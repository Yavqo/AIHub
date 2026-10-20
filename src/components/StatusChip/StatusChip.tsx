import styles from "./StatusChip.module.css";

export default function StatusChip({ tone, children, onMedia }: { tone: "positive" | "negative" | "neutral"; children: React.ReactNode; onMedia?: boolean }) {
  return (
    <span className={`${styles.chip} ${styles[tone]} ${onMedia ? styles.onMedia : ""}`}>
      <span className={styles.dot} aria-hidden />
      {children}
    </span>
  );
}
