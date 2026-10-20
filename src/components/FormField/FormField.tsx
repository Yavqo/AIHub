import type { ComponentProps, ReactNode } from "react";
import Icon from "@/components/Icon/Icon";
import styles from "./FormField.module.css";

type Extra = { label: string; error?: string; hint?: string };

function Wrap({ id, label, error, hint, children }: Extra & { id: string; children: ReactNode }) {
  return (
    <div>
      <div className={`${styles.field} ${error ? styles.error : ""}`}>
        {children}
        <label htmlFor={id} className={styles.label}>{label}</label>
      </div>
      {error ? <p className={styles.message} id={`${id}-error`}>{error}</p> : hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}

export function TextField({ id, label, error, hint, ...rest }: Extra & ComponentProps<"input"> & { id: string }) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <input id={id} className={styles.input} placeholder=" " aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...rest} />
    </Wrap>
  );
}

export function TextArea({ id, label, error, hint, ...rest }: Extra & ComponentProps<"textarea"> & { id: string }) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <textarea id={id} className={styles.input} placeholder=" " {...rest} />
    </Wrap>
  );
}

export function SelectField({ id, label, error, hint, children, ...rest }: Extra & ComponentProps<"select"> & { id: string }) {
  return (
    <div>
      <div className={`${styles.field} ${error ? styles.error : ""}`}>
        <select id={id} className={`${styles.input} ${styles.always}`} {...rest}>
          {children}
        </select>
        <label htmlFor={id} className={styles.label}>{label}</label>
        <span className={styles.chevron}><Icon name="arrow" size={20} /></span>
      </div>
      {error ? <p className={styles.message}>{error}</p> : hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
