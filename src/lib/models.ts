import type { Model } from "@/lib/types";

// Used when the catalog table cannot be read (for example before Supabase is configured).
export const FALLBACK_MODELS: Model[] = [
  {
    id: "sunlight-2-pro",
    display_name: "Sunlight 2 Pro",
    description: "Fast, capable model for code, research and everyday chat.",
    context_window: null,
    upstream_model: "recursive/flint-v1.0:free",
    is_active: true,
    sort_order: 1,
    input_price_per_mtok: 2.5,
    output_price_per_mtok: 10,
    currency: "EUR",
  },
];

export const DEFAULT_MODEL_ID = "sunlight-2-pro";

// Price for one request, in EUR. Prices are per 1M tokens.
export function costEur(model: Pick<Model, "input_price_per_mtok" | "output_price_per_mtok">, input: number, output: number): number {
  return (input * Number(model.input_price_per_mtok) + output * Number(model.output_price_per_mtok)) / 1_000_000;
}

export function formatEur(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) }).format(value);
}
