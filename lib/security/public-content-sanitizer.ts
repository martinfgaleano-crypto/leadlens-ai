/** Removes personal contact channels from public source text before it enters
 * prompts, candidate artifacts or reports. Company facts and source URLs stay
 * intact; LeadLens is account intelligence, never a contact database. */
export function sanitizePublicContent(value: string): string {
  return value
    .replace(/\[([^\]]*)\]\(mailto:[^)]+\)/gi, "$1 [email redacted]")
    .replace(/\[([^\]]*)\]\(tel:[^)]+\)/gi, "$1 [phone redacted]")
    .replace(/mailto:[^\s)]+/gi, "[email redacted]")
    .replace(/tel:[^\s)]+/gi, "[phone redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    // International and US-style phone numbers; require at least 7 digits so
    // publication dates, prices and ordinary quantities are not removed.
    .replace(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]\d{4}\b/g, (match) =>
      match.replace(/\D/g, "").length >= 7 ? "[phone redacted]" : match,
    );
}
