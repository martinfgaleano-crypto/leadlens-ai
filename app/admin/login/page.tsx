"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken, setAdminToken, clearAdminToken, adminFetch } from "@/lib/admin/admin-client";

async function validateToken(token: string): Promise<"ok" | "invalid" | "unreachable"> {
  const res = await adminFetch("/api/admin/auth-check");
  if (res.ok) return "ok";
  if (res.status === 401 || res.status === 403) { clearAdminToken(); return "invalid"; }
  if (res.status === 503) return "unreachable";
  return "invalid";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken]       = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);

  // If already have a stored token, validate it silently and redirect
  useEffect(() => {
    const existing = getAdminToken();
    if (!existing) { setChecking(false); return; }

    adminFetch("/api/admin/auth-check")
      .then((r) => {
        if (r.ok) {
          router.replace("/admin");
        } else {
          clearAdminToken();
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const t = token.trim();
    if (!t) { setError("Token is required."); return; }

    setLoading(true);
    setAdminToken(t);

    const result = await validateToken(t);
    setLoading(false);

    if (result === "ok") {
      router.replace("/admin");
    } else if (result === "unreachable") {
      clearAdminToken();
      setError("Could not reach the server. Make sure the dev server is running.");
    } else {
      clearAdminToken();
      setError("Invalid token. Check your ADMIN_SECRET_TOKEN in .env.local.");
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "-apple-system,sans-serif", color: "#64748b" }}>
        Verifying session...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8fafc",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      padding: "2rem",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "1rem",
        padding: "2.5rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        {/* Brand */}
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
            borderRadius: 10,
            color: "#fff",
            fontWeight: 800,
            fontSize: "1.25rem",
            marginBottom: "0.875rem",
          }}>L</div>
          <h1 style={{ color: "#0f172a", fontSize: "1.25rem", fontWeight: 800, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
            LeadLens Admin
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>Internal operations dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: "1.25rem" }}>
            <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.4rem", letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Admin Token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your ADMIN_SECRET_TOKEN"
              autoComplete="current-password"
              style={{
                display: "block",
                width: "100%",
                padding: "0.75rem 0.875rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.625rem",
                fontSize: "0.9rem",
                color: "#0f172a",
                background: "#fff",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#0ea5e9"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.12)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
            />
          </label>

          {error && (
            <div style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "0.5rem",
              padding: "0.625rem 0.875rem",
              color: "#dc2626",
              fontSize: "0.8rem",
              marginBottom: "1rem",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              display: "block",
              width: "100%",
              padding: "0.8rem",
              background: loading ? "#7dd3fc" : "#0ea5e9",
              color: "#fff",
              border: "none",
              borderRadius: "0.625rem",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Verifying..." : "Enter admin dashboard"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.72rem", marginTop: "1.5rem", marginBottom: 0 }}>
          Token is validated server-side. Never stored in plain text.
        </p>
      </div>
    </div>
  );
}
