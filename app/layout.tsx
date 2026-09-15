import type { Metadata } from "next";
import { Inter, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Type system (Landing Experience Refinement V1): a modern commercial-software voice.
// Display = Manrope (geometric-humanist, professional, distinctive — not editorial, not the
// Inter/Space-Grotesk default). Body = Inter. Metadata/dates = IBM Plex Mono (used sparingly).
const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Manrope({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"], display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"], display: "swap" });

// Canonical production domain. Env-driven so preview/prod resolve correctly;
// fallback is the production domain (leadlensintel.com), NOT the Vercel URL.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://leadlensintel.com").replace(/\/$/, "");
const OG_TITLE = "LeadLens — Commercial Intelligence";
const OG_DESC =
  "LeadLens researches and compares companies so teams can focus commercial effort where it matters most, with evidence and uncertainty behind every decision.";

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
        alt: "LeadLens — Commercial Intelligence",
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
      <body className={`${inter.variable} ${display.variable} ${mono.variable} ${inter.className}`}>{children}</body>
    </html>
  );
}
