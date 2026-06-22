"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  email: string;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function DashboardShell({ email, onLogout, children }: Props) {
  const pathname = usePathname() ?? "";

  return (
    <div style={S.root}>
      <aside style={S.sidebar}>
        {/* Brand */}
        <div style={S.brand}>
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <span style={S.brandName}>LeadLens</span>
            <span style={S.brandTag}>AI</span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={S.nav}>
          <div style={S.navSection}>Workspace</div>
          <NavItem href="/dashboard"          label="Dashboard"     active={pathname === "/dashboard"} />
          <NavItem href="/dashboard/icp"      label="ICP Builder"   active={pathname.startsWith("/dashboard/icp")} />
          <NavItem href="/dashboard/searches"      label="Lead Searches"  active={pathname.startsWith("/dashboard/searches")} />
          <NavItem href="/dashboard/notifications" label="Notifications"  active={pathname.startsWith("/dashboard/notifications")} />
          <NavItem href="/dashboard/account"       label="Account"        active={false} disabled />
        </nav>

        {/* Footer */}
        <div style={S.sidebarFooter}>
          <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email}
          </div>
          <button onClick={onLogout} style={S.logoutBtn}>Log out</button>
        </div>
      </aside>

      <main style={S.main}>{children}</main>
    </div>
  );
}

function NavItem({ href, label, active, disabled }: { href: string; label: string; active: boolean; disabled?: boolean }) {
  if (disabled) {
    return (
      <div style={{ ...S.navLink, color: "#475569", cursor: "default", opacity: 0.5 }}>
        {label}
        <span style={{ fontSize: "0.6rem", marginLeft: "0.4rem", opacity: 0.7 }}>soon</span>
      </div>
    );
  }
  return (
    <Link href={href} style={{ ...S.navLink, ...(active ? S.navLinkActive : {}) }}>
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
