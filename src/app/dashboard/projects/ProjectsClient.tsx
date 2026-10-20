"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import { TextField } from "@/components/FormField/FormField";
import { formatEur } from "@/lib/models";
import type { Project } from "@/lib/types";
import styles from "../dashboard.module.css";

type Stats = Record<string, { keys: number; deployments: number; spend: number }>;

export default function ProjectsClient({ initialProjects, stats, monthLabel }: { initialProjects: Project[]; stats: Stats; monthLabel: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(json.error ?? "Could not create the project.");
    }
    router.push(`/dashboard/projects/${json.project.id}`);
  }

  return (
    <div className={styles.grid2}>
      <Card>
        <h2 className="y-feature" style={{ marginBottom: 16 }}>Your projects</h2>
        {initialProjects.length === 0 ? (
          <p className="y-muted">No projects yet. Create one to deploy a model.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>Deployments</th><th>Active keys</th><th>{monthLabel}</th></tr></thead>
              <tbody>
                {initialProjects.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.strong}><Link href={`/dashboard/projects/${p.id}`}>{p.name}</Link></td>
                    <td>{stats[p.id]?.deployments ?? 0}</td>
                    <td>{stats[p.id]?.keys ?? 0}</td>
                    <td>{formatEur(stats[p.id]?.spend ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="y-feature" style={{ marginBottom: 8 }}>New project</h2>
        <p className="y-muted" style={{ marginBottom: 24 }}>A project holds your deployments, API keys and billing. Use one per app or environment.</p>
        <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField id="project-name" label="Project name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} error={error || undefined} />
          <Button type="submit" disabled={!name.trim() || busy}>{busy ? "Creating…" : "Create project"}</Button>
        </form>
      </Card>
    </div>
  );
}
