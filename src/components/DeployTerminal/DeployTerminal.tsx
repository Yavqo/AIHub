"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DeployTerminal.module.css";

export type DeployStep = {
  label: string;
  // Real work for this step. Resolves to the text shown after the label (or a warning
  // that does not stop the deploy), or throws to stop it.
  run: () => Promise<string | { warn: string } | void>;
  // How long the line stays running at least, as a [min, max] range in ms. A random
  // value in the range is used so each deploy paces a little differently.
  duration?: [number, number];
};

type Line = { label: string; state: "run" | "ok" | "warn" | "err"; detail?: string };

const DEFAULT_DURATION: [number, number] = [450, 450];

const pick = ([min, max]: [number, number]) => min + Math.random() * (max - min);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Plays the deploy as terminal output. Each line waits for its step's real work and its
// paced duration, whichever is longer. Reduced motion skips the pacing.
export default function DeployTerminal({
  command,
  title,
  steps,
  doneText,
  onDone,
  onError,
}: {
  command: string;
  title: string;
  steps: DeployStep[];
  doneText: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [finished, setFinished] = useState<"ok" | "err" | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stepStartedAt, setStepStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      setStartedAt(Date.now());
      for (const [i, step] of steps.entries()) {
        setLines((ls) => [...ls, { label: step.label, state: "run" }]);
        setStepStartedAt(Date.now());
        try {
          const [result] = await Promise.all([step.run(), reduce ? null : wait(pick(step.duration ?? DEFAULT_DURATION))]);
          const next: Line =
            result && typeof result === "object"
              ? { label: step.label, state: "warn", detail: result.warn }
              : { label: step.label, state: "ok", detail: result || undefined };
          setLines((ls) => ls.map((l, j) => (j === i ? next : l)));
        } catch (err) {
          const message = (err as Error).message || "Something went wrong.";
          setLines((ls) => ls.map((l, j) => (j === i ? { ...l, state: "err", detail: message } : l)));
          setFinished("err");
          onError(message);
          return;
        }
      }
      setFinished("ok");
      await wait(reduce ? 0 : 900);
      onDone();
    })();
  }, [steps, onDone, onError]);

  // Ticks the elapsed-time readouts while the deploy runs.
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [finished]);

  const seconds = (from: number | null) => (from && now > from ? Math.floor((now - from) / 1000) : 0);
  const done = lines.filter((l) => l.state !== "run").length;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines, finished]);

  return (
    <div className={styles.terminal}>
      <div className={styles.bar}>
        <span className={styles.dots} aria-hidden><span /><span /><span /></span>
        <span className={styles.title}>{title}</span>
        <span className={styles.elapsed}>
          {finished === "ok" ? "Done" : finished === "err" ? "Stopped" : `Step ${Math.min(done + 1, steps.length)} of ${steps.length}`} · {seconds(startedAt)}s
        </span>
      </div>
      <div className={styles.progress} aria-hidden>
        <span style={{ width: `${(finished === "ok" ? 1 : done / steps.length) * 100}%` }} />
      </div>
      <div className={styles.body} ref={bodyRef} role="log" aria-live="polite" aria-label="Deployment progress">
        <div className={styles.line}><span className={styles.prompt}>$</span><span>{command}</span></div>
        {lines.map((l, i) => (
          <div key={i} className={styles.line}>
            <span className={`${styles.mark} ${styles[l.state]}`} aria-hidden>
              {l.state === "run" ? <span className={styles.spinner}>◐</span> : l.state === "ok" ? "✓" : l.state === "warn" ? "!" : "✕"}
            </span>
            <span>
              {l.label}
              {l.detail ? <span className={l.state === "err" ? styles.err : l.state === "warn" ? styles.warn : styles.detail}>{`  ${l.detail}`}</span> : null}
              {l.state === "run" ? <span className={styles.detail}>{`  ${seconds(stepStartedAt)}s`}</span> : null}
            </span>
          </div>
        ))}
        {finished === "ok" ? <div className={`${styles.line} ${styles.final} ${styles.ok}`}>{doneText}</div> : null}
        {finished === "err" ? <div className={`${styles.line} ${styles.final} ${styles.err}`}>Deployment stopped. Nothing was charged.</div> : null}
        {!finished ? <span className={styles.caret} aria-hidden /> : null}
      </div>
    </div>
  );
}
