"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import { SelectField, TextField } from "@/components/FormField/FormField";
import Icon from "@/components/Icon/Icon";
import Modal from "@/components/Modal/Modal";
import StatusChip from "@/components/StatusChip/StatusChip";
import type { ApiKey, Project } from "@/lib/types";
import styles from "../dashboard.module.css";

const dateFmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "Never";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
  return json as T;
}

export default function KeysClient({ initialKeys, projects: initialProjects }: { initialKeys: ApiKey[]; projects: Project[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [projects, setProjects] = useState(initialProjects);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(initialProjects[0]?.id ?? "");
  const [newProject, setNewProject] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const needsProject = projects.length === 0;
  const valid = name.trim().length > 0 && (needsProject ? newProject.trim().length > 0 : Boolean(projectId));

  function closeCreate() {
    setCreateOpen(false);
    setSecret(null);
    setName("");
    setNewProject("");
    setError("");
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      let pid = projectId;
      if (needsProject) {
        const { project } = await postJson<{ project: Project }>("/api/projects", { name: newProject });
        setProjects([project]);
        setProjectId(project.id);
        pid = project.id;
      }
      const { key, secret } = await postJson<{ key: ApiKey; secret: string }>("/api/keys", { name, project_id: pid });
      setKeys((k) => [key, ...k]);
      setSecret(secret);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke() {
    if (!revoking) return;
    setBusy(true);
    const res = await fetch(`/api/keys/${revoking.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      const now = new Date().toISOString();
      setKeys((ks) => ks.map((k) => (k.id === revoking.id ? { ...k, revoked_at: now } : k)));
      setRevoking(null);
      router.refresh();
    } else {
      setError("Could not revoke this key. Try again.");
    }
  }

  return (
    <>
      <Card>
        <div className={styles.panelHead}>
          <div>
            <h2 className="y-feature">API keys</h2>
            <p className="y-muted" style={{ marginTop: 4 }}>Keys let your apps call Sunlight. Keep them secret and on your server.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={18} />
            Create key
          </Button>
        </div>

        {keys.length === 0 ? (
          <div className={styles.empty}>
            <p className="y-muted">You don&apos;t have any keys yet.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Name</th><th>Key</th><th>Project</th><th>Created</th><th>Last used</th><th>Status</th><th><span className="y-sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className={styles.strong}>{k.name}</td>
                    <td><span className={styles.mono}>{k.prefix}…{k.last4}</span></td>
                    <td>{projectName.get(k.project_id) ?? "—"}</td>
                    <td>{dateFmt(k.created_at)}</td>
                    <td>{dateFmt(k.last_used_at)}</td>
                    <td>{k.revoked_at ? <StatusChip tone="neutral">Revoked</StatusChip> : <StatusChip tone="positive">Active</StatusChip>}</td>
                    <td>
                      {!k.revoked_at ? (
                        <Button variant="danger" onClick={() => setRevoking(k)} aria-label={`Revoke ${k.name}`}>Revoke</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={createOpen} title={secret ? "Save your key" : "Create API key"} onClose={closeCreate}>
        {secret ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="y-muted">This is the only time you can see this key. Copy it and store it somewhere safe, such as an environment variable.</p>
            <CodeBlock title="Your new key" snippets={[{ label: "Key", code: secret }]} />
            <Button size="large" full onClick={closeCreate}>Done</Button>
          </div>
        ) : (
          <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <TextField id="key-name" label="Key name" placeholder=" " value={name} onChange={(e) => setName(e.target.value)} maxLength={80} hint="For example: Production server" autoFocus />
            {needsProject ? (
              <TextField id="project-name" label="Project name" value={newProject} onChange={(e) => setNewProject(e.target.value)} maxLength={80} hint="Keys belong to a project. We'll create it for you." />
            ) : (
              <SelectField id="key-project" label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectField>
            )}
            {error ? <p role="alert" style={{ color: "var(--y-negative)", fontSize: 14 }}>{error}</p> : null}
            <Button type="submit" size="large" full disabled={!valid || busy}>{busy ? "Creating…" : "Create key"}</Button>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(revoking)} title="Revoke this key?" onClose={() => setRevoking(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="y-muted">
            Apps using <strong style={{ color: "var(--y-ink)" }}>{revoking?.name}</strong> will stop working right away. You can&apos;t undo this.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button variant="danger" onClick={onRevoke} disabled={busy}>{busy ? "Revoking…" : "Revoke key"}</Button>
            <Button variant="outline" onClick={() => setRevoking(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
