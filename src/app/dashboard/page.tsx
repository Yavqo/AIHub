import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import UsageChart from "@/components/UsageChart/UsageChart";
import { dailySeries, fmt, loadKeys, loadUsage, summarize } from "@/lib/dashboard";
import { formatEur } from "@/lib/models";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Overview({ searchParams }: PageProps<"/dashboard">) {
  const { range } = await searchParams;
  const days = range === "30" ? 30 : 7;
  const [logs, keys] = await Promise.all([loadUsage({ days }), loadKeys()]);
  const s = summarize(logs);
  const activeKeys = keys.filter((k) => !k.revoked_at);

  return (
    <>
      <div className={styles.stats}>
        <div className={styles.stat}><span className={styles.statLabel}>Requests</span><span className={styles.statValue}>{fmt.number(s.requests)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Tokens</span><span className={styles.statValue}>{fmt.number(s.tokens)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Error rate</span><span className={styles.statValue}>{fmt.percent(s.errorRate)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>Charges</span><span className={styles.statValue}>{formatEur(s.cost)}</span></div>
      </div>

      <Card>
        <div className={styles.panelHead}>
          <h2 className="y-feature">Requests per day</h2>
          <div className={styles.segment} role="group" aria-label="Time range">
            <Link href="/dashboard?range=7" aria-current={days === 7}>7 days</Link>
            <Link href="/dashboard?range=30" aria-current={days === 30}>30 days</Link>
          </div>
        </div>
        <UsageChart series={dailySeries(logs, days)} label="Requests per day" />
      </Card>

      {activeKeys.length === 0 ? (
        <Card tone="soft" className={styles.empty}>
          <h2 className="y-sub">Create your first key</h2>
          <p className="y-muted">You need a project and an API key to call Sunlight from your app.</p>
          <ButtonLink href="/dashboard/keys">Create API key</ButtonLink>
        </Card>
      ) : (
        <Card>
          <div className={styles.panelHead}>
            <h2 className="y-feature">Active keys</h2>
            <ButtonLink href="/dashboard/keys" variant="outline">Manage keys</ButtonLink>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>Key</th><th>Last used</th></tr></thead>
              <tbody>
                {activeKeys.slice(0, 5).map((k) => (
                  <tr key={k.id}>
                    <td className={styles.strong}>{k.name}</td>
                    <td><span className={styles.mono}>{k.prefix}…{k.last4}</span></td>
                    <td>{fmt.date(k.last_used_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
