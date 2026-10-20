"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import DeployTerminal, { type DeployStep } from "@/components/DeployTerminal/DeployTerminal";
import { TextArea, TextField } from "@/components/FormField/FormField";
import Icon from "@/components/Icon/Icon";
import Modal from "@/components/Modal/Modal";
import StatusChip from "@/components/StatusChip/StatusChip";
import { formatEur } from "@/lib/models";
import { apiBaseUrl } from "@/lib/site";
import { chatSnippets } from "@/lib/snippets";
import type { Deployment, Model, Project } from "@/lib/types";
import dash from "../../dashboard.module.css";
import styles from "./project.module.css";

type Totals = { requests: number; input_tokens: number; output_tokens: number; cost_eur: number };

const endpointFor = (d: Deployment) => `${apiBaseUrl}/deployments/${d.slug}`;
const num = (n: number) => new Intl.NumberFormat("en", { notation: n >= 100_000 ? "compact" : "standard" }).format(n);

function CopyText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.copyBtn}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={16} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

type FormState = { name: string; system_prompt: string; temperature: string; max_tokens: string; rpm_limit: string; tpm_limit: string };
const emptyForm: FormState = { name: "", system_prompt: "", temperature: "", max_tokens: "", rpm_limit: "60", tpm_limit: "200000" };

const isWhole = (v: string, min: number, max: number) => Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max;

function toPayload(f: FormState) {
  return {
    name: f.name.trim(),
    system_prompt: f.system_prompt.trim() || null,
    temperature: f.temperature === "" ? null : Number(f.temperature),
    max_tokens: f.max_tokens === "" ? null : Number(f.max_tokens),
    rpm_limit: Number(f.rpm_limit),
    tpm_limit: Number(f.tpm_limit),
  };
}

function formError(f: FormState): string | null {
  if (!f.name.trim()) return "Give the deployment a name.";
  if (f.temperature !== "" && !(Number(f.temperature) >= 0 && Number(f.temperature) <= 2)) return "Temperature must be between 0 and 2.";
  if (f.max_tokens !== "" && !(Number.isInteger(Number(f.max_tokens)) && Number(f.max_tokens) >= 1 && Number(f.max_tokens) <= 32000)) {
    return "Max tokens must be a whole number from 1 to 32,000.";
  }
  if (!isWhole(f.rpm_limit, 1, 10_000)) return "Requests per minute must be a whole number from 1 to 10,000.";
  if (!isWhole(f.tpm_limit, 1_000, 10_000_000)) return "Tokens per minute must be a whole number from 1,000 to 10,000,000.";
  return null;
}

function SettingsFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <>
      <TextField id="dep-name" label="Deployment name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} hint="For example: Support assistant" />
      <TextArea
        id="dep-system"
        label="System prompt (optional)"
        rows={4}
        value={form.system_prompt}
        onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
        hint="Sent before every conversation. Its tokens count as input."
      />
      <div className={styles.row2}>
        <TextField id="dep-temp" label="Temperature" inputMode="decimal" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} hint="0 to 2. Empty uses the default." />
        <TextField id="dep-max" label="Max tokens" inputMode="numeric" value={form.max_tokens} onChange={(e) => setForm({ ...form, max_tokens: e.target.value })} hint="Reply length cap. Empty means none." />
      </div>
      <div className={styles.row2}>
        <TextField id="dep-rpm" label="Requests per minute" inputMode="numeric" value={form.rpm_limit} onChange={(e) => setForm({ ...form, rpm_limit: e.target.value })} hint="Rate limit. 1 to 10,000." />
        <TextField id="dep-tpm" label="Tokens per minute" inputMode="numeric" value={form.tpm_limit} onChange={(e) => setForm({ ...form, tpm_limit: e.target.value })} hint="Input plus output. 1,000 to 10,000,000." />
      </div>
    </>
  );
}

export default function ProjectDetail({
  project,
  initialDeployments,
  keyCount,
  models,
  monthLabel,
  monthTotals,
  spendByDeployment,
}: {
  project: Project;
  initialDeployments: Deployment[];
  keyCount: number;
  models: Model[];
  monthLabel: string;
  monthTotals: Totals;
  spendByDeployment: Record<string, number>;
}) {
  const router = useRouter();
  const [deployments, setDeployments] = useState(initialDeployments);
  const [deployOpen, setDeployOpen] = useState(false);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [created, setCreated] = useState<Deployment | null>(null);
  const [editing, setEditing] = useState<Deployment | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<Deployment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<{ id: number; steps: DeployStep[]; command: string } | null>(null);
  const [liveSlug, setLiveSlug] = useState("");
  const runId = useRef(0);
  const deployed = useRef<Deployment | null>(null);

  const modelName = (id: string) => models.find((m) => m.id === id)?.display_name ?? id;

  function closeDeploy() {
    runId.current++;
    // Closing mid-run doesn't undo a deployment that was already created.
    const d = deployed.current;
    if (d) {
      setDeployments((ds) => [d, ...ds.filter((x) => x.id !== d.id)]);
      deployed.current = null;
      router.refresh();
    }
    setDeployOpen(false);
    setCreated(null);
    setRun(null);
    setForm(emptyForm);
    setError("");
  }

  // Each terminal line is a real step: the deployment is created, routed and checked
  // against the model gateway while the output plays. Durations pace the whole run to
  // roughly 30 to 60 seconds.
  function onDeploy(e: FormEvent) {
    e.preventDefault();
    const problem = formError(form);
    if (problem) return setError(problem);
    const model = models.find((m) => m.id === modelId);
    if (!model) return setError("Choose a model.");
    setError("");
    deployed.current = null;
    setLiveSlug("");
    const payload = toPayload(form);
    const id = ++runId.current;
    const need = () => {
      if (!deployed.current) throw new Error("Deployment was not created.");
      return deployed.current;
    };

    const steps: DeployStep[] = [
      {
        label: "Validating configuration",
        duration: [3000, 5000],
        run: async () => `name "${payload.name}"`,
      },
      {
        label: `Resolving base model ${model.id}`,
        duration: [3000, 6000],
        run: async () => model.display_name,
      },
      {
        label: `Creating deployment in ${project.name}`,
        duration: [6000, 12000],
        run: async () => {
          const res = await fetch("/api/deployments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: project.id, base_model_id: model.id, ...payload }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error ?? "Could not create the deployment.");
          deployed.current = json.deployment as Deployment;
          setLiveSlug(deployed.current.slug);
          return deployed.current.slug;
        },
      },
      {
        label: "Applying settings",
        duration: [4000, 7000],
        run: async () =>
          [
            payload.system_prompt ? `system prompt ${payload.system_prompt.length} chars` : "no system prompt",
            payload.temperature != null ? `temperature ${payload.temperature}` : "default temperature",
            payload.max_tokens != null ? `max tokens ${payload.max_tokens}` : "no max tokens",
          ].join(" · "),
      },
      {
        label: "Setting rate limits",
        duration: [3000, 5000],
        run: async () => `${num(need().rpm_limit)} requests/min · ${num(need().tpm_limit)} tokens/min`,
      },
      {
        label: "Routing endpoint",
        duration: [5000, 10000],
        run: async () => `/api/v1/deployments/${need().slug}`,
      },
      {
        label: "Checking model gateway",
        duration: [5000, 9000],
        run: async () => {
          const res = await fetch(`/api/deployments/${need().id}/health`, { cache: "no-store" });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.ok) return `healthy · ${json.latency_ms} ms`;
          return { warn: "not answering right now. Requests may fail until it's back." };
        },
      },
      {
        label: "Enabling per-token billing",
        duration: [3000, 6000],
        run: async () =>
          `${formatEur(Number(model.input_price_per_mtok))} / 1M in · ${formatEur(Number(model.output_price_per_mtok))} / 1M out`,
      },
    ];

    setRun({
      id,
      steps,
      command: `yavqo deploy ${model.id} --project "${project.name}" --name "${payload.name}"`,
    });
  }

  function onRunDone() {
    const d = deployed.current;
    if (!d || !run || run.id !== runId.current) return;
    setDeployments((ds) => [d, ...ds.filter((x) => x.id !== d.id)]);
    setCreated(d);
    setRun(null);
    router.refresh();
  }

  function onRunError(message: string) {
    setError(message);
    // If the deployment was created before a later step stopped, still show it.
    const d = deployed.current;
    if (d) setDeployments((ds) => [d, ...ds.filter((x) => x.id !== d.id)]);
  }

  async function patch(d: Deployment, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/deployments/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save. Try again.");
      return false;
    }
    setDeployments((ds) => ds.map((x) => (x.id === d.id ? json.deployment : x)));
    return true;
  }

  function openEdit(d: Deployment) {
    setEditing(d);
    setError("");
    setEditForm({
      name: d.name,
      system_prompt: d.system_prompt ?? "",
      temperature: d.temperature == null ? "" : String(d.temperature),
      max_tokens: d.max_tokens == null ? "" : String(d.max_tokens),
      rpm_limit: String(d.rpm_limit),
      tpm_limit: String(d.tpm_limit),
    });
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const problem = formError(editForm);
    if (problem) return setError(problem);
    if (await patch(editing, toPayload(editForm))) setEditing(null);
  }

  async function onDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = await fetch(`/api/deployments/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setDeployments((ds) => ds.filter((x) => x.id !== deleting.id));
      setDeleting(null);
      router.refresh();
    } else {
      setError("Could not delete this deployment. Try again.");
    }
  }

  const selectedModel = models.find((m) => m.id === modelId);

  return (
    <>
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <Link href="/dashboard/projects" className={styles.back}><Icon name="arrow" size={18} />Projects</Link>
          <h2 className="y-title">{project.name}</h2>
        </div>
        <Button onClick={() => setDeployOpen(true)} disabled={!models.length}>
          <Icon name="plus" size={18} />
          Deploy a model
        </Button>
      </div>

      <div className={dash.stats}>
        <div className={dash.stat}><span className={dash.statLabel}>Spend in {monthLabel}</span><span className={dash.statValue}>{formatEur(monthTotals.cost_eur)}</span></div>
        <div className={dash.stat}><span className={dash.statLabel}>Requests</span><span className={dash.statValue}>{num(monthTotals.requests)}</span></div>
        <div className={dash.stat}><span className={dash.statLabel}>Input tokens</span><span className={dash.statValue}>{num(monthTotals.input_tokens)}</span></div>
        <div className={dash.stat}><span className={dash.statLabel}>Output tokens</span><span className={dash.statValue}>{num(monthTotals.output_tokens)}</span></div>
      </div>

      <Card>
        <div className={dash.panelHead}>
          <div>
            <h2 className="y-feature">Deployments</h2>
            <p className="y-muted" style={{ marginTop: 4 }}>Each deployment has its own endpoint and settings. Calls are billed to this project.</p>
          </div>
        </div>

        {deployments.length === 0 ? (
          <div className={dash.empty}>
            <h3 className="y-sub">Deploy your first model</h3>
            <p className="y-muted">Pick a Sunlight model, give it a name and a system prompt, and get an endpoint for your app.</p>
            <Button onClick={() => setDeployOpen(true)} disabled={!models.length}>Deploy a model</Button>
          </div>
        ) : (
          <div className={styles.list}>
            {deployments.map((d) => (
              <div key={d.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <div className={styles.itemTop}>
                    <span className={styles.itemName}>{d.name}</span>
                    <StatusChip tone={d.status === "active" ? "positive" : d.status === "suspended" ? "negative" : "neutral"}>
                      {d.status === "active" ? "Active" : d.status === "suspended" ? "Suspended" : "Paused"}
                    </StatusChip>
                  </div>
                  <div className={styles.meta}>
                    <span>Model <strong>{modelName(d.base_model_id)}</strong></span>
                    <span>Name in API <strong className={dash.mono}>{d.slug}</strong></span>
                    <span>Limits <strong>{num(d.rpm_limit)} req/min · {num(d.tpm_limit)} tokens/min</strong></span>
                    <span>{monthLabel} <strong>{formatEur(spendByDeployment[d.id] ?? 0)}</strong></span>
                  </div>
                  {d.status === "suspended" ? (
                    <div className={styles.suspended} role="note">
                      <strong>Suspended by Yavqo{d.suspended_at ? ` on ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(d.suspended_at))}` : ""}.</strong>{" "}
                      Calls to this endpoint return an error.{d.suspended_reason ? ` Reason: ${d.suspended_reason}.` : ""} Contact Yavqo support if you think this is a mistake.
                    </div>
                  ) : null}
                  <div className={styles.endpoint}>
                    <code title={endpointFor(d)}>{endpointFor(d)}</code>
                    <CopyText text={endpointFor(d)} label={`Copy endpoint for ${d.name}`} />
                  </div>
                </div>
                {d.status === "suspended" ? null : (
                  <div className={styles.actions}>
                    <ButtonLink href={`/playground?model=${d.slug}`} variant="outline">Try it</ButtonLink>
                    <Button variant="outline" onClick={() => openEdit(d)}>Settings</Button>
                    <Button variant="outline" disabled={busy} onClick={() => patch(d, { status: d.status === "active" ? "paused" : "active" })}>
                      {d.status === "active" ? "Pause" : "Resume"}
                    </Button>
                    <Button variant="danger" onClick={() => setDeleting(d)}>Delete</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {error && !deployOpen && !editing && !deleting ? <p className={styles.formError} role="alert">{error}</p> : null}
      </Card>

      <Card tone="soft" className={dash.panelHead} style={{ marginBottom: 0 }}>
        <div>
          <h2 className="y-feature">API keys</h2>
          <p className="y-muted" style={{ marginTop: 4 }}>
            {keyCount === 1 ? "1 active key" : `${keyCount} active keys`} can call this project&apos;s deployments.
          </p>
        </div>
        <ButtonLink href="/dashboard/keys" variant={keyCount ? "outline" : "primary"}>{keyCount ? "Manage keys" : "Create API key"}</ButtonLink>
      </Card>

      <Modal open={deployOpen} title={created ? "Your endpoint is ready" : run ? "Deploying" : "Deploy a model"} onClose={closeDeploy}>
        {run ? (
          <div className={styles.form}>
            <DeployTerminal
              key={run.id}
              title="Yavqo AIHub · deploy"
              command={run.command}
              steps={run.steps}
              doneText={`✓ Live at ${apiBaseUrl}/deployments/${liveSlug}`}
              onDone={onRunDone}
              onError={onRunError}
            />
            {error ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Button variant="outline" onClick={() => { setRun(null); setError(""); }}>Back to settings</Button>
              </div>
            ) : null}
          </div>
        ) : created ? (
          <div className={styles.form}>
            <p className="y-muted">
              Call <strong style={{ color: "var(--y-ink)" }}>{created.name}</strong> with any OpenAI SDK. Use an API key from this project.
            </p>
            <div className={styles.endpoint}>
              <code>{endpointFor(created)}</code>
              <CopyText text={endpointFor(created)} label="Copy endpoint" />
            </div>
            <CodeBlock snippets={chatSnippets(endpointFor(created), created.slug, { prompt: "Hello" })} />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ButtonLink href={`/playground?model=${created.slug}`}>Try in playground</ButtonLink>
              <Button variant="outline" onClick={closeDeploy}>Done</Button>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={onDeploy}>
            <div className={styles.modelOptions} role="radiogroup" aria-label="Base model">
              {models.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={m.id === modelId} className={styles.modelOption} onClick={() => setModelId(m.id)}>
                  <span className={styles.modelOptionName}>{m.display_name}</span>
                  <span className="y-muted y-ui">{m.description}</span>
                  <span className={styles.price}>
                    {formatEur(Number(m.input_price_per_mtok))} per 1M input tokens · {formatEur(Number(m.output_price_per_mtok))} per 1M output tokens
                  </span>
                </button>
              ))}
            </div>
            <SettingsFields form={form} setForm={setForm} />
            {error ? <p className={styles.formError} role="alert">{error}</p> : null}
            <Button type="submit" size="large" full disabled={busy || !form.name.trim() || !selectedModel}>{busy ? "Deploying…" : "Deploy"}</Button>
            <p className={styles.fine}>You pay only for tokens used. Billing is per project, at the prices above.</p>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(editing)} title="Deployment settings" onClose={() => setEditing(null)}>
        <form className={styles.form} onSubmit={onSaveEdit}>
          <SettingsFields form={editForm} setForm={setEditForm} />
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          <Button type="submit" size="large" full disabled={busy || !editForm.name.trim()}>{busy ? "Saving…" : "Save changes"}</Button>
          <p className={styles.fine}>The endpoint stays the same. Changes apply to the next request.</p>
        </form>
      </Modal>

      <Modal open={Boolean(deleting)} title="Delete this deployment?" onClose={() => setDeleting(null)}>
        <div className={styles.form}>
          <p className="y-muted">
            Apps calling <strong style={{ color: "var(--y-ink)" }}>{deleting?.slug}</strong> will get an error right away. Its usage history and charges stay on the project. You can&apos;t undo this.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button variant="danger" onClick={onDelete} disabled={busy}>{busy ? "Deleting…" : "Delete deployment"}</Button>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
