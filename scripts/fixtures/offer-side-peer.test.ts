// SELF-SERVE ADVANCEMENT V2 (§5/§6) — offer-side peer exclusion controlled suite.
// A service/consulting/agency firm is excluded ONLY when the buyer profile does not target
// service firms and the objective is not partnerships. Never over-excludes real targets.

import assert from "node:assert/strict";
import { isOfferSidePeer, candidateLooksLikeServiceFirm, buyerTargetsServiceFirms } from "@/lib/discovery/offer-side-peer";

let passed = 0;
const t = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`ok - ${passed} ${name}`); };

const manufacturersBuyer = { organizationTypes: ["Large US manufacturers", "Industrial goods producers"], industries: ["Manufacturing", "Distribution"], objectiveType: "customer_acquisition", targetRelationship: "buyer" };
const saasBuyer = { organizationTypes: ["B2B SaaS companies"], industries: ["Software", "SaaS"], objectiveType: "customer_acquisition", targetRelationship: "buyer" };
const ecommerceBuyer = { organizationTypes: ["Ecommerce brands", "Online retailers"], industries: ["Retail", "Ecommerce"], objectiveType: "customer_acquisition", targetRelationship: "buyer" };
const consultancyBuyer = { organizationTypes: ["Boutique consulting firms"], industries: ["Management consulting"], objectiveType: "customer_acquisition", targetRelationship: "buyer" };
const partnershipObjective = { organizationTypes: ["Implementation partners"], industries: [], objectiveType: "partnerships", targetRelationship: "partner" };
const emptyBuyer = { organizationTypes: [], industries: [], objectiveType: "customer_acquisition", targetRelationship: "buyer" };

// A — consultancy candidate under a MANUFACTURERS buyer → excluded.
t("A consultancy candidate excluded when buyer targets manufacturers", isOfferSidePeer({ name: "Clarkston Consulting", organizationType: "Consulting firm", industry: "Management consulting" }, manufacturersBuyer));
t("A a real manufacturer is NEVER excluded", !isOfferSidePeer({ name: "Nestle USA", organizationType: "Manufacturer", industry: "Food manufacturing" }, manufacturersBuyer));
t("A Maine Pointe (ops consultancy) excluded under manufacturer buyer", isOfferSidePeer({ name: "Maine Pointe", organizationType: "Supply chain consultancy", industry: "Consulting" }, manufacturersBuyer));

// C — agency candidate under a B2B SaaS buyer → excluded; a SaaS company kept.
t("C digital agency excluded when buyer targets B2B SaaS", isOfferSidePeer({ name: "Acme Digital Agency", organizationType: "Marketing agency", industry: "Advertising" }, saasBuyer));
t("C a SaaS target is kept", !isOfferSidePeer({ name: "Datadog", organizationType: "Software company", industry: "SaaS" }, saasBuyer));

// D — agency under ecommerce buyer → excluded; ecommerce brand kept.
t("D agency excluded when buyer targets ecommerce", isOfferSidePeer({ name: "Shopify Experts Agency", organizationType: "Agency", industry: "Ecommerce services" }, ecommerceBuyer));
t("D ecommerce brand kept", !isOfferSidePeer({ name: "Warby Parker", organizationType: "Retailer", industry: "Ecommerce" }, ecommerceBuyer));

// F — partnership objective: legitimate same-category partners NOT excluded.
t("F consultancy NOT excluded when objective is partnerships", !isOfferSidePeer({ name: "Deloitte", organizationType: "Consulting firm", industry: "Consulting" }, partnershipObjective));

// Buyer explicitly wants consultancies → NOT excluded.
t("buyer targeting consultancies keeps consultancy candidates", !isOfferSidePeer({ name: "Bain & Company", organizationType: "Consulting firm", industry: "Management consulting" }, consultancyBuyer));

// K/G — empty/unresolved buyer profile → never silently excludes (should clarify instead).
t("empty buyer profile never triggers exclusion (clarify, don't silently drop)", !isOfferSidePeer({ name: "Some Consulting LLP", organizationType: "Consulting", industry: null }, emptyBuyer));

// Primitive helpers.
t("candidateLooksLikeServiceFirm detects consulting/agency by name", candidateLooksLikeServiceFirm({ name: "XYZ Advisory" }) && candidateLooksLikeServiceFirm({ name: "Foo Consulting" }) && !candidateLooksLikeServiceFirm({ name: "Tyson Foods" }));
t("buyerTargetsServiceFirms true for partnerships + services buyers, false for manufacturers", buyerTargetsServiceFirms(partnershipObjective) && buyerTargetsServiceFirms(consultancyBuyer) && !buyerTargetsServiceFirms(manufacturersBuyer));

// L — a large famous off-category company is not special-cased here (peer guard only
// handles service firms); a manufacturer-name mega-company stays (activity gates elsewhere).
t("L peer guard does not touch a non-service mega-company", !isOfferSidePeer({ name: "Nvidia", organizationType: "Semiconductor company", industry: "Semiconductors" }, manufacturersBuyer));

console.log(`\n${passed} passed, 0 failed`);
