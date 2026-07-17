// Unit tests for classifyEntity (entity-resolution-v3) — pure, no DB.
// Run: npm run test:entity-v3

import { classifyEntity } from "@/lib/vault/entity-resolution";

let passed = 0, failed = 0;
const t = (name: string, input: Parameters<typeof classifyEntity>[0], expect: { cls: string; primary?: string | null; secondaries?: number }) => {
  const v = classifyEntity(input);
  const ok = v.entity_class === expect.cls
    && (expect.primary === undefined || v.primary_account === expect.primary)
    && (expect.secondaries === undefined || v.secondary_participants.length === expect.secondaries);
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : `  got class=${v.entity_class} primary=${v.primary_account} sec=${JSON.stringify(v.secondary_participants)}`}`);
  ok ? passed++ : failed++;
};

t("FedEx and ServiceNow → multiple_companies, sin cuenta única", { name: "FedEx and ServiceNow", signalType: "partnership" }, { cls: "multiple_companies", primary: null, secondaries: 2 });
t("Geek+ & Mindugar → multiple_companies", { name: "Geek+ & Mindugar", signalType: "partnership" }, { cls: "multiple_companies", primary: null, secondaries: 2 });
t("Target Houston Receive Center → facility con company Target", { name: "Target Houston Receive Center" }, { cls: "facility", primary: "Target Houston" });
t("Cardinal Health Distribution Center → facility", { name: "Cardinal Health Distribution Center" }, { cls: "facility", primary: "Cardinal Health" });
t("Cxtms como publisher (freightwaves-like host)", { name: "Cxtms", sourceUrl: "https://www.cxtms.news/gxo-kion-deploy", sourceType: "news" }, { cls: "publisher", primary: null });
t("B2B Companies → category", { name: "B2B Companies" }, { cls: "category", primary: null });
t("Companies Hiring → category", { name: "Companies Hiring" }, { cls: "category", primary: null });
t("Logistics Trends → category", { name: "Logistics Trends" }, { cls: "category", primary: null });
t("Sales Staffing Agency → category", { name: "Sales Staffing Agency" }, { cls: "category", primary: null });
t("headline completo → generic_phrase", { name: "NAWAH opens first US VACNT manufacturing facility in Ohio" }, { cls: "facility", primary: null });
t("NAWAH → single_company", { name: "NAWAH" }, { cls: "single_company", primary: "NAWAH" });
t("OPmobility → single_company", { name: "OPmobility" }, { cls: "single_company", primary: "OPmobility" });
t("Inter Rapidísimo → single_company", { name: "Inter Rapidísimo" }, { cls: "single_company", primary: "Inter Rapidísimo" });
t("Freight Visibility Platform → product", { name: "Freight Visibility Platform" }, { cls: "product", primary: null });

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
