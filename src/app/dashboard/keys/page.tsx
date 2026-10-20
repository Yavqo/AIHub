import type { Metadata } from "next";
import KeysClient from "./KeysClient";
import { loadKeys, loadProjects } from "@/lib/dashboard";

export const metadata: Metadata = { title: "API keys" };

export default async function KeysPage() {
  const [keys, projects] = await Promise.all([loadKeys(), loadProjects()]);
  return <KeysClient initialKeys={keys} projects={projects} />;
}
