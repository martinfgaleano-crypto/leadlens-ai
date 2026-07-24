// Unit tests: market-to-account-v1 (segments, structural multi-score, selection).
import { classifyBuyerSegment, computeStructuralScores, selectAccounts, buildMarketLandscape, type RankedAccount } from "@/lib/discovery/market-to-account";
let p = 0, f = 0; const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// Segmentation
t("'Tienda Ser Saludable' → retail", classifyBuyerSegment("Ser Saludable", "tienda saludable").primarySegment === "retail");
t("'GHL Hoteles' → hospitality", classifyBuyerSegment("GHL Hoteles", "hoteleria").primarySegment === "hospitality");
t("'Alimentos Sostenibles distribuidor' → distribution", classifyBuyerSegment("Alimentos Sostenibles", "distribuidor de alimentos").primarySegment === "distribution");
t("'Spa Luna' → wellness", classifyBuyerSegment("Spa Luna Wellness", "spa").primarySegment === "wellness");
t("nombre genérico → unclassified con fit bajo", (() => { const a = classifyBuyerSegment("Bawana", null); return a.primarySegment === "unclassified" && a.segmentFit < 45; })());
t("buyerType poblado", !!classifyBuyerSegment("Café Central", "cafeteria").buyerType);

// Structural scores — timing is separate; channel-only never act_now
const retailSeg = classifyBuyerSegment("Ser Saludable", "tienda saludable");
const noTiming = computeStructuralScores({ segment: retailSeg, visibility: "emerging", hasDomain: true, baseScore: 72, daysOld: null, corroboration: "low", isChannelOnly: true });
t("channel-only + sin fecha → NO act_now", noTiming.actionability !== "act_now");
t("channel-only con fit/evidence → validate_first o monitor", ["validate_first", "monitor"].includes(noTiming.actionability));
t("timing bajo sin fecha", noTiming.timing < 40);
const fresh = computeStructuralScores({ segment: retailSeg, visibility: "emerging", hasDomain: true, baseScore: 80, daysOld: 30, corroboration: "high", isChannelOnly: false });
t("evento fresco + evidencia + fit → act_now", fresh.actionability === "act_now", JSON.stringify(fresh));
t("scores separados (fit≠timing)", fresh.fit !== fresh.timing);

// Selection with segment diversity
const mk = (name: string, sector: string, vis: string, base: number): RankedAccount => { const seg = classifyBuyerSegment(name, sector); return { company: name, domain: name.length % 2 ? "x.com" : null, sector, visibility: vis, segment: seg, scores: computeStructuralScores({ segment: seg, visibility: vis as never, hasDomain: true, baseScore: base, daysOld: null, corroboration: "low", isChannelOnly: true }) }; };
const universe = [mk("Ser Saludable", "tienda saludable", "emerging", 72), mk("Luna Verde", "tienda natural", "emerging", 61), mk("PURE", "tienda saludable", "emerging", 61), mk("GHL Hoteles", "hotel", "obvious", 69), mk("Spa Zen", "spa", "emerging", 55)];
const sel = selectAccounts(universe, 3, 2);
t("selección respeta topN", sel.length <= 3);
t("selección no es todo un segmento (diversidad)", new Set(sel.map((a) => a.segment.primarySegment)).size >= 2);

// Market landscape
const land = buildMarketLandscape(universe, { shortlisted: 3, validation_candidates: 2, dynamic_opportunities: 0 });
t("landscape agrega segmentos", land.segments.length >= 2);
t("landscape funnel coherente", land.funnel.discovered === universe.length && land.funnel.dynamic_opportunities === 0);
t("landscape top_by_segment poblado", Object.keys(land.top_by_segment).length >= 2);
t("landscape marca universo pequeño como limitación", land.limitations.some((l) => l.includes("ampliar") || l.includes("Universo")));

console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
