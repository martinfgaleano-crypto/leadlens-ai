"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface Props {
  email: string;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function DashboardShell({ email, onLogout, children }: Props) {
  const pathname   = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close drawer on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const close = () => setMenuOpen(false);

  const sidebarContent = (
    <>
      <div style={S.brand}>
        <Link href="/dashboard" style={{ textDecoration: "none" }} onClick={close}>
          <span style={S.brandName}>LeadLens</span>
          <span style={S.brandTag}>AI</span>
        </Link>
      </div>
      <nav style={S.nav}>
        <div style={S.navSection}>Workspace</div>
        <NavItem href="/dashboard"               label="Dashboard"     active={pathname === "/dashboard"}                       onClick={close} />
        <NavItem href="/dashboard/icp"           label="ICP Builder"   active={pathname.startsWith("/dashboard/icp")}           onClick={close} />
        <NavItem href="/dashboard/searches"      label="Lead Searches" active={pathname.startsWith("/dashboard/searches")}      onClick={close} />
        <NavItem href="/dashboard/notifications" label="Notifications" active={pathname.startsWith("/dashboard/notifications")} onClick={close} />
        <NavItem href="/dashboard/account"       label="Account"       active={false} disabled onClick={close} />
      </nav>
      <div style={S.sidebarFooter}>
        <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email}
        </div>
        <button onClick={onLogout} style={S.logoutBtn}>Log out</button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: "#f8fafc" }}>
        {/* Mobile top bar */}
        <div style={S.topBar}>
          <Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={S.brandName}>LeadLens</span>
            <span style={S.brandTag}>AI</span>
          </Link>
          <button onClick={() => setMenuOpen(o => !o)} style={S.hamburger} aria-label="Toggle menu">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Backdrop */}
        {menuOpen && <div style={S.backdrop} onClick={close} />}

        {/* Slide-out drawer */}
        <div style={{ ...S.drawer, transform: menuOpen ? "translateX(0)" : "translateX(-100%)" }}>
          {sidebarContent}
        </div>

        <main style={S.mobileMain}>{children}</main>
      </div>
    );
  }

  // Desktop
  return (
    <div style={S.root}>
      <aside style={S.sidebar}>{sidebarContent}</aside>
      <main style={S.main}>{children}</main>
    </div>
  );
}

function NavItem({
  href, label, active, disabled, onClick,
}: {
  href: string; label: string; active: boolean; disabled?: boolean; onClick?: () => void;
}) {
  if (disabled) {
    return (
      <div style={{ ...S.navLink, color: "#475569", cursor: "default", opacity: 0.5 }}>
        {label}
        <span style={{ fontSize: "0.6rem", marginLeft: "0.4rem", opacity: 0.7 }}>soon</span>
      </div>
    );
  }
  return (
    <Link href={href} onClick={onClick} style={{ ...S.navLink, ...(active ? S.navLinkActive : {}) }}>
      {label}
    </Link>
  );
}

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
  } as React.CSSProperties,
  hamburger: {
    background: "transparent",
    border: "none",
    color: "#f0f9ff",
    fontSize: "1.3rem",
    cursor: "pointer",
    padding: "0.35rem 0.5rem",
    lineHeight: 1,
    fontFamily: "inherit",
  } as React.CSSProperties,
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
  } as React.CSSProperties,
  brand: {
    padding: "0 1.25rem 1.5rem",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: "1rem",
  } as React.CSSProperties,
  brandName: {
    color: "#f0f9ff",
    fontWeight: 800,
    fontSize: "1.05rem",
    letterSpacing: "-0.02em",
  } as React.CSSProperties,
  brandTag: {
    color: "#38bdf8",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    marginLeft: "0.3rem",
  },
  nav: { flex: 1, padding: "0 0.75rem" } as React.CSSProperties,
  navSection: {
    color: "#475569",
    fontSize: "0.625rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    padding: "0.5rem 0.5rem 0.25rem",
    marginTop: "0.5rem",
  },
  navLink: {
    display: "block",
    padding: "0.5rem 0.75rem",
    borderRadius: "0.5rem",
    color: "#94a3b8",
    fontWeight: 400,
    fontSize: "0.875rem",
    textDecoration: "none",
    background: "transparent",
    borderLeft: "2px solid transparent",
    marginBottom: "0.125rem",
  } as React.CSSProperties,
  navLinkActive: {
    color: "#f0f9ff",
    fontWeight: 600,
    background: "rgba(14,165,233,0.15)",
    borderLeft: "2px solid #0ea5e9",
  } as React.CSSProperties,
  sidebarFooter: {
    padding: "1rem 1.25rem 0.5rem",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginTop: "auto",
  } as React.CSSProperties,
  logoutBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#94a3b8",
    borderRadius: "0.4rem",
    padding: "0.4rem 0.75rem",
    fontSize: "0.75rem",
    cursor: "pointer",
    width: "100%",
    textAlign: "left" as const,
    fontFamily: "inherit",
  },
  main: {
    marginLeft: 220,
    flex: 1,
    padding: "2rem 2.5rem",
    maxWidth: "calc(100vw - 220px)",
  } as React.CSSProperties,
};
