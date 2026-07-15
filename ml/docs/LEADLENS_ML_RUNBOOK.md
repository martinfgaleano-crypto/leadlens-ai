# Runbook

Install dependencies, run `PYTHONPATH=src python -m leadlens_ml.run_demo`, then `PYTHONPATH=src pytest -q`. Review `reports/demo/evaluation_report.json`, calibration, OOD and shadow reports. Demo metrics are never product claims. Before real integration, replace fixture extraction and simulated review labels with audited LeadLens snapshots and human/customer labels.
