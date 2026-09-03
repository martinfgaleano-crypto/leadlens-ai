import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — LeadLens",
  description: "Terms and conditions for using LeadLens.",
};

export default function TermsPage() {
  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a", background: "#fff", lineHeight: 1.6 }}>
      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
        <Link href="/" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".875rem", fontWeight: 600 }}>
          ← Back to LeadLens
        </Link>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-.02em", marginTop: "2rem", marginBottom: ".5rem" }}>
          Terms of Service
        </h1>
        <p style={{ color: "#64748b", fontSize: ".875rem", marginBottom: "2.5rem" }}>
          Last updated: September 2026
        </p>

        <Section title="1. The service">
          <p>
            LeadLens provides <strong>Account Opportunity Intelligence</strong> through web software and related digital
            outputs. Depending on your access, outputs may include researched organizations, Opportunity Cases,
            referenced Evidence, Fit and Timing assessments, Decisions, portfolio analysis and comparison, Monitor /
            recurring review, and Account Memory / What Changed. LeadLens helps you decide which accounts deserve
            attention; it does not send outreach and does not deliver contact lists or email databases.
          </p>
        </Section>

        <Section title="2. Acceptance">
          <p>
            By creating an account, purchasing, or using LeadLens, you agree to these Terms and to our{" "}
            <Link href="/privacy" style={{ color: "#0ea5e9" }}>Privacy Policy</Link>. If you do not agree, do not use
            the service.
          </p>
        </Section>

        <Section title="3. Accounts">
          <p>
            You must provide accurate information, keep your credentials secure, and are responsible for activity under
            your account. Access is for your organization&rsquo;s internal commercial and business-development use.
          </p>
        </Section>

        <Section title="4. Permitted and prohibited use">
          <p>Use LeadLens for legitimate internal commercial decision support. You will not:</p>
          <ul>
            <li>use the service for unlawful activity, or to violate privacy, anti-spam, or other applicable laws;</li>
            <li>attack, disrupt, or attempt unauthorized access to the service or its systems;</li>
            <li>resell or redistribute access or outputs without our permission;</li>
            <li>present LeadLens outputs as guaranteed facts where validation is required.</li>
          </ul>
        </Section>

        <Section title="5. No outcome guarantee">
          <p>
            LeadLens supports commercial judgment; it does not guarantee buyer intent, responses, meetings,
            transactions, customers, revenue, procurement, or any commercial outcome. A &ldquo;Prioritize&rdquo; decision
            is not a guarantee of a sale, and a &ldquo;Hold&rdquo; is a valid, useful result.
          </p>
        </Section>

        <Section title="6. Information limitations and your responsibility">
          <p>
            LeadLens relies substantially on public/business information and automated research and reasoning.
            Information may be incomplete, delayed, unavailable, contradictory, or updated later, and may require your
            validation. You remain responsible for your commercial decisions, for validating outputs before acting, and
            for conducting any outreach lawfully and in compliance with applicable laws.
          </p>
        </Section>

        <Section title="7. No professional advice">
          <p>
            LeadLens does not provide legal, financial, investment, tax, or other regulated professional advice. Its
            outputs are commercial decision-support information only.
          </p>
        </Section>

        <Section title="8. Your content and our intellectual property">
          <p>
            You retain ownership of the commercial context and information you provide. You grant LeadLens a limited
            license to process that information to interpret your context, run Intelligence, store relevant state and
            history, operate the service, and provide support. We do not claim ownership of your content. LeadLens
            retains all rights in its software, product, methods, interfaces, and trademarks; you receive a limited right
            to use the service and its outputs according to your access. We may improve the service using anonymized,
            aggregated usage patterns.
          </p>
        </Section>

        <Section title="9. Availability and changes">
          <p>
            The service is provided on an evolving basis and may include maintenance, product changes, beta/evaluation
            features, and third-party provider interruptions. We do not promise uninterrupted service. We may suspend or
            terminate access for misuse, security risk, legal violation, or non-payment where payment applies.
          </p>
        </Section>

        <Section title="10. Payment">
          <p>
            Where paid products are available, prices are in USD and are shown at the point of purchase. LeadLens
            currently offers one-time digital Intelligence products; paid products or subscription plans are described as
            &ldquo;available&rdquo; only where and when they are actually offered. See our{" "}
            <Link href="/refund" style={{ color: "#0ea5e9" }}>Refund Policy</Link>. Invited evaluation or pilot access may
            be provided temporarily and does not create a permanent free entitlement; functionality and access terms may
            change, and future paid plans may differ.
          </p>
        </Section>

        <Section title="11. Limitation of liability">
          <p>
            LeadLens is provided &ldquo;as is.&rdquo; To the maximum extent permitted by law, our total liability is
            limited to the amount you paid for the service in the preceding period, and we are not liable for indirect,
            incidental, or consequential damages.
          </p>
        </Section>

        <Section title="12. Changes and contact">
          <p>
            We may update these Terms as the service evolves; we will post the updated date above, and continued use
            constitutes acceptance. Questions? Email{" "}
            <a href="mailto:operations@leadlensintel.com" style={{ color: "#0ea5e9" }}>operations@leadlensintel.com</a>.
          </p>
        </Section>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "2rem", marginTop: "2rem", fontSize: ".82rem", color: "#94a3b8" }}>
          Questions? Email{" "}
          <a href="mailto:operations@leadlensintel.com" style={{ color: "#0ea5e9" }}>operations@leadlensintel.com</a>
          {" · "}
          <Link href="/privacy" style={{ color: "#94a3b8" }}>Privacy</Link>
          {" · "}
          <Link href="/refund" style={{ color: "#94a3b8" }}>Refund Policy</Link>
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
