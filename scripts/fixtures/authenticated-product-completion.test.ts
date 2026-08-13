import { readFileSync } from "node:fs";
import { commercialFlowQuery, parseCommercialFlowState, safeCustomerReturnPath } from "@/lib/commercial/customer-flow";
import { normalizeCommercialContext } from "@/lib/commercial/commercial-context";
import { buildCustomerDashboardView } from "@/lib/dashboard/customer-dashboard-view";
import { hasUsableOpportunity } from "@/lib/analytics/customer-lifecycle";
import type { LeadLensReport } from "@/types";

let passed = 0;
function test(name: string, ok: boolean) { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`PASS: ${name}`); }

const flow = parseCommercialFlowState(new URLSearchParams("product_code=intelligence_launch_v0&source_cta=pricing&locale=es&return_to=%2Fdashboard"));
test("canonical product survives auth query", flow?.product_code === "intelligence_launch_v0" && commercialFlowQuery(flow).includes("product_code=intelligence_launch_v0"));
test("legacy plan resolves to canonical product", parseCommercialFlowState(new URLSearchParams("plan=starter"))?.product_code === "brief_launch_v0");
test("unknown product fails closed", parseCommercialFlowState(new URLSearchParams("product_code=enterprise")) === null);
test("external redirect blocked", safeCustomerReturnPath("https://evil.example/x") === "/dashboard");
test("protocol-relative redirect blocked", safeCustomerReturnPath("//evil.example/x") === "/dashboard");
test("approved customer route preserved", safeCustomerReturnPath("/dashboard/searches?tab=ready") === "/dashboard/searches?tab=ready");

const context = normalizeCommercialContext({ company_description: "  Herbal   products ", offer: "Elixirs", buyer: "Hotels", problem_solved: "Wellness", target_countries: ["colombia", "Colombia"], commercial_goal: "Distribution" });
test("target_countries authoritative and deduplicated", context.target_countries.join() === "Colombia");
test("region derived from countries", context.derived_region === "latin_america");
test("commercial context whitespace normalized", context.company_description === "Herbal products");

const dash = buildCustomerDashboardView({ onboarding_completed: true, monitors: [{ latest_report_job_id: "job-1", latest_completed_at: "2026-08-01", has_processing_run: false, has_comparison: false }] });
test("dashboard view uses latest brief not fabricated opportunity", dash.stage === "brief_ready" && dash.latest_brief?.job_id === "job-1");
test("dashboard report route encodes id", dash.primary_action.href === "/results/job-1/brief");

const callback = readFileSync("app/auth/callback/route.ts", "utf8");
const forgot = readFileSync("app/forgot-password/page.tsx", "utf8");
const reset = readFileSync("app/reset-password/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/049_commercial_intents.sql", "utf8");
const onboardingMigration = readFileSync("supabase/migrations/050_authenticated_onboarding_context.sql", "utf8");
const lifecycleMigration = readFileSync("supabase/migrations/051_customer_lifecycle_events.sql", "utf8");
const onboardingRoute = readFileSync("app/api/customer/onboarding/route.ts", "utf8");
const intentRoute = readFileSync("app/api/commercial-intents/route.ts", "utf8");
test("recovery callback reaches password form with browser exchange", callback.includes("/reset-password") && reset.includes("exchangeCodeForSession"));
test("recovery request uses Supabase secure flow", forgot.includes("resetPasswordForEmail"));
test("new password updates authenticated user", reset.includes("updateUser({ password })"));
test("commercial intent user ownership is mandatory", /user_id uuid not null/.test(migration));
test("commercial intent RLS enabled", migration.includes("enable row level security") && migration.includes("auth.uid() = user_id"));
test("commercial intent transitions are server-only", migration.includes("Writes are server-only") && !migration.includes("for update to authenticated"));
test("commercial intent is not modeled as payment", migration.includes("This is not an order") && !migration.includes("amount_paid"));
test("commercial intent updated_at trigger exists", migration.includes("commercial_intents_set_updated_at"));
test("onboarding reuses existing model", onboardingMigration.includes("alter table public.onboarding_requests"));
test("onboarding links intent and product additively", onboardingMigration.includes("commercial_intent_id") && onboardingMigration.includes("product_code"));
test("onboarding intent owner mismatch blocked in database", onboardingMigration.includes("commercial intent owner mismatch"));
test("onboarding RLS owner policies exist", onboardingMigration.includes("auth.uid() = user_id"));
test("onboarding administrative writes are server-only", onboardingMigration.includes("Writes remain server-only") && !onboardingMigration.includes("for update to authenticated"));
test("onboarding API derives owner from verified JWT", onboardingRoute.includes("db.auth.getUser(token)") && onboardingRoute.includes("user_id: auth.user.id"));
test("onboarding requires explicit target countries", onboardingRoute.includes("target_countries") && onboardingRoute.includes(".min(1).max(12)"));
test("onboarding bootstraps missing customer profile server-side", onboardingRoute.includes('from("profiles").upsert') && onboardingRoute.includes('ignoreDuplicates: true'));
test("onboarding claims intent before persistence", onboardingRoute.includes('status: "onboarding_started"') && onboardingRoute.includes('.eq("status", "captured").select("id")'));
test("completed onboarding retry returns existing row", onboardingRoute.includes("intent.onboarding_id") && onboardingRoute.includes("idempotent: true"));
test("lifecycle event idempotency is persisted", lifecycleMigration.includes("unique (user_id, event_name, object_type, object_id)"));
test("browser cannot forge lifecycle milestone insert", !lifecycleMigration.includes("for insert to authenticated"));
test("commercial intent emits privacy-safe ledger event", intentRoute.includes('event_name: "commercial_intent_created"') && intentRoute.includes("metadata: {}"));
test("onboarding emits privacy-safe ledger event", onboardingRoute.includes('event_name: "onboarding_completed"') && onboardingRoute.includes("metadata: {}"));
const usable = { delivery_readiness: { status: "ready" }, actionability_summary: { act_now: 0, validate_first: 1, monitor: 0, exclude: 0 }, processed_leads: [] } as unknown as LeadLensReport;
const empty = { delivery_readiness: { status: "blocked" }, actionability_summary: { act_now: 1, validate_first: 0, monitor: 0, exclude: 0 }, processed_leads: [] } as unknown as LeadLensReport;
test("first value requires usable opportunity", hasUsableOpportunity(usable));
test("blocked delivery never emits first value", !hasUsableOpportunity(empty));

console.log(`\n${passed}/35 authenticated product assertions passed.`);
