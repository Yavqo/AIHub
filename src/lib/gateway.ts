import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/errors";
import type { Target } from "@/lib/deployments";
import { costEur } from "@/lib/models";
import { addDeploymentTokens, takeDeploymentSlot } from "@/lib/ratelimit";
import { recordUsage, type UsageEntry } from "@/lib/usage";

const messageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant", "tool", "developer"]),
    content: z.union([z.string(), z.array(z.unknown()), z.null()]),
  })
  .passthrough();

export const chatBodySchema = z
  .object({
    model: z.string().min(1).max(100).optional(),
    messages: z.array(messageSchema).min(1).max(500),
    stream: z.boolean().optional(),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().max(32_000).optional(),
  })
  .passthrough();

export type ChatBody = z.infer<typeof chatBodySchema>;

export type Caller = {
  owner_id: string;
  project_id: string | null;
  api_key_id: string | null;
  source: "api" | "playground";
};

type Usage = { prompt_tokens?: number; completion_tokens?: number };

// Only the token counts go back to callers; the gateway's own usage block carries
// upstream cost fields that are not ours to show.
function cleanUsage(usage: Usage | null | undefined) {
  if (!usage) return undefined;
  const prompt = usage.prompt_tokens ?? 0;
  const completion = usage.completion_tokens ?? 0;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

// Deployment defaults: its system prompt goes first, and its temperature and
// max_tokens apply unless the request sets them.
function applyDeployment(body: ChatBody, target: Target): ChatBody {
  const d = target.deployment;
  if (!d) return body;
  return {
    ...body,
    temperature: body.temperature ?? (d.temperature != null ? Number(d.temperature) : undefined),
    max_tokens: body.max_tokens ?? d.max_tokens ?? undefined,
    messages: d.system_prompt ? [{ role: "system", content: d.system_prompt }, ...body.messages] : body.messages,
  };
}

export async function forwardChat(input: ChatBody, target: Target, caller: Caller): Promise<Response> {
  const started = Date.now();
  const { model, deployment } = target;
  const servedAs = deployment?.slug ?? model.id;
  const body = applyDeployment(input, target);
  if (!serverEnv.gatewayApiKey) {
    return apiError(503, "The Sunlight gateway is not configured.", "server_error", "gateway_not_configured");
  }

  const stream = body.stream === true;

  // Deployment rate limits: requests and tokens per minute, set per deployment.
  const slot = deployment ? await takeDeploymentSlot(deployment) : null;
  const rl = slot?.headers ?? {};
  if (deployment && slot && !slot.allowed) {
    const message =
      slot.reason === "tokens"
        ? `Rate limit reached for ${deployment.slug}: ${deployment.tpm_limit.toLocaleString("en")} tokens per minute. Try again in ${slot.retryAfter}s.`
        : `Rate limit reached for ${deployment.slug}: ${deployment.rpm_limit.toLocaleString("en")} requests per minute. Try again in ${slot.retryAfter}s.`;
    after(() =>
      recordUsage({
        ...caller,
        model_id: model.id,
        deployment_id: deployment.id,
        endpoint: `/v1/deployments/${deployment.slug}/chat/completions`,
        status_code: 429,
        stream,
        latency_ms: Date.now() - started,
      }),
    );
    return apiError(429, message, "rate_limit_error", slot.reason === "tokens" ? "tokens_per_minute_exceeded" : "requests_per_minute_exceeded", {
      ...rl,
      "Retry-After": String(slot.retryAfter),
    });
  }

  const log = async (status: number, usage?: Usage) => {
    const entry: UsageEntry = {
      ...caller,
      model_id: model.id,
      deployment_id: deployment?.id ?? null,
      endpoint: deployment ? `/v1/deployments/${deployment.slug}/chat/completions` : "/v1/chat/completions",
      status_code: status,
      stream,
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
      latency_ms: Date.now() - started,
      cost_eur: usage ? costEur(model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0) : null,
    };
    await Promise.all([
      recordUsage(entry),
      deployment && slot && usage
        ? addDeploymentTokens(deployment.id, slot.window, (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0))
        : null,
    ]);
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${serverEnv.gatewayBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.gatewayApiKey}`,
        ...(stream ? { Accept: "text/event-stream" } : {}),
      },
      body: JSON.stringify({ ...body, model: model.upstream_model }),
    });
  } catch {
    after(() => log(502));
    return apiError(502, "Could not reach the Sunlight gateway.", "server_error", "upstream_unreachable");
  }

  if (!upstream.ok) {
    after(() => log(upstream.status));
    // The gateway rejected AIHub's own key: a server misconfiguration, not the caller's fault.
    if (upstream.status === 401 || upstream.status === 403) {
      console.error("Sunlight gateway rejected GATEWAY_API_KEY", upstream.status);
      return apiError(502, "AIHub could not authenticate with the Sunlight gateway. The server's GATEWAY_API_KEY is wrong or out of date.", "server_error", "gateway_auth_failed", rl);
    }
    const text = await upstream.text().catch(() => "");
    let message = "The Sunlight gateway returned an error.";
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {}
    const status = upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status;
    const retryAfter = upstream.headers.get("retry-after");
    return apiError(status, message, status === 429 ? "rate_limit_error" : "server_error", undefined, retryAfter ? { ...rl, "Retry-After": retryAfter } : rl);
  }

  if (!stream) {
    const json = (await upstream.json()) as { model?: string; provider?: string; usage?: Usage };
    const usage = json.usage;
    json.model = servedAs;
    json.usage = cleanUsage(usage);
    delete json.provider;
    after(() => log(200, usage));
    return Response.json(json, { headers: rl });
  }

  if (!upstream.body) {
    after(() => log(502));
    return apiError(502, "The Sunlight gateway sent an empty stream.", "server_error");
  }

  // Pass the SSE stream through line by line, rewriting the model name and
  // picking up the usage block if the gateway sends one.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let usage: Usage | undefined;

  const rewrite = (line: string): string => {
    if (!line.startsWith("data:")) return line;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return line;
    try {
      const chunk = JSON.parse(data) as { model?: string; provider?: string; usage?: Usage | null };
      if (chunk.usage) {
        usage = chunk.usage;
        chunk.usage = cleanUsage(chunk.usage);
      }
      chunk.model = servedAs;
      delete chunk.provider;
      return `data: ${JSON.stringify(chunk)}`;
    } catch {
      return line;
    }
  };

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(bytes, controller) {
      buffer += decoder.decode(bytes, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (lines.length) controller.enqueue(encoder.encode(lines.map(rewrite).join("\n") + "\n"));
    },
    async flush(controller) {
      buffer += decoder.decode();
      if (buffer) controller.enqueue(encoder.encode(rewrite(buffer)));
      await log(200, usage);
    },
  });

  return new Response(upstream.body.pipeThrough(transform), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...rl,
    },
  });
}
