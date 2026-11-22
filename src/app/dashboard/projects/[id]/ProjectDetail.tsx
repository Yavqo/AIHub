"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import DeployTerminal, { type DeployStep } from "@/components/DeployTerminal/DeployTerminal";
import { SelectField, TextArea, TextField } from "@/components/FormField/FormField";
import Icon from "@/components/Icon/Icon";
import Modal from "@/components/Modal/Modal";
import StatusChip from "@/components/StatusChip/StatusChip";
import {
  DEFAULT_VOICE,
  formatEur,
  formatModelPriceSummary,
  isDeployableModel,
  modelKind,
  modelKindLabel,
  modelRouteSuffix,
  SUNLIGHT_VOICES,
} from "@/lib/models";
import { apiBaseUrl } from "@/lib/site";
import { snippetsForModel } from "@/lib/snippets";
import type { Deployment, Model, ModelKind, Project } from "@/lib/types";
import dash from "../../dashboard.module.css";
import styles from "./project.module.css";

type Totals = { requests: number; input_tokens: number; output_tokens: number; cost_eur: number };

const endpointFor = (d: Deployment, kind: ModelKind = "chat") => `${apiBaseUrl}/deployments/${d.slug}${kind === "chat" ? "" : modelRouteSuffix(kind)}`;
const baseUrlFor = (d: Deployment) => `${apiBaseUrl}/deployments/${d.slug}`;
const docsAnchorFor = (kind: ModelKind) => (kind === "tts" ? "/docs#tts" : kind === "decision" ? "/docs#decisions" : kind === "realtime" ? "/docs#realtime" : "/docs");
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

type FormState = {
  name: string;
  system_prompt: string;
  temperature: string;
  max_tokens: string;
  voice: string;
  rpm_limit: string;
  tpm_limit: string;
};
const emptyForm: FormState = {
  name: "",
  system_prompt: "",
  temperature: "",
  max_tokens: "",
  voice: DEFAULT_VOICE,
  rpm_limit: "60",
  tpm_limit: "200000",
};

const isWhole = (v: string, min: number, max: number) => Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max;

function toPayload(f: FormState, kind: ModelKind) {
  return {
    name: f.name.trim(),
    system_prompt: f.system_prompt.trim() || null,
    temperature: kind === "chat" || kind === "realtime" ? (f.temperature === "" ? null : Number(f.temperature)) : null,
    max_tokens: kind === "chat" ? (f.max_tokens === "" ? null : Number(f.max_tokens)) : null,
    voice: kind === "tts" || kind === "realtime" ? f.voice || DEFAULT_VOICE : null,
    rpm_limit: Number(f.rpm_limit),
    tpm_limit: Number(f.tpm_limit),
  };
}

function formError(f: FormState, kind: ModelKind): string | null {
  if (!f.name.trim()) return "Give the deployment a name.";
  if ((kind === "chat" || kind === "realtime") && f.temperature !== "" && !(Number(f.temperature) >= 0 && Number(f.temperature) <= 2)) {
    return "Temperature must be between 0 and 2.";
  }
  if (kind === "chat" && f.max_tokens !== "" && !(Number.isInteger(Number(f.max_tokens)) && Number(f.max_tokens) >= 1 && Number(f.max_tokens) <= 32000)) {
    return "Max tokens must be a whole number from 1 to 32,000.";
  }
  if (!isWhole(f.rpm_limit, 1, 10_000)) return "Requests per minute must be a whole number from 1 to 10,000.";
  if (!isWhole(f.tpm_limit, 1_000, 10_000_000)) return "Tokens per minute must be a whole number from 1,000 to 10,000,000.";
  return null;
}

function SettingsFields({ form, setForm, kind }: { form: FormState; setForm: (f: FormState) => void; kind: ModelKind }) {
  const promptLabel =
    kind === "tts"
      ? "Style direction (optional)"
      : kind === "decision"
        ? "Shared context (optional)"
        : kind === "realtime"
          ? "System instructions (optional)"
          : "System prompt (optional)";
  const promptHint =
    kind === "tts"
      ? "Controls tone, pacing or accent. Prepended to each speech request."
      : kind === "decision"
        ? "Prepended to string inputs before your questions are evaluated."
        : kind === "realtime"
          ? "Locked into every ephemeral session token for this deployment."
          : "Sent before every conversation. Its tokens count as input.";
  const nameHint =
    kind === "tts"
      ? "For example: Narration voice"
      : kind === "decision"
        ? "For example: Ticket router"
        : kind === "realtime"
          ? "For example: Voice concierge"
          : "For example: Support assistant";

  return (
    <>
      <TextField id="dep-name" label="Deployment name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} hint={nameHint} />
      {kind === "tts" || kind === "realtime" ? (
        <SelectField
          id="dep-voice"
          label="Default voice"
          value={form.voice || DEFAULT_VOICE}
          onChange={(e) => setForm({ ...form, voice: e.target.value })}
          hint="Can be overridden per request."
        >
          {SUNLIGHT_VOICES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </SelectField>
      ) : null}
      <TextArea
        id="dep-system"
        label={promptLabel}
        rows={3}
        value={form.system_prompt}
        onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
        hint={promptHint}
      />
      {kind === "chat" ? (
        <div className={styles.row2}>
          <TextField id="dep-temp" label="Temperature" inputMode="decimal" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} hint="0 to 2. Empty uses the default." />
          <TextField id="dep-max" label="Max tokens" inputMode="numeric" value={form.max_tokens} onChange={(e) => setForm({ ...form, max_tokens: e.target.value })} hint="Reply length cap. Empty means none." />
        </div>
      ) : kind === "realtime" ? (
        <TextField id="dep-temp" label="Temperature" inputMode="decimal" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} hint="0 to 2. Empty uses the default." />
      ) : null}
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
  const deployableModels = models.filter(isDeployableModel);
  const [deployments, setDeployments] = useState(initialDeployments);
  const [deployOpen, setDeployOpen] = useState(false);
  const [modelId, setModelId] = useState(deployableModels[0]?.id ?? "");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [created, setCreated] = useState<Deployment | null>(null);
  const [editing, setEditing] = useState<Deployment | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<Deployment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<{ id: number; steps: DeployStep[]; command: string; suffix: string } | null>(null);
  const [liveSlug, setLiveSlug] = useState("");
  const runId = useRef(0);
  const deployed = useRef<Deployment | null>(null);

  const findModel = (id: string) => models.find((x) => x.id === id);
  const kindFor = (id: string): ModelKind => {
    const m = findModel(id);
    return m ? modelKind(m) : "chat";
  };
  const modelName = (id: string) => {
    const m = findModel(id);
    if (!m) return id;
    return m.is_legacy ? `${m.display_name} (Legacy)` : m.display_name;
  };

  function closeDeploy() {
    runId.current++;
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

  function onDeploy(e: FormEvent) {
    e.preventDefault();
    const model = deployableModels.find((m) => m.id === modelId);
    if (!model) return setError("Choose a model.");
    const kind = modelKind(model);
    const problem = formError(form, kind);
    if (problem) return setError(problem);
    setError("");
    deployed.current = null;
    setLiveSlug("");
    const payload = toPayload(form, kind);
    const id = ++runId.current;
    const suffix = modelRouteSuffix(kind);
    const need = () => {
      if (!deployed.current) throw new Error("Deployment was not created.");
      return deployed.current;
    };

    const settingSummary = [
      payload.voice ? `voice ${payload.voice}` : null,
      payload.system_prompt ? `instructions ${payload.system_prompt.length} chars` : "no default instructions",
      kind === "chat" || kind === "realtime" ? (payload.temperature != null ? `temperature ${payload.temperature}` : "default temperature") : null,
      kind === "chat" ? (payload.max_tokens != null ? `max tokens ${payload.max_tokens}` : "no max tokens") : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const steps: DeployStep[] = [
      {
        label: "Validating configuration",
        duration: [2500, 4500],
        run: async () => `name "${payload.name}" · ${modelKindLabel(model)}`,
      },
      {
        label: `Resolving base model ${model.id}`,
        duration: [2500, 5000],
        run: async () => model.display_name,
      },
      {
        label: `Creating deployment in ${project.name}`,
        duration: [5000, 10000],
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
        duration: [3500, 6000],
        run: async () => settingSummary,
      },
      {
        label: "Setting rate limits",
        duration: [2500, 4500],
        run: async () => `${num(need().rpm_limit)} requests/min · ${num(need().tpm_limit)} tokens/min`,
      },
      {
        label: "Routing endpoint",
        duration: [4000, 8000],
        run: async () => `/api/v1/deployments/${need().slug}${suffix}`,
      },
      {
        label: "Checking model gateway",
        duration: [4000, 8000],
        run: async () => {
          const res = await fetch(`/api/deployments/${need().id}/health`, { cache: "no-store" });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.ok) return `healthy · ${json.latency_ms} ms`;
          return { warn: "not answering right now. Requests may fail until it's back." };
        },
      },
      {
        label: kind === "realtime" ? "Enabling per-minute billing" : "Enabling per-token billing",
        duration: [2500, 5000],
        run: async () => formatModelPriceSummary(model),
      },
    ];

    setRun({
      id,
      steps,
      suffix,
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
      voice: d.voice ?? DEFAULT_VOICE,
      rpm_limit: String(d.rpm_limit),
      tpm_limit: String(d.tpm_limit),
    });
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const kind = kindFor(editing.base_model_id);
    const problem = formError(editForm, kind);
    if (problem) return setError(problem);
    if (await patch(editing, toPayload(editForm, kind))) setEditing(null);
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

  const selectedModel = deployableModels.find((m) => m.id === modelId);
  const selectedKind: ModelKind = selectedModel ? modelKind(selectedModel) : "chat";
  const createdKind: ModelKind = created ? kindFor(created.base_model_id) : "chat";

  return (
    <>
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <Link href="/dashboard/projects" className={styles.back}><Icon name="arrow" size={18} />Projects</Link>
          <h2 className="y-title">{project.name}</h2>
        </div>
        <Button onClick={() => setDeployOpen(true)} disabled={!deployableModels.length}>
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
            <p className="y-muted">Pick a Sunlight chat, voice, speech or decision model, configure defaults, and get an endpoint for your app.</p>
            <Button onClick={() => setDeployOpen(true)} disabled={!deployableModels.length}>Deploy a model</Button>
          </div>
        ) : (
          <div className={styles.list}>
            {deployments.map((d) => {
              const kind = kindFor(d.base_model_id);
              const url = endpointFor(d, kind);
              return (
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
                      {d.voice ? <span>Voice <strong>{d.voice}</strong></span> : null}
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
                      <code title={url}>{url}</code>
                      <CopyText text={url} label={`Copy endpoint for ${d.name}`} />
                    </div>
                  </div>
                  {d.status === "suspended" ? null : (
                    <div className={styles.actions}>
                      {kind === "chat" ? (
                        <ButtonLink href={`/playground?model=${d.slug}`} variant="outline">Try it</ButtonLink>
                      ) : (
                        <ButtonLink href={docsAnchorFor(kind)} variant="outline">API docs</ButtonLink>
                      )}
                      <Button variant="outline" onClick={() => openEdit(d)}>Settings</Button>
                      <Button variant="outline" disabled={busy} onClick={() => patch(d, { status: d.status === "active" ? "paused" : "active" })}>
                        {d.status === "active" ? "Pause" : "Resume"}
                      </Button>
                      <Button variant="danger" onClick={() => setDeleting(d)}>Delete</Button>
                    </div>
                  )}
                </div>
              );
            })}
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
              doneText={`✓ Live at ${apiBaseUrl}/deployments/${liveSlug}${run.suffix}`}
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
              Call <strong style={{ color: "var(--y-ink)" }}>{created.name}</strong> with an API key from this project.
            </p>
            <div className={styles.endpoint}>
              <code>{endpointFor(created, createdKind)}</code>
              <CopyText text={endpointFor(created, createdKind)} label="Copy endpoint" />
            </div>
            <CodeBlock snippets={snippetsForModel(createdKind, baseUrlFor(created), created.slug, { voice: created.voice ?? undefined, prompt: "Hello" })} />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {createdKind === "chat" ? (
                <ButtonLink href={`/playground?model=${created.slug}`}>Try in playground</ButtonLink>
              ) : (
                <ButtonLink href={docsAnchorFor(createdKind)}>Read API docs</ButtonLink>
              )}
              <Button variant="outline" onClick={closeDeploy}>Done</Button>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={onDeploy}>
            <div className={styles.modelOptions} role="radiogroup" aria-label="Base model">
              {deployableModels.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={m.id === modelId} className={styles.modelOption} onClick={() => setModelId(m.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span className={styles.modelOptionName}>{m.display_name}</span>
                    <span className="y-caption">{modelKindLabel(m)}</span>
                  </div>
                  <span className="y-muted y-ui">{m.description}</span>
                  <span className={styles.price}>{formatModelPriceSummary(m)}</span>
                </button>
              ))}
            </div>
            <SettingsFields form={form} setForm={setForm} kind={selectedKind} />
            {error ? <p className={styles.formError} role="alert">{error}</p> : null}
            <Button type="submit" size="large" full disabled={busy || !form.name.trim() || !selectedModel}>{busy ? "Deploying…" : "Deploy"}</Button>
            <p className={styles.fine}>
              {selectedKind === "realtime"
                ? "Billed per minute of minted session window to this project."
                : "You pay only for tokens used. Billing is per project, at the prices above."}
            </p>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(editing)} title="Deployment settings" onClose={() => setEditing(null)}>
        <form className={styles.form} onSubmit={onSaveEdit}>
          <SettingsFields form={editForm} setForm={setEditForm} kind={editing ? kindFor(editing.base_model_id) : "chat"} />
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
