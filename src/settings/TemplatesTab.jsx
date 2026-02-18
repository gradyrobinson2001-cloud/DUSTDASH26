import React from "react";
import { T } from "../shared";

export default function TemplatesTab({ templates, copyTemplate, removeTemplate, setAddTemplateModal, isMobile }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Message Templates</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Quick-copy messages for common responses</p>
        </div>
        <button onClick={() => setAddTemplateModal(true)} style={{ padding: "10px 18px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Add Template
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {templates.map(t => (
          <div key={t.id} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "16px" : "20px 24px", boxShadow: T.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{t.name}</span>
                {t.isDefault && <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: T.blueLight, color: T.blue }}>DEFAULT</span>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => copyTemplate(t.content)} style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${T.primary}`, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.primary }}>
                  📋 Copy
                </button>
                {!t.isDefault && (
                  <button onClick={() => removeTemplate(t.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#FDF0EF", cursor: "pointer", fontSize: 12, color: T.danger }}>
                    🗑️
                  </button>
                )}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{t.content}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, background: T.blueLight, borderRadius: T.radius, padding: "16px 20px" }}>
        <h4 style={{ margin: "0 0 8px", fontWeight: 700, color: T.blue }}>💡 Tip: Using placeholders</h4>
        <p style={{ margin: 0, fontSize: 13, color: T.text }}>
          Use <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>{"{NAME}"}</code> for customer name, <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>{"{FREQUENCY}"}</code> for clean frequency, and <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>{"[FORM LINK]"}</code> as a reminder to paste your form link.
        </p>
      </div>
    </>
  );
}
