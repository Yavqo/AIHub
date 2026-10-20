import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectDetail from "./ProjectDetail";
import { listModels } from "@/lib/catalog";
import { loadBilling, loadDeployments, loadKeys, loadProject, monthRange, sumBilling } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/dashboard/projects/[id]">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();

  const month = monthRange();
  const [deployments, keys, models, billing] = await Promise.all([
    loadDeployments(id),
    loadKeys(),
    listModels(),
    loadBilling(month.from, month.to),
  ]);
  const projectRows = billing.filter((r) => r.project_id === id);
  const spendByDeployment: Record<string, number> = {};
  for (const r of projectRows) if (r.deployment_id) spendByDeployment[r.deployment_id] = (spendByDeployment[r.deployment_id] ?? 0) + r.cost_eur;

  return (
    <ProjectDetail
      project={project}
      initialDeployments={deployments}
      keyCount={keys.filter((k) => k.project_id === id && !k.revoked_at).length}
      models={models.filter((m) => m.is_active)}
      monthLabel={month.label}
      monthTotals={sumBilling(projectRows)}
      spendByDeployment={spendByDeployment}
    />
  );
}
