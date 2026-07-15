# LeadLens Intelligence Lab v0 — Pre-Integration ML Build

Standalone, executable technical vertical slice for LeadLens opportunity-quality ML.

**Status:** pipeline technical validation only. It is not trained on real LeadLens data and does not establish product performance.

## What runs

- canonical Pydantic contracts and JSON/TypeScript counterparts;
- deterministic demo fixture generation;
- dataset factory with duplicate handling and manifests;
- independent weak labeling functions and aggregation;
- company-grouped temporal splits;
- calibrated logistic-regression baseline;
- calibrated histogram gradient-boosting challenger;
- classification and calibration metrics;
- inference with missingness and OOD flags;
- non-mutating shadow-rank simulation;
- tests and preliminary integration contracts.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=src python -m leadlens_ml.run_demo
PYTHONPATH=src pytest -q
```

Outputs are written to `fixtures/`, `artifacts/demo/`, and `reports/demo/`.

## Hard boundary

All generated records carry `DEMO_ONLY_NOT_PRODUCTION_TRAINING_DATA`. No repository, Supabase, Vault, production pipeline, customer feedback, or real shadow scoring has been integrated.
