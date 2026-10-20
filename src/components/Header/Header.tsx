"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon/Icon";
import { ButtonLink } from "@/components/Button/Button";
import styles from "./Header.module.css";

const NAV = [
  { href: "/models", label: "Models" },
  { href: "/playground", label: "Playground" },
  { href: "/docs", label: "Docs" },
];

export default function Header({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const hasHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const overHero = hasHero && !scrolled;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={`${styles.header} ${overHero ? styles.overHero : ""}`} style={hasHero ? { marginBottom: "calc(-1 * var(--y-header-h))" } : undefined}>
      <nav className={styles.inner} aria-label="Main">
        <div className={styles.left}>
          <button className={`${styles.iconBtn} ${styles.menuBtn}`} aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <Link href="/" className={styles.logo} aria-label="Yavqo AIHub home">
            <Image
              className={styles.logoImg}
              src={overHero ? "/brand/yavqo-logo-white.png" : "/brand/yavqo-logo-ink.png"}
              alt="Yavqo"
              width={63}
              height={22}
              priority
            />
            <span className={styles.logoLabel}>AIHub</span>
          </Link>
          <div className={`${styles.left} ${styles.desktopOnly}`}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={`${styles.link} ${isActive(item.href) ? styles.active : ""}`} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.right}>
          {signedIn ? (
            <>
              <Link href="/dashboard" className={`${styles.link} ${styles.desktopOnly} ${isActive("/dashboard") ? styles.active : ""}`}>
                Dashboard
              </Link>
              <Link href="/dashboard" className={styles.iconBtn} aria-label="Your account">
                <Icon name="account" />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={`${styles.link} ${styles.desktopOnly}`}>Sign in</Link>
              <span className={styles.desktopOnly}>
                <ButtonLink href="/signup">Get API key</ButtonLink>
              </span>
              <Link href="/login" className={`${styles.iconBtn} ${styles.menuBtn}`} aria-label="Sign in">
                <Icon name="account" />
              </Link>
            </>
          )}
        </div>
      </nav>

      {open ? (
        <div className={styles.mobileMenu} role="dialog" aria-modal="true" aria-label="Menu">
          <div className={styles.mobileTop}>
            <Link href="/" className={styles.logo} onClick={() => setOpen(false)}>
              <Image className={styles.logoImg} src="/brand/yavqo-logo-ink.png" alt="Yavqo" width={63} height={22} />
              <span className={styles.logoLabel}>AIHub</span>
            </Link>
            <button className={styles.iconBtn} aria-label="Close menu" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <div className={styles.mobileLinks}>
            {[...NAV, ...(signedIn ? [{ href: "/dashboard", label: "Dashboard" }] : [])].map((item) => (
              <Link key={item.href} href={item.href} className={styles.mobileLink} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
          {!signedIn ? (
            <div className={styles.mobileCta}>
              <ButtonLink href="/signup" size="large" full onClick={() => setOpen(false)}>Get API key</ButtonLink>
              <ButtonLink href="/login" variant="outline" size="large" full onClick={() => setOpen(false)}>Sign in</ButtonLink>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
