# Security Model

Threats include cross-tenant leakage, PII ingestion, poisoned labels, artifact tampering, unsafe deserialization and public model artifacts. Production integration must prohibit tenant/user IDs and PII as predictors, validate all contracts, checksum artifacts, load only trusted artifacts, sanitize logs, keep admin actions server-side, and apply tenant-scoped deletion and retention rules. Joblib artifacts must never be loaded from untrusted paths.
