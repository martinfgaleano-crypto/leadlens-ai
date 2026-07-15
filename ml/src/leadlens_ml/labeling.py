from __future__ import annotations
from collections import defaultdict
from .contracts import OpportunityFeatureSnapshot, WeakLabelResult

def _r(id,label,conf,reason,features):
    return WeakLabelResult(labeler_id=id,labeler_version='1.0.0',label=label,confidence=conf,reason_codes=[reason],rationale_code=reason,applied_features=features)

def apply_labelers(s:OpportunityFeatureSnapshot):
    r=[]
    r.append(_r('recent_verified_expansion','positive',.9,'recent_verified_expansion',['primary_signal_type','signal_age_days','evidence_grounded']) if s.primary_signal_type=='expansion' and (s.signal_age_days or 999)<=45 and s.evidence_grounded else _r('recent_verified_expansion','abstain',0,'not_applicable',[]))
    r.append(_r('strong_independent_evidence','positive',.85,'strong_independent_evidence',['independent_source_count','evidence_quality']) if s.independent_source_count>=2 and (s.evidence_quality or 0)>=.7 else _r('strong_independent_evidence','abstain',0,'not_applicable',[]))
    r.append(_r('stale_signal','negative',.85,'stale_signal',['signal_age_days']) if (s.signal_age_days or 0)>90 else _r('stale_signal','abstain',0,'not_applicable',[]))
    r.append(_r('generic_hiring','negative',.7,'generic_hiring',['primary_signal_type','evidence_quality']) if s.primary_signal_type=='hiring' and (s.evidence_quality or 0)<.55 else _r('generic_hiring','abstain',0,'not_applicable',[]))
    r.append(_r('strong_icp_fit','positive',.8,'strong_icp_fit',['soft_fit_score']) if (s.soft_fit_score or 0)>=.75 and s.hard_gate_violation_count==0 else _r('strong_icp_fit','abstain',0,'not_applicable',[]))
    r.append(_r('hard_gate_violation','negative',.95,'hard_gate_violation',['hard_gate_violation_count']) if s.hard_gate_violation_count>0 else _r('hard_gate_violation','abstain',0,'not_applicable',[]))
    r.append(_r('contradictory_evidence','negative',.9,'contradictory_evidence',['contradiction_count']) if s.contradiction_count>0 else _r('contradictory_evidence','abstain',0,'not_applicable',[]))
    r.append(_r('coverage_limited','abstain',0,'coverage_limited',['coverage_limited']) if s.coverage_limited else _r('coverage_limited','abstain',0,'not_applicable',[]))
    r.append(_r('weak_single_source','negative',.75,'weak_single_source',['source_count','evidence_quality']) if s.source_count<=1 and (s.evidence_quality or 0)<.5 else _r('weak_single_source','abstain',0,'not_applicable',[]))
    r.append(_r('fit_strong_evidence_weak','negative',.65,'fit_strong_evidence_weak',['soft_fit_score','evidence_quality']) if (s.soft_fit_score or 0)>.75 and (s.evidence_quality or 0)<.4 else _r('fit_strong_evidence_weak','abstain',0,'not_applicable',[]))
    return r

def aggregate_labels(results:list[WeakLabelResult], threshold=.15):
    pos=sum(x.confidence for x in results if x.label=='positive')
    neg=sum(x.confidence for x in results if x.label=='negative')
    total=pos+neg
    if total==0: return None,0.0,True
    prob=pos/total
    conflict=pos>0 and neg>0
    if abs(prob-.5)<threshold: return None,prob,conflict
    return int(prob>=.5),prob,conflict

def labeler_stats(all_results):
    stats=defaultdict(lambda:defaultdict(int))
    for rs in all_results:
        for x in rs: stats[x.labeler_id][x.label]+=1
    return {k:dict(v) for k,v in stats.items()}
