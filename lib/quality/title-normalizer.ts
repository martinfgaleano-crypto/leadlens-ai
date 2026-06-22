export type Seniority =
  | "C-Level"
  | "VP"
  | "Director"
  | "Manager"
  | "Individual Contributor"
  | "Unknown";

// Ordered title normalization rules — first match wins
const TITLE_MAP: Array<[RegExp, string]> = [
  [/\b(ceo|chief executive officer|founder|co-?founder|cofounder|owner|president|managing director)\b/i, "CEO"],
  [/\bcto\b/i,                                                                "CTO"],
  [/\bcfo\b/i,                                                                "CFO"],
  [/\bcoo\b/i,                                                                "COO"],
  [/\bcmo\b/i,                                                                "CMO"],
  [/\b(svp|evp|executive vice president)\b/i,                                "SVP"],
  [/\bvp.{0,10}sales|vice president.{0,10}sales\b/i,                         "VP Sales"],
  [/\bvp.{0,10}marketing|vice president.{0,10}marketing\b/i,                 "VP Marketing"],
  [/\bvp.{0,10}engineering|vice president.{0,10}engineering\b/i,             "VP Engineering"],
  [/\bvp.{0,10}operations|vice president.{0,10}operations\b/i,               "VP Operations"],
  [/\bvp.{0,10}product|vice president.{0,10}product\b/i,                     "VP Product"],
  [/\b(vp|vice president)\b/i,                                               "VP"],
  [/\b(head of procurement|procurement director|director.{0,15}procurement)\b/i, "Procurement"],
  [/\b(head of sales|sales director|director.{0,15}sales)\b/i,               "Sales Director"],
  [/\b(head of marketing|marketing director|director.{0,15}marketing)\b/i,   "Marketing Director"],
  [/\b(head of engineering|engineering director|director.{0,15}engineering)\b/i, "Engineering Director"],
  [/\b(head of|director of|director)\b/i,                                    "Director"],
  [/\bmarketing manager\b/i,                                                 "Marketing Manager"],
  [/\bsales manager\b/i,                                                     "Sales Manager"],
  [/\bproduct manager\b/i,                                                   "Product Manager"],
  [/\bproject manager\b/i,                                                   "Project Manager"],
  [/\boperations manager\b/i,                                                "Operations Manager"],
  [/\bmanager\b/i,                                                           "Manager"],
];

// Seniority detection — checked against the original title (not normalized)
const SENIORITY_RULES: Array<[RegExp[], Seniority]> = [
  [
    [/\bceo\b/i, /\bcto\b/i, /\bcfo\b/i, /\bcoo\b/i, /\bcmo\b/i,
     /\bchief\b/i, /\bfounder\b/i, /\bco-?founder\b/i, /\bcofounder\b/i,
     /\bowner\b/i, /\bpresident\b/i, /\bmanaging director\b/i],
    "C-Level",
  ],
  [
    [/\bvp\b/i, /\bvice president\b/i, /\bsvp\b/i, /\bevp\b/i],
    "VP",
  ],
  [
    [/\bdirector\b/i, /\bhead of\b/i],
    "Director",
  ],
  [
    [/\bmanager\b/i, /\blead\b/i, /\bsupervisor\b/i],
    "Manager",
  ],
];

export function normalizeTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  for (const [pattern, canonical] of TITLE_MAP) {
    if (pattern.test(title)) return canonical;
  }
  return title;
}

export function detectSeniority(title: string | null | undefined): Seniority {
  if (!title) return "Unknown";
  for (const [patterns, level] of SENIORITY_RULES) {
    if (patterns.some(p => p.test(title))) return level;
  }
  return "Individual Contributor";
}
