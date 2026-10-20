import "server-only";
import crypto from "node:crypto";
import { getAdminClient } from "@/lib/supabase/admin";

// Same format as YavqoAPIS keys so every Yavqo key looks alike.
const KEY_PREFIX = "yavqo_live_";

export function generateRawKey(): string {
  return KEY_PREFIX + crypto.randomBytes(24).toString("hex");
}

export function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function describeKey(raw: string) {
  return { prefix: raw.slice(0, 16), last4: raw.slice(-4), key_hash: hashKey(raw) };
}

export type VerifiedKey = { id: string; project_id: string; owner_id: string };

export function readBearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.startsWith(KEY_PREFIX) && token.length === KEY_PREFIX.length + 48 ? token : null;
}

// Lookup is by SHA-256 hash, so comparing secrets in application code is not needed.
export async function verifyKey(raw: string): Promise<VerifiedKey | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("aihub_api_keys")
    .select("id, project_id, owner_id, revoked_at")
    .eq("key_hash", hashKey(raw))
    .maybeSingle<{ id: string; project_id: string; owner_id: string; revoked_at: string | null }>();
  if (error || !data || data.revoked_at) return null;
  return { id: data.id, project_id: data.project_id, owner_id: data.owner_id };
}

export async function touchKey(id: string) {
  await getAdminClient()
    .from("aihub_api_keys")
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", id);
}
