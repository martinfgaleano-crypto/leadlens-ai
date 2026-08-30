# Account Memory canonical lineage contract V1

Status: proposed, contract-first, not implemented.

Account Memory stores customer-relative evaluations over time. It is not a report
cache, an execution log, a source of current Evidence, or a global company registry.

## Identity tuple

Every immutable review snapshot belongs to this tuple:

```text
(tenant_key, client_scope_key, account_key, review_id)
```

- `tenant_key`: the authenticated owner/workspace identity. In the current product
  this is `owner_user_id`. It is always required for new production memory.
- `client_scope_key`: `client:<client_id>|context:<confirmed_context_id>` when the
  existing optional client ID is present, otherwise `context:<confirmed_context_id>`.
  The confirmed context ID is the always-present logical commercial-question lineage;
  the client ID prevents two client projects owned by one tenant from being conflated.
  Context versions stay in the same scope so the system can explain that the customer
  objective changed. A new logical context ID creates a new scope. `run_id`, report
  `job_id` and report `search_id` are forbidden as implicit fallbacks.
- `account_key`: an upstream canonical organization key. Preferred form is an
  immutable entity-resolution ID. A reviewed Vault company ID may be referenced if
  it denotes the exact operating entity, but Vault is not required and does not own
  customer reasoning. Until such an ID is available, the bounded fallback is
  `domain:<registrable-canonical-domain>` only when identity confidence is verified
  or strong and the domain belongs to the evaluated operating entity.
- `review_id`: one logical evaluation cycle. It is stable across infrastructure
  retries and re-entry, and different for a genuinely new observation/evaluation.

The run ID identifies one execution attempt. It is not a tenant, client scope,
account key, or long-lived review lineage.

## Account key rules

The account key must be stable across report reorder, run IDs, Decision changes and
display-name aliases. It must distinguish same-name companies and must not merge a
parent, subsidiary, brand or operating company unless entity resolution explicitly
declares that exact entity as the monitored commercial account.

Newsroom subdomains and country domains are aliases only after canonical identity
resolution. String normalization alone is insufficient. An unresolved or ambiguous
identity is not admitted to active Account Memory; its diagnostic record belongs in
run/research telemetry.

## Scope rules

The same tenant, optional client, logical confirmed context and canonical account share
history across new runs and context versions. A new context version is recorded in each
snapshot and may be a Decision-change driver. A materially different commercial
objective should be confirmed as a new logical context ID and therefore starts
separate customer-relative history. Different tenants never share Account Memory,
even when both reference the same universal company identity.

## Review and attempt rules

- New review: a new logical evaluation using a new observation cutoff or an explicit
  customer review cycle. It appends a snapshot.
- Retry/reprocess: another execution attempt for the same review. Identical payload
  is idempotent and appends nothing.
- Conflict: same review tuple with a different fingerprint. The write is rejected and
  both fingerprints are auditable; neither silently replaces history.
- Correction: an explicit privileged operation that writes a new correction record
  referencing the invalid review. It never updates the historical row in place.
- Supersession: a later valid review can become current; it does not mutate the prior
  snapshot.

## Current-state ordering

Current state is the valid review with the greatest semantic observation cutoff, then
review sequence as a deterministic tie-breaker. Database insertion time and last
writer do not determine current state. A later-started review with a newer observation
cutoff remains current even if an older review finishes afterward.

The model must persist distinct values for logical review ID, execution attempt ID,
observation cutoff and completion time. Event dates remain Evidence semantics and are
not review ordering clocks.

## Snapshot and fingerprint

The normalized state fingerprint includes:

- canonical account key and entity granularity;
- confirmed-context version;
- Decision plus bounded reason codes;
- Fit, Timing and Evidence dimensions;
- canonical event identity keys, not localized event prose;
- canonical evidence-origin keys and independence state;
- structured counterevidence identity/state;
- normalized decision-critical validation keys;
- normalized revisit trigger key and status.

It excludes rank, array index, translated/display prose, source ordering, report
layout, generated labels and relative age strings.

Rediscovering the same event/source does not create new Evidence or What Changed. A
new independent source for the same event may strengthen Evidence without creating a
new event.

## Decision and eligibility semantics

Decision is not a promotion ladder. Every transition among Hold, Monitor, Validate
and Prioritize is legal when current evidence supports it.

Monitor and customer-relevant Hold snapshots belong in Memory when identity and scope
are resolved. Hold reason must distinguish at least structural rejection, insufficient
evidence, stale event and no current event. Wrong entity, non-company and hard
structural disqualifier records are excluded from active Account Memory. They remain
diagnostic telemetry and may not become monitored accounts.

Monitor continuity preserves canonical account identity, customer scope, Decision,
bounded Decision reasons, current Evidence/event state, what-to-validate, revisit
trigger, observation cutoff and immutable review history.

## Boundaries

- Vault may supply/reference universal company identity and public facts. Fit,
  Timing, Decision, thesis and revisit state remain tenant-scoped Account Memory.
- Report is a representation of current intelligence. Report order never defines
  identity and opening a report must not be the canonical write trigger.
- Prior Memory is comparison context, not current Evidence. Claims must be reverified
  before affecting a current Case.

## Persistence contract

Required unique identity:

```text
(owner_user_id, client_scope_key, account_key, review_id)
```

An insert with the same key and same fingerprint is an idempotent success. The same
key with a different fingerprint is a conflict. An update/upsert that replaces the
snapshot is prohibited.

An optional current projection may point to the selected latest immutable review, but
the history table remains authoritative. Updating the projection must use monotonic
semantic ordering or compare-and-swap.

Monitor must consume the same canonical scope and account key. It must not infer that
an arbitrary UUID-shaped `client_scope_key` is a `search_id`. Report/search linkage is
explicit metadata, not identity. Current-state loading must exclude invalid/conflicted/
corrected reviews before ordering; `reviewed_at desc` over every row is insufficient.

## Migration assessment

A schema/data migration is required to fully enforce immutability and conflict
detection. Existing rows keyed by `runId` or index-derived account IDs require
heuristic reconciliation and are unsafe to auto-merge. Safe policy:

1. preserve legacy rows unchanged;
2. mark their lineage as legacy/unresolved;
3. backfill only rows whose tenant, logical context and exact operating-entity identity
   can be proven;
4. begin canonical lineage from the first confidently resolved review otherwise.
