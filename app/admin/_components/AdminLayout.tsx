"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getAdminToken, clearAdminToken } from "@/lib/admin/admin-client";


const S = {
  root: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    background: "#f8fafc",
  } as React.CSSProperties,
  sidebar: {
    width: 220,
    minWidth: 220,
    background: "#0f172a",
    display: "flex",
    flexDirection: "column" as const,
    padding: "1.5rem 0",
    position: "fixed" as const,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 10,
  },
  brand: {
    padding: "0 1.25rem 1.5rem",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: "1rem",
  },
  brandName: {
    color: "#f0f9ff",
    fontWeight: 800,
    fontSize: "1.05rem",
    letterSpacing: "-0.02em",
    display: "block",
  },
  brandTag: {
    color: "#38bdf8",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    marginTop: "0.15rem",
    display: "block",
  },
  nav: { flex: 1, padding: "0 0.75rem" },
  navSection: {
    color: "#475569",
    fontSize: "0.625rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    padding: "0.5rem 0.5rem 0.25rem",
    marginTop: "0.5rem",
  },
  footer: {
    padding: "1rem 1.25rem 0.5rem",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginTop: "auto",
  },
  main: {
    marginLeft: 220,
    flex: 1,
    minHeight: "100vh",
    padding: "2rem 2.5rem",
    maxWidth: "calc(100vw - 220px)",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    color: "#64748b",
    fontFamily: "-apple-system,sans-serif",
    fontSize: "0.9rem",
  },
  topBar: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    background: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 1rem",
    zIndex: 40,
  },
  hamburger: {
    background: "transparent",
    border: "none",
    color: "#f0f9ff",
    fontSize: "1.3rem",
    cursor: "pointer",
    padding: "0.35rem 0.5rem",
    lineHeight: 1,
    fontFamily: "inherit",
  },
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 45,
  },
  drawer: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    background: "#0f172a",
    display: "flex",
    flexDirection: "column" as const,
    padding: "1.5rem 0",
    zIndex: 50,
    transition: "transform 0.25s ease",
    overflowY: "auto" as const,
  },
  mobileMain: {
    marginTop: 52,
    padding: "1.25rem 1rem",
    minHeight: "calc(100vh - 52px)",
  },
} as const;

function NavLink({ href, label, active, onClick }: { href: string; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "block",
        padding: "0.5rem 0.75rem",
        borderRadius: "0.5rem",
        color: active ? "#f0f9ff" : "#94a3b8",
        fontWeight: active ? 600 : 400,
        fontSize: "0.875rem",
        textDecoration: "none",
        background: active ? "rgba(14,165,233,0.15)" : "transparent",
        borderLeft: active ? "2px solid #0ea5e9" : "2px solid transparent",
        marginBottom: "0.125rem",
        transition: "all 0.1s",
      }}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady]       = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace("/admin/login");
    } else {
      setReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  function handleLogout() {
    clearAdminToken();
    router.replace("/admin/login");
  }

  if (!ready) {
    return <div style={S.loading}>Loading...</div>;
  }

  const nav = [
    { href: "/admin",               label: "Overview" },
    { href: "/admin/beta-readiness", label: "Beta Readiness" },
    { href: "/admin/onboarding",    label: "Onboarding" },
    { href: "/admin/orders",        label: "Orders" },
    { href: "/admin/jobs",          label: "Jobs" },
    { href: "/admin/searches",      label: "Searches" },
    { href: "/admin/monitor-runs",  label: "Monitor Ops" },
    { href: "/admin/vault-foundation", label: "Vault Foundation" },
    { href: "/admin/lead-hunter",   label: "Lead Hunter" },
    { href: "/admin/vault-report-bridge", label: "Vault Bridge" },
    { href: "/admin/vault",         label: "Vault" },
    { href: "/admin/companies",     label: "Companies" },
    { href: "/admin/credits",       label: "Credits" },
    { href: "/admin/feedback",            label: "Feedback Analytics" },
    { href: "/admin/snapshots",           label: "Snapshots" },
    { href: "/admin/analytics",          label: "Analytics" },
    { href: "/admin/notifications",      label: "Notifications" },
    { href: "/admin/vault-performance",  label: "Vault Performance" },
    { href: "/admin/vault-candidates",   label: "Vault Candidates" },
    { href: "/admin/sources",            label: "Sources" },
    { href: "/admin/source-config", label: "Source Config" },
    { href: "/admin/source-runs",   label: "Source Runs" },
    { href: "/admin/settings",      label: "Settings" },
  ];

  const close = () => setMenuOpen(false);

  const sidebarContent = (
    <>
      <div style={S.brand}>
        <span style={S.brandName}>LeadLens</span>
        <span style={S.brandTag}>Admin — Internal</span>
      </div>
      <nav style={S.nav}>
        <div style={S.navSection}>Operations</div>
        {nav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)}
            onClick={close}
          />
        ))}
      </nav>
      <div style={S.footer}>
        <Link href="/" style={{ display: "block", color: "#475569", fontSize: "0.75rem", marginBottom: "0.5rem", textDecoration: "none" }}>
          ← Public site
        </Link>
        <button
          onClick={handleLogout}
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", borderRadius: "0.4rem", padding: "0.4rem 0.75rem", fontSize: "0.75rem", cursor: "pointer", width: "100%", textAlign: "left" }}
        >
          Logout
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: "#f8fafc" }}>
        <div style={S.topBar}>
          <span style={{ ...S.brandName, fontSize: "0.95rem" }}>LeadLens Admin</span>
          <button onClick={() => setMenuOpen(o => !o)} style={S.hamburger} aria-label="Toggle menu">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
        {menuOpen && <div style={S.backdrop} onClick={close} />}
        <div style={{ ...S.drawer, transform: menuOpen ? "translateX(0)" : "translateX(-100%)" }}>
          {sidebarContent}
        </div>
        <main style={S.mobileMain}>{children}</main>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <aside style={S.sidebar}>{sidebarContent}</aside>
      <main style={S.main}>{children}</main>
    </div>
  );
}
