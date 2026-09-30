// ─── Opportunity Test (opportunity-test-v1) ──────────────────────────────────
// Fail-closed gate applied AFTER a signal is found for a known company. An
// opportunity exists ONLY when identity + fit + a real dated material event +
// a plausible commercial relationship + timing + evidence all hold. Any hard
// blocker → reject, regardless of how "relevant" the article reads. Pure and
// deterministic; the LLM never rescues a signal that fails a hard blocker.

import { classifyEntity } from "@/lib/vault/entity-resolution";

export const OPPORTUNITY_TEST_VERSION = "opportunity-test-v1";

export interface OpportunityInput {
  company: string;
  company_from_universe: boolean;   // came from the verified company-first universe
  signal_summary: string | null;
  signal_type: string | null;
  signal_date: string | null;       // resolved publication/event date (ISO) or null
  date_confidence: "high" | "medium" | "low" | "none";
  source_url: string | null;
  source_type: string | null;       // news/official/company_website/…
  company_in_content: boolean;      // the company name appears in the extracted body
  grounded: boolean;                // extraction ok + claim supported
  matches_needs_family: boolean;    // a needs-family EVENT verb appears in title/content
  /** Geography check: content/domain confirms the target region (guards against
   *  same-named foreign homonyms, e.g. CO "Bavaria" vs German "Bavaria"). */
  geography_confirmed: boolean;
  region_required: boolean;         // whether a region check applies (es/CO runs)
  /** Verified official-site EVIDENCE that this account accepts/distributes external
   * brands (a found vendor/supplier/onboarding page). This is verified channel
   * ACCESS — a channel-fit investigation, never buying intent. */
  channel_access_verified?: boolean;
  /** An official commercial-entry mechanism was fetched live and is currently
   * usable (for example an active product-submission portal). Not buying intent. */
  current_actionability_verified?: boolean;
  /** A resolved-identity account in a plausible commercial ROUTE (e.g. a verified
   * reseller) that is worth validating as a market-entry route — WITHOUT verified
   * channel access and WITHOUT a dated event. This is route-fit / strategic
   * validation, NOT verified access and NOT buying intent; it is kept separate from
   * channel_access_verified so the two are never conflated (§8.1). */
  strategic_route_validatable?: boolean;
  corporate_identity_verified?: boolean;
}

// Non-event reference pages: encyclopedias, app stores, profile/aggregator and
// review sites are never a dated commercial EVENT, regardless of the company.
const NON_EVENT_URL = /(wikipedia\.org|\.fandom\.|play\.google\.|apps\.apple\.|tracxn\.com|crunchbase\.com|trustpilot\.|glassdoor\.|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com|twitter\.com|x\.com\/|\/directorio|\/directory|paginasamarillas)/i;

export type OppStatus = "opportunity" | "investigate" | "monitor" | "reject";
export interface OpportunityVerdict {
  status: OppStatus;
  hard_blockers: string[];
  soft_flags: string[];
  reason: string;
}

function daysOld(iso: string | null): number | null {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null;
}

export function opportunityTest(i: OpportunityInput): OpportunityVerdict {
  const hard: string[] = [], soft: string[] = [];
  // A verified channel (real onboarding evidence) OR an explicit strategic-route
  // validation basis exempts the dated-event blockers below — both are structural,
  // non-event bases for VALIDATE. They remain DISTINCT verdicts (see tiering).
  const eventExempt = i.channel_access_verified || i.strategic_route_validatable;

  // ── Identity (hard) ──
  const cls = classifyEntity({ name: i.company, sourceUrl: i.source_url, sourceType: i.source_type, signalType: i.signal_type });
  if (!i.corporate_identity_verified && (cls.entity_class !== "single_company" || !cls.primary_account)) hard.push(`identity_${cls.entity_class}`);
  if (!i.company_in_content) hard.push("signal_not_associated_with_company");
  if (!i.source_url) hard.push("no_source");

  // ── Event (hard/soft) ──
  // A verified multi-brand channel (the account's own official vendor/supplier
  // page) is itself the qualifying structural signal for a channel-fit opportunity,
  // so it exempts the dated-event blockers below (no_event / no_material_event /
  // no_valid_date) exactly as the existing channel_access_verified exemptions do.
  // Identity, grounding and source blockers still apply. Without this, the
  // channel-fit → "investigate" verdict (line ~83) was unreachable for a null
  // signal_summary and every no-trigger account collapsed to reject/HOLD (§51).
  if (!i.signal_summary && !eventExempt) hard.push("no_event");
  if (!i.grounded) hard.push("ungrounded_claim");
  if (i.source_url && NON_EVENT_URL.test(i.source_url)) hard.push("non_event_reference_page");
  if (!i.matches_needs_family && !eventExempt) hard.push("no_material_event");
  if (i.region_required && !i.geography_confirmed) hard.push("geography_mismatch_or_homonym");
  if ((!i.signal_date || i.date_confidence === "none") && !eventExempt) hard.push("no_valid_date");
  else if (i.date_confidence === "low") soft.push("low_date_confidence");
  const age = daysOld(i.signal_date);
  // Publication age governs dated timing signals, not evergreen official
  // channel capability. A distributor page from 2018 can still describe the
  // current operation; liveness is handled by successful live extraction.
  if (!eventExempt && age !== null && age > 180) hard.push("stale_beyond_180d");
  else if (!eventExempt && age !== null && age > 90) soft.push("aging_signal");

  // ── Commercial relationship: the material-event check above already
  //    requires a needs-family verb; universe membership carries fit. ──

  // ── Fit (soft — universe membership is the strong fit signal) ──
  if (!i.company_from_universe) soft.push("company_not_in_verified_universe");

  if (hard.length) return { status: "reject", hard_blockers: hard, soft_flags: soft, reason: `Bloqueado por: ${hard.join(", ")}` };
  if (i.channel_access_verified && i.current_actionability_verified) {
    return { status: "opportunity", hard_blockers: [], soft_flags: ["ongoing_access_not_buying_intent", ...soft], reason: "Mecanismo comercial oficial y actualmente accesible verificado; justifica atención comercial ahora, sin afirmar intención de compra." };
  }
  if (i.channel_access_verified && !i.matches_needs_family) {
    // Verified channel ACCESS: real onboarding/vendor evidence from the account's source.
    return { status: "investigate", hard_blockers: [], soft_flags: ["channel_fit_not_buying_intent", ...soft], reason: "Canal multimarca verificado en fuente corporativa; no prueba intención de compra ni timing. Validar categoría, onboarding y decisor." };
  }
  if (i.strategic_route_validatable && !i.matches_needs_family) {
    // Strategic ROUTE validation: plausible commercial route + verified identity, but
    // channel access is NOT verified and there is no dated event. Explicitly labeled
    // so it is never presented as verified access or buying intent (§8.1).
    return { status: "investigate", hard_blockers: [], soft_flags: ["strategic_route_validation", "channel_access_not_verified", "not_buying_intent", ...soft], reason: "Ruta comercial plausible con identidad verificada; acceso al canal NO verificado y sin evento datado. Validar la ruta (categoría, mecanismo de onboarding, decisor) antes de priorizar." };
  }
  // No hard blockers → tier by soft flags.
  if (soft.includes("aging_signal") || soft.includes("low_date_confidence")) {
    return { status: "monitor", hard_blockers: [], soft_flags: soft, reason: "Señal real y de la empresa correcta, pero timing débil o fecha poco confiable — monitorear." };
  }
  if (soft.includes("company_not_in_verified_universe")) {
    return { status: "investigate", hard_blockers: [], soft_flags: soft, reason: "Evento válido y asociado, pero la empresa no vino del universo verificado — investigar fit antes de contactar." };
  }
  return { status: "opportunity", hard_blockers: [], soft_flags: soft, reason: "Empresa correcta, evento material reciente, relación comercial plausible — oportunidad revisable." };
}
