import type { Metadata } from "next";
import Playground, { type PlaygroundTarget } from "./Playground";
import { listModels } from "@/lib/catalog";
import { loadDeployments, loadProjects, requireUser } from "@/lib/dashboard";
import { DEFAULT_MODEL_ID } from "@/lib/models";

export const metadata: Metadata = { title: "Playground" };

export default async function PlaygroundPage({ searchParams }: PageProps<"/playground">) {
  await requireUser("/playground");
  const { model } = await searchParams;
  const [models, deployments, projects] = await Promise.all([listModels(), loadDeployments(), loadProjects()]);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const targets: PlaygroundTarget[] = [
    ...deployments
      .map((d) => ({
        status: d.status,
        id: d.slug,
        label: d.name,
        group: projectName.get(d.project_id) ?? "Deployments",
        modelName: models.find((m) => m.id === d.base_model_id)?.display_name ?? d.base_model_id,
        hasSystemPrompt: Boolean(d.system_prompt),
        isDeployment: true,
      })),
    ...models
      .filter((m) => m.is_active)
      .map((m) => ({ id: m.id, label: m.display_name, group: "Base models", modelName: m.display_name, hasSystemPrompt: false, isDeployment: false, status: "active" as const })),
  ];
  const initial = targets.find((t) => t.id === model)?.id ?? targets.find((t) => t.status === "active")?.id ?? DEFAULT_MODEL_ID;
  return <Playground targets={targets} initialModel={initial} />;
}
