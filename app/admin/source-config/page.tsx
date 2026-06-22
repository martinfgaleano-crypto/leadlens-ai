"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface WeightRow {
  id:          string;
  source_name: string;
  weight:      number;
  active:      boolean;
  priority:    number;
  created_at:  string;
}

interface RowState extends WeightRow {
  saving:  boolean;
  saved:   boolean;
  error:   string | null;
  // local editable copies
  _weight:   string;
  _priority: string;
  _active:   boolean;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const SOURCE_LABELS: Record<string, string> = {
  apollo:           "Apollo.io",
  google_maps:      "Google Maps",
  linkedin:         "LinkedIn",
  directories:      "Directories",
  crunchbase:       "Crunchbase",
  manual:           "Manual Datasets",
  company_websites: "Company Websites",
};

function statusLabel(row: RowState): { text: string; color: string; bg: string } {
  if (row.active) return { text: "Active",   color: "#16a34a", bg: "#f0fdf4" };
  return              { text: "Inactive", color: "#94a3b8", bg: "#f1f5f9" };
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

const S = {
  card:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" } as React.CSSProperties,
  table:   { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.855rem" },
  th:      { textAlign: "left" as const, padding: "0.65rem 1rem", fontWeight: 700, color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "2px solid #e2e8f0" },
  td:      { padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" as const },
  input:   { padding: "0.4rem 0.65rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", fontSize: "0.85rem", color: "#1e293b", width: 72, outline: "none", textAlign: "right" as const } as React.CSSProperties,
  saveBtn: (dirty: boolean, saving: boolean) => ({
    padding: "0.35rem 0.9rem", borderRadius: "0.4rem", fontSize: "0.78rem", fontWeight: 700, cursor: dirty && !saving ? "pointer" : "not-allowed",
    border: "none", background: dirty && !saving ? "#0ea5e9" : "#e2e8f0",
    color: dirty && !saving ? "#fff" : "#94a3b8", fontFamily: "inherit",
  } as React.CSSProperties),
};

export default function SourceConfigPage() {
  const [rows, setRows]       = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    adminFetch("/api/admin/source-weights")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Failed to load")))
      .then((d: { weights: WeightRow[] }) => {
        setRows(d.weights.map(w => ({
          ...w,
          saving:    false,
          saved:     false,
          error:     null,
          _weight:   String(w.weight),
          _priority: String(w.priority),
          _active:   w.active,
        })));
      })
      .catch(() => setLoadErr("Failed to load source weights."))
      .finally(() => setLoading(false));
  }, []);

  function isDirty(row: RowState): boolean {
    return (
      parseFloat(row._weight)   !== row.weight  ||
      parseInt(row._priority, 10) !== row.priority ||
      row._active               !== row.active
    );
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch, saved: false, error: null } : r));
  }

  async function saveRow(row: RowState) {
    const weight   = parseFloat(row._weight);
    const priority = parseInt(row._priority, 10);

    if (isNaN(weight)   || weight < 0 || weight > 10) {
      updateRow(row.id, { error: "Weight must be 0–10." }); return;
    }
    if (isNaN(priority) || !Number.isFinite(priority)) {
      updateRow(row.id, { error: "Priority must be an integer." }); return;
    }

    updateRow(row.id, { saving: true });

    try {
      const res = await adminFetch(`/api/admin/source-weights/${row.id}`, {
        method: "PATCH",
        body:   JSON.stringify({ active: row._active, weight, priority }),
      });
      const data = await res.json() as { weight?: WeightRow; error?: string };

      if (!res.ok) {
        updateRow(row.id, { saving: false, error: data.error ?? "Save failed." });
        return;
      }

      // Commit persisted values
      const saved = data.weight!;
      setRows(prev => prev.map(r => r.id === row.id ? {
        ...r,
        weight:    saved.weight,
        active:    saved.active,
        priority:  saved.priority,
        _weight:   String(saved.weight),
        _priority: String(saved.priority),
        _active:   saved.active,
        saving:    false,
        saved:     true,
        error:     null,
      } : r));
    } catch {
      updateRow(row.id, { saving: false, error: "Network error." });
    }
  }

  return (
    <AdminLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Source Configuration</h1>
          <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
            Control which sources are active and how leads are allocated across them.
          </p>
        </div>
      </div>

      {loadErr && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.75rem 1rem", color: "#dc2626", marginBottom: "1rem", fontSize: "0.85rem" }}>
          {loadErr}
        </div>
      )}

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Source</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Active</th>
              <th style={S.th}>Weight</th>
              <th style={S.th}>Priority</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: "2rem" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: "2rem" }}>No source weights found. Run migration 012 in Supabase.</td></tr>
            ) : (
              rows.map(row => {
                const dirty   = isDirty(row);
                const { text: stText, color: stColor, bg: stBg } = statusLabel(row);
                return (
                  <tr key={row.id}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    {/* Source name */}
                    <td style={S.td}>
                      <span style={{ fontWeight: 700, color: "#1e293b" }}>
                        {SOURCE_LABELS[row.source_name] ?? row.source_name}
                      </span>
                      <span style={{ display: "block", fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.1rem" }}>
                        {row.source_name}
                      </span>
                    </td>

                    {/* Status badge (reflects current _active) */}
                    <td style={S.td}>
                      <span style={{ background: stBg, color: stColor, fontWeight: 700, fontSize: "0.68rem", padding: "0.2rem 0.55rem", borderRadius: "1rem", border: `1px solid ${stColor}25` }}>
                        {stText}
                      </span>
                    </td>

                    {/* Active toggle */}
                    <td style={S.td}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={row._active}
                          onChange={e => updateRow(row.id, { _active: e.target.checked })}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#0ea5e9" }}
                        />
                      </label>
                    </td>

                    {/* Weight */}
                    <td style={S.td}>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={row._weight}
                        onChange={e => updateRow(row.id, { _weight: e.target.value })}
                        style={S.input}
                      />
                    </td>

                    {/* Priority */}
                    <td style={S.td}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row._priority}
                        onChange={e => updateRow(row.id, { _priority: e.target.value })}
                        style={S.input}
                      />
                    </td>

                    {/* Save */}
                    <td style={{ ...S.td, minWidth: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <button
                          disabled={!dirty || row.saving}
                          onClick={() => saveRow(row)}
                          style={S.saveBtn(dirty, row.saving)}
                        >
                          {row.saving ? "Saving…" : "Save"}
                        </button>
                        {row.saved && !dirty && (
                          <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600 }}>Saved</span>
                        )}
                        {row.error && (
                          <span style={{ fontSize: "0.72rem", color: "#dc2626" }}>{row.error}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
        Weight controls lead allocation share (higher = more leads assigned). Priority determines execution order.
        Only sources with active providers will produce results — inactive providers return empty arrays.
      </p>
    </AdminLayout>
  );
}
