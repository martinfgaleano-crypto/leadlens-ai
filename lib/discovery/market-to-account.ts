// ─── Market-to-Account Intelligence (market-to-account-v1) ───────────────────
// Formalizes the architecture shift: market → buyer segments → company universe
// → structural ranking (SEPARATE Fit / Attractiveness / Timing / Evidence
// scores) → selection → deep research. An account does NOT need a recent signal
// to enter the universe; timing is a separate axis, not an entry gate. Pure and
// deterministic so it is testable and consistent across Report/Brief/PDF/Admin.

export const MARKET_TO_ACCOUNT_VERSION = "market-to-account-v1";

export type BuyerSegment =
  | "hospitality" | "wellness" | "retail" | "distribution"
  | "food_service" | "corporate" | "amenities" | "unclassified";

export interface SegmentDef {
  id: BuyerSegment; label: string;
  match: RegExp;                 // name/sector/domain keywords
  ease_of_entry: number;         // 0-100 (higher = easier to sell into)
  commercial_potential: number;  // 0-100 (volume × recurrence)
  note: string;
}

// Attractiveness priors for a wellness/botanical-beverage brand (Amor de Gea).
// Not run-specific; a matched account inherits its segment's priors and refines
// them with observed evidence. Order roughly by strategic value.
export const SEGMENTS: SegmentDef[] = [
  { id: "retail", label: "Retail saludable / premium", match: /(tienda|market|supermercad|saludable|natural|org[aá]nic|concept ?store|mercad|abarrote|minimarket|fresh)/i, ease_of_entry: 62, commercial_potential: 82, note: "Volumen y recompra altos; entrada media (surtido/category management)." },
  { id: "distribution", label: "Distribución / mayorista", match: /(distribuidor|mayorist|importa|comercializ|abastec|wholesale|deposito|canal especializado)/i, ease_of_entry: 48, commercial_potential: 88, note: "Mayor volumen; ciclo más largo, decisión de portafolio." },
  { id: "hospitality", label: "Hospitality (hoteles/resorts)", match: /(hotel|resort|hospedaje|hoster|hostal|lodge|boutique)/i, ease_of_entry: 70, commercial_potential: 66, note: "Acceso por canal/amenities; recompra media, decisión de F&B/compras." },
  { id: "wellness", label: "Wellness (spa/centros)", match: /(spa|wellness|bienestar|retiro|retreat|yoga|terapia|holíst|holist|salud integral)/i, ease_of_entry: 74, commercial_potential: 58, note: "Alta afinidad de marca; tickets menores, buena vitrina." },
  { id: "food_service", label: "Food service (café/restaurante)", match: /(caf[eé]|restaurant|bistr[oó]|gastro|coffee|ter[ií]a|catering|panader|reposter)/i, ease_of_entry: 66, commercial_potential: 64, note: "Cartas/menús; recompra por consumo, decisión operativa." },
  { id: "corporate", label: "Corporate / gifting / bienestar laboral", match: /(corporativo|gifting|regalo|obsequio|empresarial|beneficios|recursos humanos|employee|bienestar laboral|institucional)/i, ease_of_entry: 58, commercial_potential: 70, note: "Compras por campaña (gifting/wellness laboral); estacional." },
  { id: "amenities", label: "Amenities / kits", match: /(amenit|welcome kit|kit de bienvenida|room experience|welcome pack|hu[eé]sped)/i, ease_of_entry: 60, commercial_potential: 60, note: "Kits/experiencia de huésped; volumen ligado a ocupación." },
];

export interface SegmentAssessment {
  primarySegment: BuyerSegment;
  secondarySegments: BuyerSegment[];
  buyerType: string;
  roleConfidence: "high" | "medium" | "low";
  segmentFit: number;            // 0-100
  segmentEvidence: string;
}

const BUYER_TYPE: Record<BuyerSegment, string> = {
  retail: "Comprador de surtido / category manager", distribution: "Comprador de portafolio / mayorista",
  hospitality: "F&B / compras / experiencia de huésped", wellness: "Dueño/gerente de spa o centro",
  food_service: "Chef / operaciones / compras", corporate: "RRHH / compras / marketing",
  amenities: "Operador de amenities", unclassified: "Rol comercial por determinar",
};

/** Classify an account into buyer segments from its name/sector/domain. */
export function classifyBuyerSegment(name: string, sector: string | null, extra = ""): SegmentAssessment {
  const hay = `${name} ${sector ?? ""} ${extra}`.toLowerCase();
  const hits = SEGMENTS.filter((s) => s.match.test(hay));
  if (hits.length === 0) {
    return { primarySegment: "unclassified", secondarySegments: [], buyerType: BUYER_TYPE.unclassified, roleConfidence: "low", segmentFit: 35, segmentEvidence: "Sin señales de segmento en nombre/sector; requiere investigación." };
  }
  const primary = hits[0];
  const secondary = hits.slice(1, 3).map((s) => s.id);
  const conf: SegmentAssessment["roleConfidence"] = hits.length >= 2 ? "high" : /(tienda|hotel|spa|distribuidor|caf[eé]|restaurant)/i.test(hay) ? "medium" : "low";
  const segmentFit = Math.min(100, Math.round((primary.commercial_potential * 0.6 + primary.ease_of_entry * 0.4)));
  return { primarySegment: primary.id, secondarySegments: secondary, buyerType: BUYER_TYPE[primary.id], roleConfidence: conf, segmentFit, segmentEvidence: `Coincide con ${primary.label}${secondary.length ? ` (+${secondary.join(", ")})` : ""}.` };
}

export type Actionability = "act_now" | "validate_first" | "monitor" | "exclude";
export interface StructuralScores {
  fit: number; attractiveness: number; timing: number; evidence: number;
  actionability: Actionability; actionability_reason: string;
}

export interface StructuralInput {
  segment: SegmentAssessment;
  visibility: "obvious" | "emerging" | "unknown" | string;
  hasDomain: boolean;
  baseScore: number | null;      // universe confidence from discovery
  daysOld: number | null;        // signal recency; null = no dated event
  corroboration: "high" | "medium" | "low" | "insufficient" | null;
  isChannelOnly: boolean;        // only channel fit, no buying event
}

/** Separate structural scores. Timing is NOT an entry gate; channel-only never
 *  reaches act_now on its own (preserves channel_fit_not_buying_intent). */
export function computeStructuralScores(i: StructuralInput): StructuralScores {
  const seg = SEGMENTS.find((s) => s.id === i.segment.primarySegment);
  const fit = Math.round(i.segment.segmentFit * 0.7 + (i.hasDomain ? 30 : 15) * (i.segment.roleConfidence === "high" ? 1 : i.segment.roleConfidence === "medium" ? 0.8 : 0.5));
  const noveltyBonus = i.visibility === "emerging" ? 18 : i.visibility === "obvious" ? -6 : 6;
  const attractiveness = Math.max(0, Math.min(100, Math.round((seg ? (seg.commercial_potential + seg.ease_of_entry) / 2 : 40) + noveltyBonus + (i.baseScore ? (i.baseScore - 50) * 0.2 : 0))));
  const timing = i.daysOld == null ? 8 : i.daysOld <= 60 ? 90 : i.daysOld <= 120 ? 62 : i.daysOld <= 180 ? 40 : 18;
  const evidenceMap: Record<string, number> = { high: 85, medium: 60, low: 35, insufficient: 15 };
  const evidence = Math.min(100, (i.corroboration ? evidenceMap[i.corroboration] : 25) + (i.hasDomain ? 10 : 0));

  let actionability: Actionability; let reason: string;
  if (i.segment.primarySegment === "unclassified" && fit < 45) { actionability = "exclude"; reason = "Segmento no resuelto y fit bajo."; }
  else if (i.isChannelOnly || timing < 40) { actionability = fit >= 60 && evidence >= 45 ? "validate_first" : "monitor"; reason = i.isChannelOnly ? "Solo fit de canal (channel_fit_not_buying_intent): validar antes de actuar." : "Sin timing reciente: monitorear."; }
  else if (timing >= 62 && evidence >= 60 && fit >= 60) { actionability = "act_now"; reason = "Fit + evidencia + timing recientes: accionable."; }
  else { actionability = "validate_first"; reason = "Fit atractivo pero timing/evidencia requieren validación."; }
  return { fit: Math.min(100, fit), attractiveness, timing, evidence, actionability, actionability_reason: reason };
}

export interface RankedAccount {
  company: string; domain: string | null; sector: string | null;
  segment: SegmentAssessment; scores: StructuralScores; visibility: string;
}

/** Select for research with segment diversity: top by a structural composite
 *  (attractiveness-led, timing does NOT dominate), capped per segment so the
 *  shortlist is not all one type. */
export function selectAccounts(accounts: RankedAccount[], topN: number, perSegmentCap = 3): RankedAccount[] {
  const composite = (a: RankedAccount) => a.scores.attractiveness * 0.45 + a.scores.fit * 0.35 + a.scores.evidence * 0.12 + a.scores.timing * 0.08;
  const sorted = [...accounts].filter((a) => a.scores.actionability !== "exclude").sort((x, y) => composite(y) - composite(x));
  const perSeg: Record<string, number> = {}; const out: RankedAccount[] = [];
  for (const a of sorted) {
    const seg = a.segment.primarySegment;
    if ((perSeg[seg] ?? 0) >= perSegmentCap) continue;
    perSeg[seg] = (perSeg[seg] ?? 0) + 1; out.push(a);
    if (out.length >= topN) break;
  }
  return out;
}

export interface MarketLandscape {
  total_accounts: number; verified_with_domain: number;
  segments: Array<{ id: BuyerSegment; label: string; count: number; high_fit: number; ease_of_entry: number; commercial_potential: number; note: string }>;
  buyer_types: Array<{ type: string; count: number }>;
  funnel: { discovered: number; verified: number; high_fit: number; shortlisted: number; validation_candidates: number; dynamic_opportunities: number; monitor: number };
  top_by_segment: Record<string, Array<{ company: string; fit: number; attractiveness: number; actionability: Actionability }>>;
  limitations: string[];
}

/** Build a market landscape from a ranked universe (no live cost). */
export function buildMarketLandscape(accounts: RankedAccount[], opts: { shortlisted?: number; validation_candidates?: number; dynamic_opportunities?: number } = {}): MarketLandscape {
  const segMap = new Map<BuyerSegment, { count: number; high_fit: number }>();
  const buyerMap = new Map<string, number>();
  for (const a of accounts) {
    const s = a.segment.primarySegment;
    const e = segMap.get(s) ?? { count: 0, high_fit: 0 }; e.count++; if (a.scores.fit >= 65) e.high_fit++; segMap.set(s, e);
    buyerMap.set(a.segment.buyerType, (buyerMap.get(a.segment.buyerType) ?? 0) + 1);
  }
  const segments = Array.from(segMap.entries()).map(([id, v]) => {
    const def = SEGMENTS.find((d) => d.id === id);
    return { id, label: def?.label ?? id, count: v.count, high_fit: v.high_fit, ease_of_entry: def?.ease_of_entry ?? 40, commercial_potential: def?.commercial_potential ?? 40, note: def?.note ?? "Segmento por caracterizar." };
  }).sort((a, b) => b.count - a.count);
  const top_by_segment: MarketLandscape["top_by_segment"] = {};
  for (const seg of segments) {
    top_by_segment[seg.id] = accounts.filter((a) => a.segment.primarySegment === seg.id)
      .sort((x, y) => (y.scores.attractiveness + y.scores.fit) - (x.scores.attractiveness + x.scores.fit))
      .slice(0, 3).map((a) => ({ company: a.company, fit: a.scores.fit, attractiveness: a.scores.attractiveness, actionability: a.scores.actionability }));
  }
  const highFit = accounts.filter((a) => a.scores.fit >= 65).length;
  const monitor = accounts.filter((a) => a.scores.actionability === "monitor").length;
  const limitations: string[] = [];
  if (accounts.length < 30) limitations.push(`Universo de ${accounts.length} cuentas — ampliar a 40–100 en la próxima corrida para robustez estadística.`);
  if (segMap.get("unclassified")?.count) limitations.push(`${segMap.get("unclassified")!.count} cuentas sin segmento resuelto — requieren investigación de rol.`);
  return {
    total_accounts: accounts.length,
    verified_with_domain: accounts.filter((a) => a.domain).length,
    segments, buyer_types: Array.from(buyerMap.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    funnel: { discovered: accounts.length, verified: accounts.filter((a) => a.domain).length, high_fit: highFit, shortlisted: opts.shortlisted ?? 0, validation_candidates: opts.validation_candidates ?? 0, dynamic_opportunities: opts.dynamic_opportunities ?? 0, monitor },
    top_by_segment, limitations,
  };
}
