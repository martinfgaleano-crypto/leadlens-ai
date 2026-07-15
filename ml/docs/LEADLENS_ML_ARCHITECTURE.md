# LeadLens ML Architecture

## Status
Pre-integration technical build. No real LeadLens data or production integration.

## Flow
Canonical opportunity snapshot → validation → dataset factory → weak labelers / human labels → grouped temporal split → independent models → evaluation → local registry artifacts → inference → OOD checks → shadow comparison.

## Safety boundaries
The independent feature set excludes tenant identity, company name, private notes, contact data, future feedback, outcomes, baseline score and baseline rank. Shadow output is stored separately and never mutates baseline ordering.

## Model strategy
Logistic regression is the interpretable baseline. Histogram gradient boosting is the nonlinear challenger. Both are evaluated on grouped temporal test data. Fixture results validate execution only.
