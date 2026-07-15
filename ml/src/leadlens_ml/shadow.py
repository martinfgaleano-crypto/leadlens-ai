from __future__ import annotations
import pandas as pd
from .contracts import ShadowRankingResult, ShadowRow

def compare_shadow_ranking(items, top_k=10):
    df=pd.DataFrame(items).copy(); original=df.sort_values('baseline_rank').company_key_hash.tolist()
    df['shadow_rank']=df.groupby('candidate_group')['ml_score'].rank(method='first',ascending=False).astype(int)
    rows=[]
    for _,r in df.iterrows():
        rows.append(ShadowRow(company_key_hash=r.company_key_hash,baseline_rank=int(r.baseline_rank),shadow_rank=int(r.shadow_rank),rank_delta=int(r.baseline_rank-r.shadow_rank),would_enter_top_k=bool(r.baseline_rank>top_k and r.shadow_rank<=top_k),would_leave_top_k=bool(r.baseline_rank<=top_k and r.shadow_rank>top_k),baseline_score=float(r.baseline_score),ml_score=float(r.ml_score),out_of_distribution=bool(r.get('out_of_distribution',False))))
    corr=float(df[['baseline_rank','shadow_rank']].corr(method='spearman').iloc[0,1]) if len(df)>2 else None
    return ShadowRankingResult(top_k=top_k,rows=rows,spearman_correlation=corr,baseline_order_unchanged=(original==df.sort_values('baseline_rank').company_key_hash.tolist()))
