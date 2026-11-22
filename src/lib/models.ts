import type { Model, ModelKind } from "@/lib/types";

export const SUNLIGHT_VOICES = [
  "Kore",
  "Puck",
  "Zephyr",
  "Charon",
  "Fenrir",
  "Aoede",
  "Leda",
  "Orus",
  "Sulafat",
  "Achird",
] as const;

export const DEFAULT_VOICE = "Kore";

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
    kind: "chat",
    sort_order: 1,
    input_price_per_mtok: 2.5,
    output_price_per_mtok: 10,
    price_per_minute: null,
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
    kind: "chat",
    sort_order: 2,
    input_price_per_mtok: 0.5,
    output_price_per_mtok: 2,
    price_per_minute: null,
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
    kind: "chat",
    sort_order: 3,
    input_price_per_mtok: 2.5,
    output_price_per_mtok: 10,
    price_per_minute: null,
    currency: "EUR",
  },
  {
    id: "sunlight-1.1-realtime",
    display_name: "Sunlight 1.1 Realtime",
    description: "Low-latency two-way voice conversations with extended thinking. Connect from the browser or a server over WebSocket.",
    context_window: null,
    upstream_model: "gemini-3.8-live-extended-thinking",
    upstream_base_url: "https://generativelanguage.googleapis.com/v1beta",
    is_active: true,
    is_legacy: false,
    kind: "realtime",
    sort_order: 4,
    input_price_per_mtok: 0,
    output_price_per_mtok: 0,
    price_per_minute: 0.04,
    currency: "EUR",
  },
  {
    id: "sunlight-1-tts",
    display_name: "Sunlight 1 TTS",
    description: "Natural text to speech with 30 voices and style direction. Returns WAV or raw PCM audio.",
    context_window: null,
    upstream_model: "gemini-3.8-flash-tts",
    upstream_base_url: "https://generativelanguage.googleapis.com/v1beta",
    is_active: true,
    is_legacy: false,
    kind: "tts",
    sort_order: 5,
    input_price_per_mtok: 0.6,
    output_price_per_mtok: 10.5,
    price_per_minute: null,
    currency: "EUR",
  },
  {
    id: "sunlight-decision",
    display_name: "Sunlight Decision",
    description: "Answer up to 1,000 yes/no, multiple-choice and scoring questions about one input in a single call, with calibrated probabilities.",
    context_window: 262144,
    upstream_model: "gemini-decision-1",
    upstream_base_url: "https://generativelanguage.googleapis.com/v1beta",
    is_active: true,
    is_legacy: false,
    kind: "decision",
    sort_order: 6,
    input_price_per_mtok: 0.12,
    output_price_per_mtok: 0,
    price_per_minute: null,
    currency: "EUR",
  },
];

export const DEFAULT_MODEL_ID = "sunlight-2.1-pro";

export function modelKind(model: Pick<Model, "kind">): ModelKind {
  return model.kind ?? "chat";
}

export function modelKindLabel(model: Pick<Model, "kind">): string {
  switch (modelKind(model)) {
    case "realtime":
      return "Realtime voice";
    case "tts":
      return "Text to speech";
    case "decision":
      return "Decisions";
    default:
      return "Chat";
  }
}

export function modelRouteSuffix(kind: ModelKind): string {
  switch (kind) {
    case "realtime":
      return "/realtime/sessions";
    case "tts":
      return "/audio/speech";
    case "decision":
      return "/decisions";
    default:
      return "/chat/completions";
  }
}

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

export function sessionCostEur(model: Pick<Model, "price_per_minute">, minutes: number): number {
  return Number(model.price_per_minute ?? 0) * minutes;
}

export function formatEur(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) }).format(value);
}

export function formatModelPriceSummary(model: Pick<Model, "kind" | "input_price_per_mtok" | "output_price_per_mtok" | "price_per_minute">): string {
  if (modelKind(model) === "realtime") {
    return `${formatEur(Number(model.price_per_minute ?? 0.04))} / min`;
  }
  if (modelKind(model) === "decision") {
    return `${formatEur(Number(model.input_price_per_mtok))} / 1M input · €0.00 output`;
  }
  return `${formatEur(Number(model.input_price_per_mtok))} / 1M in · ${formatEur(Number(model.output_price_per_mtok))} / 1M out`;
}
