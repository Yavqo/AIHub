"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import { TextField } from "@/components/FormField/FormField";
import { formatEur } from "@/lib/models";
import styles from "../dashboard.module.css";

type Redemption = { id: string; code: string; credit_eur: number; created_at: string };

export default function PromotionCodes({ redemptions }: { redemptions: Redemption[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = code.trim().length >= 3;

  async function onRedeem(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/promotions/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Could not redeem the code. Try again.");
    setSuccess(`${formatEur(json.credit_eur)} in AI credits added to your account.`);
    setCode("");
    router.refresh();
  }

  return (
    <Card>
      <div className={styles.grid2} style={{ alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h2 className="y-feature">Promotion codes</h2>
            <p className="y-muted" style={{ marginTop: 4 }}>Redeem a code to add free AI credits. Credits pay for token usage in all your projects.</p>
          </div>
          <form onSubmit={onRedeem} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <TextField
                id="promo-code"
                label="Promotion code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={40}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                error={error || undefined}
              />
            </div>
            <Button type="submit" size="large" disabled={!valid || busy}>{busy ? "Redeeming…" : "Redeem"}</Button>
          </form>
          {success ? (
            <p role="status" style={{ color: "var(--y-positive)", fontSize: 14, fontWeight: 700 }}>{success}</p>
          ) : null}
        </div>
        <div>
          <h3 className="y-ui" style={{ fontWeight: 700, marginBottom: 8 }}>Redeemed codes</h3>
          {redemptions.length === 0 ? (
            <p className="y-muted y-ui">No codes redeemed yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Code</th><th>Credit</th><th>Redeemed</th></tr></thead>
                <tbody>
                  {redemptions.map((r) => (
                    <tr key={r.id}>
                      <td><span className={styles.mono}>{r.code}</span></td>
                      <td className={styles.strong}>{formatEur(r.credit_eur)}</td>
                      <td>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(r.created_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
