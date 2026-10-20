import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm/AuthForm";
import { noIndex } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in", robots: noIndex, alternates: { canonical: "/login" } };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
