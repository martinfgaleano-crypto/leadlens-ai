from pathlib import Path
import pandas as pd
from leadlens_ml.fixtures import generate_demo_snapshots
from leadlens_ml.dataset import build_training_examples, flatten_examples
from leadlens_ml.labeling import apply_labelers, aggregate_labels
from leadlens_ml.splitting import group_temporal_split
from leadlens_ml.training import train_models
from leadlens_ml.shadow import compare_shadow_ranking

def test_contract_and_labeling():
    s=generate_demo_snapshots(2,1)[0]
    rs=apply_labelers(s)
    assert len(rs)>=8
    y,p,c=aggregate_labels(rs)
    assert 0<=p<=1

def test_split_has_no_company_leakage():
    ex,_,_=build_training_examples(generate_demo_snapshots(120,2))
    df=group_temporal_split(flatten_examples(ex))
    tr=set(df[df.split_assignment=='train'].near_duplicate_cluster)
    te=set(df[df.split_assignment=='test'].near_duplicate_cluster)
    assert not tr & te

def test_models_train(tmp_path):
    ex,_,_=build_training_examples(generate_demo_snapshots(240,3))
    df=group_temporal_split(flatten_examples(ex))
    result=train_models(df,tmp_path)
    assert (tmp_path/'logistic_calibrated.joblib').exists()
    assert (tmp_path/'gradient_boosting_calibrated.joblib').exists()
    assert result['logistic']['n']>0

def test_shadow_keeps_baseline():
    items=[{'company_key_hash':str(i),'candidate_group':'g','baseline_rank':i+1,'baseline_score':100-i,'ml_score':float(i),'out_of_distribution':False} for i in range(12)]
    r=compare_shadow_ranking(items,5)
    assert r.baseline_order_unchanged
    assert any(x.would_enter_top_k for x in r.rows)
