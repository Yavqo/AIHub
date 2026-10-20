import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import PromotionClaim from "@/components/PromotionClaim/PromotionClaim";
import { Suspense } from "react";
import { appUrl, siteDescription, siteName } from "@/lib/site";
import { getUser } from "@/lib/supabase/server";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

const code = Geist_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: `${siteName}: deploy Sunlight AI models`, template: `%s · ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  icons: { icon: "/brand/yavqo-mark-512.png", apple: "/brand/yavqo-mark-512.png" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName,
    locale: "en",
    url: "/",
    title: `${siteName}: deploy Sunlight AI models`,
    description: siteDescription,
  },
  twitter: { card: "summary_large_image", title: `${siteName}: deploy Sunlight AI models`, description: siteDescription },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser();
  return (
    <html lang="en" className={`${sans.variable} ${code.variable}`}>
      <body>
        <Header signedIn={Boolean(user)} />
        <main id="main">{children}</main>
        <Footer />
        <Suspense>
          <PromotionClaim signedIn={Boolean(user)} />
        </Suspense>
      </body>
    </html>
  );
}
