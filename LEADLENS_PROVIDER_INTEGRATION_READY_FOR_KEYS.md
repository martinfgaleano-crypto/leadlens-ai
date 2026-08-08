# LeadLens provider integration — ready for keys

The existing provider layer was extended; no parallel retrieval architecture was created. Exa is an optional semantic company-search escalation. SAM.gov is a structured USA entity/procurement source. SEC EDGAR is direct public-company and filing evidence, not general company discovery.

| Provider | Role | Environment variable | Required | Cost-sensitive | Activation | Fallback | Future benchmark |
|---|---|---|---|---|---|---|---|
| Brave | Broad search/freshness | `BRAVE_SEARCH_API_KEY` | No | Yes | Existing | Tavily/Serper | Existing stack baseline |
| Tavily | Search/research | `TAVILY_API_KEY` | No | Yes | Existing | Brave/Firecrawl | Existing stack baseline |
| Serper | Secondary broad search | `SERPER_API_KEY` | No | Yes | Existing | Brave/Tavily | Keep optional while quota is exhausted |
| Firecrawl | Extraction/fallback | `FIRECRAWL_API_KEY` | No | Yes | Existing | Tavily extraction | Extraction only |
| Exa | Semantic company discovery escalation | `EXA_API_KEY` | No | Yes | Add key and restart | Existing search stack | Current stack vs current stack + Exa |
| SAM.gov | USA structured entity/procurement evidence | `DATA_GOV_API_KEY` | No | Rate-limited | Add key and restart | State/foundation/industry sources + search | USA Manufacturing |
| SEC EDGAR | Public-company identity, filings, signals | `SEC_EDGAR_CONTACT` | No API key | No | Add operational contact for SEC User-Agent | Company sites/search | USA Manufacturing / future monitoring |

OpenCorporates remains `candidate_provider / deferred_due_cost`; no code or dependency was added.

## Founder activation

Local (`.env.local`, never source code):

```dotenv
EXA_API_KEY=<paste the Exa value>
DATA_GOV_API_KEY=<paste the api.data.gov/SAM.gov value>
SEC_EDGAR_CONTACT=<monitored LeadLens contact email>
```

Then restart the local app and run exactly one explicit diagnostic:

```bash
npm run providers:diagnose
```

The diagnostic makes one minimal call per configured provider and prints statuses only. Normal startup never spends diagnostic calls.

Vercel:

1. Project → Settings → Environment Variables.
2. Add `EXA_API_KEY`, `DATA_GOV_API_KEY`, and `SEC_EDGAR_CONTACT` to Production and Preview as appropriate.
3. Redeploy so the runtime receives the new values.
4. Open Admin → Operations → Providers and explicitly test the desired provider once.

Until keys are added, Exa and SAM.gov correctly report `not_configured`; this is not a source-quality finding. SEC needs no key, but remains unavailable until its fair-access contact is configured. The next controlled benchmark is **USA Manufacturing**, comparing the existing stack against existing stack + Exa and measuring SAM/SEC complementary value without changing source confidence before evidence exists.
