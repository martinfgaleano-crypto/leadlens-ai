# Repository Integration Plan

1. Audit real report, candidate, feedback and Vault schemas.
2. Map repository types to canonical contracts; revise assumptions.
3. Replace preliminary SQL with additive migrations and RLS matching current patterns.
4. Connect dataset extraction to immutable report/candidate snapshots.
5. Select a secure Python batch worker and private artifact store.
6. Add admin review, dataset and model-comparison surfaces.
7. Run real-data offline evaluation with a gold-only test set.
8. Integrate shadow predictions without changing customer-facing order.
9. Promote only after sustained Precision@K lift, calibration, slice safety and tested rollback.
