import "server-only";

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export const serverEnv = {
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  gatewayBaseUrl: (read("GATEWAY_BASE_URL") || "https://api.ai.yavqo.com/v1").replace(/\/$/, ""),
  gatewayApiKey: read("GATEWAY_API_KEY"),
  rateLimitPerMin: Number.parseInt(read("RATE_LIMIT_PER_MIN") || "60", 10),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabaseAnonKey);
}
