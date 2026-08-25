// Landing ↔ real Stage A integration guards (Phase 2, Commit B). Ensures the
// live Company Interpretation no longer relies on the deterministic fixture and
// is truthful about what did (and did not) happen.
import { readFileSync } from "node:fs";
let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const src = readFileSync("app/demo-pipeline/page.tsx", "utf8");
const client = readFileSync("lib/interpretation/interpret-client.ts", "utf8");
const route = readFileSync("app/api/interpret/route.ts", "utf8");

// §9/§47.1: the normal path calls the real service, not the deterministic fixture.
t("landing calls the real Stage A API via requestInterpretation", /requestInterpretation\(/.test(src) && /from "@\/lib\/interpretation\/interpret-client"/.test(src));
t("landing no longer imports/uses the deterministic interpretLandingInput as the normal path", !/interpretLandingInput/.test(src));
t("client posts to /api/interpret and imports only the PublicInterpretation TYPE (no server code)",
  /fetch\("\/api\/interpret"/.test(client) && /import type \{ PublicInterpretation \}/.test(client));

// §25: explicit UI states.
t("UI models loading / done / error states + clarification + unsupported",
  /status === "loading"/.test(src) && /status === "error"/.test(src) &&
  /r\.status === "needs_clarification"/.test(src) && /r\.status === "unsupported_objective"/.test(src) &&
  /r\.status === "ready_for_confirmation"/.test(src));
t("no fake progress percentage", !/Understanding \d+%|\d+% (understood|complete)/.test(src));

// §10: told vs inferred distinction.
t("UI distinguishes what you told us vs what LeadLens inferred", /sa\.told/.test(src) && /sa\.inferred/.test(src));

// §11: truthful disclosure, no research/verification claims.
t("truthful disclosure: 'No external account research has run yet' (4 locales in SA_COPY)",
  (src.match(/No external account research has run/g) || []).length >= 1 &&
  /noResearch:/.test(src) && (src.match(/noResearch:/g) || []).length >= 1);
t("no false claim that research ran / companies were found / facts verified",
  !/companies were found|accounts were found|externally verified|market research (ran|complete)/i.test(src));

// §12: heading is broader commercial-context framing, not 'what you sell'.
t("interpretation heading is objective-framed, not 'Tell LeadLens what you sell'",
  /title: "Tell LeadLens what your business is trying to achieve\."/.test(src) && !/title: "Tell LeadLens what you sell/.test(src));

// §14/§31: international default, no Colombia/LatAm/jewelry anchoring in the interpretation examples.
t("default interpretation example is the international supply-chain scenario",
  /placeholder: "We provide supply-chain planning software to mid-sized manufacturers/.test(src));
t("INTERPRET_EXAMPLES contain no Colombia/LatAm/jewelry anchoring",
  (() => { const m = src.match(/const INTERPRET_EXAMPLES[\s\S]*?\n\};/); return !!m && !/colombia|latin ?america|latam|am[eé]rica latina|jewelry|joyer/i.test(m[0]); })());

// §30: the synthetic sample is not presented as generated from user input.
t("sample canvas carries a truthful 'not generated from your description' transition",
  /not generated from your description/.test(src) && /SAMPLE_TRANSITION/.test(src));

// §23/§39: the route/client never touch research providers, keys stay server-side.
t("route imports the server service; client never imports the server service",
  /from "@\/lib\/interpretation\/interpret-service"/.test(route) && !/interpret-service/.test(client));
t("no research provider import in route/client", !/tavily|serper|firecrawl|\bexa\b|\bbrave\b/i.test(route) && !/tavily|serper|firecrawl|\bexa\b|\bbrave\b/i.test(client));

// §37: default example shows a precomputed seed, no model call on passive view.
t("default example is a precomputed seed (no LLM call on mount)",
  /DEFAULT_INTERPRETATION/.test(src) && /useState<PublicInterpretation \| null>\(DEFAULT_INTERPRETATION\)/.test(src) && !/useEffect\(\(\) => \{ run\(input/.test(src));

// §11: investigation brief surfaces routes-to-evaluate (hypotheses) + gaps.
t("investigation brief renders routes-to-evaluate as hypotheses + gaps, progressive disclosure",
  /routesToEvaluate/.test(src) && /sa\.routesHint/.test(src) && /sa\.gaps/.test(src) && /setExpanded/.test(src) && /What LeadLens would investigate/.test(src));

// §22/§23: one-time is no longer the primary commercial identity.
t("hero price note is neutral 'Plans from $7' (no 'one-time' identity)",
  /heroPriceNote:\s*"Plans from \$7\."/.test(src) && !/heroPriceNote:\s*"[^"]*one-time/.test(src));
t("final CTA is neutral 'Get started →' (no $7/one-time anchor)",
  /ctaCTA:\s*"Get started →"/.test(src) && !/ctaCTA:\s*"[^"]*(one-time|\$7)/.test(src));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
