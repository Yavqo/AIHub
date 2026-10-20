export type Project = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

export type ApiKey = {
  id: string;
  project_id: string;
  owner_id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type Model = {
  id: string;
  display_name: string;
  description: string;
  context_window: number | null;
  upstream_model: string;
  is_active: boolean;
  sort_order: number;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  currency: string;
};

export type Deployment = {
  id: string;
  project_id: string;
  owner_id: string;
  base_model_id: string;
  name: string;
  slug: string;
  system_prompt: string | null;
  temperature: number | null;
  max_tokens: number | null;
  status: "active" | "paused" | "suspended";
  suspended_reason: string | null;
  suspended_at: string | null;
  rpm_limit: number;
  tpm_limit: number;
  created_at: string;
  updated_at: string;
};

export type UsageLog = {
  id: number;
  api_key_id: string | null;
  project_id: string | null;
  owner_id: string | null;
  model_id: string | null;
  source: "api" | "playground";
  endpoint: string;
  status_code: number;
  stream: boolean;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  deployment_id: string | null;
  cost_eur: number | null;
  created_at: string;
};
