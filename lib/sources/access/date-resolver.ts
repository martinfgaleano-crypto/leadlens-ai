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

const ES_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};
const EN_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");
function inRange(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(`${y}-${pad(mo)}-${pad(d)}`);
  return Number.isFinite(dt.getTime()) && dt.getTime() < Date.now() + 86_400_000 && y >= 2000 ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

/** Parse Spanish absolute ("27 de marzo de 2026", "23 sept 2025") and relative
 *  ("hace 4 meses", "hace 2 días") dates that ISO/Date.parse miss. Conservative:
 *  returns null on anything ambiguous — never invents a date. */
export function parseSpanishDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  // Relative: "hace N día(s)/semana(s)/mes(es)/año(s)"
  const rel = s.match(/hace\s+(\d+)\s+(d[ií]as?|semanas?|meses?|a[ñn]os?)/);
  if (rel) {
    const n = parseInt(rel[1], 10); const unit = rel[2]; const now = new Date();
    if (/d[ií]a/.test(unit)) now.setDate(now.getDate() - n);
    else if (/semana/.test(unit)) now.setDate(now.getDate() - n * 7);
    else if (/mes/.test(unit)) now.setMonth(now.getMonth() - n);
    else now.setFullYear(now.getFullYear() - n);
    return now.toISOString().slice(0, 10);
  }
  // "27 de marzo de 2026" / "27 marzo 2026" / "23 sept 2025"
  const dmy = s.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\.?\s+(?:de\s+)?(\d{4})/);
  if (dmy && ES_MONTHS[dmy[2]]) return inRange(parseInt(dmy[3], 10), ES_MONTHS[dmy[2]], parseInt(dmy[1], 10));
  // "marzo 27, 2026" / "marzo 27 de 2026"
  const mdy = s.match(/([a-záéíóú]+)\.?\s+(\d{1,2}),?\s+(?:de\s+)?(\d{4})/);
  if (mdy && ES_MONTHS[mdy[1]]) return inRange(parseInt(mdy[3], 10), ES_MONTHS[mdy[1]], parseInt(mdy[2], 10));
  return null;
}

export function parseEnglishDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  const mdy = s.match(/([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (mdy && EN_MONTHS[mdy[1]]) return inRange(parseInt(mdy[3], 10), EN_MONTHS[mdy[1]], parseInt(mdy[2], 10));
  const dmy = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?,?\s+(\d{4})/);
  if (dmy && EN_MONTHS[dmy[2]]) return inRange(parseInt(dmy[3], 10), EN_MONTHS[dmy[2]], parseInt(dmy[1], 10));
  return null;
}

function toIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(ISO_RE);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
    return Number.isFinite(d.getTime()) && d.getTime() < Date.now() + 86_400_000 ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  const es = parseSpanishDate(raw);
  if (es) return es;
  const en = parseEnglishDate(raw);
  if (en) return en;
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

  // 5. Visible date near publication markers (ISO-like)
  const visible = html.match(/(?:published|publicado|posted|fecha)[:\s]{0,12}(\d{4}-\d{2}-\d{2})/i);
  const visIso = toIso(visible?.[1]);
  if (visIso) candidates.push({ date: visIso, source: "visible_text", confidence: "low", method: "visible publication marker" });

  // 5b. Spanish/English visible date in extracted article text (markdown strips the
  //     HTML meta/JSON-LD, so Colombian news dates only survive as body text like
  //     "27 de marzo de 2026" or "23 sept 2025"). Scan the first 1500 chars where
  //     the byline/dateline lives, to avoid picking up dates cited in the story.
  if (!candidates.some((c) => c.source !== "url_pattern")) {
    const head = html.slice(0, 5000);
    const visibleMatch = head.match(/(\d{1,2}\s+(?:de\s+)?[a-zA-Záéíóú]+\.?\s+(?:de\s+)?\d{4})|([a-zA-Z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})|(?:hace\s+\d+\s+(?:d[ií]as?|semanas?|meses?|a[ñn]os?))/i);
    const visibleIso = parseSpanishDate(visibleMatch?.[0]) ?? parseEnglishDate(visibleMatch?.[0]);
    if (visibleIso) candidates.push({ date: visibleIso, source: "visible_text", confidence: "low", method: "visible Spanish/English dateline" });
  }

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
