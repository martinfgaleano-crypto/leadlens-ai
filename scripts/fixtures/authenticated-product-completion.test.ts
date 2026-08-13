import { readFileSync } from "node:fs";
import { commercialFlowQuery, parseCommercialFlowState, safeCustomerReturnPath } from "@/lib/commercial/customer-flow";
import { normalizeCommercialContext } from "@/lib/commercial/commercial-context";
import { buildCustomerDashboardView } from "@/lib/dashboard/customer-dashboard-view";

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
test("recovery callback reaches password form with browser exchange", callback.includes("/reset-password") && reset.includes("exchangeCodeForSession"));
test("recovery request uses Supabase secure flow", forgot.includes("resetPasswordForEmail"));
test("new password updates authenticated user", reset.includes("updateUser({ password })"));
test("commercial intent user ownership is mandatory", /user_id uuid not null/.test(migration));
test("commercial intent RLS enabled", migration.includes("enable row level security") && migration.includes("auth.uid() = user_id"));
test("commercial intent is not modeled as payment", migration.includes("This is not an order") && !migration.includes("amount_paid"));

console.log(`\n${passed}/17 authenticated product assertions passed.`);
