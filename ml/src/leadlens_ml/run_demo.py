from __future__ import annotations
import json, hashlib
from pathlib import Path
import pandas as pd
from .fixtures import generate_demo_snapshots
from .dataset import build_training_examples, flatten_examples
from .splitting import group_temporal_split
from .training import train_models
from .inference import predict_logistic, artifact_checksum
from .shadow import compare_shadow_ranking
from .contracts import DatasetManifest
from datetime import datetime, timezone

def main(root='.'): 
    root=Path(root); art=root/'artifacts/demo'; rep=root/'reports/demo'; fix=root/'fixtures'; art.mkdir(parents=True,exist_ok=True); rep.mkdir(parents=True,exist_ok=True); fix.mkdir(parents=True,exist_ok=True)
    snaps=generate_demo_snapshots(140,42); examples,rejected,dups=build_training_examples(snaps); df=group_temporal_split(flatten_examples(examples))
    csv=fix/'demo_training_examples.csv'; pq=fix/'demo_training_examples.parquet'; df.to_csv(csv,index=False)
    try:
        df.to_parquet(pq,index=False); checksum=hashlib.sha256(pq.read_bytes()).hexdigest()
    except ImportError:
        pq=csv; checksum=hashlib.sha256(csv.read_bytes()).hexdigest()
    manifest=DatasetManifest(dataset_version='demo-v1',feature_schema_version=1,label_schema_version=1,created_at=datetime.now(timezone.utc),source_records=len(snaps),accepted_examples=len(df),rejected_examples=len(rejected),duplicate_examples=dups,class_distribution={str(k):int(v) for k,v in df.target.value_counts().to_dict().items()},split_distribution={str(k):int(v) for k,v in df.split_assignment.value_counts().to_dict().items()},checksum=checksum,demo_only=True)
    (rep/'dataset_manifest.json').write_text(manifest.model_dump_json(indent=2))
    results=train_models(df,art)
    (rep/'evaluation_report.json').write_text(json.dumps({'banner':'PIPELINE TECHNICAL VALIDATION — NOT PRODUCT PERFORMANCE',**results},indent=2))
    # inference + shadow on test
    test=df[df.split_assignment=='test'].head(25).copy(); preds=[]
    from .contracts import OpportunityFeatureSnapshot
    for _,r in test.iterrows():
        data={k:r[k] for k in OpportunityFeatureSnapshot.model_fields if k in r}
        s=OpportunityFeatureSnapshot.model_validate(data); pr=predict_logistic(s,art/'logistic_calibrated.joblib',results['features']); preds.append(pr)
    items=[]
    for (_,r),p in zip(test.iterrows(),preds):
        items.append({'company_key_hash':r.company_key_hash,'candidate_group':r.candidate_group,'baseline_rank':int(r.baseline_rank),'baseline_score':float(r.baseline_score),'ml_score':p.quality_score,'out_of_distribution':p.out_of_distribution})
    shadow=compare_shadow_ranking(items,10); (rep/'shadow_simulation_report.json').write_text(shadow.model_dump_json(indent=2))
    (rep/'ood_report.json').write_text(json.dumps({'banner':'PIPELINE TECHNICAL VALIDATION — NOT PRODUCT PERFORMANCE','count':sum(p.out_of_distribution for p in preds),'predictions':[p.model_dump(mode='json') for p in preds]},indent=2,default=str))
    (rep/'calibration_report.json').write_text(json.dumps({'banner':'PIPELINE TECHNICAL VALIDATION — NOT PRODUCT PERFORMANCE','logistic_brier':results['logistic']['brier'],'gradient_brier':results['gradient_boosting']['brier']},indent=2))
    return {'rows':len(df),'rejected':len(rejected),'duplicates':dups,'results':results}

if __name__=='__main__':
    print(json.dumps(main(Path(__file__).resolve().parents[2]),indent=2))
