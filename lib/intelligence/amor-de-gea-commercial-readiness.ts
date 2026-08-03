export const AMOR_ACCEPTED_CONTEXT={id:"context_28bbc2b447323da3e387c964",version:1,accepted_at:"2026-08-03T05:35:33.492Z",source_candidate_id:"intake_fb4bc38a8e0af0343c9f8f1e",authorization:"Founder-authorized for this candidate only",accepted_fields:17,customer_safe_promoted:false,ranking_impact:"off",provider_calls:0,theses_recalculated:0} as const;

export const AMOR_COMMERCIAL_READINESS={
 context_version_id:AMOR_ACCEPTED_CONTEXT.id,
 offer_ready_now:["Three botanical concentrates: Agua, Tierra and Éter","50 ml presentation","Individual premium packaging","Label and packaging adaptation possibilities","Gifting, special assortments and co-branding possibilities"],
 initial_order_readiness:["Pilot around 50 units","Early recurrence around 100–300 units monthly","Larger accounts conditioned by ordinary and per-SKU capacity validation"],
 geographic_readiness:["Colombia nationally (client-stated)","Freight economics, delivery SLA and glass handling pending before formal proposal"],
 routes:{enabled:["Independent specialty retail","Wellness retail","Boutique hospitality","Spas","Gifting","Co-branding","Curated wellness partnerships"],conditioned:["Regional distributors","Larger multi-location accounts","Procurement-heavy retailers","Distant low-order accounts"],blocked:["Private label","High-volume national distribution","Accounts requiring verified health or regulatory claims","Accounts requiring immediate volume near or above 1,000 units"]},
 validations:{before_formal_proposal:["Account-specific economics","Delivery and freight","Replenishment capacity","Relevant documentation","Relationship and conflict check"],later_negotiation:["Exact discount","Final margin","Payment terms","Exclusivity","Contracts","Distributor economics"]},
 customer_safe_limitations:["No unsupported health claims","No unverified regulatory claims","No unresolved dosage statements","No representation of client marketing as independent evidence"],
 account_profile:{favor:["Manageable pilot sizes","Founder-led or accessible buying processes","Brand alignment","Premium wellness positioning","Repeat-purchase potential","Clear experiential, gifting or retail use case","Reasonable initial procurement complexity"],deprioritize:["Long procurement cycles","Complex national chains","High-volume immediate requirements","Opportunities dependent on private label","Low-value distant orders with weak freight economics"]},
 internal_only:true,final_report_generation:"disabled",next_phase:"Search Blueprint and six-account recalibration — blocked pending founder review",
} as const;
