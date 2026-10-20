import type { Metadata } from "next";
import ProjectsClient from "./ProjectsClient";
import { loadBilling, loadDeployments, loadKeys, loadProjects, monthRange } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const month = monthRange();
  const [projects, keys, deployments, billing] = await Promise.all([loadProjects(), loadKeys(), loadDeployments(), loadBilling(month.from, month.to)]);
  const stats: Record<string, { keys: number; deployments: number; spend: number }> = {};
  const get = (id: string) => (stats[id] ??= { keys: 0, deployments: 0, spend: 0 });
  for (const k of keys) if (!k.revoked_at) get(k.project_id).keys++;
  for (const d of deployments) get(d.project_id).deployments++;
  for (const r of billing) if (r.project_id) get(r.project_id).spend += r.cost_eur;
  return <ProjectsClient initialProjects={projects} stats={stats} monthLabel={month.label} />;
}
