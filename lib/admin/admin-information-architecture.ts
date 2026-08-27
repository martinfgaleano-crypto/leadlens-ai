export const ADMIN_INFORMATION_ARCHITECTURE_VERSION = "admin-information-architecture-v1";

export type AdminSurfaceDisposition = "primary" | "secondary" | "contextual" | "deprecated_navigation";
export type AdminNavItem = { href: string; label: string; disposition: AdminSurfaceDisposition; purpose: string };
export type AdminNavSection = { id: string; label: string; items: AdminNavItem[] };

export const ADMIN_NAVIGATION: AdminNavSection[] = [
  { id: "control", label: "Control", items: [
    { href: "/admin", label: "Operations Overview", disposition: "primary", purpose: "Live operational summary" },
    { href: "/admin/beta-readiness", label: "Launch Readiness", disposition: "primary", purpose: "Automatic evidence-based launch gates" },
    { href: "/admin/intelligence", label: "Intelligence OS", disposition: "primary", purpose: "Capability maturity and evidence" },
    { href: "/admin/operations/providers", label: "Provider Health", disposition: "primary", purpose: "Provider availability, limits and cost" },
    { href: "/admin/system-health", label: "Runtime & Exceptions", disposition: "primary", purpose: "Canonical Intelligence lifecycle, latency and failures" },
  ] },
  { id: "execute", label: "Execute", items: [
    { href: "/admin/pilot", label: "Pilot Console", disposition: "primary", purpose: "Create and run customer pilots" },
    { href: "/admin/jobs", label: "Jobs", disposition: "primary", purpose: "Execution lifecycle" },
    { href: "/admin/searches", label: "Searches", disposition: "secondary", purpose: "Search execution detail" },
    { href: "/admin/monitor-runs", label: "Monitor Operations", disposition: "primary", purpose: "Recurring monitor runs" },
    { href: "/admin/deliverables", label: "Deliverables", disposition: "secondary", purpose: "Customer delivery queue" },
  ] },
  { id: "intelligence", label: "Intelligence Assets", items: [
    { href: "/admin/lead-hunter", label: "Lead Hunter", disposition: "primary", purpose: "Candidate universe and review" },
    { href: "/admin/vault-foundation", label: "Vault Foundation", disposition: "primary", purpose: "Verified companies, signals and sources" },
    { href: "/admin/vault", label: "Vault", disposition: "secondary", purpose: "Reusable account evidence" },
    { href: "/admin/intelligence/sources", label: "Source Intelligence", disposition: "primary", purpose: "Source access and utility" },
    { href: "/admin/intelligence/review", label: "Human Review", disposition: "primary", purpose: "Validation queue" },
  ] },
  { id: "customer", label: "Customers & Learning", items: [
    { href: "/admin/onboarding", label: "Onboarding", disposition: "primary", purpose: "Customer context intake" },
    { href: "/admin/feedback", label: "Feedback & Outcomes", disposition: "primary", purpose: "Human feedback and outcome learning" },
    { href: "/admin/analytics", label: "Customer Analytics", disposition: "secondary", purpose: "Customer lifecycle metrics" },
    { href: "/admin/orders", label: "Orders", disposition: "secondary", purpose: "Order administration" },
    { href: "/admin/credits", label: "Credits", disposition: "secondary", purpose: "Customer credit ledger" },
    { href: "/admin/settings", label: "Settings", disposition: "secondary", purpose: "Operational configuration" },
  ] },
];

export const ADMIN_DEPRECATED_NAVIGATION: AdminNavItem[] = [
  { href: "/admin/snapshots", label: "Snapshots", disposition: "deprecated_navigation", purpose: "Reachable contextually from Jobs and reports" },
  { href: "/admin/vault-report-bridge", label: "Vault Bridge", disposition: "deprecated_navigation", purpose: "Legacy implementation surface" },
  { href: "/admin/notifications", label: "Notifications", disposition: "deprecated_navigation", purpose: "Contextual operational surface" },
  { href: "/admin/vault-performance", label: "Vault Performance", disposition: "deprecated_navigation", purpose: "Consolidated into Intelligence OS" },
  { href: "/admin/vault-candidates", label: "Vault Candidates", disposition: "deprecated_navigation", purpose: "Consolidated into Lead Hunter" },
  { href: "/admin/sources", label: "Sources", disposition: "deprecated_navigation", purpose: "Consolidated into Source Intelligence" },
  { href: "/admin/source-config", label: "Source Config", disposition: "deprecated_navigation", purpose: "Contextual from Source Intelligence" },
  { href: "/admin/source-runs", label: "Source Runs", disposition: "deprecated_navigation", purpose: "Contextual from Source Intelligence" },
  { href: "/admin/companies", label: "Legacy Companies", disposition: "deprecated_navigation", purpose: "Merged into Lead Hunter and Vault Foundation; legacy company_profiles was lead/contact-scoring data" },
];
