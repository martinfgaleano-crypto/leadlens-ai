import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — LeadLens",
  description: "How LeadLens collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a", background: "#fff", lineHeight: 1.6 }}>
      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
        <Link href="/" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".875rem", fontWeight: 600 }}>
          ← Back to LeadLens
        </Link>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-.02em", marginTop: "2rem", marginBottom: ".5rem" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#64748b", fontSize: ".875rem", marginBottom: "2.5rem" }}>
          Last updated: September 2026
        </p>

        <Section title="1. Who we are">
          <p>LeadLens (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) provides <strong>Account Opportunity Intelligence</strong> — web software that helps commercial teams determine which external organizations deserve attention and understand the evidence behind that decision. This policy applies to the LeadLens website and product. For any privacy question or request, contact us at{" "}
            <a href="mailto:operations@leadlensintel.com" style={{ color: "#0ea5e9" }}>operations@leadlensintel.com</a>.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <ul>
            <li><strong>Account information</strong> — your email address, account identifiers, and authentication metadata.</li>
            <li><strong>Commercial context you provide</strong> — your business description, commercial objective, the kinds of organizations that matter to you, target geography and sector, and any free-text you enter and confirm so LeadLens can interpret your request.</li>
            <li><strong>Product data LeadLens generates for you</strong> — Intelligence runs, Opportunity Cases, referenced Evidence, Fit and Timing assessments, Decisions, Compare and Portfolio state, Account Memory, What Changed, Monitor state, reports, and usage records.</li>
            <li><strong>Operational and technical data</strong> — server logs, timestamps, service events, and security-related information used to run and protect the service.</li>
            <li><strong>Support and feedback</strong> — messages you send us and any feedback you choose to share.</li>
          </ul>
          <p>We collect only what is described here; we do not collect categories of data the product does not use.</p>
        </Section>

        <Section title="3. Research and public business information">
          <p>
            To produce Account Opportunity Intelligence, LeadLens researches organizations using
            <strong> publicly available business and company information</strong> (company websites, news, public
            directories, and similar public sources). LeadLens is <strong>not a contact database</strong> and does
            not sell scraped personal-contact data or email lists. Public sources can incidentally include business
            contact details (for example, a company&rsquo;s public press or role information); we use such information only
            to assess account opportunities, never to build or sell contact lists.
          </p>
        </Section>

        <Section title="4. How we use your information">
          <ul>
            <li>Create and manage your account, and enforce entitlements and usage.</li>
            <li>Interpret your commercial context and run Intelligence.</li>
            <li>Research and evaluate organizations, and generate Opportunity Cases, Evidence, Fit/Timing and Decisions.</li>
            <li>Maintain Account Memory and What Changed, and operate Monitor / recurring review.</li>
            <li>Provide reports, product functionality, and support.</li>
            <li>Maintain security, troubleshoot, and improve the reliability and quality of the service.</li>
            <li>Meet applicable legal obligations.</li>
          </ul>
          <p><strong>We do not sell your personal information</strong>, and we do not use your data to send messages or outreach on your behalf.</p>
        </Section>

        <Section title="5. Service providers and international processing">
          <p>
            We use third-party service providers to operate LeadLens, in categories such as cloud hosting and
            database infrastructure, AI/model processing, web research and search, payment processing (Lemon Squeezy),
            and basic analytics/telemetry. These providers process data only to perform services for us. Sharing data
            with a service provider to run the service is not a sale of your data.
          </p>
          <p>
            LeadLens and its providers may process and store information in countries other than your own, including
            the <strong>United States</strong>. Where applicable law requires it, we rely on appropriate safeguards for
            such international processing.
          </p>
        </Section>

        <Section title="6. Data retention">
          <p>
            We retain your account information, commercial context, generated Intelligence (including Account Memory,
            What Changed and Monitor state), reports, and operational records for as long as reasonably necessary to
            provide the service, maintain your account and its history, operate recurring review, maintain security and
            operational records, and satisfy legal obligations. We may delete or anonymize data when it is no longer
            needed for these purposes, or earlier at your request (see your rights below).
          </p>
        </Section>

        <Section title="7. Your rights and choices">
          <p>
            You may request access to, correction of, or deletion of your personal data, and ask questions about how we
            process it, by emailing{" "}
            <a href="mailto:operations@leadlensintel.com" style={{ color: "#0ea5e9" }}>operations@leadlensintel.com</a>.
            We respond to privacy and data-rights requests within the timeframes required by applicable law.
          </p>
        </Section>

        <Section title="8. Regional rights (United States &amp; South America)">
          <p>
            This is one global policy. Depending on where you are, you may have additional rights, which you can exercise
            through the contact above:
          </p>
          <ul>
            <li><strong>United States.</strong> We describe the data we actually collect, why we process it, our use of
              service providers, and reasonable security practices. We do not sell your personal information. We do not
              claim certification under any specific US privacy statute; where a state law applies to you, we will honor
              the rights it grants.</li>
            <li><strong>South America.</strong> You may have rights of notice/transparency, access, correction/updating,
              and deletion or revocation of authorization, subject to applicable local law. You can exercise these rights
              via the contact above and may lodge a complaint with your local data-protection authority. For example, in
              Colombia (Law 1581 of 2012 on personal-data protection) you may access, update, correct, and revoke
              authorization for your personal data, and may contact the Superintendencia de Industria y Comercio. Such
              references are jurisdiction-specific rights, not separate regional products.</li>
          </ul>
        </Section>

        <Section title="9. Security">
          <p>
            We use reasonable technical and organizational measures to protect information. No method of transmission or
            storage is perfectly secure, and we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this policy as the service evolves. We will post the updated date at the top of this page.
            Continued use of LeadLens after changes constitutes acceptance of the updated policy.
          </p>
        </Section>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "2rem", marginTop: "2rem", fontSize: ".82rem", color: "#94a3b8" }}>
          Questions? Email{" "}
          <a href="mailto:operations@leadlensintel.com" style={{ color: "#0ea5e9" }}>operations@leadlensintel.com</a>
          {" · "}
          <Link href="/terms" style={{ color: "#94a3b8" }}>Terms</Link>
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
