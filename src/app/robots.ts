import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private and machine-only areas. They also send noindex, so links to them never get indexed.
        disallow: ["/dashboard", "/playground", "/api/", "/auth/"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
