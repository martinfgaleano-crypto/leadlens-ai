import { sanitizePublicContent } from "@/lib/security/public-content-sanitizer";

let passed = 0;
function test(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`PASS: ${name}`);
}

const source = "Published: March 3, 2026\n[media@sprouts.com](mailto:media@sprouts.com) [602-682-1536](tel:602-682-1536)\nContact press@example.org or +1 415-555-0199.";
const clean = sanitizePublicContent(source);
test("email addresses are removed", !clean.includes("@sprouts.com") && !clean.includes("press@example.org"));
test("mailto destinations are removed", !clean.includes("mailto:"));
test("phone numbers are removed", !clean.includes("602-682-1536") && !clean.includes("415-555-0199"));
test("tel destinations are removed", !clean.includes("tel:"));
test("publication dates remain", clean.includes("March 3, 2026"));
test("redaction is explicit", clean.includes("[email redacted]") && clean.includes("[phone redacted]"));
console.log(`\n${passed}/6 sanitizer assertions passed.`);
