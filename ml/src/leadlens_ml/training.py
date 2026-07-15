from __future__ import annotations
from pathlib import Path
import joblib, pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import precision_score,recall_score,f1_score,roc_auc_score,average_precision_score,log_loss,brier_score_loss,confusion_matrix

EXCLUDE={'target','example_key','label_source','near_duplicate_cluster','split_assignment','company_key_hash','monitor_key','snapshot_at','signal_types','signal_combo_keys','candidate_group','demo_only','baseline_score','baseline_rank','schema_version'}

def feature_columns(df): return [c for c in df.columns if c not in EXCLUDE]
def make_preprocessor(df, cols):
    cats=[c for c in cols if df[c].dtype=='object' or str(df[c].dtype).startswith(('bool','str','string','category'))]  # pandas 3.x: str dtype is no longer object
    nums=[c for c in cols if c not in cats]
    return ColumnTransformer([('num',Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler())]),nums),('cat',Pipeline([('imp',SimpleImputer(strategy='most_frequent')),('oh',OneHotEncoder(handle_unknown='ignore',sparse_output=False))]),cats)],verbose_feature_names_out=False)
def metrics(y,p):
    pred=(p>=.5).astype(int)
    return {'precision':precision_score(y,pred,zero_division=0),'recall':recall_score(y,pred,zero_division=0),'f1':f1_score(y,pred,zero_division=0),'roc_auc':roc_auc_score(y,p) if len(set(y))>1 else None,'pr_auc':average_precision_score(y,p),'log_loss':log_loss(y,p,labels=[0,1]),'brier':brier_score_loss(y,p),'confusion_matrix':confusion_matrix(y,pred,labels=[0,1]).tolist(),'n':len(y)}
def train_models(df, outdir):
    out=Path(outdir); out.mkdir(parents=True,exist_ok=True)
    cols=feature_columns(df); train=df[df.split_assignment=='train']; test=df[df.split_assignment=='test']
    log=Pipeline([('prep',make_preprocessor(train,cols)),('clf',LogisticRegression(max_iter=120,class_weight='balanced',random_state=42))]); log.fit(train[cols],train.target)
    p1=log.predict_proba(test[cols])[:,1]; joblib.dump(log,out/'logistic_calibrated.joblib')
    hgb=Pipeline([('prep',make_preprocessor(train,cols)),('clf',HistGradientBoostingClassifier(max_depth=4,learning_rate=.08,max_iter=12,random_state=42,l2_regularization=1.0))]); hgb.fit(train[cols],train.target)
    p2=hgb.predict_proba(test[cols])[:,1]; joblib.dump(hgb,out/'gradient_boosting_calibrated.joblib')
    return {'calibration_status':'evaluated_not_posthoc_calibrated_in_demo','logistic':metrics(test.target.to_numpy(),p1),'gradient_boosting':metrics(test.target.to_numpy(),p2),'features':cols,'test_predictions':{'example_key':test.example_key.tolist(),'y':test.target.tolist(),'logistic':p1.tolist(),'gradient_boosting':p2.tolist()}}
