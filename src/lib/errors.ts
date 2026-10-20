// OpenAI-compatible error body so existing SDKs surface the message.
export function apiError(
  status: number,
  message: string,
  type: string,
  code?: string,
  headers?: Record<string, string>,
) {
  return Response.json({ error: { message, type, code: code ?? null } }, { status, headers });
}

export function notConfigured() {
  return apiError(503, "AIHub is not configured yet. Set the Supabase environment variables.", "server_error", "not_configured");
}
