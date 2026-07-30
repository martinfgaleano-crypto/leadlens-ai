import { loadEnvConfig } from "@next/env";
import { braveProvider } from "@/lib/sources/access/providers";

loadEnvConfig(process.cwd());

async function main() {
  const queries = [
    '"Hotel Spa La Colina" expansión',
    '"BioPlaza" expansión',
    '"Distribuidora DAM" expansión',
  ];
  const output = [];
  for (const query of queries) {
    const response = await braveProvider.search({
      query, region: "co", language: "es", max_results: 5,
      query_type: "signal_specific", freshness_days: 730,
    });
    output.push({
      query, ok: response.ok, error: response.error,
      cost_state: response.cost_estimate_usd == null ? "not_measured" : "measured",
      cost_usd: response.cost_estimate_usd,
      results: response.results.map((result) => ({
        url: result.canonical_url, title: result.title, snippet: result.snippet,
        published_date: result.published_date, retrieved_at: result.retrieved_at,
        source_type: result.source_type,
      })),
    });
  }
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
