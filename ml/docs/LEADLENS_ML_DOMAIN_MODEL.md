# Domain Model

Core immutable entities are OpportunitySnapshot, TrainingExample, Label, DatasetVersion, TrainingRun, ModelVersion, Prediction and ShadowRankingResult. Account/company identity is represented by a stable internal hash in exportable ML records. Feedback and outcomes occur after prediction time and are labels, never contemporaneous features. Dataset and model versions are append-only manifests.
