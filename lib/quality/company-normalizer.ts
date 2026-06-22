const CORP_SUFFIXES = [
  /,?\s*inc(?:orporated)?\.?$/i,
  /,?\s*l\.?l\.?c\.?$/i,
  /,?\s*ltd\.?$/i,
  /,?\s*limited$/i,
  /,?\s*corp(?:oration)?\.?$/i,
  /,?\s*co\.?$/i,
  /,?\s*plc\.?$/i,
  /,?\s*gmbh\.?$/i,
  /,?\s*s\.?a\.?$/i,
  /,?\s*b\.?v\.?$/i,
  /,?\s*n\.?v\.?$/i,
];

export function normalizeCompany(company: string | null | undefined): string | null {
  if (!company) return null;
  let result = company.trim();
  for (const suffix of CORP_SUFFIXES) {
    result = result.replace(suffix, "").trim();
  }
  return result.length > 0 ? result : company;
}

export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const raw = website.trim();
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
