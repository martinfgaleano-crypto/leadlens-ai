import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy — LeadLens AI",
  description: "LeadLens AI refund and satisfaction policy for beta batch purchases.",
};

export default function RefundPage() {
  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a", background: "#fff", lineHeight: 1.6 }}>
      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
        <Link href="/demo-pipeline" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".875rem", fontWeight: 600 }}>
          ← Back to LeadLens AI
        </Link>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-.02em", marginTop: "2rem", marginBottom: ".5rem" }}>
          Refund Policy
        </h1>
        <p style={{ color: "#64748b", fontSize: ".875rem", marginBottom: "2.5rem" }}>
          Last updated: June 2026
        </p>

        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: ".875rem", padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
          <p style={{ margin: 0, color: "#0284c7", fontSize: ".9375rem" }}>
            <strong>Summary:</strong> We want you to be satisfied with your LeadLens report. If
            your report was not delivered or did not match your ICP description, contact us within
            7 days and we will make it right — reprocess your batch or issue a refund.
          </p>
        </div>

        <Section title="1. Our commitment">
          <p>
            LeadLens AI is in beta. We stand behind the quality of our research and outreach copy.
            If the report we deliver does not match the ICP and requirements you described in the
            form, we will fix it or refund you.
          </p>
        </Section>

        <Section title="2. Eligible refund scenarios">
          <ul>
            <li><strong>Non-delivery</strong> — Your report was not delivered within 72 hours of payment and we did not communicate a delay.</li>
            <li><strong>Significant ICP mismatch</strong> — The leads in your report do not match the target customer, industry, or company size you described in your order form.</li>
            <li><strong>Technical failure</strong> — The report file is corrupted, unreadable, or missing key sections (email copy, qualification scores).</li>
          </ul>
        </Section>

        <Section title="3. Non-refundable scenarios">
          <ul>
            <li>You changed your mind after the report was delivered.</li>
            <li>Leads did not reply to your outreach (we cannot control reply rates).</li>
            <li>You provided inaccurate or vague ICP information in the form.</li>
            <li>More than 7 days have passed since delivery.</li>
          </ul>
        </Section>

        <Section title="4. How to request a refund">
          <p>
            Email{" "}
            <a href="mailto:martinfgaleano@gmail.com" style={{ color: "#0ea5e9" }}>martinfgaleano@gmail.com</a>{" "}
            with:
          </p>
          <ul>
            <li>Your order email address</li>
            <li>The reason for your refund request</li>
            <li>Any relevant details (e.g., examples of leads that did not match your ICP)</li>
          </ul>
          <p>
            We will respond within 2 business days. If your request is valid, we will either
            reprocess your batch at no charge or issue a full refund to your original payment method.
          </p>
        </Section>

        <Section title="5. Processing time">
          <p>
            Approved refunds are processed within 5–10 business days depending on your payment
            provider and bank.
          </p>
        </Section>

        <Section title="6. Contact">
          <p>
            For any questions about this policy, email{" "}
            <a href="mailto:martinfgaleano@gmail.com" style={{ color: "#0ea5e9" }}>martinfgaleano@gmail.com</a>.
          </p>
        </Section>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "2rem", marginTop: "2rem", fontSize: ".82rem", color: "#94a3b8" }}>
          Questions? Email{" "}
          <a href="mailto:martinfgaleano@gmail.com" style={{ color: "#0ea5e9" }}>martinfgaleano@gmail.com</a>
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
