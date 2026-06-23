-- ═══════════════════════════════════════════════════════════════════════════════
-- LeadLens — Delivery Packages: access_url + email_sent (Sprint #3)
-- access_url: signed Supabase Storage URL forwarded to the customer.
-- email_sent: true once Resend confirms the delivery email was dispatched.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE delivery_packages
  ADD COLUMN IF NOT EXISTS access_url  TEXT,
  ADD COLUMN IF NOT EXISTS email_sent  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
