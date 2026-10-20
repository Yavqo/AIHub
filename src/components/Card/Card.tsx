import type { ComponentProps } from "react";
import styles from "./Card.module.css";

export default function Card({ tone = "white", compact, className, ...rest }: ComponentProps<"div"> & { tone?: "white" | "soft"; compact?: boolean }) {
  return <div className={[styles.card, tone === "soft" ? styles.soft : "", compact ? styles.compact : "", className ?? ""].join(" ")} {...rest} />;
}
