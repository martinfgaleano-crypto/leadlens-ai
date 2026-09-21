// ─── Production reused-identity qualification deps — bounded official-source fetch ──
//
// Supplies ReuseQualificationDeps.fetchCompanyEvidence for the productive path: a BOUNDED
// scrape of the company's OWN official domain (its current public content), used only to
// establish a neutral operating-role family. Reuses the existing Firecrawl credential/endpoint
// convention (mirrors providers.ts). Fail-closed: any missing key, timeout, or error returns
// ok:false so the candidate is held (never wrongly excluded, §13/§43). Not unit-tested (needs a
// live provider), mirroring discovery-runner.ts; its decisions are covered by the pure
// qualifyFromEvidence tests.

import type { CompanyEvidence, ReuseQualificationDeps } from "./vault-reuse-qualification";

const SCRAPE_TIMEOUT_MS = 12_000;
const MAX_CONTENT_CHARS = 6_000; // bounded content is enough for role detection; caps tokens/cost

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

export function createReuseQualificationDeps(): ReuseQualificationDeps {
  return {
    async fetchCompanyEvidence({ domain }): Promise<CompanyEvidence> {
      const clean = normalizeDomain(domain);
      const sourceUrl = `https://${clean}`;
      const key = process.env.FIRECRAWL_API_KEY;
      if (!key || !clean) return { domain: clean, content: "", sourceUrl, ok: false };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceUrl, formats: ["markdown"], onlyMainContent: true, timeout: SCRAPE_TIMEOUT_MS }),
          signal: controller.signal,
        });
        if (!res.ok) return { domain: clean, content: "", sourceUrl, ok: false };
        const json = (await res.json()) as { success?: boolean; data?: { markdown?: string; metadata?: { description?: string; title?: string } } };
        const md = json?.data?.markdown ?? "";
        const meta = `${json?.data?.metadata?.title ?? ""} ${json?.data?.metadata?.description ?? ""}`;
        const content = `${meta} ${md}`.trim().slice(0, MAX_CONTENT_CHARS);
        return { domain: clean, content, sourceUrl, ok: content.length > 0 };
      } catch {
        return { domain: clean, content: "", sourceUrl, ok: false }; // timeout / network → held, not excluded
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
