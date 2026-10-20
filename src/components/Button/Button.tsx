import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "outline" | "danger";

type Common = {
  variant?: Variant;
  size?: "default" | "large";
  full?: boolean;
  children: ReactNode;
  className?: string;
};

function classes({ variant = "primary", size = "default", full, className }: Omit<Common, "children">) {
  return [
    styles.btn,
    styles[variant],
    size === "large" ? styles.large : styles.responsiveLarge,
    full ? styles.full : "",
    className ?? "",
  ].join(" ");
}

export function Button({ variant, size, full, className, children, ...rest }: Common & ComponentProps<"button">) {
  return (
    <button className={classes({ variant, size, full, className })} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, full, className, children, href, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={classes({ variant, size, full, className })} {...rest}>
      {children}
    </Link>
  );
}
