from __future__ import annotations
from datetime import datetime, timedelta, timezone
import hashlib, random
from .contracts import OpportunityFeatureSnapshot

REGIONS=['north_america','latam','europe']
INDUSTRIES=['logistics','cybersecurity','construction','healthcare','fintech','saas']
SIGNALS=['expansion','hiring','funding','launch','partnership','regulatory']
SIZES=['small','medium','large']

def _h(text:str)->str: return hashlib.sha256(text.encode()).hexdigest()[:20]

def generate_demo_snapshots(n:int=500, seed:int=42):
    rng=random.Random(seed)
    now=datetime(2026,7,14,tzinfo=timezone.utc)
    out=[]
    for i in range(n):
        region=rng.choice(REGIONS); industry=rng.choice(INDUSTRIES); size=rng.choice(SIZES)
        signal=rng.choices(SIGNALS, weights=[.25,.25,.15,.15,.1,.1])[0]
        age=max(0,int(rng.gauss(45 if signal!='hiring' else 65,35)))
        source_count=max(1,int(rng.gauss(2.5,1.2)))
        independent=max(1,min(source_count,int(rng.gauss(2,1))))
        official=rng.random()<.45
        evidence=min(1,max(0,rng.gauss(.65+.08*(source_count>=3)+.08*official, .18)))
        fit=min(1,max(0,rng.gauss(.62, .22)))
        contradiction=1 if rng.random()<.08 else 0
        coverage=region=='latam' and rng.random()<.18
        hard_gate=1 if rng.random()<.08 else 0
        baseline=max(0,min(100,100*(.35*fit+.3*evidence+.2*max(0,1-age/150)+.15*(signal in ['expansion','funding','launch'])) - 15*hard_gate))
        snap=OpportunityFeatureSnapshot(
            company_key_hash=_h(f'company-{i//2 if i%73==0 else i}'), monitor_key=f'icp-{i%12}', snapshot_at=now-timedelta(days=i%180),
            primary_signal_type=signal, signal_types=[signal], signal_age_days=age, freshest_signal_age_days=age, oldest_signal_age_days=age,
            dated_signal_ratio=1.0 if rng.random()>.1 else 0.0, fresh_signal_count=int(age<=30), recent_signal_count=int(30<age<=90), stale_signal_count=int(age>90),
            source_count=source_count, independent_source_count=independent, official_source_present=official, primary_source_present=official,
            reputable_media_present=rng.random()<.6, evidence_grounded=evidence>.5 and contradiction==0, evidence_quality=evidence,
            evidence_completeness=max(0,min(1,evidence-rng.random()*.15)), contradiction_count=contradiction, claim_count=source_count+rng.randint(0,3),
            cited_claim_ratio=max(0,min(1,evidence+rng.gauss(0,.1))), dated_claim_ratio=1.0 if age is not None else 0,
            provenance_completeness=max(0,min(1,evidence+rng.gauss(0,.08))), rights_allowed=True, coverage_limited=coverage,
            unsupported_claim_count=int(evidence<.35), normalized_industry=industry, region=region, country={'north_america':'US','latam':'CO','europe':'ES'}[region],
            size_bucket=size, growth_stage=rng.choice(['early','growth','mature']), public_private_status=rng.choice(['private','public']),
            geographic_footprint_count=rng.randint(1,8), b2b_indicator=True, saas_indicator=industry=='saas', multi_region_indicator=rng.random()<.35,
            industry_match=fit, region_match=max(0,min(1,fit+rng.gauss(0,.15))), size_match=max(0,min(1,fit+rng.gauss(0,.15))),
            use_case_match=max(0,min(1,fit+rng.gauss(0,.15))), keyword_overlap=max(0,min(1,fit+rng.gauss(0,.2))),
            matched_criteria_count=int(round(fit*5)), unmatched_criteria_count=5-int(round(fit*5)), hard_gate_violation_count=hard_gate,
            soft_fit_score=fit, fit_confidence=max(0,min(1,fit+rng.gauss(0,.1))), signal_combo_keys=[], baseline_score=baseline,
            baseline_rank=(i%25)+1, candidate_group=f'run-{i//25}', demo_only=True
        )
        out.append(snap)
    return out
