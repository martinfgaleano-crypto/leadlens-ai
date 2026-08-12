import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Canonical production domain. Env-driven so preview/prod resolve correctly;
// fallback is the production domain (leadlensintel.com), NOT the Vercel URL.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://leadlensintel.com").replace(/\/$/, "");
const OG_TITLE = "LeadLens — Account Opportunity Intelligence for B2B";
const OG_DESC =
  "Tell us your ideal customer. LeadLens tells you which B2B accounts to prioritize now, why they matter, and the public evidence behind each opportunity — account-level intelligence, not a contact list.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: OG_TITLE,
  description: OG_DESC,
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    url: APP_URL,
    siteName: "LeadLens",
    type: "website",
    images: [
      {
        url: `${APP_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: "LeadLens — Account Opportunity Intelligence for B2B",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
    images: [`${APP_URL}/api/og`],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
