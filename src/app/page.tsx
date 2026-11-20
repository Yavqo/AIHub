import { ButtonLink } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import Icon, { type IconName } from "@/components/Icon/Icon";
import StatusChip from "@/components/StatusChip/StatusChip";
import { listModels } from "@/lib/catalog";
import { DEFAULT_MODEL_ID, formatEur, isDeployableModel, modelStatusLabel, modelStatusTone } from "@/lib/models";
import { apiBaseUrl, appUrl, siteDescription, siteName } from "@/lib/site";
import { chatSnippets } from "@/lib/snippets";
import styles from "./page.module.css";

// Re-read the model catalog every 5 minutes so changes need no redeploy.
export const revalidate = 300;

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  { icon: "rocket", title: "Deploy in your project", body: "Pick a Sunlight model, give it a system prompt and defaults, and get your own dedicated endpoint." },
  { icon: "key", title: "Scoped project keys", body: "API keys are isolated to their project's deployments. Rotate or revoke any key in one click." },
  { icon: "euro", title: "Transparent EUR billing", body: "Pay strictly for the tokens each request uses, with real-time spend tracking per deployment." },
];

const TRUST_POINTS = [
  { title: "OpenAI-compatible", sub: "Drop-in SDK support" },
  { title: "Dedicated endpoints", sub: "Per-deployment defaults" },
  { title: "Rate limit controls", sub: "Custom RPM & TPM caps" },
  { title: "EUR per-token pricing", sub: "Failed requests are free" },
];

export default async function Home() {
  const models = await listModels();

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
        offers: models
          .filter(isDeployableModel)
          .map((m) => ({
            "@type": "Offer",
            name: m.display_name,
            priceCurrency: m.currency,
            priceSpecification: [
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
        <div className={`y-container ${styles.heroInner}`}>
          <p className={`${styles.eyebrow} y-reveal`}>
            <span className={styles.eyebrowDot} aria-hidden />
            Yavqo AIHub · Sunlight 2.1 &amp; 2.1 Pro now deployable
          </p>
          <h1 className="y-h1 y-reveal">
            Build with <span className={styles.heroAccent}>Sunlight</span>
          </h1>
          <p className={`y-lead ${styles.heroLead} y-reveal`}>
            Deploy Sunlight models in your own project, get an OpenAI-compatible endpoint for your app, and pay only for the tokens you use.
          </p>
          <div className={`${styles.actions} y-reveal`}>
            <ButtonLink href="/signup" size="large">Get API key</ButtonLink>
            <ButtonLink href="/playground" variant="outline" size="large">Try the playground</ButtonLink>
          </div>

          <div className={`${styles.console} y-reveal`} aria-label="Example request and response">
            <div className={styles.consoleBar}>
              <div className={styles.consolePath}>
                <span className={styles.method}>POST</span>
                <span>/api/v1/deployments/support-bot-3f9a1c/chat/completions</span>
              </div>
              <StatusChip tone="positive" onMedia>200 OK</StatusChip>
            </div>
            <div className={styles.consoleGrid}>
              <div className={styles.pane}>
                <div className={styles.paneLabel}>
                  <span>Request body</span>
                  <span>JSON</span>
                </div>
                <pre className={styles.paneCode}>{`{
  "model": "support-bot-3f9a1c",
  "messages": [
    {
      "role": "user",
      "content": "Name three uses for a solar lamp."
    }
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
                  1. Path lighting that charges by day.<br />
                  2. A camping light with no batteries to carry.<br />
                  3. A backup lamp for power cuts. <span>▍</span>
                </p>
              </div>
            </div>
          </div>

          <div className={`${styles.trustStrip} y-reveal`}>
            {TRUST_POINTS.map((item) => (
              <div key={item.title} className={styles.trustItem}>
                <p className={styles.trustTitle}>{item.title}</p>
                <p className={styles.trustSub}>{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="y-section y-section--soft">
        <div className="y-container">
          <div className="y-section-head">
            <h2 className="y-h2">Your model, your endpoint</h2>
            <p className="y-lead">AIHub manages the infrastructure, keys, rate limits and billing. You shape how it answers.</p>
          </div>
          <div className={styles.benefits}>
            {BENEFITS.map((b) => (
              <Card key={b.title} className={styles.benefit}>
                <span className={styles.benefitIcon}><Icon name={b.icon} /></span>
                <h3 className="y-sub">{b.title}</h3>
                <p className={styles.benefitBody}>{b.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="y-section">
        <div className="y-container">
          <div className="y-section-head">
            <h2 className="y-h2">Your first call in minutes</h2>
            <p className="y-lead">Three steps from sign-up to a production deployment endpoint.</p>
          </div>
          <div className={styles.steps}>
            <ol className={styles.stepList}>
              {[
                ["Create a project", "Sign in and make a project. It holds your deployments, keys and charges."],
                ["Deploy a model", "Choose Sunlight 2.1 or 2.1 Pro, add a system prompt and get an endpoint for the deployment."],
                ["Call your endpoint", "Create a key, point any OpenAI-compatible SDK at the endpoint and start building."],
              ].map(([title, body], i) => (
                <li key={title} className={styles.step}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <div>
                    <p className={styles.stepTitle}>{title}</p>
                    <p className={styles.stepBody}>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <CodeBlock snippets={chatSnippets(`${apiBaseUrl}/deployments/support-bot-3f9a1c`, "support-bot-3f9a1c")} />
          </div>
        </div>
      </section>

      <section className="y-section y-section--soft">
        <div className="y-container">
          <div className="y-section-head">
            <h2 className="y-h2">{models.length === 1 ? "Meet the model" : "Sunlight models"}</h2>
            <p className="y-lead">{models.length === 1 ? "One model, ready for your app today." : "Pick the right balance of speed and reasoning for your workload."}</p>
          </div>
          <div className={`${styles.models} ${models.length === 1 ? styles.modelsSingle : ""}`}>
            {models.map((m) => (
              <article key={m.id} className={`${styles.modelCard} ${m.is_legacy ? styles.modelCardLegacy : ""}`}>
                <div className={styles.modelHead}>
                  <span className={styles.modelId}>{m.id}</span>
                  <StatusChip tone={modelStatusTone(m)}>{modelStatusLabel(m)}</StatusChip>
                </div>
                <h3 className={styles.modelTitle}>{m.display_name}</h3>
                <p className={styles.modelDesc}>{m.description}</p>
                <div className={styles.modelPricing}>
                  <div className={styles.priceCell}>
                    <span className={styles.priceLabel}>Input / 1M</span>
                    <span className={styles.priceVal}>{formatEur(Number(m.input_price_per_mtok))}</span>
                  </div>
                  <div className={styles.priceCell}>
                    <span className={styles.priceLabel}>Output / 1M</span>
                    <span className={styles.priceVal}>{formatEur(Number(m.output_price_per_mtok))}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  {isDeployableModel(m) ? (
                    <>
                      <ButtonLink href="/dashboard/projects">Deploy</ButtonLink>
                      <ButtonLink href={`/playground?model=${m.id}`} variant="outline">Playground</ButtonLink>
                    </>
                  ) : (
                    <ButtonLink href="/models" variant="outline">View details</ButtonLink>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="y-section">
        <div className="y-container">
          <div className={styles.ctaBanner}>
            <h2 className="y-h2">Start building today</h2>
            <p className="y-lead">Create an account and deploy your first model in minutes. You only pay for what you use.</p>
            <div className={styles.actions}>
              <ButtonLink href="/signup" size="large">Get API key</ButtonLink>
              <ButtonLink href="/docs" variant="outline" size="large">Read the docs</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
