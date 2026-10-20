import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/Card/Card";
import { listModels } from "@/lib/catalog";
import { loadBilling, loadCredits, loadDeployments, loadProjects, monthRange, sumBilling, type BillingRow } from "@/lib/dashboard";
import PromotionCodes from "./PromotionCodes";
import { formatEur } from "@/lib/models";
import styles from "../dashboard.module.css";

export const metadata: Metadata = { title: "Billing" };

const num = (n: number) => new Intl.NumberFormat("en").format(n);

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const { month } = await searchParams;
  const offset = month === "previous" ? -1 : 0;
  const range = monthRange(offset);
  const [rows, projects, deployments, models, credits] = await Promise.all([
    loadBilling(range.from, range.to),
    loadProjects(),
    loadDeployments(),
    listModels(),
    loadCredits(range.from, range.to),
  ]);

  const total = sumBilling(rows);
  const covered = Math.min(credits.summary.covered_in_period, total.cost_eur);
  const due = Math.max(total.cost_eur - covered, 0);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const deploymentName = new Map(deployments.map((d) => [d.id, d.name]));
  const modelName = new Map(models.map((m) => [m.id, m.display_name]));

  // Group rows by project; usage without a project (base-model playground) gets its own group.
  const groups = new Map<string, BillingRow[]>();
  for (const r of rows) {
    const key = r.project_id ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const ordered = [...groups.entries()].sort((a, b) => sumBilling(b[1]).cost_eur - sumBilling(a[1]).cost_eur);

  return (
    <>
      <div className={styles.panelHead} style={{ marginBottom: 0 }}>
        <div className={styles.segment} role="group" aria-label="Billing period">
          <Link href="/dashboard/billing" aria-current={offset === 0}>This month</Link>
          <Link href="/dashboard/billing?month=previous" aria-current={offset === -1}>Last month</Link>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}><span className={styles.statLabel}>Charges for {range.label}</span><span className={styles.statValue}>{formatEur(total.cost_eur)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Paid with credits</span><span className={styles.statValue}>{formatEur(covered)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Amount due</span><span className={styles.statValue}>{formatEur(due)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Credit balance</span><span className={styles.statValue}>{formatEur(credits.summary.credits_remaining)}</span></div>
      </div>

      <PromotionCodes redemptions={credits.redemptions} />

      <Card>
        <h2 className="y-feature" style={{ marginBottom: 16 }}>Charges by project</h2>
        {ordered.length === 0 ? (
          <p className="y-muted">No usage in {range.label}.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Project and deployment</th><th>Model</th><th>Requests</th><th>Input tokens</th><th>Output tokens</th><th>Charge</th></tr>
              </thead>
              <tbody>
                {ordered.flatMap(([pid, list]) => {
                  const sub = sumBilling(list);
                  return [
                    <tr key={pid}>
                      <td className={styles.strong}>
                        {pid === "none" ? "Playground (no project)" : <Link href={`/dashboard/projects/${pid}`}>{projectName.get(pid) ?? "Deleted project"}</Link>}
                      </td>
                      <td />
                      <td className={styles.strong}>{num(sub.requests)}</td>
                      <td className={styles.strong}>{num(sub.input_tokens)}</td>
                      <td className={styles.strong}>{num(sub.output_tokens)}</td>
                      <td className={styles.strong}>{formatEur(sub.cost_eur)}</td>
                    </tr>,
                    ...list.map((r) => (
                      <tr key={`${pid}-${r.deployment_id}-${r.model_id}`}>
                        <td style={{ paddingLeft: 20 }}>
                          {r.deployment_id ? deploymentName.get(r.deployment_id) ?? "Deleted deployment" : "Base model, no deployment"}
                        </td>
                        <td>{r.model_id ? modelName.get(r.model_id) ?? r.model_id : "—"}</td>
                        <td>{num(r.requests)}</td>
                        <td>{num(r.input_tokens)}</td>
                        <td>{num(r.output_tokens)}</td>
                        <td>{formatEur(r.cost_eur, 4)}</td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card tone="soft">
        <h2 className="y-feature" style={{ marginBottom: 16 }}>Pricing</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Model</th><th>Input, per 1M tokens</th><th>Output, per 1M tokens</th></tr></thead>
            <tbody>
              {models.filter((m) => m.is_active).map((m) => (
                <tr key={m.id}>
                  <td className={styles.strong}>{m.display_name}</td>
                  <td>{formatEur(Number(m.input_price_per_mtok))}</td>
                  <td>{formatEur(Number(m.output_price_per_mtok))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="y-caption" style={{ marginTop: 16 }}>
          Each request is charged for the tokens it used. A deployment&apos;s system prompt counts as input tokens. Failed requests are not charged.
          Credits pay for charges made after you redeem them, oldest first.
        </p>
      </Card>
    </>
  );
}
