import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://leadlensintel.com").replace(/\/$/, "");

// Public marketing pages are crawlable; app/admin/API surfaces are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/dashboard", "/results", "/upload", "/login", "/signup", "/start"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
