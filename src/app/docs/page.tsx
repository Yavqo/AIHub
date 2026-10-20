import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import { listModels } from "@/lib/catalog";
import { DEFAULT_MODEL_ID, formatEur } from "@/lib/models";
import { chatSnippets } from "@/lib/snippets";
import styles from "./docs.module.css";
import { apiBaseUrl, publicPage } from "@/lib/site";

// Re-read the model catalog every 5 minutes so changes need no redeploy.
export const revalidate = 300;

export const metadata: Metadata = publicPage(
  "/docs",
  "API docs",
  "Call Sunlight models with any OpenAI SDK: quickstart, deployments, streaming, pricing, rate limits and error codes for the Yavqo AIHub API.",
);

const SECTIONS = [
  ["quickstart", "Quickstart"],
  ["deployments", "Deployments"],
  ["pricing", "Pricing"],
  ["authentication", "Authentication"],
  ["chat", "Chat completions"],
  ["streaming", "Streaming"],
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
            Deploy a Sunlight model in your project and call it with any OpenAI SDK. Each deployment gets its own base URL.
          </p>
          <ol>
            <li><Link href="/signup">Create an account</Link> and a <Link href="/dashboard/projects">project</Link>.</li>
            <li>In the project, choose <strong>Deploy a model</strong>. Copy the endpoint it shows.</li>
            <li>Create an API key for the same project under <Link href="/dashboard/keys">API keys</Link>. It is shown once.</li>
            <li>Store it as <code className={styles.inline}>YAVQO_API_KEY</code> and run one of the examples below.</li>
          </ol>
          <CodeBlock snippets={chatSnippets(`${apiBaseUrl}/deployments/your-deployment`, "your-deployment")} />
        </section>

        <section id="deployments" className={styles.section}>
          <h2 className="y-feature">Deployments</h2>
          <p>
            A deployment is your own instance of a base model, inside one project. It has a name in the API (for example{" "}
            <code className={styles.inline}>support-bot-3f9a1c</code>), an optional system prompt, and default temperature and max tokens.
          </p>
          <ul>
            <li>Its endpoint is <code className={styles.inline}>{apiBaseUrl}/deployments/&lt;name&gt;</code>. Use it as the SDK base URL; <code className={styles.inline}>model</code> is optional there.</li>
            <li>You can also call <code className={styles.inline}>{apiBaseUrl}/chat/completions</code> with the deployment name as <code className={styles.inline}>model</code>.</li>
            <li>Keys only work with deployments in their own project.</li>
            <li>The system prompt is sent first. Your request&apos;s temperature and max_tokens win over the defaults.</li>
            <li>A paused deployment returns 409 until you resume it. A deleted one returns 404. A deployment suspended by Yavqo returns 403.</li>
            <li>
              Each deployment has its own rate limits: requests per minute (default 60) and tokens per minute (default 200,000),
              counted per calendar minute. Change them in the deployment&apos;s settings.
            </li>
          </ul>
          <p>
            Responses include <code className={styles.inline}>x-ratelimit-limit-requests</code>, <code className={styles.inline}>x-ratelimit-remaining-requests</code>,{" "}
            <code className={styles.inline}>x-ratelimit-limit-tokens</code>, <code className={styles.inline}>x-ratelimit-remaining-tokens</code> and matching reset headers.
          </p>
        </section>

        <section id="pricing" className={styles.section}>
          <h2 className="y-feature">Pricing</h2>
          <p>You pay per token, billed to the project that owns the deployment. The deployment&apos;s system prompt counts as input. Failed requests are free.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Model</th><th>Input, per 1M tokens</th><th>Output, per 1M tokens</th></tr></thead>
              <tbody>
                {models.filter((m) => m.is_active).map((m) => (
                  <tr key={m.id}><td>{m.id}</td><td>{formatEur(Number(m.input_price_per_mtok))}</td><td>{formatEur(Number(m.output_price_per_mtok))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Every response includes a <code className={styles.inline}>usage</code> object with prompt and completion tokens, so you can track cost per call.</p>
        </section>

        <section id="authentication" className={styles.section}>
          <h2 className="y-feature">Authentication</h2>
          <p>
            Send your key in the <code className={styles.inline}>Authorization</code> header as a bearer token. Keys start with{" "}
            <code className={styles.inline}>yavqo_live_</code>. Keep them on your server; never ship them in browser or mobile code.
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
                <tr><td>model</td><td>A deployment name or base model ID. Optional on a deployment endpoint.</td></tr>
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

        <section id="models" className={styles.section}>
          <h2 className="y-feature">Models</h2>
          <p><code className={styles.inline}>GET /api/v1/models</code> lists the base models and your project&apos;s active deployments.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Name</th><th>Status</th></tr></thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id}><td>{m.id}</td><td>{m.display_name}</td><td>{m.is_active ? "Live" : "Coming soon"}</td></tr>
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
                <tr><td>400</td><td>The request body is not valid.</td></tr>
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
