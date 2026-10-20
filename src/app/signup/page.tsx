import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm/AuthForm";
import { noIndex } from "@/lib/site";

export const metadata: Metadata = { title: "Create account", robots: noIndex, alternates: { canonical: "/signup" } };

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
