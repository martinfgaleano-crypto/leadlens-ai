"""Batch inference entry: score a JSONL of adapted snapshots with a saved
artifact and emit predictions JSONL (probability, class, missingness, OOD).
Never mutates anything; the caller stores results as SHADOW data only.

Usage: python -m leadlens_ml.run_infer <snapshots.jsonl> <artifact.joblib> <features.json> <out.jsonl>
"""
from __future__ import annotations
import json, sys
from pathlib import Path

from .contracts import OpportunityFeatureSnapshot
from .inference import predict_logistic, artifact_checksum


def main(snapshots_path: str, artifact_path: str, features_path: str, out_path: str) -> int:
    feature_names = json.loads(Path(features_path).read_text())
    checksum = artifact_checksum(artifact_path)
    out_lines = []
    for line in Path(snapshots_path).read_text().splitlines():
        if not line.strip():
            continue
        raw = json.loads(line)
        passthrough = {k: raw.get(k) for k in ("example_key", "job_id", "baseline_rank", "company_key_hash")}
        snap = OpportunityFeatureSnapshot(**{k: v for k, v in raw.items() if k in OpportunityFeatureSnapshot.model_fields})
        pred = predict_logistic(snap, artifact_path, feature_names)
        out_lines.append(json.dumps({**passthrough, "artifact_checksum": checksum, **pred.model_dump(mode="json")}))
    Path(out_path).write_text("\n".join(out_lines) + "\n")
    print(json.dumps({"status": "completed", "predictions": len(out_lines), "artifact_checksum": checksum}))
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:5]))
