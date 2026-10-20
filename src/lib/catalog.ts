import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { FALLBACK_MODELS } from "@/lib/models";
import type { Model } from "@/lib/types";

// The catalog is public (RLS allows anon reads), so the anon key is enough.
export async function listModels(): Promise<Model[]> {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseAnonKey) return FALLBACK_MODELS;
  try {
    const supabase = createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.from("aihub_models").select("*").order("sort_order");
    if (error || !data?.length) return FALLBACK_MODELS;
    return data as Model[];
  } catch {
    return FALLBACK_MODELS;
  }
}
