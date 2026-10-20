import { ButtonLink } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import Icon, { type IconName } from "@/components/Icon/Icon";
import StatusChip from "@/components/StatusChip/StatusChip";
import { listModels } from "@/lib/catalog";
import { DEFAULT_MODEL_ID, formatEur } from "@/lib/models";
import { apiBaseUrl } from "@/lib/site";
import { chatSnippets } from "@/lib/snippets";
import styles from "./page.module.css";

// Re-read the model catalog every 5 minutes so changes need no redeploy.
export const revalidate = 300;

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  { icon: "rocket", title: "Deploy in your project", body: "Pick a Sunlight model, give it a system prompt and defaults, and get your own endpoint." },
  { icon: "key", title: "Keys per project", body: "Your keys call your project's deployments. Revoke one in a single step." },
  { icon: "euro", title: "Pay per token", body: "Each request is charged for the tokens it used. See the cost per deployment as it happens." },
];

const GLYPH = `{\n  "model": "sunlight",\n  "stream": true\n}`;

export default async function Home() {
  const models = await listModels();

  return (
    <>
      <section className={styles.hero}>
        <div className={`y-container ${styles.heroInner}`}>
          <p className={`${styles.eyebrow} y-reveal`}>Yavqo AIHub</p>
          <h1 className="y-h1 y-reveal">Build with Sunlight</h1>
          <p className={`y-lead ${styles.heroLead} y-reveal`}>
            Deploy Sunlight in your own project, get an endpoint for your app and pay only for the tokens you use.
          </p>
          <div className={`${styles.actions} y-reveal`}>
            <ButtonLink href="/signup" size="large">Get API key</ButtonLink>
            <ButtonLink href="/playground" variant="secondary" size="large">Try the playground</ButtonLink>
          </div>

          <div className={`${styles.console} y-reveal`} aria-label="Example request and response">
            <div className={styles.pane}>
              <div className={styles.paneLabel}>
                <span>POST …/deployments/support-bot-3f9a1c/chat/completions</span>
                <StatusChip tone="positive" onMedia>200</StatusChip>
              </div>
              <pre className={styles.paneCode}>{`{
  "model": "support-bot-3f9a1c",
  "messages": [
    { "role": "user",
      "content": "Name three uses for a solar lamp." }
  ],
  "stream": true
}`}</pre>
            </div>
            <div className={styles.pane}>
              <div className={styles.paneLabel}>
                <span>Response</span>
                <span>{models.find((m) => m.id === DEFAULT_MODEL_ID)?.display_name ?? "Sunlight"}</span>
              </div>
              <p className={styles.answer}>
                1. Path lighting that charges by day.<br />
                2. A camping light with no batteries to carry.<br />
                3. A backup lamp for power cuts. <span>▍</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="y-section y-section--soft">
        <div className="y-container">
          <div className="y-section-head">
            <h2 className="y-h2">Your model, your endpoint</h2>
            <p className="y-lead">AIHub runs the model, the keys and the billing. You shape how it answers.</p>
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
            <p className="y-lead">Three steps from sign-up to your own endpoint.</p>
          </div>
          <div className={styles.steps}>
            <ol className={styles.stepList}>
              {[
                ["Create a project", "Sign in and make a project. It holds your deployments, keys and charges."],
                ["Deploy a model", "Choose Sunlight 2 Pro, add a system prompt and get an endpoint for the deployment."],
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
            <p className="y-lead">{models.length === 1 ? "One model, ready for your app today." : "Pick the model that fits the job."}</p>
          </div>
          <div className={`${styles.models} ${models.length === 1 ? styles.modelsSingle : ""}`}>
            {models.map((m) => (
              <article key={m.id} className={styles.modelCard}>
                <div className={styles.chipRow}>
                  <StatusChip tone={m.is_active ? "positive" : "neutral"} onMedia>{m.is_active ? "Live" : "Coming soon"}</StatusChip>
                </div>
                <div className={styles.modelGlyph} aria-hidden>{GLYPH.replace("sunlight", m.id)}</div>
                <p className={styles.modelEyebrow}>
                  {m.description} {formatEur(Number(m.input_price_per_mtok))} per 1M input tokens, {formatEur(Number(m.output_price_per_mtok))} per 1M output.
                </p>
                <h3 className={styles.modelTitle}>{m.display_name}</h3>
                <div className={styles.actions}>
                  {m.is_active ? (
                    <>
                      <ButtonLink href="/dashboard/projects">Deploy</ButtonLink>
                      <ButtonLink href="/docs" variant="secondary">Read docs</ButtonLink>
                    </>
                  ) : (
                    <ButtonLink href="/models" variant="secondary">Learn more</ButtonLink>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="y-section">
        <div className={`y-container ${styles.cta}`}>
          <h2 className="y-h2">Start building today</h2>
          <p className="y-lead">Create an account and deploy your first model. You only pay for what you use.</p>
          <div className={styles.actions}>
            <ButtonLink href="/signup" size="large">Get API key</ButtonLink>
            <ButtonLink href="/docs" variant="outline" size="large">Read the docs</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
