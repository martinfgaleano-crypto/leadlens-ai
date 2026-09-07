# LeadLens — Privacy / Data-Request Runbook V1 (internal)

**Purpose.** How an operator manually fulfills a customer **access, correction, deletion, or privacy inquiry** for V1. LeadLens does not have (and does not need for V1) a self-service deletion platform — requests arrive at **operations@leadlensintel.com** and are handled deliberately by a human. This runbook contains **no secrets and no production IDs**; do not paste credentials or customer identifiers into the repo.

> Never auto-execute deletions. Every step is run deliberately by a person, scoped to one tenant, and verified.

## 1. Intake
- Requests arrive at `operations@leadlensintel.com` (access / correction / deletion / inquiry).
- Verify the requester controls the account email before acting on personal data (e.g., confirm from the account's registered email).
- Respond within the timeframe required by applicable law (see Privacy Policy).

## 2. Identify the tenant
- The customer is identified by their account **email → `profiles.id`** (this id is the `owner_user_id` / `user_id` used across tenant-scoped tables).
- Confirm you have the **single correct id** before any read or write. All operations filter by exactly that id.

## 3. Customer-owned data surfaces (tenant-scoped)
Scope every query/delete by the tenant id (`user_id` or `owner_user_id`):
- `profiles` — account record.
- `customer_credits` / `credit_transactions` — one-time credit balance + ledger.
- `customer_subscriptions` — normalized subscription state (if any).
- `subscription_usage_periods` — metered allowance periods.
- `account_intelligence_charges` — per-account usage ledger (append-only in product code; **deletable at the DB level since migration 063** for erasure/cascade).
- confirmed contexts / interpretation records — the customer's commercial context.
- `snapshot_reports` — Intelligence runs and reports (`user_id`).
- `account_review_snapshots` — Account Memory / Monitor state (`owner_user_id`).
- `lead_searches`, `notifications`, feedback rows — if present for the tenant.
- Supabase Auth user (`auth.users`) — the login identity.

## 4. Access request (export)
- Read the tenant's rows from the surfaces above (service-role, read-only), scoped by the id.
- Provide the customer their data in a readable form. Do not include other tenants' data or internal secrets.

## 5. Correction request
- Correct the specific field(s) in the relevant tenant-scoped row (e.g., account email, commercial context). Immutable historical snapshots are not rewritten; note that Account Memory is append-only by design.

## 6. Deletion / erasure request
1. Re-confirm the exact tenant id.
2. Delete tenant-scoped rows. `profiles.id` has `ON DELETE CASCADE` to dependent tables, and (post-063) `account_intelligence_charges` no longer blocks the cascade — so deleting the profile / auth user cascades the tenant's data. If deleting piecewise, go child → parent.
3. Delete the Supabase Auth user last.
4. **Verify:** re-query each surface filtered by the id and confirm **0 rows** remain.

## 7. What is NOT deleted
- **Payment / transaction records held by the Merchant of Record (Lemon Squeezy)** are Lemon's records, not LeadLens's, and may be retained by the MoR for tax/legal purposes — direct payment-data requests to the MoR where applicable.
- Minimal records LeadLens must keep to meet a legal obligation (if any) — note these to the customer.

## 8. Tenant isolation & safety
- Always filter by the one confirmed id; never run an unscoped delete.
- Double-check the id in the `WHERE`/`.eq()` clause before executing.
- Do not affect any other tenant. If in doubt, stop and re-verify.

## 9. Completion
- Confirm completion to the customer.
- Log the request, action taken, and verification result (symptom + outcome), without storing unnecessary personal data.

---
*Operational V1 process. Manual, human-run, tenant-scoped. No self-service deletion platform is built or required for V1.*
