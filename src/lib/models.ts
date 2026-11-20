import type { Model } from "@/lib/types";

// Used when the catalog table cannot be read (for example before Supabase is configured).
export const FALLBACK_MODELS: Model[] = [
  {
    id: "sunlight-2.1-pro",
    display_name: "Sunlight 2.1 Pro",
    description: "Deeper reasoning for code, research and long answers.",
    context_window: null,
    upstream_model: "claude-opus-5-5",
    upstream_base_url: "https://freemodel.in/v1",
    is_active: true,
    is_legacy: false,
    sort_order: 1,
    input_price_per_mtok: 2.5,
    output_price_per_mtok: 10,
    currency: "EUR",
  },
  {
    id: "sunlight-2.1",
    display_name: "Sunlight 2.1",
    description: "Fast everyday model for chat and short tasks.",
    context_window: null,
    upstream_model: "deepseek/deepseek-v4.1-flash-free",
    upstream_base_url: "https://api.orcarouter.ai/v1",
    is_active: true,
    is_legacy: false,
    sort_order: 2,
    input_price_per_mtok: 0.5,
    output_price_per_mtok: 2,
    currency: "EUR",
  },
  {
    id: "sunlight-2-pro",
    display_name: "Sunlight 2 Pro",
    description: "Previous-generation model kept online for existing deployments.",
    context_window: null,
    upstream_model: "recursive/flint-v1.0:free",
    upstream_base_url: null,
    is_active: true,
    is_legacy: true,
    sort_order: 3,
    input_price_per_mtok: 2.5,
    output_price_per_mtok: 10,
    currency: "EUR",
  },
];

export const DEFAULT_MODEL_ID = "sunlight-2.1-pro";

export function isDeployableModel(model: Pick<Model, "is_active" | "is_legacy">): boolean {
  return model.is_active && !model.is_legacy;
}

export function modelStatusLabel(model: Pick<Model, "is_active" | "is_legacy">): "Live" | "Legacy" | "Coming soon" {
  if (!model.is_active) return "Coming soon";
  if (model.is_legacy) return "Legacy";
  return "Live";
}

export function modelStatusTone(model: Pick<Model, "is_active" | "is_legacy">): "positive" | "neutral" {
  return isDeployableModel(model) ? "positive" : "neutral";
}

// Price for one request, in EUR. Prices are per 1M tokens.
export function costEur(model: Pick<Model, "input_price_per_mtok" | "output_price_per_mtok">, input: number, output: number): number {
  return (input * Number(model.input_price_per_mtok) + output * Number(model.output_price_per_mtok)) / 1_000_000;
}

export function formatEur(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) }).format(value);
}
