"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import { TextField } from "@/components/FormField/FormField";
import { createClient } from "@/lib/supabase/client";
import styles from "./AuthForm.module.css";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") ? "That sign-in link didn't work. Try again." : "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) {
        router.replace(next);
        router.refresh();
      } else {
        setNotice("Check your inbox. We sent a link to confirm your email.");
      }
    }
  }

  const isLogin = mode === "login";
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h1 className="y-title">{isLogin ? "Sign in" : "Create your account"}</h1>
          <p className="y-muted">{isLogin ? "Welcome back to Yavqo AIHub." : "Get an API key for Sunlight in a minute."}</p>
        </div>
        {notice ? (
          <p className={styles.notice} role="status">{notice}</p>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <TextField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField
              id="password"
              label="Password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={isLogin ? undefined : "At least 8 characters."}
              required
            />
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <Button type="submit" size="large" full disabled={!valid || busy}>
              {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
            </Button>
          </form>
        )}
        <p className={styles.switch}>
          {isLogin ? (
            <>New to AIHub? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>
          ) : (
            <>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>
          )}
        </p>
        {!isLogin ? (
          <p className={styles.fine}>
            By creating an account you agree to the Yavqo <a href="https://yavqo.com/terms-of-use">Terms</a> and{" "}
            <a href="https://yavqo.com/privacy-policy">Privacy Policy</a>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
