import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LeadLens AI — Qualified B2B leads + personalized outreach, delivered in 48h",
  description:
    "LeadLens researches qualified B2B leads that match your offer and writes personalized emails, DMs, and follow-ups for each one. You review and send.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
