"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon/Icon";
import styles from "./dashboard.module.css";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/dashboard/projects", label: "Projects", icon: "folder" },
  { href: "/dashboard/keys", label: "API keys", icon: "key" },
  { href: "/dashboard/usage", label: "Usage", icon: "chart" },
  { href: "/dashboard/billing", label: "Billing", icon: "euro" },
];

export default function DashboardTabs() {
  const pathname = usePathname();
  return (
    <nav className={styles.tabs} aria-label="Dashboard">
      {TABS.map((t) => {
        const active = pathname === t.href || (t.href !== "/dashboard" && pathname.startsWith(`${t.href}/`));
        return (
          <Link key={t.href} href={t.href} className={`${styles.tab} ${active ? styles.tabActive : ""}`} aria-current={active ? "page" : undefined}>
            <Icon name={t.icon} size={18} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
