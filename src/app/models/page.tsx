import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import StatusChip from "@/components/StatusChip/StatusChip";
import { listModels } from "@/lib/catalog";
import { formatEur } from "@/lib/models";
import styles from "./models.module.css";
import { publicPage } from "@/lib/site";

// Re-read the model catalog every 5 minutes so changes need no redeploy.
export const revalidate = 300;

export const metadata: Metadata = publicPage(
  "/models",
  "Sunlight models and pricing",
  "Compare Sunlight AI models, see per-token prices in EUR and deploy one in your project with its own OpenAI-compatible endpoint.",
);

export default async function ModelsPage() {
  const models = await listModels();
  return (
    <div className={`y-container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className="y-title">Models</h1>
        <p className="y-lead">Deploy any model below into your project to get your own endpoint. You pay per token.</p>
      </div>
      <div className={styles.grid}>
        {models.map((m) => (
          <Card key={m.id} className={styles.card}>
            <div className={styles.top}>
              <span className={styles.id}>{m.id}</span>
              <StatusChip tone={m.is_active ? "positive" : "neutral"}>{m.is_active ? "Live" : "Coming soon"}</StatusChip>
            </div>
            <h2 className="y-sub">{m.display_name}</h2>
            <p className="y-muted">{m.description}</p>
            <dl className={styles.specs}>
              <div className={styles.spec}><dt>Input</dt><dd>{formatEur(Number(m.input_price_per_mtok))} / 1M tokens</dd></div>
              <div className={styles.spec}><dt>Output</dt><dd>{formatEur(Number(m.output_price_per_mtok))} / 1M tokens</dd></div>
              <div className={styles.spec}><dt>Streaming</dt><dd>Yes</dd></div>
              <div className={styles.spec}><dt>Context</dt><dd>{m.context_window ? `${(m.context_window / 1000).toFixed(0)}K tokens` : "Not published"}</dd></div>
            </dl>
            <div className={styles.actions}>
              {m.is_active ? (
                <>
                  <ButtonLink href="/dashboard/projects">Deploy</ButtonLink>
                  <ButtonLink href={`/playground?model=${m.id}`} variant="outline">Try in playground</ButtonLink>
                </>
              ) : (
                <ButtonLink href="/docs" variant="outline">Read docs</ButtonLink>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
