import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import PromotionClaim from "@/components/PromotionClaim/PromotionClaim";
import { Suspense } from "react";
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
  title: { default: "Yavqo AIHub", template: "%s · Yavqo AIHub" },
  description: "Build with Sunlight models through one OpenAI-compatible API. Create keys, try prompts and track usage.",
  icons: { icon: "/brand/yavqo-mark-512.png" },
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
