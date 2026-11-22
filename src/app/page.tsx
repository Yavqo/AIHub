import Link from "next/link";
import { ButtonLink } from "@/components/Button/Button";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import StatusChip from "@/components/StatusChip/StatusChip";
import { listModels } from "@/lib/catalog";
import {
  DEFAULT_MODEL_ID,
  formatEur,
  isDeployableModel,
  modelKind,
  modelKindLabel,
  modelStatusLabel,
  modelStatusTone,
} from "@/lib/models";
import { apiBaseUrl, appUrl, siteDescription, siteName } from "@/lib/site";
import { chatSnippets } from "@/lib/snippets";
import styles from "./page.module.css";

// Re-read the model catalog every 5 minutes so changes need no redeploy.
export const revalidate = 300;

export default async function Home() {
  const models = await listModels();
  const deployable = models.filter(isDeployableModel);

  // Structured data so search engines understand AIHub as Yavqo's AI API product.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": "https://yavqo.com/#organization", name: "Yavqo", url: "https://yavqo.com", logo: `${appUrl}/brand/yavqo-mark-512.png` },
      { "@type": "WebSite", "@id": `${appUrl}/#website`, url: appUrl, name: siteName, publisher: { "@id": "https://yavqo.com/#organization" } },
      {
        "@type": "WebAPI",
        name: `${siteName} API`,
        description: siteDescription,
        url: appUrl,
        documentation: `${appUrl}/docs`,
        provider: { "@id": "https://yavqo.com/#organization" },
        offers: deployable.map((m) => ({
          "@type": "Offer",
          name: m.display_name,
          priceCurrency: m.currency,
          priceSpecification:
            modelKind(m) === "realtime"
              ? [{ "@type": "UnitPriceSpecification", price: Number(m.price_per_minute ?? 0.04), priceCurrency: m.currency, unitText: "1 minute" }]
              : [
                  { "@type": "UnitPriceSpecification", price: Number(m.input_price_per_mtok), priceCurrency: m.currency, unitText: "1M input tokens" },
                  { "@type": "UnitPriceSpecification", price: Number(m.output_price_per_mtok), priceCurrency: m.currency, unitText: "1M output tokens" },
                ],
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className={styles.hero}>
        <div className={`y-container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 className="y-h1">Sunlight 2.1 and 2.1 Pro, deployed per project</h1>
            <p className={`y-lead ${styles.heroLead}`}>
              Create an OpenAI-compatible endpoint for your app with its own system prompt, token limits and API keys. Billed monthly in EUR per million tokens.
            </p>
            <div className={styles.actions}>
              <ButtonLink href="/signup" size="large">Create account</ButtonLink>
              <ButtonLink href="/docs" variant="outline" size="large">API reference</ButtonLink>
              <ButtonLink href="/playground" variant="secondary" size="large">Open playground</ButtonLink>
            </div>
            <div className={styles.heroMeta}>
              <span>Base URL <strong>{apiBaseUrl}</strong></span>
              <span>Key prefix <strong>yavqo_live_</strong></span>
              <span>Default limits <strong>60 RPM / 200K TPM</strong></span>
            </div>
          </div>

          <div className={styles.console} aria-label="Example deployment API call">
            <div className={styles.consoleBar}>
              <div className={styles.consolePath}>
                <span className={styles.method}>POST</span>
                <span>/api/v1/deployments/support-bot-3f9a1c/chat/completions</span>
              </div>
              <StatusChip tone="positive" onMedia>200 OK</StatusChip>
            </div>
            <div className={styles.pane}>
              <div className={styles.paneLabel}>
                <span>Request</span>
                <span>application/json</span>
              </div>
              <pre className={styles.paneCode}>{`{
  "model": "support-bot-3f9a1c",
  "messages": [
    { "role": "user", "content": "Summarise the refund policy in two lines." }
  ],
  "stream": true
}`}</pre>
            </div>
            <div className={styles.pane}>
              <div className={styles.paneLabel}>
                <span>Streamed response</span>
                <span>{models.find((m) => m.id === DEFAULT_MODEL_ID)?.display_name ?? "Sunlight 2.1 Pro"}</span>
              </div>
              <p className={styles.answer}>
                Full refunds are issued within 14 days of purchase if the order is unused.<br />
                Contact support with your order number to start a return. <span>▍</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="y-section y-section--soft">
        <div className="y-container">
          <div className="y-section-head">
            <h2 className="y-h2">Models and per-token pricing</h2>
            <p className="y-lead">
              All rates are in EUR per 1M tokens. A deployment&apos;s system prompt counts as input tokens, and failed requests are not charged.
            </p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.modelTable}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>API ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Input / Session</th>
                  <th>Output</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => {
                  const kind = modelKind(m);
                  const docsHref =
                    kind === "tts"
                      ? "/docs#tts"
                      : kind === "decision"
                        ? "/docs#decisions"
                        : kind === "realtime"
                          ? "/docs#realtime"
                          : "/docs";
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className={styles.modelName}>{m.display_name}</span>
                        <span className={styles.modelDesc}>{m.description}</span>
                      </td>
                      <td className={styles.modelId}>{m.id}</td>
                      <td>{modelKindLabel(m)}</td>
                      <td>
                        <StatusChip tone={modelStatusTone(m)}>{modelStatusLabel(m)}</StatusChip>
                      </td>
                      <td className={styles.priceCell}>
                        {kind === "realtime"
                          ? `${formatEur(Number(m.price_per_minute ?? 0.04))} / min`
                          : `${formatEur(Number(m.input_price_per_mtok))} / 1M`}
                      </td>
                      <td className={styles.priceCell}>
                        {kind === "realtime"
                          ? "Included"
                          : kind === "decision"
                            ? "€0.00"
                            : `${formatEur(Number(m.output_price_per_mtok))} / 1M`}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {isDeployableModel(m) ? (
                            <>
                              <Link href="/dashboard/projects">Deploy</Link>
                              {kind === "chat" ? (
                                <Link href={`/playground?model=${m.id}`}>Playground</Link>
                              ) : (
                                <Link href={docsHref}>Docs</Link>
                              )}
                            </>
                          ) : (
                            <Link href="/models">Details</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.tableNote}>
            Legacy models stay online for existing deployments so running applications do not break, but cannot be chosen for new deployments.
          </p>
        </div>
      </section>

      <section className="y-section">
        <div className="y-container">
          <div className={styles.archGrid}>
            <div className={styles.archIntro}>
              <h2 className="y-h2">How AIHub is structured</h2>
              <p className="y-lead">
                Deployments, keys, rate limits and charges all belong to a project so separate apps never share credentials or spend.
              </p>
            </div>
            <div className={styles.specList}>
              <div className={styles.specRow}>
                <p className={styles.specTitle}>Deployment endpoints</p>
                <p className={styles.specBody}>
                  Each deployment receives a slug such as <code>support-bot-3f9a1c</code> at <code>/api/v1/deployments/&lt;slug&gt;</code>. Its system prompt is prepended to every request, while request-level <code>temperature</code> and <code>max_tokens</code> override deployment defaults.
                </p>
              </div>
              <div className={styles.specRow}>
                <p className={styles.specTitle}>Project-level API keys</p>
                <p className={styles.specBody}>
                  Keys use the <code>yavqo_live_</code> prefix, are shown once at creation, and only authorise calls to deployments inside their own project. Revoking a key takes effect immediately.
                </p>
              </div>
              <div className={styles.specRow}>
                <p className={styles.specTitle}>Per-deployment rate limits</p>
                <p className={styles.specBody}>
                  Every deployment enforces requests per minute (default 60, up to 10,000) and tokens per minute (default 200,000, up to 10,000,000) per calendar minute, returned in <code>x-ratelimit-*</code> headers.
                </p>
              </div>
              <div className={styles.specRow}>
                <p className={styles.specTitle}>Usage logs and EUR billing</p>
                <p className={styles.specBody}>
                  Every response includes a clean <code>usage</code> object with prompt and completion tokens. Monthly charges are broken down by project and deployment in your dashboard, with promotional credits applied oldest first.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="y-section y-section--soft">
        <div className="y-container">
          <div className="y-section-head">
            <h2 className="y-h2">Calling a deployment</h2>
            <p className="y-lead">
              Point any OpenAI SDK at your deployment base URL and pass a project key in the Authorization header.
            </p>
          </div>
          <div className={styles.setupGrid}>
            <CodeBlock snippets={chatSnippets(`${apiBaseUrl}/deployments/support-bot-3f9a1c`, "support-bot-3f9a1c")} />
            <ol className={styles.stepList}>
              {[
                ["01", "Create a project", "Group deployments, API keys and monthly spend for one application or environment."],
                ["02", "Deploy Sunlight 2.1 or 2.1 Pro", "Set an optional system prompt, temperature, max tokens and RPM/TPM caps."],
                ["03", "Issue a project key", "Generate a yavqo_live_ key under API keys and store it as YAVQO_API_KEY on your server."],
                ["04", "Send chat completions", "Use the deployment URL as your SDK baseURL, or call /api/v1/chat/completions directly."],
              ].map(([num, title, body]) => (
                <li key={num} className={styles.step}>
                  <span className={styles.stepNum}>{num}</span>
                  <div>
                    <p className={styles.stepTitle}>{title}</p>
                    <p className={styles.stepBody}>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="y-section">
        <div className={`y-container ${styles.closing}`}>
          <div className={styles.closingCopy}>
            <h2 className="y-title">Open a project on Yavqo AIHub</h2>
            <p className="y-lead">Test Sunlight 2.1 and 2.1 Pro in the playground or create an account to deploy your first endpoint.</p>
          </div>
          <div className={styles.actions}>
            <ButtonLink href="/signup" size="large">Create account</ButtonLink>
            <ButtonLink href="/docs" variant="outline" size="large">Read API docs</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
