// ─── Entity role in event (entity-role-v1) ───────────────────────────────────
// Not every company mentioned in a story is the account. An acquisition has an
// acquirer and an acquired; a contract has an awarder and a contractor; a
// facility may belong to a subsidiary. This determines the candidate company's
// role and whether it is the entity that actually experienced the operational
// change (the real account) vs an incidental mention. Deterministic over the
// event text relative to the company name.

export const ENTITY_ROLE_VERSION = "entity-role-v1";

export type EntityRole =
  | "acquirer" | "acquired_company" | "operating_subsidiary" | "asset_owner"
  | "service_operator" | "contract_awarder" | "contractor" | "partner"
  | "subject_of_change" | "incidental_mention";

export interface RoleAssessment {
  role: EntityRole;
  is_account: boolean;    // is this the entity that should be the account?
  reason: string;
}

/** Word-boundary index of the company's first token. indexOf caused the
 *  "Inter"/Nu-bank false positive: "inter" matched inside "internacional".
 *  The token must appear as a complete word. */
const tokenIndex = (hay: string, company: string): number => {
  const tok = company.toLowerCase().split(" ")[0];
  const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const m = hay.match(new RegExp(`(^|[^\\p{L}\\p{N}])(${esc})(?=$|[^\\p{L}\\p{N}])`, "iu"));
    return m?.index !== undefined ? m.index + m[1].length : -1;
  } catch { return hay.indexOf(tok); }
};

const near = (hay: string, company: string, pattern: RegExp, window = 60): boolean => {
  const idx = tokenIndex(hay, company);
  if (idx < 0) return false;
  const seg = hay.slice(Math.max(0, idx - window), idx + company.length + window);
  return pattern.test(seg);
};

export function assessEntityRole(company: string, titleAndContent: string): RoleAssessment {
  const hay = titleAndContent.toLowerCase();
  const idx = tokenIndex(hay, company);
  if (idx < 0) return { role: "incidental_mention", is_account: false, reason: "La empresa no aparece cerca del evento." };

  // Acquisition roles: "<A> adquirió <B>" — A is acquirer (account), B acquired.
  if (near(hay, company, /(adquiri[oó]|compr[oó]|asumi[oó] el (100|control) de|absorbi[oó])\s+(a |el |la |las |los )?$/i, 40) === false
      && /(adquiri[oó]|compr[oó]|asumi[oó] el (100|control))/.test(hay)) {
    // Determine order: does the company appear BEFORE "adquirió"?
    const acqIdx = hay.search(/(adquiri[oó]|compr[oó]|asumi[oó] el (100|control)|absorbi[oó])/);
    if (acqIdx >= 0) {
      if (idx < acqIdx) return { role: "acquirer", is_account: true, reason: "La empresa es la adquirente (sujeto del cambio de control)." };
      return { role: "acquired_company", is_account: true, reason: "La empresa fue adquirida — el cambio de control la afecta directamente (cuenta válida, validar quién opera)." };
    }
  }
  // Contract roles.
  if (near(hay, company, /(adjudic[oó]|otorg[oó] (el|un) contrato a|contrat[oó] a)/i)) {
    const awardIdx = hay.search(/(adjudic[oó]|otorg[oó]|contrat[oó] a)/);
    if (awardIdx >= 0 && idx > awardIdx) return { role: "contractor", is_account: true, reason: "La empresa recibió el contrato (contratista)." };
    return { role: "contract_awarder", is_account: true, reason: "La empresa adjudicó el contrato." };
  }
  // Facility/asset owner: "<company> inauguró/abrió su planta/bodega".
  if (near(hay, company, /(inaugur[oó]|abri[oó]|construy[oó]|ampl[ií][oó])\s+(su |una |un |la |el |nuev)/i)) {
    return { role: "asset_owner", is_account: true, reason: "La empresa abrió/amplió una instalación propia." };
  }
  // Facility attributed BY NAME to the company: "CEDI Falabella", "planta de
  // Postobón", "bodega para Alkosto" — third-party project/showcase pages name
  // the facility after its owner. The named owner is the asset_owner (still
  // subject to date/materiality/fit gates — this is attribution, not approval).
  if (near(hay, company, /(cedi|planta|bodega|centro de distribuci[oó]n|centro log[ií]stico|instalaci[oó]n)\s+(de |para |del grupo )?$/i, 45)
      || new RegExp(`(cedi|planta|bodega|centro de distribuci[oó]n|centro log[ií]stico)\\s+(de\\s+|para\\s+)?${company.toLowerCase().split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu").test(hay)) {
    return { role: "asset_owner", is_account: true, reason: "Instalación atribuida por nombre a la empresa (CEDI/planta/bodega de la empresa)." };
  }
  // Partnership: "<company> firma alianza / anuncia acuerdo con".
  if (near(hay, company, /(firm[oó] (una )?alianza|anunci[oó] (un )?acuerdo|se ali[oó]) con/i)) {
    return { role: "partner", is_account: true, reason: "La empresa es parte de la alianza (validar cuál parte tiene la necesidad)." };
  }
  // Investment/operation by the company.
  if (near(hay, company, /(invirti[oó]|invierte|inaugur|amplí|moderniz|implement|inici[oó])/i)) {
    return { role: "subject_of_change", is_account: true, reason: "La empresa es el sujeto del cambio operativo." };
  }
  // Company appears but not tied to an action verb near it → incidental.
  return { role: "incidental_mention", is_account: false, reason: "La empresa se menciona pero no como sujeto del evento (posible mención incidental)." };
}
