"use client";

import { useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./commercial-intelligence-explorer.module.css";

type Lens = "prioritize" | "why" | "evidence" | "compare" | "validate" | "monitor";

const CONTENT: Record<LandingLocale, { label: string; frame: string; company: string; attention: string; lenses: Record<Lens, { label: string; title: string; body: string; trace: string; outcome: string }> }> = {
  en: { label: "Commercial intelligence in action", frame: "One commercial objective · a clearer allocation of attention", company: "Company", attention: "Attention", lenses: {
    prioritize: { label: "Prioritize", title: "Put attention where the case is strongest.", body: "LeadLens weighs fit, timing and evidence together—then keeps weaker companies visible without treating every signal as an opportunity.", trace: "12 companies compared · 2 justify attention", outcome: "Focus commercial effort before spending it" },
    why: { label: "Why now", title: "See what changed—and why it matters now.", body: "A dated development is connected to the operation it may affect, without turning a public signal into claimed buying intent.", trace: "Facility expansion · announced 18 days ago", outcome: "Act on timing you can inspect" },
    evidence: { label: "Evidence", title: "Follow the reasoning back to its source.", body: "Verified fact, source and date stay separate from commercial interpretation, so your team can challenge the case.", trace: "Corporate source + independent coverage", outcome: "Decide with an auditable basis" },
    compare: { label: "Compare", title: "Judge companies relative to each other.", body: "The same commercial objective is applied across the set, revealing stronger cases, trade-offs and where uncertainty changes the order.", trace: "Fit × timing × evidence", outcome: "Allocate attention across a portfolio" },
    validate: { label: "Validate", title: "Know the question that could change the decision.", body: "LeadLens surfaces missing ownership, committed vendors and other unresolved conditions instead of hiding them inside a score.", trace: "Open question · procurement ownership", outcome: "Validate the right thing before outreach" },
    monitor: { label: "Monitor", title: "Keep relevant companies in view without forcing action.", body: "A company can remain important even when its current evidence is not strong enough. LeadLens preserves the case and watches for material change.", trace: "Current decision · Monitor", outcome: "Revisit when the evidence changes" },
  } },
  es: { label: "Inteligencia comercial en acción", frame: "Un objetivo comercial · una asignación de atención más clara", company: "Empresa", attention: "Atención", lenses: {
    prioritize: { label: "Priorizar", title: "Pon la atención donde el caso es más sólido.", body: "LeadLens evalúa fit, timing y evidencia en conjunto, y mantiene visibles las empresas débiles sin convertir cada señal en oportunidad.", trace: "12 empresas comparadas · 2 justifican atención", outcome: "Enfoca el esfuerzo comercial antes de gastarlo" },
    why: { label: "Por qué ahora", title: "Entiende qué cambió y por qué importa ahora.", body: "Un cambio fechado se conecta con la operación que puede afectar, sin presentar una señal pública como intención de compra.", trace: "Expansión de planta · anunciada hace 18 días", outcome: "Actúa sobre un timing que puedes revisar" },
    evidence: { label: "Evidencia", title: "Sigue el razonamiento hasta la fuente.", body: "El hecho, la fuente y la fecha permanecen separados de la interpretación comercial para que tu equipo pueda cuestionar el caso.", trace: "Fuente corporativa + cobertura independiente", outcome: "Decide sobre una base auditable" },
    compare: { label: "Comparar", title: "Evalúa empresas de forma relativa.", body: "El mismo objetivo comercial se aplica a todo el conjunto para revelar casos fuertes, trade-offs y dónde la incertidumbre altera el orden.", trace: "Fit × timing × evidencia", outcome: "Asigna atención en todo el portafolio" },
    validate: { label: "Validar", title: "Conoce la pregunta que puede cambiar la decisión.", body: "LeadLens muestra ownership, proveedores comprometidos y otras condiciones sin resolver, en lugar de esconderlas en un puntaje.", trace: "Pregunta abierta · ownership de compras", outcome: "Valida lo correcto antes del contacto" },
    monitor: { label: "Monitorear", title: "Mantén empresas relevantes a la vista sin forzar acción.", body: "Una empresa puede seguir siendo importante aunque la evidencia actual no alcance. LeadLens conserva el caso y observa cambios materiales.", trace: "Decisión actual · Monitorear", outcome: "Retómala cuando cambie la evidencia" },
  } },
  pt: { label: "Inteligência comercial em ação", frame: "Um objetivo comercial · uma alocação de atenção mais clara", company: "Empresa", attention: "Atenção", lenses: {
    prioritize: { label: "Priorizar", title: "Coloque atenção onde o caso é mais forte.", body: "A LeadLens avalia fit, timing e evidência em conjunto sem transformar todo sinal em oportunidade.", trace: "12 empresas comparadas · 2 justificam atenção", outcome: "Direcione o esforço comercial antes de gastá-lo" },
    why: { label: "Por que agora", title: "Veja o que mudou e por que importa agora.", body: "Um fato datado é conectado à operação afetada sem virar uma alegação de intenção de compra.", trace: "Expansão de fábrica · há 18 dias", outcome: "Aja sobre um timing verificável" },
    evidence: { label: "Evidência", title: "Siga o raciocínio até a fonte.", body: "Fato, fonte e data ficam separados da interpretação comercial.", trace: "Fonte corporativa + cobertura independente", outcome: "Decida com uma base auditável" },
    compare: { label: "Comparar", title: "Avalie empresas umas contra as outras.", body: "O mesmo objetivo revela casos fortes, trade-offs e o efeito da incerteza na ordem.", trace: "Fit × timing × evidência", outcome: "Distribua atenção no portfólio" },
    validate: { label: "Validar", title: "Saiba qual pergunta pode mudar a decisão.", body: "A LeadLens expõe condições não resolvidas em vez de escondê-las numa pontuação.", trace: "Pergunta aberta · responsabilidade de compras", outcome: "Valide o ponto certo antes do contato" },
    monitor: { label: "Monitorar", title: "Mantenha empresas relevantes em vista sem forçar ação.", body: "A LeadLens preserva o caso quando a evidência ainda não justifica agir.", trace: "Decisão atual · Monitorar", outcome: "Retome quando a evidência mudar" },
  } },
  ja: { label: "コマーシャルインテリジェンスの実践", frame: "一つの商業目標 · より明確な注力配分", company: "企業", attention: "注力", lenses: {
    prioritize: { label: "優先", title: "最も根拠の強い企業に注力。", body: "適合度、タイミング、根拠を合わせて評価し、すべてのシグナルを機会とは扱いません。", trace: "12社比較 · 2社が注目に値する", outcome: "営業工数を使う前に集中先を決定" },
    why: { label: "なぜ今", title: "何が変わり、なぜ今重要かを確認。", body: "日付のある変化を業務への影響と結びつけ、購買意向とは断定しません。", trace: "工場拡張 · 18日前に発表", outcome: "検証できるタイミングで行動" },
    evidence: { label: "根拠", title: "判断を情報源までたどる。", body: "事実、出典、日付を商業的解釈と分離して表示します。", trace: "企業発表 + 独立した報道", outcome: "監査可能な根拠で判断" },
    compare: { label: "比較", title: "企業を相対的に評価。", body: "同じ商業目標で比較し、強いケースと不確実性による順位変化を示します。", trace: "Fit × Timing × Evidence", outcome: "ポートフォリオ全体に注力を配分" },
    validate: { label: "検証", title: "判断を変えうる確認事項を知る。", body: "未解決の条件をスコア内に隠さず明示します。", trace: "未確認 · 調達責任", outcome: "接触前に重要点を検証" },
    monitor: { label: "監視", title: "行動を強制せず重要企業を追跡。", body: "根拠が不足する企業も保持し、重要な変化を待ちます。", trace: "現在の判断 · 監視", outcome: "根拠が変わった時に再評価" },
  } },
};

export function CommercialIntelligenceExplorer({ locale }: { locale: LandingLocale }) {
  const [selected, setSelected] = useState<Lens>("prioritize");
  const c = CONTENT[locale];
  const active = c.lenses[selected];
  return <section className={styles.shell} aria-label={c.label}>
    <div className={styles.frame}><span>LeadLens</span><p>{c.frame}</p></div>
    <div className={styles.canvas} data-lens={selected}>
      <div className={styles.companyField} aria-hidden="true">
        <div className={styles.accountPrimary}><span>01</span><i /><strong>{c.company}</strong><em>{c.attention}</em></div>
        <div className={styles.accountSecondary}><span>02</span><i /><strong>{c.company}</strong></div>
        <div className={styles.accountTertiary}><span>03</span><i /><strong>{c.company}</strong></div>
        <div className={styles.focusMark}><i /><i /><i /><i /></div>
      </div>
      <button className={`${styles.object} ${styles.prioritize}${selected === "prioritize" ? ` ${styles.selected}` : ""}`} aria-pressed={selected === "prioritize"} onClick={() => setSelected("prioritize")}><span>01</span><strong>{c.lenses.prioritize.label}</strong><i>→</i></button>
      <button className={`${styles.object} ${styles.why}${selected === "why" ? ` ${styles.selected}` : ""}`} aria-pressed={selected === "why"} onClick={() => setSelected("why")}><time>18d</time><span>{c.lenses.why.label}</span></button>
      <button className={`${styles.object} ${styles.evidence}${selected === "evidence" ? ` ${styles.selected}` : ""}`} aria-pressed={selected === "evidence"} onClick={() => setSelected("evidence")}><span>{c.lenses.evidence.label}</span><b /><i /><b /></button>
      <button className={`${styles.object} ${styles.compare}${selected === "compare" ? ` ${styles.selected}` : ""}`} aria-pressed={selected === "compare"} onClick={() => setSelected("compare")}><span>{c.lenses.compare.label}</span><i /><i /><i /></button>
      <button className={`${styles.object} ${styles.validate}${selected === "validate" ? ` ${styles.selected}` : ""}`} aria-pressed={selected === "validate"} onClick={() => setSelected("validate")}><i /><span>{c.lenses.validate.label}</span><b>?</b></button>
      <button className={`${styles.object} ${styles.monitor}${selected === "monitor" ? ` ${styles.selected}` : ""}`} aria-pressed={selected === "monitor"} onClick={() => setSelected("monitor")}><i /><span>{c.lenses.monitor.label}</span><time aria-hidden="true">•• — •</time></button>
      <article className={styles.readout} aria-live="polite" key={selected}><span>{active.label}</span><h2>{active.title}</h2><p>{active.body}</p><div><small>{active.trace}</small><strong>{active.outcome}</strong></div></article>
    </div>
  </section>;
}
