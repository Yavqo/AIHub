import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ApiKey, Deployment, Project, UsageLog } from "@/lib/types";

export async function requireUser(path: string) {
  if (!isSupabaseConfigured()) redirect(`/login?next=${encodeURIComponent(path)}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return { supabase, user };
}

export async function loadProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("aihub_projects").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function loadKeys(): Promise<ApiKey[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aihub_api_keys")
    .select("id, project_id, owner_id, name, prefix, last4, scopes, last_used_at, revoked_at, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as ApiKey[];
}

export type UsageFilter = { days: number; project?: string; key?: string; model?: string; deployment?: string; limit?: number };

export async function loadUsage(f: UsageFilter): Promise<UsageLog[]> {
  const supabase = await createClient();
  let q = supabase
    .from("aihub_usage_logs")
    .select("*")
    .gte("created_at", new Date(Date.now() - f.days * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(f.limit ?? 5000);
  if (f.project) q = q.eq("project_id", f.project);
  if (f.key) q = q.eq("api_key_id", f.key);
  if (f.model) q = q.eq("model_id", f.model);
  if (f.deployment) q = q.eq("deployment_id", f.deployment);
  const { data } = await q;
  return (data ?? []) as UsageLog[];
}

export function summarize(logs: UsageLog[]) {
  const requests = logs.length;
  const tokens = logs.reduce((n, l) => n + (l.prompt_tokens ?? 0) + (l.completion_tokens ?? 0), 0);
  const errors = logs.filter((l) => l.status_code >= 400).length;
  const latencies = logs.map((l) => l.latency_ms).filter((v): v is number => v != null).sort((a, b) => a - b);
  const p50 = latencies.length ? latencies[Math.floor(latencies.length / 2)] : null;
  const cost = logs.reduce((n, l) => n + Number(l.cost_eur ?? 0), 0);
  return { requests, tokens, errorRate: requests ? errors / requests : 0, p50, cost };
}

export function dailySeries(logs: UsageLog[], days: number) {
  const buckets = new Map<string, number>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10), 0);
  }
  for (const l of logs) {
    const day = l.created_at.slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

export const fmt = {
  number: (n: number) => new Intl.NumberFormat("en", { notation: n >= 10_000 ? "compact" : "standard" }).format(n),
  percent: (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.01 ? 2 : 1)}%`,
  ms: (n: number | null) => (n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n} ms`),
  date: (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "Never",
};

export async function loadProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("aihub_projects").select("*").eq("id", id).maybeSingle();
  return (data as Project | null) ?? null;
}

export async function loadDeployments(projectId?: string): Promise<Deployment[]> {
  const supabase = await createClient();
  let q = supabase.from("aihub_deployments").select("*").order("created_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;
  return (data ?? []) as Deployment[];
}

export type BillingRow = {
  project_id: string | null;
  deployment_id: string | null;
  model_id: string | null;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cost_eur: number;
};

export function monthRange(offset = 0) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { from, to, label: new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(from) };
}

export async function loadBilling(from: Date, to: Date): Promise<BillingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("aihub_billing_summary", { p_from: from.toISOString(), p_to: to.toISOString() });
  return ((data ?? []) as BillingRow[]).map((r) => ({
    ...r,
    requests: Number(r.requests),
    input_tokens: Number(r.input_tokens),
    output_tokens: Number(r.output_tokens),
    cost_eur: Number(r.cost_eur),
  }));
}

export function sumBilling(rows: BillingRow[]) {
  return rows.reduce(
    (t, r) => ({
      requests: t.requests + r.requests,
      input_tokens: t.input_tokens + r.input_tokens,
      output_tokens: t.output_tokens + r.output_tokens,
      cost_eur: t.cost_eur + r.cost_eur,
    }),
    { requests: 0, input_tokens: 0, output_tokens: 0, cost_eur: 0 },
  );
}

export type CreditSummary = { credits_total: number; credits_used: number; credits_remaining: number; covered_in_period: number };
export type Redemption = { id: string; code: string; credit_eur: number; created_at: string };

export async function loadCredits(from: Date, to: Date): Promise<{ summary: CreditSummary; redemptions: Redemption[] }> {
  const supabase = await createClient();
  const [{ data: summary }, { data: redemptions }] = await Promise.all([
    supabase.rpc("aihub_credit_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.from("aihub_promotion_redemptions").select("id, code, credit_eur, created_at").order("created_at", { ascending: false }),
  ]);
  const row = (summary as Record<keyof CreditSummary, number | string>[] | null)?.[0];
  return {
    summary: {
      credits_total: Number(row?.credits_total ?? 0),
      credits_used: Number(row?.credits_used ?? 0),
      credits_remaining: Number(row?.credits_remaining ?? 0),
      covered_in_period: Number(row?.covered_in_period ?? 0),
    },
    redemptions: ((redemptions ?? []) as Redemption[]).map((r) => ({ ...r, credit_eur: Number(r.credit_eur) })),
  };
}
