import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import { listModels } from "@/lib/catalog";
import {
  DEFAULT_MODEL_ID,
  formatEur,
  modelKind,
  modelKindLabel,
  modelRouteSuffix,
  modelStatusLabel,
  SUNLIGHT_VOICES,
} from "@/lib/models";
import { chatSnippets, decisionSnippets, realtimeSnippets, speechSnippets } from "@/lib/snippets";
import styles from "./docs.module.css";
import { apiBaseUrl, publicPage } from "@/lib/site";

// Re-read the model catalog every 5 minutes so changes need no redeploy.
export const revalidate = 300;

export const metadata: Metadata = publicPage(
  "/docs",
  "API docs",
  "Call Sunlight chat, realtime voice, text-to-speech and decision models with OpenAI SDKs or REST: quickstart, deployments, pricing, rate limits and error codes.",
);

const SECTIONS = [
  ["quickstart", "Quickstart"],
  ["deployments", "Deployments"],
  ["pricing", "Pricing"],
  ["authentication", "Authentication"],
  ["chat", "Chat completions"],
  ["streaming", "Streaming"],
  ["realtime", "Realtime voice"],
  ["tts", "Text to speech"],
  ["decisions", "Decisions"],
  ["models", "Models"],
  ["errors", "Errors and limits"],
] as const;

export default async function DocsPage() {
  const models = await listModels();
  return (
    <div className={`y-container ${styles.page}`}>
      <nav className={styles.rail} aria-label="Docs sections">
        <p className={styles.railTitle}>API reference</p>
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className={styles.railLink}>{label}</a>
        ))}
      </nav>

      <div className={styles.content}>
        <section id="quickstart" className={styles.section}>
          <h1 className="y-title">Quickstart</h1>
          <p className="y-lead">
            Deploy a Sunlight model in your project and call it with any OpenAI SDK or plain HTTPS. Each deployment gets its own endpoint URL, defaults and rate limits.
          </p>
          <ol>
            <li><Link href="/signup">Create an account</Link> and a <Link href="/dashboard/projects">project</Link>.</li>
            <li>In the project, choose <strong>Deploy a model</strong> and pick a chat, realtime voice, speech or decision model.</li>
            <li>Create an API key for the same project under <Link href="/dashboard/keys">API keys</Link>. It is shown once.</li>
            <li>Store it as <code className={styles.inline}>YAVQO_API_KEY</code> and run one of the examples below.</li>
          </ol>
          <CodeBlock snippets={chatSnippets(`${apiBaseUrl}/deployments/your-deployment`, "your-deployment")} />
        </section>

        <section id="deployments" className={styles.section}>
          <h2 className="y-feature">Deployments</h2>
          <p>
            A deployment is your own instance of a base model inside one project. It has a slug in the API (for example{" "}
            <code className={styles.inline}>support-bot-3f9a1c</code>), optional instructions, default voice or generation settings, and its own rate limits.
          </p>
          <ul>
            <li>Chat deployments live at <code className={styles.inline}>{apiBaseUrl}/deployments/&lt;name&gt;/chat/completions</code>.</li>
            <li>Realtime voice deployments mint session tokens at <code className={styles.inline}>{apiBaseUrl}/deployments/&lt;name&gt;/realtime/sessions</code>.</li>
            <li>Text-to-speech deployments synthesise audio at <code className={styles.inline}>{apiBaseUrl}/deployments/&lt;name&gt;/audio/speech</code>.</li>
            <li>Decision deployments evaluate questions at <code className={styles.inline}>{apiBaseUrl}/deployments/&lt;name&gt;/decisions</code>.</li>
            <li>Keys only work with deployments in their own project.</li>
            <li>A paused deployment returns 409 until you resume it. A deleted one returns 404. A deployment suspended by Yavqo returns 403.</li>
            <li>
              Each deployment enforces requests per minute (default 60, up to 10,000) and tokens per minute (default 200,000, up to 10,000,000)
              per calendar minute. Change them in the deployment&apos;s settings.
            </li>
          </ul>
          <p>
            Responses include <code className={styles.inline}>x-ratelimit-limit-requests</code>, <code className={styles.inline}>x-ratelimit-remaining-requests</code>,{" "}
            <code className={styles.inline}>x-ratelimit-limit-tokens</code>, <code className={styles.inline}>x-ratelimit-remaining-tokens</code> and matching reset headers.
          </p>
        </section>

        <section id="pricing" className={styles.section}>
          <h2 className="y-feature">Pricing</h2>
          <p>
            Chat, text-to-speech and decision models are billed per 1M tokens in EUR. Realtime voice sessions are billed per minute of session window. Failed requests are not charged.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Model</th><th>Type</th><th>Input / Session</th><th>Output</th></tr></thead>
              <tbody>
                {models.filter((m) => m.is_active).map((m) => {
                  const kind = modelKind(m);
                  return (
                    <tr key={m.id}>
                      <td>{m.id}{m.is_legacy ? " (Legacy)" : ""}</td>
                      <td>{modelKindLabel(m)}</td>
                      <td>
                        {kind === "realtime"
                          ? `${formatEur(Number(m.price_per_minute ?? 0.04))} / min`
                          : `${formatEur(Number(m.input_price_per_mtok))} / 1M tokens`}
                      </td>
                      <td>
                        {kind === "realtime"
                          ? "Included"
                          : kind === "decision"
                            ? "€0.00 (0 output tokens)"
                            : `${formatEur(Number(m.output_price_per_mtok))} / 1M tokens`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>Chat and decision responses include a <code className={styles.inline}>usage</code> object; speech responses report token counts in <code className={styles.inline}>x-yavqo-prompt-tokens</code> and <code className={styles.inline}>x-yavqo-completion-tokens</code> headers.</p>
        </section>

        <section id="authentication" className={styles.section}>
          <h2 className="y-feature">Authentication</h2>
          <p>
            Send your key in the <code className={styles.inline}>Authorization</code> header as a bearer token. Keys start with{" "}
            <code className={styles.inline}>yavqo_live_</code>. Keep them on your server; never ship them in browser or mobile code. For browser voice clients, mint a single-use token via <code className={styles.inline}>/realtime/sessions</code>.
          </p>
          <CodeBlock title="Header" snippets={[{ label: "Header", code: "Authorization: Bearer yavqo_live_…" }]} />
        </section>

        <section id="chat" className={styles.section}>
          <h2 className="y-feature">Chat completions</h2>
          <p><code className={styles.inline}>POST /api/v1/deployments/&lt;name&gt;/chat/completions</code> or <code className={styles.inline}>POST /api/v1/chat/completions</code></p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Field</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td>model</td><td>A chat deployment slug or base model ID (<code className={styles.inline}>sunlight-2.1-pro</code>, <code className={styles.inline}>sunlight-2.1</code>). Optional on a deployment endpoint.</td></tr>
                <tr><td>messages</td><td>Required. Array of <code>{"{ role, content }"}</code> with roles system, user or assistant.</td></tr>
                <tr><td>stream</td><td>Optional. Set to true to receive server-sent events.</td></tr>
                <tr><td>temperature</td><td>Optional. 0 to 2. Lower is more focused.</td></tr>
                <tr><td>max_tokens</td><td>Optional. Upper limit for the reply length.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="streaming" className={styles.section}>
          <h2 className="y-feature">Streaming</h2>
          <p>With <code className={styles.inline}>stream: true</code> the reply arrives as server-sent events, one chunk per line, ending with <code className={styles.inline}>data: [DONE]</code>.</p>
          <CodeBlock
            snippets={[
              {
                label: "TypeScript",
                code: `const stream = await client.chat.completions.create({
  model: "${DEFAULT_MODEL_ID}",
  messages: [{ role: "user", content: "Tell me a short story." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`,
              },
              {
                label: "curl",
                code: `curl -N ${apiBaseUrl}/chat/completions \\
  -H "Authorization: Bearer $YAVQO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${DEFAULT_MODEL_ID}","stream":true,"messages":[{"role":"user","content":"Hello"}]}'`,
              },
            ]}
          />
        </section>

        <section id="realtime" className={styles.section}>
          <h2 className="y-feature">Realtime voice</h2>
          <p>
            <code className={styles.inline}>POST /api/v1/deployments/&lt;name&gt;/realtime/sessions</code> or <code className={styles.inline}>POST /api/v1/realtime/sessions</code>
          </p>
          <p>
            <strong>Sunlight 1.1 Realtime</strong> (<code className={styles.inline}>sunlight-1.1-realtime</code>) supports low-latency, two-way voice conversations with extended thinking and barge-in. Call this endpoint from your backend to mint a single-use ephemeral token locked to your deployment&apos;s model, voice and system instructions, then hand the token and <code className={styles.inline}>websocket_url</code> to your client.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Field</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td>model</td><td><code className={styles.inline}>sunlight-1.1-realtime</code> or a deployment slug. Optional on a deployment endpoint.</td></tr>
                <tr><td>voice</td><td>Optional. Voice name (defaults to the deployment&apos;s voice or <code className={styles.inline}>Kore</code>).</td></tr>
                <tr><td>instructions</td><td>Optional. Additional system instructions appended to the deployment&apos;s system prompt.</td></tr>
                <tr><td>temperature</td><td>Optional. 0 to 2.</td></tr>
                <tr><td>thinking_effort</td><td>Optional. <code className={styles.inline}>minimal</code>, <code className={styles.inline}>low</code>, <code className={styles.inline}>medium</code> or <code className={styles.inline}>high</code> (defaults to <code className={styles.inline}>high</code>).</td></tr>
                <tr><td>ttl_minutes</td><td>Optional. Session lifetime in minutes (1 to 60, default 15). New connections must open within 2 minutes.</td></tr>
                <tr><td>modalities</td><td>Optional. Array containing <code className={styles.inline}>AUDIO</code> and/or <code className={styles.inline}>TEXT</code>. Defaults to <code className={styles.inline}>[&quot;AUDIO&quot;]</code>.</td></tr>
              </tbody>
            </table>
          </div>
          <CodeBlock snippets={realtimeSnippets(apiBaseUrl, "sunlight-1.1-realtime")} />
        </section>

        <section id="tts" className={styles.section}>
          <h2 className="y-feature">Text to speech</h2>
          <p>
            <code className={styles.inline}>POST /api/v1/deployments/&lt;name&gt;/audio/speech</code> or <code className={styles.inline}>POST /api/v1/audio/speech</code>
          </p>
          <p>
            <strong>Sunlight 1 TTS</strong> (<code className={styles.inline}>sunlight-1-tts</code>) uses an OpenAI-compatible <code className={styles.inline}>/audio/speech</code> endpoint and returns binary <code className={styles.inline}>audio/wav</code> (24 kHz 16-bit mono PCM in a WAV container) or raw <code className={styles.inline}>audio/pcm</code>.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Field</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td>model</td><td><code className={styles.inline}>sunlight-1-tts</code> or a TTS deployment slug. Optional on a deployment endpoint.</td></tr>
                <tr><td>input</td><td>Required. Text to speak (up to 20,000 characters).</td></tr>
                <tr><td>voice</td><td>Optional. Prebuilt voice name such as {SUNLIGHT_VOICES.slice(0, 6).join(", ")} (defaults to deployment voice or <code className={styles.inline}>Kore</code>).</td></tr>
                <tr><td>instructions</td><td>Optional. Style, accent or pacing direction prepended to the request.</td></tr>
                <tr><td>response_format</td><td>Optional. <code className={styles.inline}>wav</code> (default) or <code className={styles.inline}>pcm</code>.</td></tr>
              </tbody>
            </table>
          </div>
          <CodeBlock snippets={speechSnippets(apiBaseUrl, "sunlight-1-tts")} />
        </section>

        <section id="decisions" className={styles.section}>
          <h2 className="y-feature">Decisions</h2>
          <p>
            <code className={styles.inline}>POST /api/v1/deployments/&lt;name&gt;/decisions</code> or <code className={styles.inline}>POST /api/v1/decisions</code>
          </p>
          <p>
            <strong>Sunlight Decision</strong> (<code className={styles.inline}>sunlight-decision</code>) evaluates up to 1,000 structured questions against one input (up to 256K tokens) in a single forward pass. It returns calibrated probabilities and confidence scores with <strong>0 output tokens</strong>.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Question type</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td>noul</td><td>Yes/no check. Returns a calibrated probability (<code className={styles.inline}>0.01</code>–<code className={styles.inline}>0.99</code>) and <code className={styles.inline}>confidence</code>.</td></tr>
                <tr><td>choice</td><td>Single-select across 2 to 255 named criteria. Returns winning <code className={styles.inline}>choice</code>, per-option <code className={styles.inline}>probabilities</code> and <code className={styles.inline}>confidence</code>.</td></tr>
                <tr><td>score</td><td>Ordered rubric of 2 to 255 levels. Returns weighted <code className={styles.inline}>score</code>, <code className={styles.inline}>legend</code>, per-level <code className={styles.inline}>probabilities</code> and <code className={styles.inline}>confidence</code>.</td></tr>
              </tbody>
            </table>
          </div>
          <CodeBlock snippets={decisionSnippets(apiBaseUrl, "sunlight-decision")} />
        </section>

        <section id="models" className={styles.section}>
          <h2 className="y-feature">Models</h2>
          <p><code className={styles.inline}>GET /api/v1/models</code> lists the base models and your project&apos;s active deployments.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Endpoint</th><th>Status</th></tr></thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>{m.display_name}</td>
                    <td>{modelKindLabel(m)}</td>
                    <td><code className={styles.inline}>{modelRouteSuffix(modelKind(m))}</code></td>
                    <td>{modelStatusLabel(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="errors" className={styles.section}>
          <h2 className="y-feature">Errors and limits</h2>
          <p>Errors use the OpenAI shape: <code className={styles.inline}>{"{ error: { message, type, code } }"}</code>.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td>400</td><td>The request body is not valid, or the model was called on the wrong endpoint (for example calling <code className={styles.inline}>/chat/completions</code> with a TTS model).</td></tr>
                <tr><td>401</td><td>The key is missing, wrong or revoked.</td></tr>
                <tr><td>404</td><td>The model or deployment does not exist in this key&apos;s project.</td></tr>
                <tr><td>403</td><td>The deployment is suspended by Yavqo. The message includes the reason. Contact Yavqo support.</td></tr>
                <tr><td>409</td><td>The deployment is paused.</td></tr>
                <tr><td>429</td><td>A rate limit was hit: the deployment&apos;s requests or tokens per minute, or 60 requests per minute per key when calling a base model directly. Wait for the Retry-After seconds.</td></tr>
                <tr><td>502, 503</td><td>The model service is unavailable. Retry with backoff.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
