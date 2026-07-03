// ─── Env Health v0 ────────────────────────────────────────────────────────────
// Presence checks + derived readiness for the monitor infrastructure.
// NEVER returns secret values — booleans only. Consumed by the admin-only
// system-health endpoint. See DEPLOYMENT_READINESS_CHECKLIST.md for setup.

export interface EnvHealth {
  // Raw presence (present/missing only — never values)
  supabase_url_set: boolean;
  supabase_anon_key_set: boolean;
  supabase_service_role_set: boolean;
  admin_secret_set: boolean;
  internal_run_secret_set: boolean;
  cron_secret_set: boolean;
  app_url_set: boolean;
  demo_mode: boolean;
  node_env: string;

  // Derived readiness for the monitor infrastructure
  supabase_ready: boolean;
  /** report auth chain can run (supabase + some admin credential) */
  report_auth_ready: boolean;
  /** processor accepts authenticated calls (dedicated or fallback secret) */
  processor_ready: boolean;
  /** drainer accepts at least one credential type */
  drainer_ready: boolean;
  /** Vercel Cron will authenticate against the drainer */
  cron_ready: boolean;
  /** everything a production beta needs is configured */
  production_safe: boolean;
  missing_for_production: string[];
}

export function getEnvHealth(): EnvHealth {
  const supabaseUrl     = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon    = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSecret     = !!process.env.ADMIN_SECRET_TOKEN;
  const internalSecret  = !!process.env.INTERNAL_RUN_SECRET;
  const cronSecret      = !!process.env.CRON_SECRET;
  const appUrl          = !!process.env.NEXT_PUBLIC_APP_URL;
  const demoMode        = process.env.DEMO_MODE === "true";

  const supabaseReady  = supabaseUrl && supabaseService;
  const processorReady = internalSecret || adminSecret; // fallback chain in checkInternalAuth
  const drainerReady   = internalSecret || adminSecret || cronSecret;
  const cronReady      = cronSecret; // Vercel Cron sends Bearer CRON_SECRET automatically

  const missing: string[] = [];
  if (!supabaseUrl)     missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnon)    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!supabaseService) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!adminSecret)     missing.push("ADMIN_SECRET_TOKEN");
  if (!internalSecret)  missing.push("INTERNAL_RUN_SECRET");
  if (!cronSecret)      missing.push("CRON_SECRET");
  if (!appUrl)          missing.push("NEXT_PUBLIC_APP_URL");

  return {
    supabase_url_set:          supabaseUrl,
    supabase_anon_key_set:     supabaseAnon,
    supabase_service_role_set: supabaseService,
    admin_secret_set:          adminSecret,
    internal_run_secret_set:   internalSecret,
    cron_secret_set:           cronSecret,
    app_url_set:               appUrl,
    demo_mode:                 demoMode,
    node_env:                  process.env.NODE_ENV ?? "unknown",

    supabase_ready:    supabaseReady,
    report_auth_ready: supabaseReady && adminSecret,
    processor_ready:   processorReady,
    drainer_ready:     drainerReady,
    cron_ready:        cronReady,
    production_safe:   missing.length === 0 && !demoMode,
    missing_for_production: missing,
  };
}
