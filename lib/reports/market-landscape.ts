/* eslint-disable @typescript-eslint/no-explicit-any */

export type MarketLandscapeStage = "known_reference" | "investigated" | "finalist" | "preliminary";

export interface MarketLandscapeAccount {
  company: string;
  domain: string | null;
  sector: string | null;
  origin: string;
  visibility: string | null;
  role: string | null;
  stage: MarketLandscapeStage;
  fit_score: number | null;
  outcome_reason: string;
}

export interface MarketLandscape {
  version: "market-landscape-v1";
  category_query: string;
  geography: string[];
  explanation: string;
  known_accounts_policy: string;
  considered_count: number;
  investigated_count: number;
  selected_count: number;
  accounts: MarketLandscapeAccount[];
}

const normalized = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("es");

export function buildMarketLandscape(input: {
  discovery: any;
  report: any;
  knownAccounts: string[];
  previousAccounts?: string[];
  geography: string[];
  categoryQuery: string;
}): MarketLandscape {
  const { discovery, report, knownAccounts, previousAccounts = [], geography, categoryQuery } = input;
  const finalByCompany = new Map<string, any>(
    (report?.ranked_opportunities ?? []).map((opportunity: any) => [
      normalized(opportunity.company),
      opportunity,
    ]),
  );
  const candidateByCompany = new Map<string, any>(
    (discovery?.candidates ?? []).map((candidate: any) => [
      normalized(candidate.company),
      candidate,
    ]),
  );

  const rawUniverse = Array.isArray(discovery?.metrics?.universe_accounts)
    ? discovery.metrics.universe_accounts
    : Array.from(
        new Map(
          (discovery?.metrics?.search_trace ?? [])
            .filter((trace: any) => trace?.company)
            .map((trace: any) => [normalized(trace.company), { company: trace.company }]),
        ).values(),
      );

  const investigated: MarketLandscapeAccount[] = rawUniverse.map((account: any) => {
    const company = String(account.company).trim();
    const candidate = candidateByCompany.get(normalized(company));
    const finalist = finalByCompany.get(normalized(company));
    const stage: MarketLandscapeStage = finalist
      ? "finalist"
      : candidate
        ? "preliminary"
        : "investigated";
    const outcomeReason = finalist
      ? `Finalista: sobrevivió los filtros de geografía, rol comprador, novedad, evidencia y fit; quedó ${finalist.category ?? "sin tier"} con fit ${finalist.fit_score ?? "sin puntaje"}.`
      : candidate
        ? "Oportunidad preliminar: mostró fit de canal, pero no quedó entre las dos cuentas seleccionadas para análisis profundo."
        : "Investigada durante el barrido, pero no produjo evidencia suficiente para superar los filtros de rol comprador, oportunidad, materialidad y calidad.";
    return {
      company,
      domain: account.domain ?? candidate?.domain ?? null,
      sector: account.sector ?? candidate?.industry ?? null,
      origin: account.origin ?? candidate?.discovery_origin ?? "search_trace",
      visibility: account.visibility ?? candidate?.account_visibility ?? null,
      role: account.role ?? candidate?.account_role ?? null,
      stage,
      fit_score: typeof finalist?.fit_score === "number" ? finalist.fit_score : null,
      outcome_reason: outcomeReason,
    };
  });

  const investigatedNames = new Set(investigated.map((account) => normalized(account.company)));
  for (const candidate of discovery?.candidates ?? []) {
    if (investigatedNames.has(normalized(candidate.company))) continue;
    const finalist = finalByCompany.get(normalized(candidate.company));
    investigated.push({
      company: candidate.company,
      domain: candidate.domain ?? null,
      sector: candidate.industry ?? null,
      origin: candidate.discovery_origin ?? "candidate",
      visibility: candidate.account_visibility ?? null,
      role: candidate.account_role ?? null,
      stage: finalist ? "finalist" : "preliminary",
      fit_score: typeof finalist?.fit_score === "number" ? finalist.fit_score : null,
      outcome_reason: finalist
        ? `Finalista: sobrevivió los filtros de geografía, rol comprador, novedad, evidencia y fit; quedó ${finalist.category ?? "sin tier"} con fit ${finalist.fit_score ?? "sin puntaje"}.`
        : "Oportunidad preliminar: mostró fit de canal, pero no quedó entre las dos cuentas seleccionadas para análisis profundo.",
    });
  }

  const references: MarketLandscapeAccount[] = knownAccounts
    .filter((company) => !investigatedNames.has(normalized(company)))
    .map((company) => ({
      company,
      domain: null,
      sector: null,
      origin: "customer_known_reference",
      visibility: "obvious",
      role: "buyer_channel",
      stage: "known_reference",
      fit_score: null,
      outcome_reason: "Cuenta conocida de referencia: se reconoce como participante relevante, pero se excluyó de las finalistas para que LeadLens aportara descubrimiento nuevo en vez de cobrar por un nombre obvio.",
    }));
  for (const company of previousAccounts) {
    if (investigatedNames.has(normalized(company)) || references.some((account) => normalized(account.company) === normalized(company))) continue;
    references.push({
      company,
      domain: null,
      sector: null,
      origin: "previous_report_memory",
      visibility: null,
      role: null,
      stage: "known_reference",
      fit_score: null,
      outcome_reason: "Cuenta de un reporte anterior excluida antes de gastar en investigación: no se observó todavía una señal nueva que justificara volver a ocupar un cupo finalista.",
    });
  }

  const selectedCount = investigated.filter((account) => account.stage === "finalist").length;
  return {
    version: "market-landscape-v1",
    category_query: categoryQuery,
    geography,
    explanation: "LeadLens parte de la categoría del producto y la región para construir un universo amplio; después filtra por rol comprador, cobertura geográfica, novedad, evidencia comercial y fit antes de profundizar en las finalistas.",
    known_accounts_policy: "Las empresas grandes o conocidas no se consideran ausentes: aparecen como referencias del mercado. No se priorizan automáticamente porque este piloto exige oportunidades novedosas y útiles, no una lista de nombres obvios.",
    considered_count: investigated.length + references.length,
    investigated_count: investigated.length,
    selected_count: selectedCount,
    accounts: [...references, ...investigated].sort((a, b) => {
      const order: Record<MarketLandscapeStage, number> = { finalist: 0, preliminary: 1, known_reference: 2, investigated: 3 };
      return order[a.stage] - order[b.stage] || a.company.localeCompare(b.company);
    }),
  };
}
