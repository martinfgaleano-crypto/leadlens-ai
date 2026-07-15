# Assumption Registry

| ID | Assumption | Risk | Verification | Severity |
|---|---|---|---|---|
| A1 | Reports expose a stable company key | Dedupe and joins fail | Audit report JSON/types | blocking |
| A2 | A monitor/search identifier exists | Group evaluation is incomplete | Audit lead_searches/snapshot_reports | high |
| A3 | Signal dates are preserved | Freshness features become unreliable | Audit feature snapshots | high |
| A4 | Candidate pools can be retained | Ranking metrics are limited | Audit selector/run metadata | medium |
| A5 | Server-side async execution exists | Training jobs cannot run safely | Audit worker/cron pattern | high |
| A6 | Secure artifact storage is available | Models cannot be deployed safely | Audit Supabase Storage/infrastructure | high |
| A7 | Admin authorization has a reusable guard | ML controls may be exposed | Audit requireAdmin pattern | blocking |
