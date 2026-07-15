from __future__ import annotations
from pathlib import Path
import hashlib, joblib, pandas as pd, numpy as np
from .contracts import OpportunityFeatureSnapshot, PredictionResult
from .training import EXCLUDE

def artifact_checksum(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def _row(s):
    d=s.model_dump(mode='json'); return pd.DataFrame([d])

def predict_logistic(s, artifact, feature_names):
    model=joblib.load(artifact); df=_row(s); missing=[c for c in feature_names if c not in df or pd.isna(df.iloc[0].get(c))]
    p=float(model.predict_proba(df[feature_names])[:,1][0]); miss=len(missing)/max(1,len(feature_names)); reasons=[]
    if miss>.35: reasons.append('high_missingness')
    if s.region not in {'north_america','latam','europe'}: reasons.append('unseen_region')
    if s.coverage_limited: reasons.append('coverage_limited')
    ood=bool(reasons)
    return PredictionResult(model_id='leadlens-global-quality-logistic',model_version='0.1.0-demo',probability=p,quality_score=100*p,predicted_class='useful' if p>=.5 else 'not_useful',uncertainty=1-abs(p-.5)*2,top_positive_factors=['evidence_quality','soft_fit_score'] if p>=.5 else [],top_negative_factors=['signal_age_days','hard_gate_violation_count'] if p<.5 else [],missing_features=missing,missingness_ratio=miss,out_of_distribution=ood,ood_reasons=reasons)
