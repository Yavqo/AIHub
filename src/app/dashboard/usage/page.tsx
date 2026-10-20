import type { Metadata } from "next";
import { Button } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import { SelectField } from "@/components/FormField/FormField";
import StatusChip from "@/components/StatusChip/StatusChip";
import UsageChart from "@/components/UsageChart/UsageChart";
import { listModels } from "@/lib/catalog";
import { dailySeries, fmt, loadDeployments, loadKeys, loadProjects, loadUsage, summarize } from "@/lib/dashboard";
import { formatEur } from "@/lib/models";
import styles from "../dashboard.module.css";

export const metadata: Metadata = { title: "Usage" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function UsagePage({ searchParams }: PageProps<"/dashboard/usage">) {
  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(one(sp.range))) ? Number(one(sp.range)) : 7;
  const filter = { days, project: one(sp.project), key: one(sp.key), model: one(sp.model), deployment: one(sp.deployment) };
  const [logs, projects, keys, models, deployments] = await Promise.all([loadUsage(filter), loadProjects(), loadKeys(), listModels(), loadDeployments()]);
  const deploymentName = new Map(deployments.map((d) => [d.id, d.name]));
  const s = summarize(logs);
  const keyName = new Map(keys.map((k) => [k.id, k.name]));

  return (
    <>
      <form className={styles.filters} method="get">
        <SelectField id="range" name="range" label="Time range" defaultValue={String(days)}>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </SelectField>
        <SelectField id="project" name="project" label="Project" defaultValue={filter.project ?? ""}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectField>
        <SelectField id="key" name="key" label="API key" defaultValue={filter.key ?? ""}>
          <option value="">All keys</option>
          {keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </SelectField>
        <SelectField id="deployment" name="deployment" label="Deployment" defaultValue={filter.deployment ?? ""}>
          <option value="">All deployments</option>
          {deployments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>
        <Button type="submit" size="large">Apply</Button>
      </form>

      <div className={styles.stats}>
        <div className={styles.stat}><span className={styles.statLabel}>Requests</span><span className={styles.statValue}>{fmt.number(s.requests)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Tokens</span><span className={styles.statValue}>{fmt.number(s.tokens)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Error rate</span><span className={styles.statValue}>{fmt.percent(s.errorRate)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Charges</span><span className={styles.statValue}>{formatEur(s.cost)}</span></div>
      </div>

      {days > 1 ? (
        <Card>
          <h2 className="y-feature" style={{ marginBottom: 24 }}>Requests per day</h2>
          <UsageChart series={dailySeries(logs, days)} label="Requests per day" />
        </Card>
      ) : null}

      <Card>
        <h2 className="y-feature" style={{ marginBottom: 16 }}>Recent requests</h2>
        {logs.length === 0 ? (
          <p className="y-muted">No requests in this range yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Time</th><th>Status</th><th>Deployment</th><th>Model</th><th>Source</th><th>Key</th><th>Tokens in / out</th><th>Latency</th><th>Charge</th></tr>
              </thead>
              <tbody>
                {logs.slice(0, 100).map((l) => (
                  <tr key={l.id}>
                    <td>{fmt.date(l.created_at)}</td>
                    <td><StatusChip tone={l.status_code < 400 ? "positive" : "negative"}>{l.status_code}</StatusChip></td>
                    <td className={styles.strong}>{l.deployment_id ? deploymentName.get(l.deployment_id) ?? "Deleted" : "—"}</td>
                    <td>{l.model_id ? models.find((m) => m.id === l.model_id)?.display_name ?? l.model_id : "—"}</td>
                    <td>{l.source === "playground" ? "Playground" : "API"}</td>
                    <td>{l.api_key_id ? keyName.get(l.api_key_id) ?? "Deleted key" : "—"}</td>
                    <td>{l.prompt_tokens ?? "—"} / {l.completion_tokens ?? "—"}</td>
                    <td>{fmt.ms(l.latency_ms)}</td>
                    <td>{l.cost_eur == null ? "—" : formatEur(Number(l.cost_eur), 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
