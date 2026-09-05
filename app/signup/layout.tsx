import type { Metadata } from "next";

// Commercial-private surface: not an SEO acquisition page. Public pages (/, /get-started, /pricing)
// stay indexable; this route is marked noindex so only the public funnel entry is discoverable.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function NoindexLayout({ children }: { children: React.ReactNode }) {
  return children;
}
