import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { listModels } from "@/lib/catalog";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Deployment, Model } from "@/lib/types";

export type Target = { model: Model; deployment: Deployment | null };
export type TargetError = { status: number; message: string; code: string };

// Turns a model name (or the slug in a deployment URL) into what to run and bill.
// A deployment is only usable from its own project (API keys) or by its owner (playground).
export async function resolveTarget(
  name: string,
  scope: { projectId: string } | { ownerId: string },
): Promise<Target | TargetError> {
  const models = await listModels();
  const base = models.find((m) => m.id === name);
  if (base) {
    if (!base.is_active) return { status: 404, message: `The model '${name}' is not available yet.`, code: "model_not_found" };
    return { model: base, deployment: null };
  }

  const { data } = await getAdminClient().from("aihub_deployments").select("*").eq("slug", name).maybeSingle<Deployment>();
  const allowed = data && ("projectId" in scope ? data.project_id === scope.projectId : data.owner_id === scope.ownerId);
  if (!data || !allowed) {
    return { status: 404, message: `No model or deployment called '${name}' in this project.`, code: "model_not_found" };
  }
  if (data.status === "suspended") {
    const reason = data.suspended_reason ? ` Reason: ${data.suspended_reason}.` : "";
    return {
      status: 403,
      message: `The deployment '${name}' has been suspended by Yavqo and can't be used.${reason} Contact Yavqo support if you think this is a mistake.`,
      code: "deployment_suspended",
    };
  }
  if (data.status !== "active") {
    return { status: 409, message: `The deployment '${name}' is paused. Resume it in your project to use it.`, code: "deployment_paused" };
  }
  const model = models.find((m) => m.id === data.base_model_id && m.is_active);
  if (!model) return { status: 503, message: "This deployment's base model is not available right now.", code: "model_unavailable" };
  return { model, deployment: data };
}

export function isTargetError(t: Target | TargetError): t is TargetError {
  return "code" in t;
}

export function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "deployment";
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

// Settings a user can choose when creating or editing a deployment.
export const deploymentFields = {
  name: z.string().trim().min(1).max(80),
  system_prompt: z.string().max(20_000).nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  max_tokens: z.number().int().min(1).max(32_000).nullable().optional(),
  rpm_limit: z.number().int().min(1).max(10_000).optional(),
  tpm_limit: z.number().int().min(1_000).max(10_000_000).optional(),
};

export const LIMIT_DEFAULTS = { rpm_limit: 60, tpm_limit: 200_000 };
