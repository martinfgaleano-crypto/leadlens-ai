// Unit tests: event-first query planning for wellness/channel ICPs.
// Run: npm run test:event-first-queries
import { buildCompanyQueries } from "@/lib/discovery/company-first-discovery";
import type { NeedsMap } from "@/lib/discovery/needs-map";
let p = 0, f = 0; const t = (n: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${n}`); ok ? p++ : f++; };

const wellnessNeeds = { buyer_problem: "diferenciar surtido de bienestar con bebidas funcionales", expected_need: "infusiones y productos naturales", relevant_signal_families: [] } as unknown as NeedsMap;
const swNeeds = { buyer_problem: "reducir complejidad operativa", expected_need: "software de inventarios", relevant_signal_families: [] } as unknown as NeedsMap;

const retail = buildCompanyQueries("Alkosto", "alkosto.com", wellnessNeeds, true, 6, false, false, "buyer_channel" as never).join(" | ");
t("retail wellness → busca APERTURAS/expansión (evento)", /nueva tienda|abre|inauguró|expansión/i.test(retail));
t("retail wellness → busca proveedores/sourcing (evento)", /proveedores|sourcing|convocatoria/i.test(retail));
t("retail wellness → busca gifting/renovación (evento)", /gifting|regalos|renovación|relanzamiento/i.test(retail));
t("retail wellness → NO es solo portafolio estático", !/^\S*portafolio\S*$/.test(retail) && /nueva|abre|programa|convenio/i.test(retail));

const hotel = buildCompanyQueries("GHL Hoteles", "ghlhoteles.com", wellnessNeeds, true, 6, false, false, "hospitality_operator" as never).join(" | ");
t("hospitality → busca apertura de hotel/spa (evento)", /apertura de hotel|nuevo hotel|nuevo spa|renovación de spa|programa de bienestar/i.test(hotel));

// Software ICP must NOT get wellness event families (channel_access scope guard).
const sw = buildCompanyQueries("Nutresa", "nutresa.com", swNeeds, true, 6, false, false).join(" | ");
t("software/ops ICP → sin familias wellness", !/spa|gifting|wellness amenities|convocatoria de proveedores/i.test(sw));

console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
