export const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const apiBaseUrl = `${appUrl}/api/v1`;

export const siteName = "Yavqo AIHub";
export const siteDescription =
  "Deploy Sunlight AI models in your own project, get an OpenAI-compatible endpoint and pay only for the tokens you use.";

// Signed-in and auth pages: reachable, but kept out of search results.
export const noIndex = { index: false, follow: false } as const;

// Metadata for a public page. Open Graph is set in full because Next.js replaces the
// parent's openGraph object rather than merging it.
export function publicPage(path: string, title: string, description: string) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website" as const,
      siteName,
      locale: "en",
      url: path,
      title: `${title} · ${siteName}`,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${siteName}: deploy Sunlight AI models` }],
    },
    twitter: { card: "summary_large_image" as const, title: `${title} · ${siteName}`, description, images: ["/twitter-image"] },
  };
}
