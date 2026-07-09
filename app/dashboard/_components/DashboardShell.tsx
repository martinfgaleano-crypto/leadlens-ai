"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

// ─── Customer Workspace Shell ─────────────────────────────────────────────────
// Premium top-nav workspace — a private continuation of the public site, NOT
// an admin panel. Light gradient background, horizontal navigation, customer
// language (Monitors, not Searches). Same props as before, so every dashboard
// page inherits the new shell without changes.

interface Props {
  email: string;
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard",               label: "Overview",      match: (p: string) => p === "/dashboard" },
  { href: "/dashboard/searches",      label: "Monitors",      match: (p: string) => p.startsWith("/dashboard/searches") },
  { href: "/dashboard/icp",           label: "Target Profiles", match: (p: string) => p.startsWith("/dashboard/icp") },
  { href: "/dashboard/notifications", label: "Notifications", match: (p: string) => p.startsWith("/dashboard/notifications") },
];

export default function DashboardShell({ email, onLogout, children }: Props) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const brand = (
    <Link href="/dashboard" style={{ textDecoration: "none", display: "inline-flex", alignItems: "baseline", gap: "0.35rem" }}>
      <span style={{ fontWeight: 800, fontSize: "1.15rem", letterSpacing: "-0.03em", color: "#0f172a" }}>
        Lead<span style={{ color: "#0ea5e9" }}>Lens</span>
      </span>
      <span style={{ color: "#94a3b8", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Workspace
      </span>
    </Link>
  );

  const navLinks = NAV.map(item => {
    const active = item.match(pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        style={{
          textDecoration: "none",
          fontSize: "0.85rem",
          fontWeight: active ? 700 : 500,
          color: active ? "#0f172a" : "#64748b",
          padding: "0.4rem 0.15rem",
          borderBottom: active ? "2px solid #0ea5e9" : "2px solid transparent",
          whiteSpace: "nowrap" as const,
        }}
      >
        {item.label}
      </Link>
    );
  });

  const accountArea = (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span style={{ color: "#94a3b8", fontSize: "0.75rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {email}
      </span>
      <button
        onClick={onLogout}
        style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "0.45rem", padding: "0.35rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
      >
        Sign out
      </button>
    </div>
  );

  const pageBackground: React.CSSProperties = {
    minHeight: "100vh",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    background: "linear-gradient(175deg, #f0f9ff 0%, #f8fafc 220px, #f8fafc 100%)",
  };

  if (isMobile) {
    return (
      <div style={pageBackground} data-workspace-version="premium-workspace-v0">
        <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e8f4fd" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem" }}>
            {brand}
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              style={{ background: "transparent", border: "none", color: "#0f172a", fontSize: "1.25rem", cursor: "pointer", padding: "0.3rem 0.5rem", lineHeight: 1, fontFamily: "inherit" }}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
          {menuOpen && (
            <div style={{ padding: "0.5rem 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.35rem", borderTop: "1px solid #f1f5f9" }}>
              {NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    textDecoration: "none", padding: "0.55rem 0.75rem", borderRadius: "0.5rem",
                    fontSize: "0.9rem",
                    fontWeight: item.match(pathname) ? 700 : 500,
                    color: item.match(pathname) ? "#0f172a" : "#64748b",
                    background: item.match(pathname) ? "#e0f2fe" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              ))}
              <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "0.5rem", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#94a3b8", fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{email}</span>
                <button onClick={onLogout} style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "0.45rem", padding: "0.35rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </header>
        <main style={{ padding: "1.25rem 1rem 3rem", maxWidth: "72rem", margin: "0 auto" }}>{children}</main>
      </div>
    );
  }

  return (
    <div style={pageBackground} data-workspace-version="premium-workspace-v0">
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e8f4fd", boxShadow: "0 1px 0 #e8f4fd" }}>
        <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "0.8rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2.25rem", minWidth: 0 }}>
            {brand}
            <nav style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              {navLinks}
            </nav>
          </div>
          {accountArea}
        </div>
      </header>
      <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>{children}</main>
    </div>
  );
}
