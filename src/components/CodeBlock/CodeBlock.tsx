"use client";

import { useState } from "react";
import Icon from "@/components/Icon/Icon";
import styles from "./CodeBlock.module.css";

export type Snippet = { label: string; code: string };

export default function CodeBlock({ snippets, title }: { snippets: Snippet[]; title?: string }) {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const current = snippets[index];

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className={styles.block}>
      <div className={styles.bar}>
        {snippets.length > 1 ? (
          <div className={styles.tabs} role="tablist" aria-label={title ?? "Code language"}>
            {snippets.map((s, i) => (
              <button key={s.label} role="tab" aria-selected={i === index} className={styles.tab} onClick={() => setIndex(i)}>
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <span className={styles.label}>{title ?? current.label}</span>
        )}
        <button className={styles.copy} onClick={copy} aria-label="Copy code">
          <Icon name={copied ? "check" : "copy"} size={18} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.pre}>
        <code>{current.code}</code>
      </pre>
    </div>
  );
}
