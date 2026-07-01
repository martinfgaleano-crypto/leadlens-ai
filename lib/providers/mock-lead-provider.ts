import type { LeadProvider } from "./lead-provider";
import type { LeadCandidate, LeadSearchCriteria } from "@/types";

// ─── Account-level mock pool ──────────────────────────────────────────────────
// 32 company/account records across 12 sectors.
// No personal data: no names, titles, emails, or personal LinkedIn URLs.
// Each account includes a raw_context with simulated public buying signals.
// Used in DEMO_MODE and ALLOW_MOCK_LEADS_WITH_REAL_AI hybrid mode.

type MockAccount = Omit<LeadCandidate, "id">;

const MOCK_POOL: MockAccount[] = [

  // ─── Logistics / Supply Chain ───────────────────────────────────────────────

  {
    company: "Midwest Freight Solutions",
    domain: "midwestfreightsolutions.com",
    website_url: "https://midwestfreightsolutions.com",
    linkedin_url: "linkedin.com/company/midwest-freight-solutions",
    location: "Chicago, IL",
    industry: "Logistics",
    company_size: "51-200",
    source: "mock",
    source_url: "https://midwestfreightsolutions.com/careers",
    confidence_score: 0.88,
    raw_context: "Careers page lists 9 open roles including operations coordinators, dispatch supervisors, and a regional account executive across Illinois and Indiana. Company blog post from last month mentions plans to add two new distribution hubs in the Midwest by Q4 of this year.",
  },
  {
    company: "SunCoast Logistics Group",
    domain: "suncoastlogisticsgroup.com",
    website_url: "https://suncoastlogisticsgroup.com",
    linkedin_url: "linkedin.com/company/suncoast-logistics",
    location: "Tampa, FL",
    industry: "Logistics",
    company_size: "51-200",
    source: "mock",
    source_url: "https://suncoastlogisticsgroup.com/about",
    confidence_score: 0.85,
    raw_context: "Company website mentions fleet expansion — 40% more delivery vehicles added in the past 12 months. LinkedIn company page highlights new same-day coverage in 14 ZIP codes across the Tampa Bay region. Press release dated 3 months ago references plans to expand into the Orlando corridor.",
    signal_date: "2026-04-01", // "Press release dated 3 months ago" — pinned explicitly for demo
  },
  {
    company: "ColdRoute Distribution",
    domain: "coldroutedistribution.com",
    website_url: "https://coldroutedistribution.com",
    linkedin_url: "linkedin.com/company/coldroute-distribution",
    location: "Denver, CO",
    industry: "Supply Chain",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.82,
    raw_context: "Specializes in cold chain logistics for food and pharma clients. Company recently added pharmaceutical cold storage capacity to its Denver hub. Careers page lists an open supply chain solutions manager role. Website references new compliance certifications for multi-temperature transport.",
  },
  {
    company: "Apex 3PL Services",
    domain: "apex3pl.com",
    website_url: "https://apex3pl.com",
    linkedin_url: "linkedin.com/company/apex-3pl-services",
    location: "Dallas, TX",
    industry: "Logistics",
    company_size: "51-200",
    source: "mock",
    source_url: "https://apex3pl.com/news",
    confidence_score: 0.87,
    raw_context: "News section of company website announces expansion from 2 to 5 distribution centers, with new facilities opening in Dallas, Houston, and Phoenix. Company is actively hiring warehouse operations and logistics technology roles. LinkedIn company updates mention a new client win in the food retail sector.",
  },
  {
    company: "TransLink Freight Brokers",
    domain: "translinkfreight.com",
    website_url: "https://translinkfreight.com",
    location: "Atlanta, GA",
    industry: "Logistics",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.74,
    raw_context: "Regional freight broker serving Southeast US. Website recently added a digital load tracking feature and mentions technology-enabled freight matching as a competitive differentiator. Company appears to be transitioning from manual brokerage to a tech-assisted model.",
  },

  // ─── Regional Food Distributors ─────────────────────────────────────────────

  {
    company: "Heartland Specialty Foods",
    domain: "heartlandspecialtyfoods.com",
    website_url: "https://heartlandspecialtyfoods.com",
    linkedin_url: "linkedin.com/company/heartland-specialty-foods",
    location: "Kansas City, MO",
    industry: "Food Distribution",
    company_size: "51-200",
    source: "mock",
    source_url: "https://heartlandspecialtyfoods.com/wholesale",
    confidence_score: 0.86,
    raw_context: "Wholesale page on company website recently relaunched with a new application form for B2B buyers. LinkedIn company update from 6 weeks ago announces new supplier partnerships with 4 regional producers. Company is expanding B2B delivery zones to cover Missouri, Kansas, and Nebraska.",
  },
  {
    company: "Pacific Rim Distributors",
    domain: "pacificrimdistributors.com",
    website_url: "https://pacificrimdistributors.com",
    location: "Los Angeles, CA",
    industry: "Food Distribution",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.83,
    raw_context: "Specialty food importer and distributor focused on Asian and Latin American products for grocery chains and foodservice operators. Company website mentions expansion into the Pacific Northwest distribution territory. Careers listing for a business development associate posted 8 weeks ago.",
  },
  {
    company: "NorthStar Produce",
    domain: "northstarproduceco.com",
    website_url: "https://northstarproduceco.com",
    linkedin_url: "linkedin.com/company/northstar-produce",
    location: "Minneapolis, MN",
    industry: "Food Distribution",
    company_size: "51-200",
    source: "mock",
    source_url: "https://northstarproduceco.com/blog",
    confidence_score: 0.80,
    raw_context: "Regional produce distributor serving grocery chains and institutional buyers across the Upper Midwest. Blog post from last month announces launch of a wholesale ordering program for restaurant operators. Company is hiring procurement operations roles and references digital transformation of its ordering process.",
  },

  // ─── Healthcare / Clinics ───────────────────────────────────────────────────

  {
    company: "Cornerstone Physical Therapy Group",
    domain: "cornerstonept.com",
    website_url: "https://cornerstonept.com",
    linkedin_url: "linkedin.com/company/cornerstone-physical-therapy",
    location: "Phoenix, AZ",
    industry: "Healthcare",
    company_size: "51-200",
    source: "mock",
    source_url: "https://cornerstonept.com/locations",
    confidence_score: 0.81,
    raw_context: "Multi-location physical therapy group with 7 existing clinics and 3 new locations announced on the website. Careers page shows open roles for physical therapists, front desk coordinators, and a clinic operations manager. Company has added digital scheduling and telehealth intake in the past year.",
  },
  {
    company: "Summit Dental Partners",
    domain: "summitdentalpartners.com",
    website_url: "https://summitdentalpartners.com",
    linkedin_url: "linkedin.com/company/summit-dental-partners",
    location: "Nashville, TN",
    industry: "Healthcare",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.76,
    raw_context: "Dental group with 12 locations across Tennessee expanding into suburban markets. Website mentions 2 new locations opening in Franklin and Murfreesboro. Careers page includes roles for dental office managers and patient experience coordinators. Company recently launched online booking across all locations.",
  },
  {
    company: "Clarity Mental Health Network",
    domain: "claritymentalhealth.com",
    website_url: "https://claritymentalhealth.com",
    location: "Seattle, WA",
    industry: "Healthcare",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.70,
    raw_context: "Growing mental health clinic network adding digital intake and teletherapy services. Company website references expansion to 3 new clinic locations in the Puget Sound area. Hiring patient operations coordinators and billing specialists. Insurance panels recently expanded to include 6 additional providers.",
  },

  // ─── B2B SaaS ───────────────────────────────────────────────────────────────

  {
    company: "Workstream HR",
    domain: "workstreamhr.com",
    website_url: "https://workstreamhr.com",
    linkedin_url: "linkedin.com/company/workstream-hr",
    location: "Austin, TX",
    industry: "B2B SaaS",
    company_size: "51-200",
    source: "mock",
    source_url: "https://workstreamhr.com/careers",
    confidence_score: 0.90,
    raw_context: "HR tech SaaS company actively hiring SDRs and a revenue operations manager. Careers page lists 7 open GTM roles. Pricing page recently updated with a new SMB tier. LinkedIn company updates from last month reference an upcoming product expansion into performance management for the SMB market.",
  },
  {
    company: "Buildflow Construction Tech",
    domain: "buildflowtech.com",
    website_url: "https://buildflowtech.com",
    linkedin_url: "linkedin.com/company/buildflow-construction-tech",
    location: "Denver, CO",
    industry: "B2B SaaS",
    company_size: "51-200",
    source: "mock",
    source_url: "https://buildflowtech.com/news",
    confidence_score: 0.84,
    raw_context: "Construction project management SaaS company that recently announced a Series A and is expanding into enterprise accounts. News section references a new partner program with construction supply chains. Company is hiring enterprise account executives and a channel partner manager.",
    signal_date: "2026-05-15", // Series A announced ~6 weeks ago — pinned explicitly for demo
  },
  {
    company: "Nexflow RevOps",
    domain: "nexflowrevops.com",
    website_url: "https://nexflowrevops.com",
    location: "San Francisco, CA",
    industry: "B2B SaaS",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.78,
    raw_context: "Revenue operations SaaS platform recently launched a new pricing tier for small sales teams. Company blog posts reference outbound prospecting and account prioritization as core use cases. LinkedIn company page highlights a new customer success hire and mentions expanding into mid-market accounts.",
  },
  {
    company: "FleetEdge Software",
    domain: "fleetedgesoftware.com",
    website_url: "https://fleetedgesoftware.com",
    linkedin_url: "linkedin.com/company/fleetedge-software",
    location: "Columbus, OH",
    industry: "Logistics",
    company_size: "51-200",
    source: "mock",
    source_url: "https://fleetedgesoftware.com/about",
    confidence_score: 0.89,
    raw_context: "Fleet management software company specifically serving regional trucking operators and last-mile delivery companies. Company recently expanded integrations with major TMS platforms. Careers page lists a solutions engineer for logistics accounts. Blog post mentions growing demand from food distribution clients.",
  },

  // ─── Fintech ────────────────────────────────────────────────────────────────

  {
    company: "Meridian SMB Lending",
    domain: "meridiansmblending.com",
    website_url: "https://meridiansmblending.com",
    linkedin_url: "linkedin.com/company/meridian-smb-lending",
    location: "Charlotte, NC",
    industry: "FinTech",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.82,
    raw_context: "SMB lending platform expanding from 3 to 7 states with new regulatory licenses announced on company website. LinkedIn company update references new partnerships with 2 regional banks. Company is hiring compliance operations and SMB outreach roles. New product launch for invoice factoring added to website last month.",
  },
  {
    company: "TradePass Payments",
    domain: "tradepasspayments.com",
    website_url: "https://tradepasspayments.com",
    location: "Miami, FL",
    industry: "FinTech",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.75,
    raw_context: "Cross-border payments company serving import/export businesses with US-Latin America trade flows. Website recently added compliance documentation for Mexico and Colombia payment corridors. Careers page lists a business development manager for distributor partnerships.",
  },
  {
    company: "Kapital Trade Finance",
    domain: "kapitaltradefinance.com",
    website_url: "https://kapitaltradefinance.com",
    linkedin_url: "linkedin.com/company/kapital-trade-finance",
    location: "New York, NY",
    industry: "FinTech",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.79,
    raw_context: "Trade finance platform serving importers and exporters. Company recently launched a digital application portal for supply chain financing. LinkedIn updates reference new integrations with freight forwarders and customs brokers. Expanding into food and agricultural commodity financing as a new vertical.",
  },

  // ─── Industrial Suppliers ───────────────────────────────────────────────────

  {
    company: "Vanguard Industrial Supply",
    domain: "vanguardindustrialsupply.com",
    website_url: "https://vanguardindustrialsupply.com",
    linkedin_url: "linkedin.com/company/vanguard-industrial-supply",
    location: "Detroit, MI",
    industry: "Industrial Supply",
    company_size: "51-200",
    source: "mock",
    source_url: "https://vanguardindustrialsupply.com/distributors",
    confidence_score: 0.77,
    raw_context: "MRO and industrial equipment distributor that recently launched a B2B e-commerce ordering portal. Distributor page on website updated with new application for regional partnerships. Company is attending 3 upcoming trade shows and has listed sales engineer roles on careers page.",
  },
  {
    company: "SafeGuard Workplace Solutions",
    domain: "safeguardworkplace.com",
    website_url: "https://safeguardworkplace.com",
    location: "Houston, TX",
    industry: "Industrial Supply",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.71,
    raw_context: "Safety equipment manufacturer expanding its distributor network in the Gulf Coast region. Company website mentions new OSHA-compliant product line launched this year. Careers page lists regional sales representative roles in Texas and Louisiana.",
  },

  // ─── Hospitality / Hotels ───────────────────────────────────────────────────

  {
    company: "Pinnacle Hotel Group",
    domain: "pinnaclehotelgroup.com",
    website_url: "https://pinnaclehotelgroup.com",
    linkedin_url: "linkedin.com/company/pinnacle-hotel-group",
    location: "Phoenix, AZ",
    industry: "Hospitality",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.68,
    raw_context: "Regional hotel group with 8 properties adding a corporate accounts program for business travel clients. Website recently added a 'Corporate Partnerships' page with an inquiry form. Hiring a corporate sales manager and group events coordinator. LinkedIn update mentions expanded group booking capacity.",
  },
  {
    company: "Crestview Boutique Hotels",
    domain: "crestviewboutique.com",
    website_url: "https://crestviewboutique.com",
    location: "Nashville, TN",
    industry: "Hospitality",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.60,
    raw_context: "Independent boutique hotel operator with 4 properties exploring B2B partnerships with corporate travel managers and event planners. Website added a new partnerships section. Smaller operator with limited outbound sales infrastructure.",
  },

  // ─── Education / Training ───────────────────────────────────────────────────

  {
    company: "Catalyst Corporate Training",
    domain: "catalystcorptraining.com",
    website_url: "https://catalystcorptraining.com",
    linkedin_url: "linkedin.com/company/catalyst-corporate-training",
    location: "Chicago, IL",
    industry: "Education",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.73,
    raw_context: "Corporate training and professional development provider expanding B2B sales to mid-market companies. Website recently added an enterprise training inquiry form. LinkedIn company page highlights new compliance training modules for food safety and supply chain operations. Hiring an account executive for B2B outreach.",
  },
  {
    company: "LearnPath Enterprise",
    domain: "learnpathenterprise.com",
    website_url: "https://learnpathenterprise.com",
    location: "Austin, TX",
    industry: "Education",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.69,
    raw_context: "Online learning platform recently launched an enterprise tier targeting companies with 50–500 employees. Pricing page updated 4 weeks ago with team licensing options. Company is hiring a customer success manager for enterprise accounts.",
  },

  // ─── Agencies / Consulting ──────────────────────────────────────────────────

  {
    company: "Brightpath Strategy Group",
    domain: "brightpathstrategy.com",
    website_url: "https://brightpathstrategy.com",
    linkedin_url: "linkedin.com/company/brightpath-strategy-group",
    location: "Boston, MA",
    industry: "Consulting",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.76,
    raw_context: "B2B management consulting firm with 12 consultants that recently moved from 100% referral-based business to adding structured outbound for new client acquisition. Company website added a 'Work With Us' inquiry page. LinkedIn company posts from last 6 weeks show increased content about supply chain and operations strategy.",
  },
  {
    company: "Arco Growth Agency",
    domain: "arcogrowthagency.com",
    website_url: "https://arcogrowthagency.com",
    location: "New York, NY",
    industry: "Marketing / Agency",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.65,
    raw_context: "B2B digital marketing agency that serves logistics and supply chain companies. Agency website features case studies for 3PL and freight clients. Company recently published a guide on B2B lead generation for logistics operators, suggesting active content marketing for client acquisition.",
  },

  // ─── Ecommerce / Retail Operators ───────────────────────────────────────────

  {
    company: "Bluestone Specialty Retail",
    domain: "bluestonespecialty.com",
    website_url: "https://bluestonespecialty.com",
    linkedin_url: "linkedin.com/company/bluestone-specialty-retail",
    location: "Portland, OR",
    industry: "Retail",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.67,
    raw_context: "Multi-location specialty retail operator expanding into wholesale B2B distribution. Company website added a wholesale inquiry page last month. LinkedIn update mentions new partnerships with regional food and beverage brands. Operates 12 retail locations and is exploring national wholesale distribution.",
  },
  {
    company: "Cascade Direct Commerce",
    domain: "cascadedirectcommerce.com",
    website_url: "https://cascadedirectcommerce.com",
    location: "Seattle, WA",
    industry: "E-commerce",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.62,
    raw_context: "D2C brand that recently launched a B2B distribution channel for independent retailers and foodservice operators. Website added a wholesale ordering portal 6 weeks ago. Looking to onboard 50 new wholesale accounts in Q3.",
  },

  // ─── Exporters / Importers ──────────────────────────────────────────────────

  {
    company: "Andean Food Exports",
    domain: "andeanfoodexports.com",
    website_url: "https://andeanfoodexports.com",
    linkedin_url: "linkedin.com/company/andean-food-exports",
    location: "Miami, FL",
    industry: "Food Distribution",
    company_size: "11-50",
    source: "mock",
    source_url: "https://andeanfoodexports.com/distributors",
    confidence_score: 0.84,
    raw_context: "Colombian and Peruvian food exporter actively seeking US distributor partners. Company distributor page recently updated with application form. Attended the Fancy Food Show in New York last quarter. Export certifications for USDA and FDA listed on website. Actively expanding B2B presence in the US specialty food market.",
  },
  {
    company: "Pacific Gateway Imports",
    domain: "pacificgatewayimports.com",
    website_url: "https://pacificgatewayimports.com",
    linkedin_url: "linkedin.com/company/pacific-gateway-imports",
    location: "Los Angeles, CA",
    industry: "Food Distribution",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.81,
    raw_context: "Import/export broker specializing in agricultural and food commodities from Asia and Latin America. Website mentions expansion of distributor search to 5 new US states. Company recently joined the US Food Export Association and posted about expanding their US wholesale buyer network. Careers listing for an import operations coordinator posted recently.",
  },
  {
    company: "GlobalTrade Connect",
    domain: "globaltradeconnect.us",
    website_url: "https://globaltradeconnect.us",
    location: "Chicago, IL",
    industry: "Supply Chain",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.72,
    raw_context: "Trade intermediary connecting Latin American suppliers with US wholesale buyers. Company website recently added export certification documentation and a buyer inquiry page. LinkedIn company posts highlight new supplier relationships in Colombia, Mexico, and Chile.",
  },

  // ─── Construction / Real Estate B2B ─────────────────────────────────────────

  {
    company: "Meridian Building Supply Co.",
    domain: "meridianbuilding.com",
    website_url: "https://meridianbuilding.com",
    linkedin_url: "linkedin.com/company/meridian-building-supply",
    location: "Dallas, TX",
    industry: "Construction",
    company_size: "51-200",
    source: "mock",
    confidence_score: 0.73,
    raw_context: "Commercial construction materials supplier expanding product catalog with new sustainable building materials line. Company is attending 2 regional construction trade shows in Q3. Careers page lists a commercial accounts manager role and a sales engineer position.",
  },
  {
    company: "Clearview Property Tech",
    domain: "clearviewpropertytech.com",
    website_url: "https://clearviewpropertytech.com",
    location: "Atlanta, GA",
    industry: "B2B SaaS",
    company_size: "11-50",
    source: "mock",
    confidence_score: 0.66,
    raw_context: "Property management SaaS for commercial real estate operators. Company recently added a new tenant communication module and is hiring a business development manager. LinkedIn company update from 3 weeks ago references expanding from residential to commercial property management clients.",
  },
];

// ─── ICP match scoring ────────────────────────────────────────────────────────
// Scores each account against the ICP/criteria to surface the most relevant
// accounts first, rather than returning a random cross-section every time.

function scoreIcpMatch(account: MockAccount, criteria: LeadSearchCriteria): number {
  const text = [
    account.industry ?? "",
    account.raw_context ?? "",
    account.location ?? "",
    account.company ?? "",
  ].join(" ").toLowerCase();

  let score = 0;

  // Industry keyword match — most important signal
  for (const ind of criteria.target_industries) {
    const keywords = ind.toLowerCase().split(/[\s/,\-&]+/).filter(k => k.length > 3);
    for (const kw of keywords) {
      if (text.includes(kw)) score += 4;
    }
  }

  // Offer/value-prop keyword match — pulls in accounts by problem context
  const offerText = [
    criteria.offer_summary,
    criteria.value_proposition,
    ...(criteria.buying_signals ?? []),
  ].join(" ").toLowerCase();
  const offerKeywords = offerText.match(/\b[a-z]{4,}\b/g) ?? [];
  const uniqueOfferKws = offerKeywords.filter((kw, i, arr) => arr.indexOf(kw) === i);
  for (const kw of uniqueOfferKws) {
    if (text.includes(kw)) score += 1;
  }

  // Geography match — boost US accounts for north_america ICP
  const geoText = (criteria.target_geography ?? []).join(" ").toLowerCase();
  if (geoText.includes("united states") || geoText.includes("north america")) {
    // All mock accounts are US-based — give a baseline geography boost
    score += 2;
  } else {
    for (const geo of criteria.target_geography ?? []) {
      if (text.includes(geo.toLowerCase())) score += 3;
    }
  }

  // Company size match
  if (account.company_size && criteria.target_company_size.includes(account.company_size)) {
    score += 2;
  }

  // Confidence as a tiebreaker (higher confidence = slightly preferred)
  score += account.confidence_score * 0.5;

  return score;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const mockLeadProvider: LeadProvider = {
  name: "mock",

  async searchLeads(criteria: LeadSearchCriteria, limit: number): Promise<LeadCandidate[]> {
    // Score accounts against ICP, then apply seeded shuffle within score bands
    // so results are deterministic for the same offer but prioritize relevant accounts
    const scored = MOCK_POOL.map(account => ({
      account,
      score: scoreIcpMatch(account, criteria),
    }));

    // Sort by ICP match score (desc), with seeded shuffle as tiebreaker within same score band
    const seed = (criteria.offer_summary?.length ?? 0) + criteria.target_industries.join("").length;
    let s = seed;
    const nextRand = () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };

    scored.sort((a, b) => {
      const diff = b.score - a.score;
      if (Math.abs(diff) > 1) return diff;
      // Same band — shuffle
      return nextRand() - 0.5;
    });

    // Filter out very low confidence (likely DISCARD regardless of ICP)
    // but keep a few so the demo has realistic score distribution
    const pool = scored.map(s => s.account);

    // Ensure realistic HOT/WARM/COLD/DISCARD mix:
    // Take the best ICP-matched accounts first, then pad with lower-confidence ones
    const highRelevance = pool.filter(a => a.confidence_score >= 0.75);
    const lowRelevance  = pool.filter(a => a.confidence_score < 0.75);

    const combined = [
      ...highRelevance,
      ...lowRelevance,
    ].slice(0, limit);

    return combined.map((account, i): LeadCandidate => ({
      ...account,
      id: `mock-${i + 1}-${account.company.toLowerCase().replace(/[\s/.'&,]+/g, "-").slice(0, 30)}`,
    }));
  },

  async findEmail(): Promise<{ email?: string; email_status: import("@/types").EmailStatus; confidence_score: number; source?: string }> {
    // Account-level mock: no personal emails to find
    return {
      email: undefined,
      email_status: "not_found",
      confidence_score: 0,
      source: "mock",
    };
  },
};

