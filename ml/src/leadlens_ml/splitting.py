from __future__ import annotations
import pandas as pd

def group_temporal_split(df:pd.DataFrame):
    # sort groups by earliest timestamp and assign whole company groups
    g=df.groupby('near_duplicate_cluster')['snapshot_at'].min().sort_values()
    groups=list(g.index); n=len(groups)
    train=set(groups[:int(.7*n)]); val=set(groups[int(.7*n):int(.85*n)]); test=set(groups[int(.85*n):])
    out=df.copy(); out['split_assignment']=out['near_duplicate_cluster'].map(lambda x:'train' if x in train else 'validation' if x in val else 'test')
    assert not (set(out[out.split_assignment=='train'].near_duplicate_cluster)&set(out[out.split_assignment=='test'].near_duplicate_cluster))
    return out
