"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/landing-v2/LanguageSwitcher";
import { getLandingV2Copy, type LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./mobile-nav.module.css";

const LABELS: Record<LandingLocale, { open: string; close: string }> = {
  en: { open: "Open navigation menu", close: "Close navigation menu" },
  es: { open: "Abrir menú de navegación", close: "Cerrar menú de navegación" },
  pt: { open: "Abrir menu de navegação", close: "Fechar menu de navegação" },
  ja: { open: "ナビゲーションメニューを開く", close: "ナビゲーションメニューを閉じる" },
};

const START_PATH = "/get-started?commercial_path=one_time";

export function MobileNav({ locale }: { locale: LandingLocale }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const c = getLandingV2Copy(locale);
  const labels = LABELS[locale] ?? LABELS.en;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={styles.root} ref={root}>
      <button ref={trigger} type="button" className={styles.trigger}
        aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((value) => !value)}>
        <span className={styles.icon} data-open={open} aria-hidden="true"><i /><i /><i /></span>
      </button>
      {open && (
        <div className={styles.menu} id="mobile-navigation">
          <nav aria-label={c.navigation} className={styles.links}>
            <a href="#how" onClick={close}>{c.nav.how}</a>
            <Link href="/sample" onClick={close}>{c.nav.sample}</Link>
            <a href="#pricing" onClick={close}>{c.nav.pricing}</a>
          </nav>
          <Link className={styles.cta} href={START_PATH} onClick={close}>{c.primary}</Link>
          <div className={styles.meta}>
            <Link href="/login" onClick={close}>{c.nav.signIn}</Link>
            <LanguageSwitcher locale={locale} label={c.language} onChangeComplete={close} />
          </div>
        </div>
      )}
    </div>
  );
}
