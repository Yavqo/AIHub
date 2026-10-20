import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

export type UsageEntry = {
  api_key_id: string | null;
  project_id: string | null;
  owner_id: string;
  model_id: string | null;
  source: "api" | "playground";
  endpoint: string;
  status_code: number;
  stream: boolean;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  latency_ms: number;
  deployment_id?: string | null;
  cost_eur?: number | null;
};

export async function recordUsage(entry: UsageEntry) {
  const { error } = await getAdminClient().from("aihub_usage_logs").insert(entry as never);
  if (error) console.error("aihub usage insert failed", error.message);
}
