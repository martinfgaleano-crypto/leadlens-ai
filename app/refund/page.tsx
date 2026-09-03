import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy — LeadLens",
  description: "LeadLens refund and satisfaction policy for one-time Intelligence products.",
};

export default function RefundPage() {
  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a", background: "#fff", lineHeight: 1.6 }}>
      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
        <Link href="/" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".875rem", fontWeight: 600 }}>
          ← Back to LeadLens
        </Link>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-.02em", marginTop: "2rem", marginBottom: ".5rem" }}>
          Refund Policy
        </h1>
        <p style={{ color: "#64748b", fontSize: ".875rem", marginBottom: "2.5rem" }}>
          Last updated: September 2026
        </p>

        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: ".875rem", padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
          <p style={{ margin: 0, color: "#0284c7", fontSize: ".9375rem" }}>
            <strong>Summary:</strong> We want you to be satisfied with your LeadLens Intelligence. If your result was not
            delivered, or materially did not match the commercial context you described and confirmed, contact us within
            7 days and we will make it right — reprocess your run or issue a refund.
          </p>
        </div>

        <Section title="1. Our commitment">
          <p>
            LeadLens stands behind the quality of its Account Opportunity Intelligence. This policy applies to one-time
            digital Intelligence products. If a delivered result materially fails to match the commercial context you
            described and confirmed, we will reprocess it or refund you.
          </p>
        </Section>

        <Section title="2. Eligible refund scenarios">
          <ul>
            <li><strong>Non-delivery</strong> — your result was not delivered within a reasonable time of payment and we did not communicate a delay.</li>
            <li><strong>Significant mismatch</strong> — the accounts or analysis materially do not match the commercial context, geography, or sector you described and confirmed.</li>
            <li><strong>Technical failure</strong> — the report is corrupted, unreadable, or missing key sections (Opportunity Cases, Evidence, or Decisions).</li>
          </ul>
        </Section>

        <Section title="3. Non-refundable scenarios">
          <ul>
            <li>You changed your mind after the result was delivered.</li>
            <li>An account did not respond or convert — LeadLens supports account decisions, does not guarantee commercial outcomes, and does not perform outreach.</li>
            <li>A valid result you didn&rsquo;t prefer — a Hold, Validate, or Monitor decision, or a small, defensible portfolio, is a legitimate output, not a defect.</li>
            <li>You provided inaccurate or vague commercial context.</li>
            <li>More than 7 days have passed since delivery.</li>
          </ul>
        </Section>

        <Section title="4. How to request a refund">
          <p>
            Email{" "}
            <a href="mailto:operations@leadlensintel.com" style={{ color: "#0ea5e9" }}>operations@leadlensintel.com</a>{" "}
            with:
          </p>
          <ul>
            <li>Your order email address</li>
            <li>The reason for your refund request</li>
            <li>Any relevant details (e.g., how the result did not match the context you confirmed)</li>
          </ul>
          <p>
            We will respond within 2 business days. If your request is valid, we will either reprocess your run at no
            charge or issue a full refund to your original payment method.
          </p>
        </Section>

        <Section title="5. Processing time">
          <p>
            Approved refunds are processed within 5–10 business days depending on your payment provider and bank.
          </p>
        </Section>

        <Section title="6. Contact">
          <p>
            For any questions about this policy, email{" "}
            <a href="mailto:operations@leadlensintel.com" style={{ color: "#0ea5e9" }}>operations@leadlensintel.com</a>.
          </p>
        </Section>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "2rem", marginTop: "2rem", fontSize: ".82rem", color: "#94a3b8" }}>
          Questions? Email{" "}
          <a href="mailto:operations@leadlensintel.com" style={{ color: "#0ea5e9" }}>operations@leadlensintel.com</a>
          {" · "}
          <Link href="/privacy" style={{ color: "#94a3b8" }}>Privacy</Link>
          {" · "}
          <Link href="/terms" style={{ color: "#94a3b8" }}>Terms</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: ".75rem", color: "#0f172a" }}>{title}</h2>
      <div style={{ color: "#475569", fontSize: ".9375rem" }}>{children}</div>
    </div>
  );
}
