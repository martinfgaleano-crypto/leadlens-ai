import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "48px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 18,
              fontWeight: 800,
              fontSize: 30,
              color: "#0284c7",
            }}
          >
            L
          </div>
          <span style={{ color: "white", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            LeadLens<span style={{ color: "#7dd3fc", marginLeft: 8 }}>AI</span>
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            color: "white",
            fontSize: 58,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -2,
            marginBottom: 32,
            maxWidth: 920,
          }}
        >
          Qualified B2B leads + personalized outreach drafts.
        </div>

        {/* Sub */}
        <div style={{ color: "#bae6fd", fontSize: 26, maxWidth: 820, lineHeight: 1.5 }}>
          Tell us your ideal customer. We research, qualify, and write the outreach. You review and send.
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
