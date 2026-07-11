# Source Engine Architecture v0

**Documento vivo** — arquitectura futura del motor de descubrimiento de cuentas/señales. Complementa `SOURCE_STRATEGY.md` (estrategia de fuentes) y `PRODUCTION_ARCHITECTURE.md`. Este es el gap de valor de producto más grande a largo plazo.

**Regla cero:** el source engine descubre EMPRESAS y SEÑALES públicas a nivel de cuenta. Nunca contactos, nunca emails personales, nunca LinkedIn personal, nunca enrichment de personas. LeadLens no es Apollo y el source engine no puede convertirlo en Apollo.

## Tipos de fuente

**Permitidas (account-level, públicas):**
- Noticias de negocio / prensa (expansiones, funding, aperturas, contratos)
- Registros públicos de empresas (cámaras de comercio, licitaciones, aduanas donde sea público)
- Job postings agregados A NIVEL DE EMPRESA (señal de crecimiento — nunca el candidato/recruiter individual)
- Sitios corporativos (páginas de empresa, comunicados, blogs corporativos)
- Directorios sectoriales y gremios
- Datos ya licenciados vía providers existentes (con contrato)

**Prohibidas:**
- Scraping de LinkedIn (personal o vía terceros grises)
- Compra/uso de bases de contactos personales
- Cualquier fuente cuyo valor sea identificar PERSONAS
- Fuentes que violen ToS del origen

## Contratos de datos (skeletons en `lib/sources/source-engine-types.ts`)

- `AccountDiscoverySource` — un adapter de fuente: id, tipo (`SourceType` existente), regiones cubiertas, `SourceReliability`, ToS-safe flag.
- `SourceCandidate` — una empresa candidata descubierta: company, domain?, industry?, region, evidencia textual account-level, `signal_date` SOLO si la fuente da fecha estructurada (regla Signal Date v0: nunca extraída de texto libre, nunca inventada).
- `SignalExtractionResult` — señal clasificada: claim, `SignalRole` (timing vs context_only), fecha estructurada o null, source URL (hostname-safe).
- `DiscoveryRun` — ejecución bounded de descubrimiento por ICP/región: mismo patrón job/processor que los monitor runs.
- `DiscoveryCache` — reuso estilo Vault: candidatos ya descubiertos se reusan por región/industria antes de golpear la fuente otra vez (mismo principio que vault_leads del flow actual).

## Reglas de integración con el pipeline existente

1. El source engine alimenta `LeadCandidate[]` al `runLeadFinderAgent` — no reemplaza etapas; enchufa antes.
2. `signal_date` estructurada o null — la Freshness Layer existente clasifica; **nunca fake freshness**: fuente sin fecha ⇒ `unknown`, y `unknown` nunca se presenta como fresh (regla vigente).
3. `SourceReliability` por adapter alimenta `region_confidence` y Evidence Quality — una fuente nueva entra con reliability baja hasta ser evaluada.
4. **Evaluación pre-exposición**: ningún adapter alimenta reportes de clientes hasta pasar un QA interno (muestra de N candidatos revisados contra el checklist de QUALITY_STANDARD: fuente identificable, fecha real, evidencia específica, cero datos personales).
5. Adapter pattern: cada fuente implementa `AccountDiscoverySource`; el engine los compone por región/ICP. Agregar una fuente = agregar un adapter, no tocar el pipeline.
6. LATAM/mercados emergentes: prioridad a registros públicos locales y prensa de negocio regional — es donde los incumbentes (US-céntricos) son débiles y donde el Vault acumulado se vuelve defensible.
7. Vault/Account Memory se reusan tal cual: candidatos descubiertos pasan por anti-repetition y do_not_show igual que hoy.

## Qué NO es este documento

No es un plan de scraping. No es una integración de APIs externas nuevas (eso requiere decisión de provider + contrato). No cambia scoring/ranking. Es el contrato para que, cuando se elija el primer adapter real, encaje en la arquitectura existente sin improvisación.

## Actualización 2026-07-11 — Vault como fuente de reportes

Nueva fuente interna compliant: el Vault → Report bridge (`source: "vault"` en
LeadSource). Selección exclusion-first de companies/signals aprobados + adapter
account-level a LeadCandidate[]. Ver LEADLENS_VAULT_REPORT_BRIDGE.md.
