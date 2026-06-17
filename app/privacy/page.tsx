import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — LeadLens AI",
  description: "How LeadLens AI collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a", background: "#fff", lineHeight: 1.6 }}>
      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
        <Link href="/demo-pipeline" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".875rem", fontWeight: 600 }}>
          ← Back to LeadLens AI
        </Link>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-.02em", marginTop: "2rem", marginBottom: ".5rem" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#64748b", fontSize: ".875rem", marginBottom: "2.5rem" }}>
          Last updated: June 2026
        </p>

        <Section title="1. Who we are">
          <p>LeadLens AI (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a B2B lead research service. We help businesses identify qualified prospects and generate personalized outreach copy. For questions, contact us at{" "}
            <a href="mailto:martinfgaleano@gmail.com" style={{ color: "#0ea5e9" }}>martinfgaleano@gmail.com</a>.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p>When you use LeadLens AI, we may collect:</p>
          <ul>
            <li><strong>Business information</strong> — company name, description, offer, value proposition, and ideal customer profile that you provide in the onboarding form.</li>
            <li><strong>Contact email</strong> — used to communicate your report and respond to your questions.</li>
            <li><strong>Payment information</strong> — processed by our payment provider (Lemon Squeezy). We do not store your card details.</li>
            <li><strong>Usage data</strong> — basic analytics such as page views and session duration, collected via standard server logs.</li>
          </ul>
        </Section>

        <Section title="3. How we use your information">
          <ul>
            <li>To generate your B2B lead report and outreach sequences.</li>
            <li>To communicate with you about your order, delivery, and support requests.</li>
            <li>To improve the quality and relevance of our service.</li>
            <li>We do not sell your personal data to third parties.</li>
            <li>We do not use your data to send automated emails on your behalf.</li>
          </ul>
        </Section>

        <Section title="4. Lead data and third-party research">
          <p>
            LeadLens AI researches potential leads using publicly available business information
            (company websites, professional directories, and similar public sources). We do not
            purchase or use private data brokers. All lead contact information in your report is
            sourced from public business records.
          </p>
        </Section>

        <Section title="5. Data retention">
          <p>
            We retain your submitted business information and generated reports for up to 90 days
            after delivery, then delete them. You may request earlier deletion by emailing us.
          </p>
        </Section>

        <Section title="6. Third-party services">
          <p>We use the following third-party services to operate LeadLens AI:</p>
          <ul>
            <li><strong>Lemon Squeezy</strong> — payment processing. Their privacy policy governs payment data.</li>
            <li><strong>Vercel</strong> — hosting and deployment.</li>
            <li><strong>Anthropic</strong> — AI processing (when enabled).</li>
          </ul>
        </Section>

        <Section title="7. Your rights">
          <p>
            You may request access to, correction of, or deletion of your personal data at any time
            by emailing{" "}
            <a href="mailto:martinfgaleano@gmail.com" style={{ color: "#0ea5e9" }}>martinfgaleano@gmail.com</a>.
            We will respond within 30 days.
          </p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>
            We may update this policy as our service evolves. We will post the updated date at the
            top of this page. Continued use of LeadLens AI after changes constitutes acceptance of
            the updated policy.
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
