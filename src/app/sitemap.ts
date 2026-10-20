import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

// Public pages only. Sign-in, sign-up and everything behind sign-in are left out.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${appUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/models`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${appUrl}/docs`, lastModified, changeFrequency: "weekly", priority: 0.8 },
  ];
}
