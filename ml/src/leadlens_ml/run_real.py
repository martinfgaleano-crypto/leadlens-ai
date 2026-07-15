"""Real-data training entry for LeadLens.

Input: JSONL produced by scripts/ml-build-dataset.mjs — each line is a lab
OpportunityFeatureSnapshot dict plus optional customer label metadata:
  { ...snapshot fields, "customer_label": 0|1|null,
    "customer_label_source": "customer_feedback"|null, "job_id": str }

Labels (provenance-aware, NEVER the deterministic baseline):
  1. customer feedback (normalized sentiment) when present — highest authority;
  2. weak supervision consensus otherwise (clearly recorded as weak).

QUALITY GATES block training honestly (status blocked_*, never fake completed):
  - fixtures/demo rows present  -> blocked_quality_gate
  - < MIN_EXAMPLES usable rows  -> blocked_insufficient_data
  - < MIN_PER_CLASS per class   -> blocked_insufficient_data
  - prohibited fields present   -> blocked_quality_gate

Usage: python -m leadlens_ml.run_real <input.jsonl> <out_dir>
"""
from __future__ import annotations
import json, sys, hashlib
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .contracts import OpportunityFeatureSnapshot, DatasetManifest
from .dataset import example_key, PROHIBITED
from .labeling import apply_labelers, aggregate_labels
from .splitting import group_temporal_split
from .training import train_models

MIN_EXAMPLES = 40
MIN_PER_CLASS = 10


def main(input_path: str, out_dir: str) -> int:
    inp = Path(input_path)
    out = Path(out_dir)
    art = out / "artifacts"
    rep = out / "reports"
    art.mkdir(parents=True, exist_ok=True)
    rep.mkdir(parents=True, exist_ok=True)

    def blocked(status: str, reason: str, extra: dict | None = None) -> int:
        payload = {"status": status, "reason": reason, "banner": "TRAINING BLOCKED — shown as blocked, never as completed", **(extra or {})}
        (rep / "training_status.json").write_text(json.dumps(payload, indent=2))
        print(json.dumps(payload))
        return 2

    if not inp.exists():
        return blocked("blocked_insufficient_data", f"input file not found: {inp}")

    rows = []
    label_provenance = {"customer_feedback": 0, "weak_labeled": 0, "rejected_no_consensus": 0, "fixtures_rejected": 0}
    for line in inp.read_text().splitlines():
        if not line.strip():
            continue
        raw = json.loads(line)
        if raw.get("demo_only") or raw.get("DEMO_ONLY_NOT_PRODUCTION_TRAINING_DATA"):
            label_provenance["fixtures_rejected"] += 1
            continue  # fixtures can NEVER enter real training data
        bad = PROHIBITED & set(raw.keys())
        if bad:
            return blocked("blocked_quality_gate", f"prohibited fields present: {sorted(bad)}")
        customer_label = raw.pop("customer_label", None)
        raw.pop("customer_label_source", None)
        raw.pop("job_id", None)
        snap = OpportunityFeatureSnapshot(**{k: v for k, v in raw.items() if k in OpportunityFeatureSnapshot.model_fields})
        weak = apply_labelers(snap)
        y, p, conflict = aggregate_labels(weak)
        if customer_label is not None:
            label, source = int(customer_label), "customer_feedback"
            label_provenance["customer_feedback"] += 1
        elif y is not None:
            label, source = y, "weak_labeled"
            label_provenance["weak_labeled"] += 1
        else:
            label_provenance["rejected_no_consensus"] += 1
            continue
        d = snap.model_dump(mode="json")
        d.update({
            "example_key": example_key(snap),
            "target": label,
            "label_source": source,
            "near_duplicate_cluster": snap.company_key_hash,
            "demo_only": False,
        })
        rows.append(d)

    if len(rows) < MIN_EXAMPLES:
        return blocked("blocked_insufficient_data",
                       f"{len(rows)} usable real examples < required {MIN_EXAMPLES}",
                       {"label_provenance": label_provenance})

    df = pd.DataFrame(rows).drop_duplicates(subset=["example_key"])
    counts = df.target.value_counts().to_dict()
    if min(counts.get(0, 0), counts.get(1, 0)) < MIN_PER_CLASS:
        return blocked("blocked_insufficient_data",
                       f"class support {counts} < required {MIN_PER_CLASS}/class",
                       {"label_provenance": label_provenance})

    df = group_temporal_split(df)
    csv = out / "real_training_examples.csv"
    df.to_csv(csv, index=False)
    checksum = hashlib.sha256(csv.read_bytes()).hexdigest()
    version = f"real-v{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
    manifest = DatasetManifest(
        dataset_version=version, feature_schema_version=1, label_schema_version=1,
        created_at=datetime.now(timezone.utc), source_records=len(rows),
        accepted_examples=len(df), rejected_examples=label_provenance["rejected_no_consensus"],
        duplicate_examples=len(rows) - len(df),
        class_distribution={str(k): int(v) for k, v in counts.items()},
        split_distribution={str(k): int(v) for k, v in df.split_assignment.value_counts().to_dict().items()},
        checksum=checksum, demo_only=False,
    )
    (rep / "dataset_manifest.json").write_text(manifest.model_dump_json(indent=2))
    results = train_models(df, art)
    (rep / "evaluation_report.json").write_text(json.dumps({
        "banner": "REAL-DATA TRAINING — labels are customer feedback + weak supervision; "
                  "do not claim product superiority without gold/customer test labels",
        "dataset_version": version,
        "label_provenance": label_provenance,
        **results,
    }, indent=2))
    (rep / "training_status.json").write_text(json.dumps({"status": "completed", "dataset_version": version}, indent=2))
    print(json.dumps({"status": "completed", "dataset_version": version, "examples": len(df), "label_provenance": label_provenance}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "runs/real"))
