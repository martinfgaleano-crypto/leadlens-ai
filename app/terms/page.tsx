import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — LeadLens AI",
  description: "Terms and conditions for using LeadLens AI.",
};

export default function TermsPage() {
  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a", background: "#fff", lineHeight: 1.6 }}>
      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
        <Link href="/demo-pipeline" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".875rem", fontWeight: 600 }}>
          ← Back to LeadLens AI
        </Link>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-.02em", marginTop: "2rem", marginBottom: ".5rem" }}>
          Terms of Service
        </h1>
        <p style={{ color: "#64748b", fontSize: ".875rem", marginBottom: "2.5rem" }}>
          Last updated: June 2026
        </p>

        <Section title="1. Service description">
          <p>
            LeadLens AI provides B2B lead research and outreach copywriting as a service. Upon
            payment, we research qualified leads matching your ideal customer profile and deliver a
            report containing lead data, qualification scores, and personalized outreach copy via
            CSV and Markdown files.
          </p>
        </Section>

        <Section title="2. Acceptance of terms">
          <p>
            By purchasing or using LeadLens AI, you agree to these Terms of Service. If you do not
            agree, do not use the service.
          </p>
        </Section>

        <Section title="3. What you receive">
          <ul>
            <li>A batch of qualified B2B leads matching the ICP you described.</li>
            <li>Personalized email drafts, LinkedIn DMs, and follow-up sequences per lead.</li>
            <li>CSV + Markdown export of all lead data and outreach copy.</li>
            <li>Delivery within 24–48 hours of order confirmation during our beta period.</li>
          </ul>
        </Section>

        <Section title="4. What you agree to">
          <ul>
            <li>You are responsible for reviewing all outreach copy before sending it.</li>
            <li>You will not use LeadLens outputs to send unsolicited bulk email (spam).</li>
            <li>You will comply with applicable anti-spam laws (CAN-SPAM, GDPR, CASL, etc.) in your jurisdiction.</li>
            <li>LeadLens AI does not send emails or messages on your behalf — you control all outreach.</li>
            <li>You will not resell or redistribute the lead data or outreach copy without permission.</li>
          </ul>
        </Section>

        <Section title="5. No outcome guarantees">
          <p>
            LeadLens AI provides research and copywriting assistance. We do not guarantee specific
            sales results, reply rates, meetings booked, or revenue generated. Results depend on
            your product, market, and outreach execution.
          </p>
        </Section>

        <Section title="6. Payment and billing">
          <p>
            Payments are processed by Lemon Squeezy. All prices are in USD. Beta batch purchases
            are one-time payments — there are no recurring charges unless you purchase additional
            batches. See our{" "}
            <Link href="/refund" style={{ color: "#0ea5e9" }}>Refund Policy</Link>{" "}
            for information on refunds.
          </p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>
            LeadLens AI is provided &ldquo;as is&rdquo; during our beta period. To the maximum extent
            permitted by law, our liability is limited to the amount you paid for the service. We
            are not liable for indirect, incidental, or consequential damages.
          </p>
        </Section>

        <Section title="8. Intellectual property">
          <p>
            The outreach copy and reports we generate are yours to use. We retain the right to
            improve our models and service using anonymized, aggregated usage patterns.
          </p>
        </Section>

        <Section title="9. Changes to these terms">
          <p>
            We may update these Terms of Service as our service evolves. We will update the date
            at the top of this page. Continued use constitutes acceptance of updated terms.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about these terms? Email{" "}
            <a href="mailto:martinfgaleano@gmail.com" style={{ color: "#0ea5e9" }}>martinfgaleano@gmail.com</a>.
          </p>
        </Section>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "2rem", marginTop: "2rem", fontSize: ".82rem", color: "#94a3b8" }}>
          Questions? Email{" "}
          <a href="mailto:martinfgaleano@gmail.com" style={{ color: "#0ea5e9" }}>martinfgaleano@gmail.com</a>
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
