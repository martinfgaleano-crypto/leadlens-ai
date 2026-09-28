// Auth coherence regression (Phase C): ONE passwordless customer auth model. Signup AND returning
// login both request a one-time code and hand off to /verify (verifyOtp); no customer password path.
// Deterministic source-level guards (the full OTP round-trip needs live Supabase). Admin auth is the
// separate /admin/login password path and is intentionally NOT covered here.
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const login = read("app/login/page.tsx");
const signup = read("app/signup/page.tsx");
const verify = read("app/verify/page.tsx");
const adminLogin = read("app/admin/login/page.tsx");

// ── Returning login is passwordless OTP ──
t("login requests a one-time code (signInWithOtp)", /signInWithOtp/.test(login));
t("login does NOT use signInWithPassword (OTP customers have no password)", !/signInWithPassword/.test(login));
t("login has no password input field", !/type="password"/.test(login) && !/autoComplete="current-password"/.test(login));
t("login hands off to /verify", /\/verify\?email=/.test(login));
t("login no longer links a password-reset flow", !/forgot-password/.test(login));

// ── Signup is the same passwordless OTP model ──
t("signup requests a one-time code (signInWithOtp)", /signInWithOtp/.test(signup));
t("signup hands off to /verify", /\/verify\?email=/.test(signup));

// ── /verify is the single code-entry + session establishment surface ──
t("verify establishes the session with verifyOtp", /verifyOtp/.test(verify));
t("verify offers resend", /signInWithOtp/.test(verify));

// ── Admin auth remains a separate password path (unchanged by this sprint) ──
t("admin login remains password-based (separate path)", /signInWithPassword/.test(adminLogin));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
