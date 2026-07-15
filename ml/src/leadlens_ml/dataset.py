from __future__ import annotations
import hashlib, json
from pathlib import Path
import pandas as pd
from .contracts import TrainingExample, DatasetManifest
from .labeling import apply_labelers, aggregate_labels

PROHIBITED={'tenant_id','user_id','company_name','email','phone','private_notes','final_label','future_outcome'}

def example_key(s):
    raw='|'.join([s.company_key_hash,s.monitor_key,s.snapshot_at.date().isoformat(),','.join(sorted(s.signal_types)),str(s.schema_version)])
    return hashlib.sha256(raw.encode()).hexdigest()

def build_training_examples(records):
    seen=set(); examples=[]; rejected=[]; duplicates=0
    for s in records:
        key=example_key(s)
        if key in seen:
            duplicates+=1; continue
        seen.add(key)
        weak=apply_labelers(s); y,p,conflict=aggregate_labels(weak)
        # simulated gold signal for technical validation only; independent from baseline score
        latent=.32*(s.soft_fit_score or 0)+.30*(s.evidence_quality or 0)+.18*max(0,1-(s.signal_age_days or 999)/150)+.12*int(s.primary_signal_type in ['expansion','funding','launch'])+.08*int((s.independent_source_count or 0)>=2)-.25*s.hard_gate_violation_count-.18*s.contradiction_count
        gold=int(latent>=.53)
        # 25% simulated human review, else weak label if available
        reviewed=int(s.company_key_hash[-2:],16)%4==0
        label=gold if reviewed else y
        source='simulated_human_review_demo' if reviewed else ('weak_supervision_demo' if y is not None else None)
        if label is None:
            rejected.append({'example_key':key,'reason':'no_consensus'}); continue
        quality='strong' if latent>=.72 else 'viable' if latent>=.53 else 'weak' if latent>=.38 else 'discard'
        examples.append(TrainingExample(example_key=key,snapshot=s,quality_label=quality,binary_label=label,label_source=source,label_confidence=1.0 if reviewed else abs(p-.5)*2,near_duplicate_cluster=s.company_key_hash))
    return examples,rejected,duplicates

def flatten_examples(examples):
    rows=[]
    for e in examples:
        d=e.snapshot.model_dump(mode='json')
        d.update({'example_key':e.example_key,'target':e.binary_label,'label_source':e.label_source,'near_duplicate_cluster':e.near_duplicate_cluster})
        for p in PROHIBITED:
            if p in d: raise ValueError(f'prohibited feature {p}')
        rows.append(d)
    return pd.DataFrame(rows)

def checksum_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
