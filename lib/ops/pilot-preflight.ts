export interface PilotPreflight {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  provider_health: "not_checked";
  provider_calls_made: false;
  max_budget_usd: number | null;
  configured: {
    demo_mode: boolean;
    mock_mode: boolean;
    anthropic: boolean;
    supabase: boolean;
    search: boolean;
    extraction: boolean;
    internal_dispatch: boolean;
    admin_console: boolean;
    app_url: boolean;
    payments_closed: boolean;
  };
}

export function evaluatePilotPreflight(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PilotPreflight {
  const anthropic = !!env.ANTHROPIC_API_KEY;
  const supabase = !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY;
  const search = !!env.BRAVE_SEARCH_API_KEY || !!env.SERPER_API_KEY || !!env.TAVILY_API_KEY;
  const extraction = !!env.FIRECRAWL_API_KEY || !!env.TAVILY_API_KEY;
  const internalDispatch = !!env.INTERNAL_RUN_SECRET;
  const demoMode = env.DEMO_MODE === "true";
  const mockMode = env.ALLOW_MOCK_LEADS_WITH_REAL_AI === "true";
  const adminConsole = !!env.ADMIN_SECRET_TOKEN;
  const appUrl = !!env.NEXT_PUBLIC_APP_URL;
  const paymentsClosed = env.PAYMENTS_ENABLED !== "true" && env.NEXT_PUBLIC_PAYMENTS_ENABLED !== "true";
  const rawBudget = env.PILOT_E2E_MAX_USD;
  const budget = rawBudget ? Number(rawBudget) : NaN;
  const maxBudgetUsd = Number.isFinite(budget) && budget > 0 ? budget : null;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (demoMode) blockers.push("DEMO_MODE must be false/unset for a real pilot.");
  if (mockMode) blockers.push("Mock-lead hybrid mode must be disabled.");
  if (!anthropic) blockers.push("ANTHROPIC_API_KEY is missing.");
  if (!supabase) blockers.push("Supabase URL/service-role configuration is incomplete.");
  if (!search) blockers.push("No compliant public-web search provider is configured.");
  if (!extraction) blockers.push("No extraction provider is configured.");
  if (!internalDispatch) blockers.push("INTERNAL_RUN_SECRET is missing.");
  if (!maxBudgetUsd) blockers.push("PILOT_E2E_MAX_USD must be an explicit positive budget.");
  else if (maxBudgetUsd > 5) blockers.push("PILOT_E2E_MAX_USD exceeds the $5 safety cap.");
  if (!paymentsClosed) blockers.push("Self-serve payment flags must remain closed during the pilot E2E.");
  if (!appUrl) warnings.push("NEXT_PUBLIC_APP_URL is missing; async dispatch may fail.");
  if (!adminConsole) warnings.push("ADMIN_SECRET_TOKEN is missing; pilot operations console will be unavailable.");

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    provider_health: "not_checked",
    provider_calls_made: false,
    max_budget_usd: maxBudgetUsd,
    configured: {
      demo_mode: demoMode,
      mock_mode: mockMode,
      anthropic,
      supabase,
      search,
      extraction,
      internal_dispatch: internalDispatch,
      admin_console: adminConsole,
      app_url: appUrl,
      payments_closed: paymentsClosed,
    },
  };
}

export interface PilotValueContractInput {
  target_countries: string[];
  known_accounts: string[];
  minimum_novel_opportunities: number;
  minimum_dynamic_opportunities: number;
  maximum_obvious_accounts: number;
  total_budget_usd: number;
  llm_budget_usd: number;
}

export function evaluatePilotValueContract(input: PilotValueContractInput): { ready: boolean; blockers: string[]; provider_budget_usd: number } {
  const blockers: string[] = [];
  const countries = input.target_countries.map(v => v.trim()).filter(Boolean);
  const known = input.known_accounts.map(v => v.trim()).filter(Boolean);
  if (countries.length === 0) blockers.push("At least one exact target country is required.");
  if (known.length === 0) blockers.push("Known/obvious accounts must be declared before a paid discovery run.");
  if (!Number.isInteger(input.minimum_novel_opportunities) || input.minimum_novel_opportunities < 1) blockers.push("minimum_novel_opportunities must be a positive integer.");
  if (!Number.isInteger(input.minimum_dynamic_opportunities) || input.minimum_dynamic_opportunities < 1 || input.minimum_dynamic_opportunities > input.minimum_novel_opportunities) blockers.push("minimum_dynamic_opportunities must be a positive integer no greater than minimum_novel_opportunities.");
  if (!Number.isInteger(input.maximum_obvious_accounts) || input.maximum_obvious_accounts < 0 || input.maximum_obvious_accounts > 1) blockers.push("maximum_obvious_accounts must be 0 or 1 for paid delivery.");
  if (!Number.isFinite(input.total_budget_usd) || input.total_budget_usd <= 0) blockers.push("A positive total budget is required.");
  if (!Number.isFinite(input.llm_budget_usd) || input.llm_budget_usd < 0 || input.llm_budget_usd > input.total_budget_usd) blockers.push("LLM budget must be between zero and the total budget.");
  return { ready: blockers.length === 0, blockers, provider_budget_usd: Number(Math.max(0, input.total_budget_usd - input.llm_budget_usd).toFixed(6)) };
}
