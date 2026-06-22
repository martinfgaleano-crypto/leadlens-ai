-- Migration 015: Vault reuse metrics on lead_searches
-- Tracks how many leads came from vault vs Apollo, and the vault hit rate.

ALTER TABLE lead_searches
  ADD COLUMN IF NOT EXISTS vault_leads_used   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS apollo_leads_used  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vault_hit_rate     NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lead_searches_vault_leads_used
  ON lead_searches (vault_leads_used)
  WHERE vault_leads_used > 0;

CREATE INDEX IF NOT EXISTS idx_lead_searches_apollo_leads_used
  ON lead_searches (apollo_leads_used);
