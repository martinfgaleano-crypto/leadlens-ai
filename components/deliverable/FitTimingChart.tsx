// Fit × Timing — the signature portfolio visual. Positions each evaluated account by the STRENGTH of
// its commercial fit (x) against the STRENGTH of its timing signal (y), coloured by canonical decision.
// It fabricates nothing: both axes are the ordinal strengths Research already produced (Strong/Moderate/
// Limited); accounts missing either dimension are listed honestly as "not positioned" rather than placed
// at a made-up coordinate. Colour is never the only signal — every point is labelled and the axes named.
"use client";
import type { AccountBriefVM, DecisionState } from "@/lib/deliverable/deliverable-view-model";
import { DECISION_TOKENS } from "@/lib/deliverable/deliverable-view-model";

const RANK: Record<string, number> = { Limited: 1, Moderate: 2, Strong: 3 };
const strengthOf = (a: AccountBriefVM, label: string): number | null => {
  const s = a.dimensions.find((d) => d.label === label)?.value ?? null;
  return s && s in RANK ? RANK[s] : null;
};

export default function FitTimingChart({ accounts, es }: { accounts: AccountBriefVM[]; es: boolean }) {
  const placed = accounts
    .map((a) => ({ a, fx: strengthOf(a, es ? "Encaje" : "Fit") ?? strengthOf(a, "Fit"), ty: strengthOf(a, es ? "Momento" : "Timing") ?? strengthOf(a, "Timing") }))
    .filter((p): p is { a: AccountBriefVM; fx: number; ty: number } => p.fx != null && p.ty != null);
  const missing = accounts.filter((a) => !placed.some((p) => p.a.id === a.id));
  if (placed.length === 0) return null;

  // Geometry (viewBox units). Square plot with padded axes.
  const W = 340, H = 240, padL = 34, padB = 28, padT = 10, padR = 20;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xFor = (v: number) => padL + ((v - 1) / 2) * plotW;       // 1..3 → left..right
  const yFor = (v: number) => padT + (1 - (v - 1) / 2) * plotH;   // 1..3 → bottom..top (inverted)
  const axis = "#94a3b8", grid = "#eef2f6", ink = "#0f172a", mute = "#64748b";
  const xLabels = es ? ["Limitado", "Moderado", "Fuerte"] : ["Limited", "Moderate", "Strong"];

  // Spread points that land on the same (fx,ty) cell so they don't overlap.
  const byCell = new Map<string, number>();
  const nodes = placed.map((p) => {
    const key = `${p.fx}-${p.ty}`;
    const n = byCell.get(key) ?? 0; byCell.set(key, n + 1);
    const ring = n === 0 ? { dx: 0, dy: 0 } : { dx: Math.cos(n) * (8 + n), dy: Math.sin(n) * (8 + n) };
    const dec = DECISION_TOKENS[p.a.decision as DecisionState];
    return { ...p, cx: xFor(p.fx) + ring.dx, cy: yFor(p.ty) + ring.dy, color: dec.dot, label: (p.a.company || "").slice(0, 22) };
  });

  return (
    <figure className="dlv-card" style={{ margin: 0 }}>
      <figcaption className="dlv-label" style={{ marginBottom: 8 }}>{es ? "Encaje × Momento" : "Fit × Timing"}</figcaption>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={es ? "Cuentas posicionadas por fuerza de encaje y de momento" : "Accounts positioned by fit strength and timing strength"} style={{ width: "100%", maxWidth: 380, height: "auto" }}>
          {/* grid */}
          {[1, 2, 3].map((v) => <line key={`gx${v}`} x1={xFor(v)} y1={padT} x2={xFor(v)} y2={padT + plotH} stroke={grid} strokeWidth={1} />)}
          {[1, 2, 3].map((v) => <line key={`gy${v}`} x1={padL} y1={yFor(v)} x2={padL + plotW} y2={yFor(v)} stroke={grid} strokeWidth={1} />)}
          {/* axes */}
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={axis} strokeWidth={1} />
          <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={axis} strokeWidth={1} />
          {/* x tick labels */}
          {[1, 2, 3].map((v, i) => <text key={`xl${v}`} x={xFor(v)} y={H - 14} textAnchor="middle" fontSize={8} fill={mute}>{xLabels[i]}</text>)}
          <text x={padL + plotW / 2} y={H - 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={ink}>{es ? "Encaje →" : "Fit →"}</text>
          {/* y tick labels */}
          {[1, 2, 3].map((v, i) => <text key={`yl${v}`} x={padL - 5} y={yFor(v) + 3} textAnchor="end" fontSize={8} fill={mute}>{xLabels[i]}</text>)}
          <text transform={`translate(9 ${padT + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={ink}>{es ? "Momento →" : "Timing →"}</text>
          {/* points */}
          {nodes.map((n) => {
            const rightHalf = n.cx > padL + plotW * 0.62; // label leftwards near the right edge so it never clips
            return (
              <g key={n.a.id}>
                <circle cx={n.cx} cy={n.cy} r={5.5} fill={n.color} stroke="#fff" strokeWidth={1.4} />
                <text x={rightHalf ? n.cx - 8 : n.cx + 8} y={n.cy + 3} fontSize={8.2} fill={ink} textAnchor={rightHalf ? "end" : "start"}>{n.label}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ minWidth: 130, fontSize: 12, color: mute }}>
          <div className="dlv-label" style={{ marginBottom: 6 }}>{es ? "Decisión" : "Decision"}</div>
          {(["prioritize", "validate", "monitor", "hold"] as DecisionState[]).map((d) => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: 9, background: DECISION_TOKENS[d].dot, display: "inline-block" }} />
              <span style={{ color: ink }}>{es ? DECISION_TOKENS[d].labelEs : DECISION_TOKENS[d].label}</span>
            </div>
          ))}
          {missing.length > 0 && (
            <p style={{ marginTop: 10, fontSize: 11 }}>{es ? "Sin posicionar (encaje o momento no evaluado): " : "Not positioned (fit or timing not evaluated): "}{missing.map((a) => a.company).join(", ")}</p>
          )}
        </div>
      </div>
    </figure>
  );
}
