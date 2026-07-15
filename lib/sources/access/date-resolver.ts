// ─── Publication date resolver ────────────────────────────────────────────────
// Resolves a publication date from extracted page content with explicit source,
// confidence and method. NEVER invents dates: extraction time ≠ publication
// time; URL patterns are weak evidence; unknown stays unknown.

export interface ResolvedDate {
  date: string | null;              // ISO YYYY-MM-DD
  date_source: "provider" | "json_ld" | "og_meta" | "html_time" | "visible_text" | "url_pattern" | "unknown";
  confidence: "high" | "medium" | "low" | "none";
  validation_method: string;
  is_modification_date: boolean;    // true when only dateModified was found
  conflict: boolean;                // multiple sources disagree by > 2 days
}

const ISO_RE = /(\d{4})-(\d{2})-(\d{2})/;

function toIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(ISO_RE);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
    return Number.isFinite(d.getTime()) && d.getTime() < Date.now() + 86_400_000 ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getTime() < Date.now() + 86_400_000) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

const daysApart = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

export function resolvePublicationDate(input: {
  provider_date?: string | null;
  html?: string | null;   // raw html or markdown from extraction
  url?: string | null;
}): ResolvedDate {
  const candidates: Array<{ date: string; source: ResolvedDate["date_source"]; confidence: ResolvedDate["confidence"]; method: string; modification?: boolean }> = [];
  const html = input.html ?? "";

  // 1. Provider-supplied date
  const prov = toIso(input.provider_date);
  if (prov) candidates.push({ date: prov, source: "provider", confidence: "medium", method: "search provider metadata" });

  // 2. JSON-LD datePublished (dateModified tracked separately)
  const published = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  const pubIso = toIso(published?.[1]);
  if (pubIso) candidates.push({ date: pubIso, source: "json_ld", confidence: "high", method: "JSON-LD datePublished" });
  const modified = html.match(/"dateModified"\s*:\s*"([^"]+)"/);
  const modIso = toIso(modified?.[1]);

  // 3. OpenGraph / article meta
  const og = html.match(/property=["'](?:article:published_time|og:published_time)["']\s+content=["']([^"']+)["']/) ??
             html.match(/content=["']([^"']+)["']\s+property=["'](?:article:published_time|og:published_time)["']/);
  const ogIso = toIso(og?.[1]);
  if (ogIso) candidates.push({ date: ogIso, source: "og_meta", confidence: "high", method: "article:published_time" });

  // 4. HTML <time datetime>
  const timeEl = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  const timeIso = toIso(timeEl?.[1]);
  if (timeIso) candidates.push({ date: timeIso, source: "html_time", confidence: "medium", method: "<time datetime>" });

  // 5. Visible date near publication markers (conservative: ISO-like only)
  const visible = html.match(/(?:published|publicado|posted|fecha)[:\s]{0,12}(\d{4}-\d{2}-\d{2})/i);
  const visIso = toIso(visible?.[1]);
  if (visIso) candidates.push({ date: visIso, source: "visible_text", confidence: "low", method: "visible publication marker" });

  // 6. URL date pattern — weak evidence only
  const urlDate = input.url?.match(/\/(\d{4})\/(\d{2})(?:\/(\d{2}))?\//);
  if (urlDate) {
    const iso = toIso(`${urlDate[1]}-${urlDate[2]}-${urlDate[3] ?? "01"}`);
    if (iso) candidates.push({ date: iso, source: "url_pattern", confidence: "low", method: "URL date segment (weak)" });
  }

  if (candidates.length === 0) {
    if (modIso) {
      return { date: modIso, date_source: "json_ld", confidence: "low", validation_method: "JSON-LD dateModified only — publication date unknown", is_modification_date: true, conflict: false };
    }
    return { date: null, date_source: "unknown", confidence: "none", validation_method: "no dated evidence found", is_modification_date: false, conflict: false };
  }

  // Best candidate by confidence order; conflict when strong sources disagree > 2 days.
  const order = { high: 0, medium: 1, low: 2, none: 3 } as const;
  candidates.sort((a, b) => order[a.confidence] - order[b.confidence]);
  const best = candidates[0];
  const conflict = candidates.some((c) => c !== best && order[c.confidence] <= 1 && daysApart(c.date, best.date) > 2);

  return {
    date: best.date,
    date_source: best.source,
    confidence: best.confidence,
    validation_method: best.method,
    is_modification_date: false,
    conflict,
  };
}
