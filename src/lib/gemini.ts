import "server-only";
import { after } from "next/server";
import { z } from "zod";
import type { Target } from "@/lib/deployments";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/errors";
import type { Caller } from "@/lib/gateway";
import { costEur, DEFAULT_VOICE, modelKind, modelRouteSuffix, sessionCostEur } from "@/lib/models";
import { addDeploymentTokens, takeDeploymentSlot } from "@/lib/ratelimit";
import { recordUsage, type UsageEntry } from "@/lib/usage";

const LIVE_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

function geminiBaseUrl(model: Target["model"]): string {
  return (model.upstream_base_url?.trim() || serverEnv.geminiBaseUrl).replace(/\/$/, "");
}

// Wraps raw 16-bit signed little-endian mono PCM (24 kHz from Gemini TTS) in a 44-byte WAV header.
function pcmToWav(pcm: Buffer, sampleRate = 24_000, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseSampleRate(mimeType?: string): number {
  const match = mimeType?.match(/rate=(\d+)/i);
  const parsed = match ? Number.parseInt(match[1], 10) : 24_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24_000;
}

async function parseUpstreamError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {}
  return fallback;
}

function requireKind(target: Target, expected: "tts" | "decision" | "realtime"): Response | null {
  const actual = modelKind(target.model);
  if (actual === expected) return null;
  const suffix = modelRouteSuffix(actual);
  return apiError(
    400,
    `Model '${target.deployment?.slug ?? target.model.id}' is a ${actual} model. Call ${suffix} instead.`,
    "invalid_request_error",
    "wrong_model_endpoint",
  );
}

// ---------------------------------------------------------------------------
// 1. Text to Speech (sunlight-1-tts -> gemini-3.8-flash-tts)
// ---------------------------------------------------------------------------
export const speechBodySchema = z.object({
  model: z.string().min(1).max(100).optional(),
  input: z.string().min(1).max(20_000),
  voice: z.string().trim().min(1).max(40).optional(),
  instructions: z.string().max(4_000).optional(),
  response_format: z.enum(["wav", "pcm"]).optional(),
});

export type SpeechBody = z.infer<typeof speechBodySchema>;

export async function forwardSpeech(body: SpeechBody, target: Target, caller: Caller): Promise<Response> {
  const wrong = requireKind(target, "tts");
  if (wrong) return wrong;
  if (!serverEnv.geminiApiKey) {
    return apiError(503, "Sunlight audio models are not configured on this server.", "server_error", "gateway_not_configured");
  }

  const started = Date.now();
  const { model, deployment } = target;
  const endpoint = deployment ? `/v1/deployments/${deployment.slug}/audio/speech` : "/v1/audio/speech";

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
        endpoint,
        status_code: 429,
        stream: false,
        latency_ms: Date.now() - started,
      }),
    );
    return apiError(429, message, "rate_limit_error", slot.reason === "tokens" ? "tokens_per_minute_exceeded" : "requests_per_minute_exceeded", {
      ...rl,
      "Retry-After": String(slot.retryAfter),
    });
  }

  const log = async (status: number, promptTokens?: number, completionTokens?: number) => {
    const entry: UsageEntry = {
      ...caller,
      model_id: model.id,
      deployment_id: deployment?.id ?? null,
      endpoint,
      status_code: status,
      stream: false,
      prompt_tokens: promptTokens ?? null,
      completion_tokens: completionTokens ?? null,
      latency_ms: Date.now() - started,
      cost_eur:
        promptTokens != null || completionTokens != null
          ? costEur(model, promptTokens ?? 0, completionTokens ?? 0)
          : null,
    };
    await Promise.all([
      recordUsage(entry),
      deployment && slot && (promptTokens || completionTokens)
        ? addDeploymentTokens(deployment.id, slot.window, (promptTokens ?? 0) + (completionTokens ?? 0))
        : null,
    ]);
  };

  const voice = body.voice ?? deployment?.voice ?? DEFAULT_VOICE;
  const direction = [deployment?.system_prompt, body.instructions].filter(Boolean).join("\n").trim();
  const promptText = direction ? `${direction}\n\n${body.input}` : body.input;

  let upstream: Response;
  try {
    upstream = await fetch(`${geminiBaseUrl(model)}/models/${encodeURIComponent(model.upstream_model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": serverEnv.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    });
  } catch {
    after(() => log(502));
    return apiError(502, "Could not reach the Sunlight speech service.", "server_error", "upstream_unreachable", rl);
  }

  if (!upstream.ok) {
    after(() => log(upstream.status));
    if (upstream.status === 401 || upstream.status === 403) {
      console.error("Gemini API rejected GEMINI_API_KEY (TTS)", upstream.status);
      return apiError(502, "AIHub could not authenticate with the upstream model provider.", "server_error", "gateway_auth_failed", rl);
    }
    const msg = await parseUpstreamError(upstream, "The speech service returned an error.");
    return apiError(upstream.status, msg, upstream.status === 429 ? "rate_limit_error" : "server_error", undefined, rl);
  }

  const json = (await upstream.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    after(() => log(502));
    return apiError(502, "The speech service returned no audio data.", "server_error", "empty_audio", rl);
  }

  const promptTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens = json.usageMetadata?.candidatesTokenCount ?? 0;
  const pcm = Buffer.from(inline.data, "base64");
  const format = body.response_format ?? "wav";
  const payload = format === "pcm" ? pcm : pcmToWav(pcm, parseSampleRate(inline.mimeType));

  after(() => log(200, promptTokens, completionTokens));

  return new Response(new Uint8Array(payload), {
    status: 200,
    headers: {
      "Content-Type": format === "pcm" ? "audio/pcm" : "audio/wav",
      "Content-Disposition": `inline; filename="speech.${format}"`,
      "x-yavqo-prompt-tokens": String(promptTokens),
      "x-yavqo-completion-tokens": String(completionTokens),
      ...rl,
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Decisions (sunlight-decision -> gemini-decision-1)
// ---------------------------------------------------------------------------
const questionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("noul"),
    instructions: z.string().min(1).max(4_000),
  }),
  z.object({
    type: z.literal("choice"),
    instructions: z.string().min(1).max(4_000),
    criteria: z.record(z.string().min(1), z.string().min(1)),
  }),
  z.object({
    type: z.literal("score"),
    instructions: z.string().min(1).max(4_000),
    criteria: z.array(z.string().min(1)).min(2).max(255),
  }),
]);

export const decisionBodySchema = z.object({
  model: z.string().min(1).max(100).optional(),
  input: z.union([z.string().min(1), z.array(z.unknown()).min(1)]),
  questions: z
    .record(z.string().min(1), questionSchema)
    .refine((q) => {
      const n = Object.keys(q).length;
      return n >= 1 && n <= 1_000;
    }, "Must include between 1 and 1,000 questions."),
});

export type DecisionBody = z.infer<typeof decisionBodySchema>;

export async function forwardDecision(body: DecisionBody, target: Target, caller: Caller): Promise<Response> {
  const wrong = requireKind(target, "decision");
  if (wrong) return wrong;
  if (!serverEnv.geminiApiKey) {
    return apiError(503, "Sunlight Decision is not configured on this server.", "server_error", "gateway_not_configured");
  }

  const started = Date.now();
  const { model, deployment } = target;
  const servedAs = deployment?.slug ?? model.id;
  const endpoint = deployment ? `/v1/deployments/${deployment.slug}/decisions` : "/v1/decisions";

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
        endpoint,
        status_code: 429,
        stream: false,
        latency_ms: Date.now() - started,
      }),
    );
    return apiError(429, message, "rate_limit_error", slot.reason === "tokens" ? "tokens_per_minute_exceeded" : "requests_per_minute_exceeded", {
      ...rl,
      "Retry-After": String(slot.retryAfter),
    });
  }

  const log = async (status: number, inputTokens?: number) => {
    const entry: UsageEntry = {
      ...caller,
      model_id: model.id,
      deployment_id: deployment?.id ?? null,
      endpoint,
      status_code: status,
      stream: false,
      prompt_tokens: inputTokens ?? null,
      completion_tokens: inputTokens != null ? 0 : null,
      latency_ms: Date.now() - started,
      cost_eur: inputTokens != null ? costEur(model, inputTokens, 0) : null,
    };
    await Promise.all([
      recordUsage(entry),
      deployment && slot && inputTokens ? addDeploymentTokens(deployment.id, slot.window, inputTokens) : null,
    ]);
  };

  const inputPayload =
    deployment?.system_prompt && typeof body.input === "string"
      ? `${deployment.system_prompt}\n\n${body.input}`
      : body.input;

  let upstream: Response;
  try {
    upstream = await fetch(`${geminiBaseUrl(model)}/decisions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": serverEnv.geminiApiKey,
      },
      body: JSON.stringify({
        model: model.upstream_model,
        input: inputPayload,
        questions: body.questions,
      }),
    });
  } catch {
    after(() => log(502));
    return apiError(502, "Could not reach the Sunlight Decision service.", "server_error", "upstream_unreachable", rl);
  }

  if (!upstream.ok) {
    after(() => log(upstream.status));
    if (upstream.status === 401 || upstream.status === 403) {
      console.error("Gemini API rejected GEMINI_API_KEY (Decisions)", upstream.status);
      return apiError(502, "AIHub could not authenticate with the upstream model provider.", "server_error", "gateway_auth_failed", rl);
    }
    const msg = await parseUpstreamError(upstream, "The decision service returned an error.");
    return apiError(upstream.status, msg, upstream.status === 429 ? "rate_limit_error" : "server_error", undefined, rl);
  }

  const json = (await upstream.json()) as {
    answers?: Record<string, unknown>;
    usage?: { total_input_tokens?: number; total_output_tokens?: number; total_tokens?: number };
  };

  const inputTokens = json.usage?.total_input_tokens ?? json.usage?.total_tokens ?? 0;
  after(() => log(200, inputTokens));

  return Response.json(
    {
      model: servedAs,
      answers: json.answers ?? {},
      usage: {
        input_tokens: inputTokens,
        output_tokens: 0,
        total_tokens: inputTokens,
      },
    },
    { headers: rl },
  );
}

// ---------------------------------------------------------------------------
// 3. Realtime Voice Sessions (sunlight-1.1-realtime -> gemini-3.8-live-extended-thinking)
// ---------------------------------------------------------------------------
export const realtimeSessionSchema = z.object({
  model: z.string().min(1).max(100).optional(),
  voice: z.string().trim().min(1).max(40).optional(),
  instructions: z.string().max(20_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  ttl_minutes: z.number().int().min(1).max(60).optional(),
  modalities: z.array(z.enum(["AUDIO", "TEXT"])).min(1).max(2).optional(),
});

export type RealtimeSessionBody = z.infer<typeof realtimeSessionSchema>;

export async function createRealtimeSession(body: RealtimeSessionBody, target: Target, caller: Caller): Promise<Response> {
  const wrong = requireKind(target, "realtime");
  if (wrong) return wrong;
  if (!serverEnv.geminiApiKey) {
    return apiError(503, "Sunlight Realtime is not configured on this server.", "server_error", "gateway_not_configured");
  }

  const started = Date.now();
  const { model, deployment } = target;
  const servedAs = deployment?.slug ?? model.id;
  const endpoint = deployment ? `/v1/deployments/${deployment.slug}/realtime/sessions` : "/v1/realtime/sessions";

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
        endpoint,
        status_code: 429,
        stream: true,
        latency_ms: Date.now() - started,
      }),
    );
    return apiError(429, message, "rate_limit_error", slot.reason === "tokens" ? "tokens_per_minute_exceeded" : "requests_per_minute_exceeded", {
      ...rl,
      "Retry-After": String(slot.retryAfter),
    });
  }

  const ttlMinutes = body.ttl_minutes ?? 15;
  const now = Date.now();
  const newSessionExpireTime = new Date(now + 2 * 60_000).toISOString();
  const expireTime = new Date(now + ttlMinutes * 60_000).toISOString();

  const voice = body.voice ?? deployment?.voice ?? DEFAULT_VOICE;
  const modalities = body.modalities ?? ["AUDIO"];
  const temperature = body.temperature ?? (deployment?.temperature != null ? Number(deployment.temperature) : undefined);
  const systemText = [deployment?.system_prompt, body.instructions].filter(Boolean).join("\n\n").trim();

  const liveConfig: Record<string, unknown> = {
    responseModalities: modalities,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: voice },
      },
    },
    ...(temperature != null ? { temperature } : {}),
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
  };

  const log = async (status: number) => {
    await recordUsage({
      ...caller,
      model_id: model.id,
      deployment_id: deployment?.id ?? null,
      endpoint,
      status_code: status,
      stream: true,
      prompt_tokens: null,
      completion_tokens: null,
      latency_ms: Date.now() - started,
      cost_eur: status === 200 ? sessionCostEur(model, ttlMinutes) : null,
    });
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${geminiBaseUrl(model)}/auth_tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": serverEnv.geminiApiKey,
      },
      body: JSON.stringify({
        uses: 1,
        newSessionExpireTime,
        expireTime,
        liveConnectConstraints: {
          model: `models/${model.upstream_model}`,
          config: liveConfig,
        },
      }),
    });
  } catch {
    after(() => log(502));
    return apiError(502, "Could not reach the Sunlight Realtime service.", "server_error", "upstream_unreachable", rl);
  }

  if (!upstream.ok) {
    after(() => log(upstream.status));
    if (upstream.status === 401 || upstream.status === 403) {
      console.error("Gemini API rejected GEMINI_API_KEY (Realtime)", upstream.status);
      return apiError(502, "AIHub could not authenticate with the upstream model provider.", "server_error", "gateway_auth_failed", rl);
    }
    const msg = await parseUpstreamError(upstream, "Could not create a realtime session.");
    return apiError(upstream.status, msg, upstream.status === 429 ? "rate_limit_error" : "server_error", undefined, rl);
  }

  const json = (await upstream.json()) as { name?: string };
  if (!json.name) {
    after(() => log(502));
    return apiError(502, "The realtime service did not return a session token.", "server_error", "empty_token", rl);
  }

  after(() => log(200));

  return Response.json(
    {
      id: json.name,
      object: "realtime.session",
      model: servedAs,
      token: json.name,
      websocket_url: LIVE_WS_URL,
      voice,
      modalities,
      ttl_minutes: ttlMinutes,
      expires_at: expireTime,
      new_session_expires_at: newSessionExpireTime,
    },
    { status: 201, headers: rl },
  );
}
