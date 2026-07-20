// ─── Organization type classification (organization-type-v1) ─────────────────
// Distinguishes commercial companies (valid ICP accounts) from public
// authorities / programs / systems that cannot reasonably buy the client's
// product. Does NOT auto-reject every state-linked entity: a mixed/state-owned
// COMMERCIAL company (Ecopetrol) or a private concessionaire (Opain) is a valid
// account; a ministry, mayor's office, or a bare transit "system" is not.
// Deterministic keyword rules over the name + optional description/domain.

export const ORGANIZATION_TYPE_VERSION = "organization-type-v1";

export type OrganizationType =
  | "private_company" | "state_owned_commercial" | "mixed_economy" | "private_concessionaire"
  | "public_authority" | "government_body" | "public_program" | "public_utility"
  | "transit_system" | "association_or_guild" | "unknown";

export interface OrgClassification {
  organization_type: OrganizationType;
  commercial_entity: boolean;         // can it plausibly transact commercially?
  public_sector_relationship: "none" | "state_owned" | "mixed" | "concession" | "authority" | "program";
  eligible_for_icp: boolean;          // may advance as an account (subject to ICP)
  reason: string;
}

// Hard public (never a commercial account): ministries, mayors, agencies,
// programs, bare "system" brands.
const GOV_BODY = /\b(ministerio|alcald[ií]a|gobernaci[oó]n|secretar[ií]a|superintendencia|departamento nacional|agencia nacional|instituto nacional|unidad administrativa|comisi[oó]n de regulaci[oó]n|congreso|senado|presidencia|contralor[ií]a|procuradur[ií]a|ministry|mayor'?s office|city of|department of|national agency|government of)\b/i;
const PUBLIC_PROGRAM = /\b(programa (nacional|distrital)|plan (nacional|de desarrollo)|proyecto p[uú]blico|pol[ií]tica p[uú]blica|iniciativa p[uú]blica)\b/i;
const TRANSIT_SYSTEM = /\b(transmilenio|sistema integrado de transporte|sitp|metropl[uú]s|metrol[ií]nea|mio\b|megab[uú]s)\b/i;
// Public utility / transit AUTHORITY names (often state operators, weak ICP fit
// unless the ICP explicitly targets them).
const PUBLIC_UTILITY = /\b(empresas? p[uú]blicas?|acueducto|alcantarillado|aseo (de|distrital)|empresa de energ[ií]a de|electrificadora|metro de [a-záéíóú]+)\b/i;
const ASSOCIATION = /\b(asociaci[oó]n|federaci[oó]n|c[aá]mara de comercio|gremio|sindicato|corporaci[oó]n gremial|association|federation|chamber of commerce|guild|union)\b/i;
// State-owned but COMMERCIAL companies (valid accounts).
const STATE_COMMERCIAL = /\b(ecopetrol|isa\b|isagen|epm\b|une\b|banco agrario|positiva|findeter|bancoldex|coljuegos|servicios postales|4-72)\b/i;
// Concession / operator markers (private operator of public infra = valid).
const CONCESSION = /\b(opain|concesi[oó]n|concesionari[ao]|operador privado|odinsa|conconcreto|episol|corficolombiana)\b/i;

export function classifyOrganization(input: { name: string; description?: string | null; domain?: string | null }): OrgClassification {
  const hay = `${input.name} ${input.description ?? ""}`.toLowerCase();
  const dom = (input.domain ?? "").toLowerCase();
  const govDomain = /\.gov(\.|$)|\.gob(\.|$)|\.mil(\.|$)/i.test(dom);

  // 1. State-owned but commercial → valid account.
  if (STATE_COMMERCIAL.test(hay)) return { organization_type: "state_owned_commercial", commercial_entity: true, public_sector_relationship: "state_owned", eligible_for_icp: true, reason: "Empresa comercial con participación estatal — cuenta válida." };
  // 2. Private concessionaire / operator → valid account.
  if (CONCESSION.test(hay)) return { organization_type: "private_concessionaire", commercial_entity: true, public_sector_relationship: "concession", eligible_for_icp: true, reason: "Concesionario/operador privado — cuenta válida." };
  // 3. Hard public bodies / programs / gov domains → not accounts.
  if (GOV_BODY.test(hay) || govDomain) return { organization_type: "government_body", commercial_entity: false, public_sector_relationship: "authority", eligible_for_icp: false, reason: "Entidad de gobierno / autoridad — no es cuenta comercial." };
  if (PUBLIC_PROGRAM.test(hay)) return { organization_type: "public_program", commercial_entity: false, public_sector_relationship: "program", eligible_for_icp: false, reason: "Programa/plan público — no es cuenta comercial." };
  // 4. Transit systems (brand, not a corporate buyer) → not accounts by default.
  if (TRANSIT_SYSTEM.test(hay)) return { organization_type: "transit_system", commercial_entity: false, public_sector_relationship: "authority", eligible_for_icp: false, reason: "Sistema de transporte público (marca/sistema) — sin entidad corporativa compradora clara." };
  // 5. Public utility / state metro operators → authority-linked, ICP-gated.
  if (PUBLIC_UTILITY.test(hay)) return { organization_type: "public_utility", commercial_entity: true, public_sector_relationship: "authority", eligible_for_icp: false, reason: "Operador/servicio público estatal — fit comercial dudoso; excluir salvo que el ICP lo incluya explícitamente." };
  // 6. Associations / guilds → not accounts.
  if (ASSOCIATION.test(hay)) return { organization_type: "association_or_guild", commercial_entity: false, public_sector_relationship: "none", eligible_for_icp: false, reason: "Asociación/gremio/cámara — no es cuenta comercial." };
  // 7. Default: private commercial company.
  return { organization_type: "private_company", commercial_entity: true, public_sector_relationship: "none", eligible_for_icp: true, reason: "Empresa privada — cuenta válida." };
}
