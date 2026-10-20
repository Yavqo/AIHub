import { isSupabaseConfigured } from "@/lib/env";
import { z } from "zod";
import { describeKey, generateRawKey } from "@/lib/keys";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  project_id: z.string().uuid(),
});

const PUBLIC_COLUMNS = "id, project_id, owner_id, name, prefix, last4, scopes, last_used_at, revoked_at, created_at";

export async function GET() {
  if (!isSupabaseConfigured()) return Response.json({ error: "AIHub is not configured yet." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data, error } = await supabase.from("aihub_api_keys").select(PUBLIC_COLUMNS).order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ keys: data });
}

// Returns the raw key exactly once. Only its SHA-256 hash is stored.
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "AIHub is not configured yet." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a project and give the key a name." }, { status: 400 });

  const raw = generateRawKey();
  const { data, error } = await supabase
    .from("aihub_api_keys")
    .insert({ ...parsed.data, ...describeKey(raw), owner_id: user.id })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ key: data, secret: raw }, { status: 201 });
}
