"use client";

import { useState } from "react";
import { LANDING_COMPARISON } from "@/lib/landing/fixtures/landing-comparison";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./hero-attention-field.module.css";

const DETAILS = [
  { source: "Company newsroom · 9 days ago", meaning: "A new regional mandate may widen planning and supplier complexity." },
  { source: "Regional business press · 14 days ago", meaning: "Two new sites create a concrete coordination question before outreach." },
  { source: "Company announcement · 21 days ago", meaning: "The footprint changed, but the commercial case still rests on limited evidence." },
] as const;

const LABELS = {
  en: { title: "Attention field", hint: "Choose a company to inspect", observed: "Observed change", meaning: "Commercial meaning", evidence: "Evidence trace", open: "Still unresolved", sample: "Illustrative sample — synthetic companies and evidence." },
  es: { title: "Campo de atención", hint: "Elige una empresa para examinar", observed: "Cambio observado", meaning: "Significado comercial", evidence: "Rastro de evidencia", open: "Aún sin resolver", sample: "Muestra ilustrativa — empresas y evidencia sintéticas." },
  pt: { title: "Campo de atenção", hint: "Escolha uma empresa para examinar", observed: "Mudança observada", meaning: "Significado comercial", evidence: "Rastro de evidência", open: "Ainda não resolvido", sample: "Amostra ilustrativa — empresas e evidências sintéticas." },
  ja: { title: "注目フィールド", hint: "企業を選んで確認", observed: "観測された変化", meaning: "商業的意味", evidence: "根拠の経路", open: "未解決", sample: "説明用サンプル — 企業と根拠は合成データです。" },
} as const;

const DECISIONS: Record<LandingLocale, Record<string, string>> = {
  en: { prioritize: "Prioritize", validate: "Validate", monitor: "Monitor" },
  es: { prioritize: "Priorizar", validate: "Validar", monitor: "Monitorear" },
  pt: { prioritize: "Priorizar", validate: "Validar", monitor: "Monitorar" },
  ja: { prioritize: "優先", validate: "検証", monitor: "監視" },
};

export function HeroAttentionField({ locale }: { locale: LandingLocale }) {
  const [selected, setSelected] = useState(0);
  const account = LANDING_COMPARISON.accounts[selected];
  const detail = DETAILS[selected];
  const copy = LABELS[locale];

  return <div className={styles.shell} aria-label={copy.title}>
    <div className={styles.header}><span>{copy.title}</span><span>{copy.hint}</span></div>
    <div className={styles.field}>
      <svg className={styles.trace} viewBox="0 0 1200 520" preserveAspectRatio="none" aria-hidden="true">
        <path d="M90 395 C250 390 250 120 455 150 S720 420 920 252 S1080 114 1160 118" />
        <path className={styles.openTrace} d="M455 150 C650 105 790 145 1045 390" />
      </svg>

      <div className={styles.source}><i aria-hidden="true" /><span>{copy.evidence}</span><strong>{detail.source}</strong></div>

      <div className={styles.companyPicker} role="group" aria-label={copy.hint}>
        {LANDING_COMPARISON.accounts.map((item, index) => <button
          type="button"
          key={item.name}
          aria-pressed={selected === index}
          className={selected === index ? styles.selectedCompany : undefined}
          onClick={() => setSelected(index)}
        ><span>{item.short}</span><small>{DECISIONS[locale][item.decision]}</small></button>)}
      </div>

      <article className={styles.focus} aria-live="polite">
        <div className={styles.corners} aria-hidden="true"><i /><i /><i /><i /></div>
        <div className={styles.focusTop}><span>{account.name}</span><b data-decision={account.decision}>{DECISIONS[locale][account.decision]}</b></div>
        <p className={styles.label}>{copy.observed}</p><h2>{account.changed}</h2>
        <div className={styles.reason}><span>{copy.meaning}</span><p>{detail.meaning}</p></div>
      </article>

      <div className={styles.unknown}><i aria-hidden="true" /><span>{copy.open}</span><strong>{account.unknown}</strong></div>
    </div>
    <p className={styles.disclosure}>{copy.sample}</p>
  </div>;
}
