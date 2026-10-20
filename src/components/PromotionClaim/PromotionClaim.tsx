"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/Button/Button";
import Modal from "@/components/Modal/Modal";
import { formatEur } from "@/lib/models";

const STORAGE_KEY = "aihub_pending_promotion";
const PARAM = "promotions";

type Offer = { code: string; credit_eur: number; min_account_age_days: number };
type View =
  | { kind: "hidden" }
  | { kind: "offer"; offer: Offer }
  | { kind: "signin"; offer: Offer }
  | { kind: "done"; offer: Offer }
  | { kind: "message"; title: string; text: string };

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(code: string | null) {
  try {
    if (code) window.localStorage.setItem(STORAGE_KEY, code);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// Opens a claim dialog for links like /?promotions=sunlight15. Signed-out visitors are sent
// to sign in or sign up and come back to the same dialog; the code is also kept in
// localStorage in case the trip goes through an email confirmation.
export default function PromotionClaim({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get(PARAM)?.trim() || null;
  const [view, setView] = useState<View>({ kind: "hidden" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (fromUrl) store(fromUrl);
    const code = fromUrl ?? (signedIn ? readStored() : null);
    if (!code || onAuthPage) return;

    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/promotions/preview?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({ valid: false }));
      if (cancelled) return;
      if (!json.valid) {
        store(null);
        if (fromUrl) setView({ kind: "message", title: "This link has expired", text: "The promotion in this link isn't valid anymore." });
        return;
      }
      const offer = { code: json.code as string, credit_eur: Number(json.credit_eur), min_account_age_days: Number(json.min_account_age_days ?? 0) };
      if (json.already_redeemed) {
        store(null);
        if (fromUrl) setView({ kind: "message", title: "Already claimed", text: `You've already added the ${formatEur(offer.credit_eur)} from ${offer.code} to your account.` });
        return;
      }
      if (signedIn && json.eligible === false) {
        store(null);
        const on = json.eligible_on ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(json.eligible_on)) : null;
        setView({
          kind: "message",
          title: "You're not eligible for this promotion",
          text: `${offer.code} is only for accounts that are at least ${offer.min_account_age_days} days old.${on ? ` Your account qualifies on ${on}.` : ""}`,
        });
        return;
      }
      setView({ kind: signedIn ? "offer" : "signin", offer });
    })();
    return () => {
      cancelled = true;
    };
  }, [fromUrl, signedIn, onAuthPage]);

  function close(clear = true) {
    if (clear) store(null);
    setView({ kind: "hidden" });
    setError("");
    if (fromUrl) {
      const next = new URLSearchParams(params.toString());
      next.delete(PARAM);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  async function accept(offer: Offer) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/promotions/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: offer.code }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Could not add the credits. Try again.");
    store(null);
    setView({ kind: "done", offer });
    router.refresh();
  }

  if (view.kind === "hidden") return null;

  const returnTo = `/dashboard/billing?${PARAM}=${encodeURIComponent(view.kind === "message" ? "" : view.offer.code)}`;
  const amount = view.kind === "message" ? "" : formatEur(view.offer.credit_eur);
  const stack = { display: "flex", flexDirection: "column", gap: 16 } as const;
  const row = { display: "flex", gap: 12, flexWrap: "wrap" } as const;

  return (
    <Modal
      open
      title={
        view.kind === "message" ? view.title : view.kind === "done" ? `${amount} added` : `Claim ${amount} in AI credits`
      }
      onClose={() => close(view.kind !== "signin")}
    >
      {view.kind === "message" ? (
        <div style={stack}>
          <p className="y-muted">{view.text}</p>
          <div style={row}><Button onClick={() => close()}>OK</Button></div>
        </div>
      ) : view.kind === "done" ? (
        <div style={stack}>
          <p className="y-muted">Your credits are ready. They pay for token usage in all your projects, starting now.</p>
          <div style={row}>
            <ButtonLink href="/dashboard/billing" onClick={() => setView({ kind: "hidden" })}>View billing</ButtonLink>
            <Button variant="outline" onClick={() => close()}>Done</Button>
          </div>
        </div>
      ) : view.kind === "offer" ? (
        <div style={stack}>
          <p className="y-muted">
            Code <strong style={{ color: "var(--y-ink)" }}>{view.offer.code}</strong> adds {amount} in free credits to your Yavqo AIHub account.
            They pay for token usage in all your projects.
          </p>
          {error ? <p role="alert" style={{ color: "var(--y-negative)", fontSize: 14 }}>{error}</p> : null}
          <div style={row}>
            <Button size="large" onClick={() => accept(view.offer)} disabled={busy}>{busy ? "Adding…" : "Accept credits"}</Button>
            <Button size="large" variant="outline" onClick={() => close()}>Not now</Button>
          </div>
        </div>
      ) : (
        <div style={stack}>
          <p className="y-muted">
            Code <strong style={{ color: "var(--y-ink)" }}>{view.offer.code}</strong> adds {amount} in free credits for Sunlight models.
            Sign in to claim them.
            {view.offer.min_account_age_days > 0 ? ` Your account must be at least ${view.offer.min_account_age_days} days old.` : ""}
          </p>
          <div style={row}>
            {view.offer.min_account_age_days > 0 ? (
              <ButtonLink href={`/login?next=${encodeURIComponent(returnTo)}`} size="large" onClick={() => setView({ kind: "hidden" })}>Sign in</ButtonLink>
            ) : (
              <>
                <ButtonLink href={`/signup?next=${encodeURIComponent(returnTo)}`} size="large" onClick={() => setView({ kind: "hidden" })}>Create account</ButtonLink>
                <ButtonLink href={`/login?next=${encodeURIComponent(returnTo)}`} size="large" variant="outline" onClick={() => setView({ kind: "hidden" })}>Sign in</ButtonLink>
              </>
            )}
            <Button size="large" variant="outline" onClick={() => close()}>Not now</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
