import type { ProviderStatus } from "./provider-health";

export interface PilotHealthGate {
  ready: boolean;
  blockers: string[];
  operating_mode: "full_discovery" | "stopped";
}

export function evaluatePilotHealth(statuses: ProviderStatus[]): PilotHealthGate {
  const state = (id: string) => statuses.find((item) => item.id === id)?.state ?? "missing";
  const blockers: string[] = [];
  if (state("anthropic") !== "ok") blockers.push(`Anthropic health is ${state("anthropic")}.`);
  if (state("supabase") !== "ok") blockers.push(`Supabase health is ${state("supabase")}.`);
  const searchOk = ["brave", "serper", "tavily"].some((id) => state(id) === "ok");
  if (!searchOk) blockers.push("No public-web search provider is healthy.");
  const extractionOk = ["tavily", "firecrawl"].some((id) => state(id) === "ok");
  if (!extractionOk) blockers.push("No extraction provider is healthy.");
  return {
    ready: blockers.length === 0,
    blockers,
    operating_mode: blockers.length === 0 ? "full_discovery" : "stopped",
  };
}
