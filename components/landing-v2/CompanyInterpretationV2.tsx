"use client";

import { useId, useRef, useState } from "react";
import { requestInterpretation, type PublicInterpretation } from "@/lib/interpretation/interpret-client";
import type { LandingLocale, LandingV2Copy } from "@/lib/landing/v2-copy";
import styles from "@/app/landing-v2.module.css";

export function CompanyInterpretationV2({ locale, copy }: { locale: LandingLocale; copy: LandingV2Copy["interpretation"] }) {
  const inputId = useId();
  const [input, setInput] = useState(copy.example);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<PublicInterpretation | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function interpret() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStatus("loading");
    const response = await requestInterpretation(input, undefined, locale, controller.signal);
    if (controller.signal.aborted) return;
    if (!response.ok) { setStatus("error"); return; }
    setResult(response.interpretation);
    setStatus("done");
  }

  const criteria = result?.inferred.signalsToWatch.slice(0, 3) ?? copy.defaultCriteria;
  const summary = result?.told.offer || result?.told.summary || copy.defaultSummary;
  const target = result?.told.target.slice(0, 2).join(" · ") || copy.defaultTarget;

  return <section className={`${styles.section} ${styles.interpretation}`} id="interpretation">
    <div className={styles.interpretCopy}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p><h2>{copy.title}</h2><p>{copy.body}</p>
      <label htmlFor={inputId}>{copy.label}</label>
      <textarea id={inputId} rows={4} maxLength={600} value={input} onChange={(e) => setInput(e.target.value)} />
      <button type="button" onClick={interpret} disabled={status === "loading"}>{status === "loading" ? copy.loading : copy.action}</button>
      {status === "error" && <p role="alert" className={styles.error}>{copy.error}</p>}
    </div>
    <div className={styles.interpretResult} aria-live="polite">
      <span>{copy.result}</span><h3>{summary}</h3><p><strong>{copy.target}:</strong> {target}</p>
      <div><strong>{copy.criteria}</strong><ul>{criteria.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <small>{result?.disclosure ?? copy.disclosure}</small>
    </div>
  </section>;
}
