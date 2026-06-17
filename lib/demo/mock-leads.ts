// @ts-nocheck — legacy demo file using old type system; not imported by pipeline
import type {
  LeadCandidate,
  EnrichedLead,
  QualifiedLead,
  ProcessedLead,
  OutreachSequence,
  OnboardingData,
  ICP,
  QCStatus,
} from "@/types";

// ─── Lead pool ────────────────────────────────────────────────────────────────
// 100 realistic B2B candidates covering diverse industries, stages & fit levels

const LEAD_POOL: Array<{
  name: string;
  title: string;
  company: string;
  company_size: string;
  industry: string;
  email: string;
  linkedin: string;
  confidence: number;
  category_hint: "HOT" | "WARM" | "COLD" | "DISCARD";
  hook: string;
  pain: string;
  trigger_template: string;
}> = [
  // HOT leads
  { name: "Sarah Chen", title: "VP of Sales", company: "Stackify SaaS", company_size: "45 employees", industry: "B2B SaaS", email: "s.chen@stackify.io", linkedin: "linkedin.com/in/sarahchen-stackify", confidence: 0.93, category_hint: "HOT", hook: "Stackify recently raised $8M Series A and is doubling their sales org", pain: "Manual outreach isn't scaling with their new headcount goals", trigger_template: "I saw Stackify just closed its Series A — congrats. That's usually the moment when the gap between the pipeline you need and what manual outreach can produce becomes really visible." },
  { name: "Marcus Torres", title: "CEO & Co-founder", company: "Revvenue AI", company_size: "22 employees", industry: "B2B SaaS", email: "marcus@revvenue.ai", linkedin: "linkedin.com/in/marcustorres", confidence: 0.91, category_hint: "HOT", hook: "Revvenue AI just launched and is actively selling to mid-market", pain: "Founder-led sales hitting a wall without a structured outreach system", trigger_template: "I noticed Revvenue AI just launched — building pipeline as a founder-led company is one of the hardest scaling challenges, especially without an SDR team." },
  { name: "Priya Nambiar", title: "Head of Growth", company: "Clover Analytics", company_size: "38 employees", industry: "Data & Analytics SaaS", email: "p.nambiar@cloveranalytics.com", linkedin: "linkedin.com/in/priyanambiar", confidence: 0.89, category_hint: "HOT", hook: "Clover Analytics is expanding into enterprise after 18 months in SMB", pain: "Outreach strategy doesn't translate from SMB to enterprise — needs reboot", trigger_template: "I saw Clover Analytics is moving upmarket into enterprise accounts — that shift almost always requires rebuilding how you do outbound from scratch." },
  { name: "James O'Brien", title: "Director of Business Development", company: "Portsmith Consulting", company_size: "30 employees", industry: "B2B Consulting", email: "james.obrien@portsmith.co", linkedin: "linkedin.com/in/jamesobrien-portsmith", confidence: 0.88, category_hint: "HOT", hook: "Portsmith grew via referrals but is now actively building an outbound channel", pain: "No systematic outreach process — entirely dependent on inbound and referrals", trigger_template: "I noticed Portsmith has been growing mostly through referrals — building the first real outbound channel is one of the trickiest transitions for a consulting firm." },
  { name: "Elena Vasquez", title: "Co-founder & CRO", company: "Funnelwise", company_size: "18 employees", industry: "Marketing SaaS", email: "elena@funnelwise.io", linkedin: "linkedin.com/in/elenavasquez", confidence: 0.92, category_hint: "HOT", hook: "Funnelwise recently hired their first SDR who needs leads immediately", pain: "Just hired first SDR but has no prospect list or outreach system ready", trigger_template: "I saw Funnelwise just posted a role for a first SDR — the biggest challenge at that stage is getting them ramped with enough pipeline before they get frustrated and leave." },
  { name: "David Kim", title: "VP Marketing", company: "Launchpad B2B", company_size: "55 employees", industry: "B2B SaaS", email: "d.kim@launchpadb2b.com", linkedin: "linkedin.com/in/davidkim-launchpad", confidence: 0.87, category_hint: "HOT", hook: "Launchpad B2B's marketing team owns pipeline targets but lacks outreach tooling", pain: "Marketing is responsible for pipeline generation but has no scalable outreach system", trigger_template: "I noticed Launchpad B2B's marketing team is being asked to own pipeline numbers — most marketing teams hit a wall when they try to run outbound without a structured system." },
  { name: "Aisha Patel", title: "Founder & CEO", company: "Meridian Advisory", company_size: "12 employees", industry: "Strategic Consulting", email: "aisha@meridianadvisory.com", linkedin: "linkedin.com/in/aishapatel", confidence: 0.90, category_hint: "HOT", hook: "Meridian is a solo-founder consultancy looking to land 3 new retainer clients", pain: "Spending too much time on proposals for wrong-fit clients found through referrals", trigger_template: "I saw Meridian Advisory is growing the team — getting consistently qualified leads rather than whoever comes through referrals is usually the unlock at that stage." },
  { name: "Tom Haggerty", title: "Director of Sales", company: "Bridgepoint Software", company_size: "67 employees", industry: "B2B SaaS", email: "t.haggerty@bridgepoint.io", linkedin: "linkedin.com/in/tomhaggerty", confidence: 0.86, category_hint: "HOT", hook: "Bridgepoint just launched a new product line targeting a different buyer persona", pain: "New product needs a new prospect list and new outreach messaging from scratch", trigger_template: "I noticed Bridgepoint just launched a new product line targeting a different buyer — most companies underestimate how much the outreach strategy needs to change when the persona changes." },

  // More HOT
  { name: "Rachel Simmons", title: "CEO", company: "GrowOps", company_size: "14 employees", industry: "Revenue Operations SaaS", email: "rachel@growops.io", linkedin: "linkedin.com/in/rachelsimmons-growops", confidence: 0.88, category_hint: "HOT", hook: "GrowOps is selling RevOps to mid-market but lacks a pipeline engine", pain: "Sells pipeline tools but doesn't have a pipeline for themselves", trigger_template: "There's an irony I noticed — GrowOps helps companies build pipeline, but most RevOps tools companies struggle most with their own outbound. You're probably too close to it." },
  { name: "Carlos Mendoza", title: "Head of Sales Development", company: "Vantage CRM", company_size: "80 employees", industry: "CRM SaaS", email: "c.mendoza@vantagecrm.com", linkedin: "linkedin.com/in/carlosmendoza-vantage", confidence: 0.85, category_hint: "HOT", hook: "Vantage CRM just merged with another company and needs to rebuild its SDR process", pain: "Post-merger sales stack is fragmented — SDR team has no clear playbook", trigger_template: "I saw Vantage CRM completed its merger — post-merger is one of the messiest times for SDR teams because the playbooks, lists, and tools rarely survive the transition intact." },

  // WARM leads
  { name: "Natalie Brooks", title: "Marketing Manager", company: "Cloudform Solutions", company_size: "90 employees", industry: "Cloud Infrastructure", email: "n.brooks@cloudform.io", linkedin: "linkedin.com/in/nataliebrooks", confidence: 0.72, category_hint: "WARM", hook: "Cloudform runs some outbound but results are inconsistent", pain: "Outreach lacks personalization — low reply rates despite decent list quality", trigger_template: "I noticed Cloudform runs outbound campaigns but the personalization usually shows at the volume — hard to maintain quality when you're sending at scale without the right system." },
  { name: "Raj Gupta", title: "Business Development Director", company: "Nexlink Partners", company_size: "35 employees", industry: "IT Consulting", email: "raj.gupta@nexlink.co", linkedin: "linkedin.com/in/rajgupta-nexlink", confidence: 0.74, category_hint: "WARM", hook: "Nexlink has an outbound motion but relies on manual research", pain: "Spending 60% of BDR time on research instead of prospecting", trigger_template: "I saw Nexlink has a BD team but most of their time seems to go into research rather than actual outreach — that ratio usually flips when you have the right research automation." },
  { name: "Chloe Martin", title: "VP of Revenue", company: "Dataplex Inc", company_size: "110 employees", industry: "Data Services", email: "c.martin@dataplex.com", linkedin: "linkedin.com/in/chloemartin-dataplex", confidence: 0.70, category_hint: "WARM", hook: "Dataplex is transitioning from field sales to inside sales + outbound", pain: "Inside sales team new to outbound — needs a playbook and leads", trigger_template: "I noticed Dataplex is shifting toward inside sales — it's a big transition and the outbound motion is usually the last thing to get figured out, long after the team is already hired." },
  { name: "Liam O'Connor", title: "Founder", company: "Clearpath GTM", company_size: "8 employees", industry: "GTM Consulting", email: "liam@clearpathgtm.com", linkedin: "linkedin.com/in/liamoconnor-gtm", confidence: 0.76, category_hint: "WARM", hook: "Clearpath GTM is a new consultancy without a systematic new client acquisition process", pain: "Relies entirely on founder network — not scalable beyond year 2", trigger_template: "I saw Clearpath GTM is building its client base through the founding team's network — that works brilliantly up to a point, but most firms hit a wall when the network runs thin." },
  { name: "Sofia Reyes", title: "Sales Director", company: "OptiFlow B2B", company_size: "48 employees", industry: "Process Automation SaaS", email: "s.reyes@optiflow.io", linkedin: "linkedin.com/in/sofiareyes-optiflow", confidence: 0.73, category_hint: "WARM", hook: "OptiFlow has territory reps but no centralized prospecting function", pain: "Each rep builds their own list — inconsistent quality and duplicated effort", trigger_template: "I noticed OptiFlow's reps each build their own prospect lists — that usually means inconsistent quality and hours of duplicated effort that could be centralized." },
  { name: "Henry Zhang", title: "CEO", company: "Promptly Analytics", company_size: "20 employees", industry: "AI Analytics", email: "henry@promptly.ai", linkedin: "linkedin.com/in/henryzhang-promptly", confidence: 0.77, category_hint: "WARM", hook: "Promptly is doing founder sales but wants to hand off to a system before next fundraise", pain: "CEO still closing all deals — needs pipeline system before hiring sales team", trigger_template: "I saw Promptly is still at the founder-led sales stage — building the pipeline system before hiring a sales team is exactly the right order, and most companies get this backwards." },
  { name: "Megan Foster", title: "Head of Partnerships", company: "Syncbridge", company_size: "60 employees", industry: "Integration SaaS", email: "m.foster@syncbridge.com", linkedin: "linkedin.com/in/meganfoster-sync", confidence: 0.69, category_hint: "WARM", hook: "Syncbridge partnerships team is now expected to also drive net-new revenue", pain: "Partnerships team pivoting to outbound sales without the right tools or process", trigger_template: "I noticed Syncbridge's partnerships team is now owning revenue targets — that transition from partnerships to outbound sales is a real adjustment and most teams struggle with the cold outreach part." },
  { name: "Alex Johnson", title: "Director of Demand Generation", company: "Prism Marketing Tech", company_size: "95 employees", industry: "MarTech SaaS", email: "a.johnson@prismmartech.com", linkedin: "linkedin.com/in/alexjohnson-prism", confidence: 0.71, category_hint: "WARM", hook: "Prism's demand gen team is moving from inbound-only to a blended inbound+outbound model", pain: "Team knows inbound well but is new to outbound — needs process and tools", trigger_template: "I saw Prism is adding outbound to what's been a mostly inbound demand gen program — the challenge is usually that the team mindset, messaging, and tooling all need to shift at once." },
  { name: "Isabella Rossi", title: "Co-founder & COO", company: "Flair Studio Agency", company_size: "17 employees", industry: "Creative Agency", email: "i.rossi@flairstudio.co", linkedin: "linkedin.com/in/isabellarossi-flair", confidence: 0.72, category_hint: "WARM", hook: "Flair Studio is trying to move from project work to retainer-based model", pain: "Needs to actively prospect retainer clients rather than wait for project briefs", trigger_template: "I noticed Flair Studio is shifting toward retainer-based work — that pivot requires a completely different business development approach since retainer clients need to be found, not just pitched." },
  { name: "Owen Murphy", title: "VP Business Development", company: "Vertex IT Solutions", company_size: "130 employees", industry: "IT Services", email: "o.murphy@vertexit.com", linkedin: "linkedin.com/in/owenmurphy-vertex", confidence: 0.68, category_hint: "WARM", hook: "Vertex IT is a services firm expanding into a new vertical", pain: "Expanding into fintech vertical with no existing contacts or prospect list", trigger_template: "I saw Vertex IT is expanding into fintech — entering a new vertical from scratch is one of the hardest things in enterprise sales because you have no warm network and the buyer language is different." },

  // More WARM
  { name: "Tiffany Green", title: "Senior Account Executive", company: "CloudSpark Pro", company_size: "72 employees", industry: "Cloud SaaS", email: "t.green@cloudspark.io", linkedin: "linkedin.com/in/tiffanygreen-cloudspark", confidence: 0.67, category_hint: "WARM", hook: "CloudSpark AEs are spending too much time on prospecting vs. closing", pain: "AEs spending 40% of time prospecting instead of in customer conversations", trigger_template: "I noticed CloudSpark AEs are also responsible for their own prospecting — that split focus is usually one of the biggest drags on quota attainment." },
  { name: "Benjamin Lee", title: "Founder & Managing Partner", company: "Lodestar Advisors", company_size: "6 employees", industry: "Management Consulting", email: "ben.lee@lodestaradvisors.com", linkedin: "linkedin.com/in/benjaminlee-lodestar", confidence: 0.75, category_hint: "WARM", hook: "Lodestar Advisors is a boutique consultancy looking for 2 anchor clients this quarter", pain: "Has great case studies but no systematic way to find and reach ideal clients", trigger_template: "I saw Lodestar has strong case studies in the space — the challenge most boutique firms have is connecting those case studies to the right prospect at the right moment." },
  { name: "Diana Park", title: "Head of Sales Enablement", company: "ScaleForce CRM", company_size: "88 employees", industry: "Sales Tech SaaS", email: "d.park@scaleforce.io", linkedin: "linkedin.com/in/dianapark-scaleforce", confidence: 0.70, category_hint: "WARM", hook: "ScaleForce's enablement team is being asked to improve SDR conversion rates", pain: "SDR team has poor quality leads, causing low conversion and high churn", trigger_template: "I noticed ScaleForce's enablement team owns SDR productivity — poor lead quality is usually the root cause when conversion rates are below benchmark, not the messaging." },
  { name: "Samuel Wright", title: "GTM Lead", company: "Propellant AI", company_size: "25 employees", industry: "AI SaaS", email: "s.wright@propellant.ai", linkedin: "linkedin.com/in/samuelwright-propellant", confidence: 0.74, category_hint: "WARM", hook: "Propellant AI is building its go-to-market from scratch after product-market fit", pain: "Has PMF signal but no outbound motion — needs to build pipeline fast", trigger_template: "I saw Propellant AI hit its first PMF signals — building the outbound motion right after product-market fit is the highest-leverage moment, and also the most chaotic." },
  { name: "Camille Dubois", title: "Co-founder", company: "Artefact Growth", company_size: "9 employees", industry: "Growth Consulting", email: "c.dubois@artefactgrowth.com", linkedin: "linkedin.com/in/camlledubois", confidence: 0.73, category_hint: "WARM", hook: "Artefact Growth does growth work for clients but struggles to grow itself", pain: "Helps other companies with growth but has no time for own pipeline building", trigger_template: "There's an interesting tension I noticed at Artefact Growth — you help clients grow, but growth agencies are usually the worst at growing themselves because client work always takes priority." },

  // COLD leads
  { name: "Patrick Sullivan", title: "Marketing Coordinator", company: "MegaRetail Corp", company_size: "2800 employees", industry: "Retail / eCommerce", email: "p.sullivan@megaretail.com", linkedin: "linkedin.com/in/patricksullivan-retail", confidence: 0.45, category_hint: "COLD", hook: "MegaRetail is enterprise — wrong size and sector", pain: "Retail marketing is not B2B sales — different buyer model", trigger_template: "I noticed MegaRetail's marketing team handles a large digital presence — curious whether outbound sales to other businesses is something your team is exploring." },
  { name: "Amanda Ross", title: "Social Media Manager", company: "Trendset Agency", company_size: "28 employees", industry: "Social Media Agency", email: "a.ross@trendset.agency", linkedin: "linkedin.com/in/amandaross-trendset", confidence: 0.42, category_hint: "COLD", hook: "Social media agency — wrong buyer for B2B sales outreach tools", pain: "Social media focus doesn't align well with B2B pipeline generation", trigger_template: "I noticed Trendset focuses on social media — curious if there's any B2B sales motion in the business beyond the creative work." },
  { name: "Kevin Hart", title: "Operations Manager", company: "FastPrint Solutions", company_size: "55 employees", industry: "Printing & Fulfillment", email: "k.hart@fastprint.com", linkedin: "linkedin.com/in/kevinhartops", confidence: 0.38, category_hint: "COLD", hook: "Printing company — not a B2B sales/SaaS buyer", pain: "Operations role doesn't have budget for sales tools", trigger_template: "I noticed FastPrint is growing the operations side — curious if there's a sales team doing B2B outreach for new accounts." },
  { name: "Lisa Montgomery", title: "HR Director", company: "Berenson Staffing", company_size: "180 employees", industry: "Staffing & Recruiting", email: "l.montgomery@bereensonstaffing.com", linkedin: "linkedin.com/in/lisamontgomery-staffing", confidence: 0.40, category_hint: "COLD", hook: "HR role at staffing company — not a sales pipeline buyer", pain: "HR doesn't control sales outreach budget", trigger_template: "I noticed Berenson's HR team is scaling — wondering if the sales side of the business has a structured outreach motion for landing new employer clients." },
  { name: "Brian Cooper", title: "IT Manager", company: "Northern Logistics", company_size: "340 employees", industry: "Logistics & Supply Chain", email: "b.cooper@northernlogistics.com", linkedin: "linkedin.com/in/briancooper-logistics", confidence: 0.35, category_hint: "COLD", hook: "IT manager at logistics company — wrong title and industry", pain: "IT manager doesn't own sales outreach decisions", trigger_template: "I noticed Northern Logistics is investing in its tech stack — curious whether the sales team has a structured outbound process for landing new shipping contracts." },
  { name: "Emma Walsh", title: "Finance Analyst", company: "AccuBooks Inc", company_size: "90 employees", industry: "Accounting Services", email: "e.walsh@accubooks.com", linkedin: "linkedin.com/in/emmawalsh-accubooks", confidence: 0.37, category_hint: "COLD", hook: "Finance analyst — no decision-making power for sales tools", pain: "Finance role at accounting firm not relevant to outreach tooling", trigger_template: "I noticed AccuBooks is growing its client roster — curious whether the business development side has a structured approach to finding new accounting clients." },

  // DISCARD leads
  { name: "Robert Banks", title: "Retired Executive", company: "Self-employed / Board Advisor", company_size: "1 employee", industry: "Advisory", email: "r.banks@gmail.com", linkedin: "linkedin.com/in/robertbanks", confidence: 0.15, category_hint: "DISCARD", hook: "Retired — not an active buyer", pain: "No active company or budget", trigger_template: "" },
  { name: "Jennifer Lopez", title: "Student", company: "State University", company_size: "N/A", industry: "Education", email: "j.lopez@stateuniversity.edu", linkedin: "linkedin.com/in/jenniferlopez-student", confidence: 0.10, category_hint: "DISCARD", hook: "Student — not a B2B buyer", pain: "No budget or decision authority", trigger_template: "" },
  { name: "Mike Smith", title: "Account Manager", company: "Competitor Corp", company_size: "500 employees", industry: "Competing SaaS", email: "m.smith@competitorcorp.com", linkedin: "linkedin.com/in/mikesmith-cc", confidence: 0.20, category_hint: "DISCARD", hook: "Works for a direct competitor", pain: "Competitor employee — would not buy", trigger_template: "" },
];

// ─── Mock ICP generator ───────────────────────────────────────────────────────

export function generateMockICP(onboarding: OnboardingData): ICP {
  return {
    target_industries: ["B2B SaaS", "Management Consulting", "IT Services", "Revenue Operations", "Marketing Technology"],
    target_titles: [
      "CEO / Co-founder",
      "VP of Sales",
      "Head of Sales Development",
      "Director of Business Development",
      "Co-founder & CRO",
    ],
    company_size_range: "10–150 employees",
    pain_points: [
      `Spending too much time on manual prospecting instead of closing`,
      `No systematic outreach process — relying on referrals and inbound`,
      `SDR team lacking qualified leads to work`,
      `Personalization quality drops as outreach volume increases`,
      `Hiring a full-time SDR is too expensive at this stage`,
    ],
    disqualifiers: [
      "Enterprise companies with 500+ employees (long sales cycles)",
      "B2C companies (wrong buyer model)",
      "Non-sales titles without pipeline responsibility",
      "Companies in industries without a B2B sales motion",
    ],
    ideal_signals: [
      "Recently raised funding (Series A/B)",
      "Actively hiring in sales or business development",
      "CEO still closing deals (founder-led sales stage)",
      "Moving upmarket or into new verticals",
      "Just launched a new product or pricing tier",
    ],
  };
}

// ─── Score & qualify mock lead ────────────────────────────────────────────────

function scoreCandidate(
  candidate: typeof LEAD_POOL[0],
  _icp: ICP,
  priority: number
): Omit<QualifiedLead, keyof EnrichedLead> {
  const categoryScores: Record<typeof candidate.category_hint, number> = {
    HOT: 8.5 + Math.random() * 1.0,
    WARM: 6.2 + Math.random() * 1.3,
    COLD: 3.8 + Math.random() * 1.5,
    DISCARD: 1.5 + Math.random() * 1.5,
  };
  const base = categoryScores[candidate.category_hint];
  const fit_score = Math.min(10, Math.max(1, parseFloat(base.toFixed(1))));

  const breakdown = {
    industry_fit: candidate.category_hint === "HOT" ? 9 : candidate.category_hint === "WARM" ? 7 : candidate.category_hint === "COLD" ? 4 : 2,
    title_fit: candidate.category_hint === "HOT" ? 9 : candidate.category_hint === "WARM" ? 7 : candidate.category_hint === "COLD" ? 3 : 2,
    company_size_fit: candidate.category_hint === "HOT" ? 9 : candidate.category_hint === "WARM" ? 7 : 5,
    pain_signals: candidate.category_hint === "HOT" ? 8 : candidate.category_hint === "WARM" ? 6 : 3,
    response_likelihood: candidate.category_hint === "HOT" ? 8 : candidate.category_hint === "WARM" ? 6 : 3,
  };

  const fitReasonsByCategory: Record<string, string[]> = {
    HOT: [
      `${candidate.industry} company — direct match to ICP target industries`,
      `${candidate.title} has direct budget ownership for sales tools and pipeline investment`,
      `${candidate.company_size} — ideal for our service ticket size`,
    ],
    WARM: [
      `${candidate.industry} adjacent to ICP — relevant but not primary target`,
      `${candidate.title} role has influence on tooling decisions`,
      `${candidate.company_size} — within range but needs budget validation`,
    ],
    COLD: [
      `${candidate.industry} has limited alignment with our offer`,
      `${candidate.title} may not have direct purchasing authority`,
    ],
    DISCARD: [],
  };

  const disqualByCategory: Record<string, string[]> = {
    HOT: [],
    WARM: [`${candidate.industry} is adjacent but not primary ICP — lower conversion probability`],
    COLD: [
      `${candidate.industry} doesn't align with B2B pipeline generation use case`,
      `${candidate.title} unlikely to be economic buyer for this service`,
    ],
    DISCARD: [
      `Contact does not match any ICP dimension (industry, title, company size)`,
      `No identified pain point relevant to our offer`,
      `Recommend removing from sequence`,
    ],
  };

  return {
    fit_score,
    category: candidate.category_hint,
    fit_reasons: fitReasonsByCategory[candidate.category_hint],
    disqualification_reasons: disqualByCategory[candidate.category_hint],
    contact_priority: priority,
    score_breakdown: breakdown,
  };
}

// ─── Outreach generator ───────────────────────────────────────────────────────

function buildOutreach(
  candidate: typeof LEAD_POOL[0],
  onboarding: OnboardingData,
  qualified: Omit<QualifiedLead, keyof EnrichedLead>
): OutreachSequence {
  const firstName = candidate.name.split(" ")[0];
  const offerShort = onboarding.offer_description || "qualified B2B leads with personalized outreach";
  const valueShort = onboarding.value_proposition || "more qualified meetings without hiring SDRs";

  if (qualified.category === "DISCARD") {
    return {
      personalization_trigger: "",
      email_subject: "",
      email_body: "",
      linkedin_dm: "",
      followup_1: "",
      followup_2: "",
    };
  }

  const trigger = candidate.trigger_template;
  const companyCtx = `${candidate.company} (${candidate.company_size}, ${candidate.industry})`;

  const toneClosings: Record<string, string> = {
    direct: `Would it make sense to talk for 20 minutes this week?`,
    consultative: `What does your current pipeline generation process look like — is outbound part of the mix?`,
    casual: `Worth a quick call to see if it's a fit?`,
  };
  const cta = toneClosings[onboarding.tone] || toneClosings.direct;

  const emailSubject = generateEmailSubject(candidate, qualified.category);

  const emailBody = `${trigger}

We help companies like ${companyCtx} with ${offerShort}. Our clients typically see ${valueShort} within the first month.

${cta}`;

  const linkedinDm = `Hi ${firstName}, ${candidate.hook.toLowerCase().replace(/^[a-z]/, (c) => c)} — curious if ${candidate.pain.toLowerCase()} is something you're actively working on. I help teams in your space with this. Worth connecting?`;

  const followup1 = `Hi ${firstName}, following up on my last message about ${candidate.pain.toLowerCase()}.

I shared a case recently with a similar ${candidate.industry} company — they went from inconsistent outreach to 15+ qualified conversations per month in 6 weeks. Happy to share the details if useful.

${cta}`;

  const followup2 = `${firstName}, last note before I close this thread — if the timing isn't right, totally fine. Just reply "later" and I'll check back in 60 days. Or if someone else at ${candidate.company} owns this, happy to reach out there instead.`;

  return {
    personalization_trigger: trigger,
    email_subject: emailSubject,
    email_body: emailBody,
    linkedin_dm: linkedinDm,
    followup_1: followup1,
    followup_2: followup2,
  };
}

function generateEmailSubject(candidate: typeof LEAD_POOL[0], category: string): string {
  const subjects: Record<string, string[]> = {
    HOT: [
      `${candidate.company}: quick idea on pipeline`,
      `${candidate.company} + qualified leads`,
      `${candidate.title.split(" ").pop()} at ${candidate.company} — pipeline question`,
    ],
    WARM: [
      `${candidate.company}: outreach question`,
      `Quick question for ${candidate.name.split(" ")[0]}`,
      `${candidate.company} — 2 min read`,
    ],
    COLD: [
      `${candidate.company} — quick note`,
      `Question for ${candidate.name.split(" ")[0]}`,
      `Relevant for ${candidate.company}?`,
    ],
    DISCARD: [""],
  };
  const opts = subjects[category] || subjects.COLD;
  return opts[Math.floor(Math.random() * opts.length)];
}

// ─── QC logic ─────────────────────────────────────────────────────────────────

function runQC(lead: QualifiedLead): { status: QCStatus; notes?: string } {
  if (lead.category === "DISCARD") {
    return { status: "FAILED", notes: "Lead disqualified — do not contact. Remove from sequence." };
  }
  if (lead.category === "COLD") {
    return { status: "REVIEW_NEEDED", notes: "COLD lead — verify email and re-evaluate title before sending. Consider skipping." };
  }
  if (!lead.outreach.personalization_trigger || lead.outreach.personalization_trigger.length < 20) {
    return { status: "REVIEW_NEEDED", notes: "Personalization trigger too generic — add specific context before sending." };
  }
  return { status: "APPROVED" };
}

// ─── Main mock lead generator ─────────────────────────────────────────────────

export function generateMockLeads(
  onboarding: OnboardingData,
  icp: ICP,
  count: number
): ProcessedLead[] {
  // Shuffle pool deterministically based on company name for consistency
  const seed = onboarding.company_name.charCodeAt(0) || 65;
  const shuffled = [...LEAD_POOL].sort((a, b) => {
    const ha = ((a.name.charCodeAt(0) * seed) % 97);
    const hb = ((b.name.charCodeAt(0) * seed) % 97);
    return ha - hb;
  });

  // Take 'count' leads, cycling the pool if needed
  const selected: typeof LEAD_POOL = [];
  for (let i = 0; i < count; i++) {
    selected.push(shuffled[i % shuffled.length]);
  }

  // Sort: HOT first, then WARM, COLD, DISCARD
  const order = { HOT: 0, WARM: 1, COLD: 2, DISCARD: 3 };
  selected.sort((a, b) => order[a.category_hint] - order[b.category_hint]);

  return selected.map((candidate, idx): ProcessedLead => {
    const enriched: EnrichedLead = {
      name: candidate.name,
      title: candidate.title,
      company: candidate.company,
      company_size_estimate: candidate.company_size,
      industry: candidate.industry,
      email: candidate.email,
      email_status: candidate.confidence > 0.8 ? "verified" : candidate.confidence > 0.6 ? "likely_valid" : "unverified",
      linkedin_url: candidate.linkedin,
      source: "mock" as const,
      source_url: `https://linkedin.com/company/${candidate.company.toLowerCase().replace(/\s+/g, "-")}`,
      confidence_score: candidate.confidence,
      company_context: `${candidate.company} is a ${candidate.company_size} company in the ${candidate.industry} space. ${candidate.hook}`,
      role_responsibilities: `As ${candidate.title}, ${candidate.name.split(" ")[0]} is responsible for revenue generation, pipeline strategy, and team performance. They likely have budget authority or strong influence over tools that affect their team's output.`,
      inferred_pain_points: [candidate.pain],
      personalization_hooks: [candidate.hook],
      confidence_note: candidate.confidence > 0.8 ? "High confidence — verified email and strong ICP match." : "Medium confidence — email unverified; recommend checking before sending.",
    };

    const priority = idx + 1;
    const scores = scoreCandidate(candidate, icp, priority);

    const qualified: QualifiedLead = { ...enriched, ...scores };
    const outreach = buildOutreach(candidate, onboarding, scores);
    const qcResult = runQC({ ...qualified, outreach, qc_status: "APPROVED", qc_approved: true });

    return {
      ...qualified,
      outreach,
      qc_status: qcResult.status,
      qc_notes: qcResult.notes,
      qc_approved: qcResult.status === "APPROVED",
    };
  });
}
