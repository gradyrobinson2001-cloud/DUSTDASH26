import React from "react";
import { T } from "../shared";

export default function FormTab({ showToast, isMobile }) {
  const formUrl = typeof window !== "undefined" ? window.location.origin + "/form" : "/form";

  return (
    <>
      <h1 style={{ margin: "0 0 4px", fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Customer Form</h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>This is the form your customers will fill in. Share the link below.</p>

      <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: isMobile ? "20px" : "28px 32px", boxShadow: T.shadowMd, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: T.text }}>📎 Shareable Form Link</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: T.radiusSm, background: T.bg, border: `1.5px solid ${T.border}`, fontSize: 14, color: T.primary, fontWeight: 600, wordBreak: "break-all" }}>
            {formUrl}
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(formUrl); showToast("📋 Link copied!"); }}
            style={{ padding: "12px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Copy Link
          </button>
          <a
            href="/form"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "12px 20px", borderRadius: T.radiusSm, border: `1.5px solid ${T.primary}`, background: "#fff", color: T.primary, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Open Form ↗
          </a>
        </div>
      </div>

      <div style={{ background: T.blueLight, borderRadius: T.radius, padding: "20px 24px" }}>
        <h4 style={{ margin: "0 0 8px", fontWeight: 700, color: T.blue }}>How it works</h4>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 2 }}>
          1️⃣ Customer clicks the link (from your auto-reply message)<br />
          2️⃣ They select their suburb first to check we service their area<br />
          3️⃣ They fill in their details, room counts, frequency & add-ons<br />
          4️⃣ Submission appears in your Inbox with status "Info Received"<br />
          5️⃣ You click "Generate Quote" → review → approve & send
        </div>
      </div>
    </>
  );
}
