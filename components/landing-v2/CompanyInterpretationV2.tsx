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

  // Restored LeadLens Read depth — every field is projected from canonical Stage-A output
  // (told/inferred), with the illustrative default only until the visitor interprets their own
  // context. No fabricated capabilities; no external research is implied.
  const criteria = result?.inferred.signalsToWatch.slice(0, 3) ?? copy.defaultCriteria;
  const summary = result?.told.offer || result?.told.summary || copy.defaultSummary;
  const target =
    (result?.told.target.length ? result.told.target : result?.discovery.candidateOrgTypes ?? [])
      .slice(0, 2).join(" · ") || copy.defaultTarget;
  const objective = result?.inferred.objectiveLabel || copy.defaultObjective;
  // Why those developments matter — a stable, methodology-level explanation (why this KIND of change
  // creates a commercial reason to engage). Kept constant rather than surfacing a raw opportunity
  // condition, which would only echo the investigate list and read as a fragment, not an explanation.
  const why = copy.defaultWhy;
  const boundary = result?.disclosure ?? copy.disclosure;

  return <section className={`${styles.section} ${styles.interpretation}`} id="interpretation">
    <div className={styles.interpretCopy}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p><h2>{copy.title}</h2><p>{copy.body}</p>
      <label htmlFor={inputId}>{copy.label}</label>
      <textarea id={inputId} rows={4} maxLength={600} value={input} onChange={(e) => setInput(e.target.value)} />
      <button type="button" onClick={interpret} disabled={status === "loading"}>{status === "loading" ? copy.loading : copy.action}</button>
      {status === "error" && <p role="alert" className={styles.error}>{copy.error}</p>}
    </div>
    <div className={styles.interpretResult} aria-live="polite">
      <span>{copy.result}</span>
      <dl className={styles.readFields}>
        <div><dt>{copy.sell}</dt><dd>{summary}</dd></div>
        <div><dt>{copy.target}</dt><dd>{target}</dd></div>
        <div><dt>{copy.objective}</dt><dd>{objective}</dd></div>
        <div className={styles.readList}><dt>{copy.criteria}</dt><dd><ul>{criteria.map((item) => <li key={item}>{item}</li>)}</ul></dd></div>
        <div><dt>{copy.whyMatters}</dt><dd className={styles.readWhy}>{why}</dd></div>
      </dl>
      <small>{boundary}</small>
    </div>
  </section>;
}
