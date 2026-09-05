// Premium activation funnel — deterministic acceptance (§15/§29). Logic round-trips for commercial
// intent + static source guards for routing/security. No network/DB.

import { readFileSync } from "node:fs";
import { parseCommercialFlowState, commercialFlowQuery, safeCustomerReturnPath } from "@/lib/commercial/customer-flow";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };
const read = (p: string) => readFileSync(p, "utf8");

// ── Commercial intent round-trips (D, E, F, M) ──
const oneTime = parseCommercialFlowState(new URLSearchParams("kind=one_time&product_code=preview_launch_v0&commercial_path=one_time"));
t("D. Preview selection parses", oneTime?.selection.kind === "one_time" && oneTime.selection.kind === "one_time" && oneTime.selection.productCode === "preview_launch_v0");
t("D. Preview survives query round-trip", (() => { const f = parseCommercialFlowState(new URLSearchParams(commercialFlowQuery(oneTime).slice(1))); return f?.selection.kind === "one_time" && f.selection.productCode === "preview_launch_v0"; })());

const sub = parseCommercialFlowState(new URLSearchParams("kind=subscription&plan_code=monitor&billing_interval=year"));
t("E. MONITOR Annual parses with interval", sub?.selection.kind === "subscription" && sub.selection.kind === "subscription" && sub.selection.planCode === "monitor" && sub.selection.interval === "year");
t("F. MONITOR Annual survives round-trip (interval preserved)", (() => { const f = parseCommercialFlowState(new URLSearchParams(commercialFlowQuery(sub).slice(1))); return f?.selection.kind === "subscription" && f.selection.planCode === "monitor" && f.selection.interval === "year"; })());
t("subscription without interval fails closed", parseCommercialFlowState(new URLSearchParams("kind=subscription&plan_code=monitor")) === null);
t("unknown product fails closed", parseCommercialFlowState(new URLSearchParams("product_code=enterprise")) === null);

t("M. external redirect blocked", safeCustomerReturnPath("https://evil.example/x") === "/dashboard");
t("M. protocol-relative redirect blocked", safeCustomerReturnPath("//evil.example") === "/dashboard");
t("M. checkout continuation is an allowed return path", safeCustomerReturnPath("/checkout/continue?kind=one_time") === "/checkout/continue?kind=one_time");

// ── Static routing/security guards ──
const landing = read("app/demo-pipeline/page.tsx");
t("A. Get Started enters /get-started, not signup", landing.includes('window.location.href = "/get-started"'));
t("N. Get Started fallback is not the LS_URLS orphan direct-pay", !landing.includes("window.location.href = lsUrl;\n    }\n    track(\"onboarding_started\"") || landing.includes('window.location.href = "/get-started"'));

const getStarted = read("app/get-started/page.tsx");
t("C. one-time vs ongoing routes to pricing pre-oriented", getStarted.includes("/pricing?commercial_path=") && getStarted.includes('choose("one_time")') && getStarted.includes('choose("ongoing")'));

const pricing = read("app/pricing/page.tsx");
t("B. pricing is public (no auth/session gate)", !pricing.includes("getSession") && !pricing.includes("auth.getUser"));
t("pricing routes selection into signup with flow", pricing.includes("/signup${commercialFlowQuery(state)}"));
t("pricing has monthly/annual toggle", pricing.includes("IntervalToggle") && pricing.includes('"month"') && pricing.includes('"year"'));

const signup = read("app/signup/page.tsx");
t("G. signup is OTP-first (signInWithOtp, no password field)", signup.includes("signInWithOtp") && !signup.includes('type="password"'));
t("G. signup routes to /verify", signup.includes("/verify?email="));

const verify = read("app/verify/page.tsx");
t("H. verify uses verifyOtp + resend + friendly errors", verify.includes("verifyOtp") && verify.includes("Resend email") && verify.includes("friendlyAuthError"));
t("I. verification resumes selected plan into checkout continuation", verify.includes("/checkout/continue${commercialFlowQuery(flow)}"));

const cont = read("app/checkout/continue/page.tsx");
t("J. anonymous checkout continuation redirects to signup", cont.includes("getSession") && cont.includes("router.replace(`/signup"));
t("K/L. checkout calls canonical endpoints with product_code/plan_code only (no variant)", cont.includes("/api/billing/checkout-one-time") && cont.includes("/api/billing/subscribe") && !cont.toLowerCase().includes("variant"));
t("O. no Stripe / no DEMO in continuation", !cont.toLowerCase().includes("stripe") && !cont.includes("DEMO_MODE"));

const success = read("app/success/page.tsx");
t("P. success routes coherently (one-time→/activate, subscription→/dashboard)", success.includes('href: "/activate"') && success.includes('href: "/dashboard"'));

// ── Dual-mode auth: real Supabase magic link (implicit flow) preserves purchase intent (B/C/D) ──
t("copy: signup promises a secure sign-in link (default template has no numeric code)", signup.includes("secure sign-in link") && !signup.includes("6-digit code"));
t("copy: verify leads with the sign-in link, code is secondary", verify.includes("Open the sign-in link") && verify.includes("6-digit code"));
// The real fix: signup/resend land the link on the CLIENT /auth/continue (not the server callback),
// because the default implicit flow returns the session in the URL fragment (server can't read it).
t("A. signup emailRedirectTo lands on client /auth/continue (implicit-flow fragment readable)", signup.includes("/auth/continue${commercialFlowQuery(flow)}") && !signup.includes("/auth/callback?type=signup"));
t("A. resend also lands on /auth/continue", verify.includes("/auth/continue${commercialFlowQuery(flow)}"));
const authCont = read("app/auth/continue/page.tsx");
t("A. continue handles implicit fragment (getSession) AND pkce code (exchangeCodeForSession)", authCont.includes("getSession") && authCont.includes("exchangeCodeForSession"));
t("C/D. continue resumes exact selection into checkout (else dashboard when no intent)", authCont.includes("/checkout/continue${commercialFlowQuery(f)}") && authCont.includes('replace(f ? `/checkout/continue'));
t("H. already-authenticated session continues (getSession checked first)", authCont.indexOf("getSession()).data.session") < authCont.indexOf("exchangeCodeForSession"));
t("E. failed/expired link shows recovery, not a silent dead-end", authCont.includes("couldn’t complete sign-in") && authCont.includes("Send a new sign-in email"));
const callback = read("app/auth/callback/route.ts");
t("D. server callback still forwards any ?code + recovery safely (belt-and-suspenders)", callback.includes("/auth/continue?") && callback.includes("/reset-password?"));

// Canonical checkout routes remain auth-bound + server-authoritative.
const subRoute = read("app/api/billing/subscribe/route.ts");
const otRoute = read("app/api/billing/checkout-one-time/route.ts");
t("K. subscribe binds trusted server user_id (never client)", subRoute.includes("db.auth.getUser(token)") && subRoute.includes("userId: user.id"));
t("K. one-time checkout binds trusted server user_id", otRoute.includes("db.auth.getUser(token)") && otRoute.includes("userId: user.id"));
t("L. checkout routes accept only product/plan; server maps to variant", subRoute.includes("plan_code:") && subRoute.includes("interval:") && subRoute.includes("createSubscriptionCheckout") && otRoute.includes("product_code:") && otRoute.includes("createOneTimeCheckout"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
