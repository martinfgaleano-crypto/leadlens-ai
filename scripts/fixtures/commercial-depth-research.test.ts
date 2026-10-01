import assert from "node:assert/strict";
import { assessCommercialDepth, isSameOrganizationDomain } from "../../lib/intelligence/commercial-depth-research";

const base = { account_ref: "entity:acme.com", account_name: "Acme", domain: "acme.com", route_id: "natural_specialty_grocery", decision: "validate" as const, customer_dependency_ids: ["landed_economics"], researched_at: "2026-09-30T00:00:00Z" };
const evidence = (content: string | null, official = true) => ({ source_id: official ? "official" : "independent", url: official ? "https://acme.com/suppliers" : "https://trade.example/acme", domain: official ? "acme.com" : "trade.example", official, independent: !official, content, extraction_ok: Boolean(content), failure: content ? null : "ACCESS_RESTRICTED" });

const verified = assessCommercialDepth({ ...base, evidence: [evidence("Prospective suppliers may submit a new item for category review by our category management team."), evidence("Acme works with external brands.", false)] });
assert.equal(verified.mechanism_status, "VERIFIED"); assert.equal(verified.access_status, "VERIFIED"); assert.deepEqual(verified.buyer_functions, ["category_management"]); assert.equal(verified.corroboration_status, "ACHIEVED");
const contact = assessCommercialDepth({ ...base, evidence: [evidence("Contact us for customer support, investor relations and careers.")] });
assert.equal(contact.mechanism_status, "RESEARCHED_NOT_FOUND"); assert.equal(contact.access_path, null);
const snippetOnly = assessCommercialDepth({ ...base, evidence: [{ ...evidence(null), extraction_ok: false, failure: "ACCESS_RESTRICTED" }] });
assert.equal(snippetOnly.mechanism_status, "FOUND_UNVERIFIED"); assert.equal(snippetOnly.buyer_function_status, "FOUND_UNVERIFIED");
assert.equal(isSameOrganizationDomain("https://about.sprouts.com/new-item-submission", "sprouts.com"), true);
assert.equal(isSameOrganizationDomain("https://sprouts.example.com/article", "sprouts.com"), false);
console.log("commercial-depth-research: 10/10 passed");
