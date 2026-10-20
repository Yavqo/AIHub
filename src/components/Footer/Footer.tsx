import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";

const COLUMNS = [
  { title: "AIHub", links: [{ href: "/models", label: "Models" }, { href: "/playground", label: "Playground" }, { href: "/dashboard", label: "Dashboard" }] },
  { title: "Developers", links: [{ href: "/docs", label: "API reference" }, { href: "/docs#streaming", label: "Streaming" }, { href: "/docs#errors", label: "Errors and limits" }] },
  { title: "Account", links: [{ href: "/signup", label: "Create account" }, { href: "/login", label: "Sign in" }, { href: "/dashboard/keys", label: "API keys" }] },
  { title: "Yavqo", links: [{ href: "https://yavqo.com", label: "yavqo.com" }, { href: "https://yavqo.com/sunlight", label: "Sunlight" }, { href: "https://yavqo.com/support", label: "Support" }] },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="y-container">
        <div className={styles.top}>
          <div className={styles.brand}>
            <Image className={styles.logo} src="/brand/yavqo-logo-ink.png" alt="Yavqo" width={72} height={25} />
            <p className={styles.intro}>AIHub is where you get keys, try prompts and track usage for Sunlight models.</p>
          </div>
          <div className={styles.cols}>
            {COLUMNS.map((col) => (
              <div key={col.title} className={styles.col}>
                <h3>{col.title}</h3>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.bottom}>
          <span>© {new Date().getFullYear()} Yavqo</span>
          <div className={styles.legal}>
            <a href="https://yavqo.com/privacy-policy">Privacy</a>
            <a href="https://yavqo.com/terms-of-use">Terms</a>
            <a href="https://yavqo.com/cookie-policy">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
