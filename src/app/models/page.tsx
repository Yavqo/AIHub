import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import StatusChip from "@/components/StatusChip/StatusChip";
import { listModels } from "@/lib/catalog";
import {
  formatEur,
  isDeployableModel,
  modelKind,
  modelKindLabel,
  modelRouteSuffix,
  modelStatusLabel,
  modelStatusTone,
} from "@/lib/models";
import styles from "./models.module.css";
import { publicPage } from "@/lib/site";

// Re-read the model catalog every 5 minutes so changes need no redeploy.
export const revalidate = 300;

export const metadata: Metadata = publicPage(
  "/models",
  "Sunlight models and pricing",
  "Compare Sunlight chat, realtime voice, text-to-speech and decision models, see prices in EUR and deploy one in your project.",
);

export default async function ModelsPage() {
  const models = await listModels();
  return (
    <div className={`y-container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className="y-title">Models</h1>
        <p className="y-lead">Deploy any live model below into your project to get your own endpoint, defaults and rate limits.</p>
      </div>
      <div className={styles.grid}>
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
            <Card key={m.id} className={styles.card}>
              <div className={styles.top}>
                <span className={styles.id}>{m.id}</span>
                <StatusChip tone={modelStatusTone(m)}>{modelStatusLabel(m)}</StatusChip>
              </div>
              <h2 className="y-sub">{m.display_name}</h2>
              <p className="y-muted">{m.description}</p>
              <dl className={styles.specs}>
                {kind === "realtime" ? (
                  <>
                    <div className={styles.spec}><dt>Session rate</dt><dd>{formatEur(Number(m.price_per_minute ?? 0.04))} / min</dd></div>
                    <div className={styles.spec}><dt>Type</dt><dd>{modelKindLabel(m)}</dd></div>
                  </>
                ) : (
                  <>
                    <div className={styles.spec}><dt>Input</dt><dd>{formatEur(Number(m.input_price_per_mtok))} / 1M tokens</dd></div>
                    <div className={styles.spec}>
                      <dt>Output</dt>
                      <dd>{kind === "decision" ? "€0.00 (0 tokens)" : `${formatEur(Number(m.output_price_per_mtok))} / 1M tokens`}</dd>
                    </div>
                  </>
                )}
                <div className={styles.spec}><dt>Endpoint</dt><dd><code>{modelRouteSuffix(kind)}</code></dd></div>
                <div className={styles.spec}>
                  <dt>{m.context_window ? "Context" : "Type"}</dt>
                  <dd>{m.context_window ? `${Math.round(m.context_window / 1024)}K tokens` : modelKindLabel(m)}</dd>
                </div>
              </dl>
              <div className={styles.actions}>
                {isDeployableModel(m) ? (
                  <>
                    <ButtonLink href="/dashboard/projects">Deploy</ButtonLink>
                    {kind === "chat" ? (
                      <ButtonLink href={`/playground?model=${m.id}`} variant="outline">Try in playground</ButtonLink>
                    ) : (
                      <ButtonLink href={docsHref} variant="outline">API docs</ButtonLink>
                    )}
                  </>
                ) : (
                  <ButtonLink href="/docs" variant="outline">Read docs</ButtonLink>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
