#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";
import type { ICP, LeadSearchCriteria } from "@/types";
import type { NeedsMap } from "@/lib/discovery/needs-map";

const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;
const vertical = process.argv[2] === "warehouse" ? "warehouse" : process.argv[2] === "colombia" ? "colombia" : "industrial";
const warehouse = vertical === "warehouse";
const colombia = vertical === "colombia";
const industrial = !warehouse;
const industries = warehouse ? ["industrial distributors"] : colombia ? ["fabricantes de alimentos y bebidas"] : ["food and beverage manufacturers"];
const icp: ICP = { target_industries: industries, target_titles: [], company_size_range: "mid-market and enterprise", pain_points: [], disqualifiers: ["retailers", "consultants", "publishers", "government"], ideal_signals: industrial ? [colombia ? "nueva planta" : "new plant", colombia ? "expansión de capacidad" : "capacity expansion"] : ["new warehouse", "automation investment"], exclusions_explicit: [] };
const criteria = { target_industries: industries, target_company_size: ["mid-market", "enterprise"], target_job_titles: [], target_geography: [colombia ? "Colombia" : "United States"], excluded_industries: [], buying_signals: icp.ideal_signals, disqualification_criteria: icp.disqualifiers, offer_summary: industrial ? (colombia ? "automatización industrial y software de operaciones de planta" : "industrial automation and plant operations software") : "warehouse automation and WMS integration", value_proposition: industrial ? (colombia ? "coordinar plantas de producción propias" : "coordinate owned production plants") : "coordinate owned distribution facilities", output_language: colombia ? "es" : "en", target_market_region: colombia ? "latin_america" : "north_america", require_real_discovery: true } as unknown as LeadSearchCriteria;
const needs = { product_or_service: criteria.offer_summary, target_company_profile: industrial ? (colombia ? "fabricantes medianos y grandes de alimentos y bebidas con plantas propias en Colombia" : "mid-market and enterprise food and beverage manufacturers operating their own plants") : "mid-market and enterprise industrial distributors operating their own warehouses", buyer_problem: industrial ? "production complexity" : "inventory complexity", operational_trigger: industrial ? "new plant or production capacity" : "new warehouse or capacity", observable_signal: industrial ? "opened plant" : "opened distribution center", expected_need: industrial ? "plant operations coordination" : "warehouse orchestration", relevant_signal_families: industrial ? ["new_facility", "capacity", "operational_transformation"] : ["new_facility", "capacity", "technology_change"], disqualifiers: criteria.disqualification_criteria, supporting_evidence_required: [], counterevidence: [], possible_commercial_action: "validate direct operation" } as NeedsMap;
const { buildCompanyUniverse } = await import("@/lib/discovery/company-universe");
const started = Date.now();
const result = await buildCompanyUniverse(icp, criteria, needs, { maxCompanies: 25 });
const artifact = { version: "dynamic-enumeration-audit-v1", generated_at: new Date().toISOString(), vertical, duration_ms: Date.now() - started, companies: result.companies, stats: result.stats };
mkdirSync("ml/data/acceptance", { recursive: true });
const path = `ml/data/acceptance/dynamic-enumeration-${vertical}-${Date.now()}.json`;
writeFileSync(path, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ path, duration_ms: artifact.duration_ms, companies: result.companies.length, raw_names: result.stats.raw_names, rejected: result.stats.rejected, providers_available: result.stats.providers_available, providers_failed: result.stats.providers_failed, route_metrics: result.stats.route_metrics, raw_name_sample: result.stats.raw_name_sample }, null, 2));
