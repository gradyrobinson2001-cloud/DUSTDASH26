import React, { useState } from "react";
import { T, calcQuote } from "../shared";
import { Modal, counterBtn, counterBtnPlus } from "../components/ui";

export default function EditQuoteModal({ quote, pricing, onSave, onClose }) {
  const [details, setDetails] = useState({ ...quote.details });
  const u = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  const calc = calcQuote(details, pricing);
  const roomServices = Object.entries(pricing).filter(([_, v]) => v.category === "room");

  return (
    <Modal title={`Edit Quote — ${quote.name}`} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {roomServices.map(([k, v]) => (
          <div key={k}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>{v.label}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <button onClick={() => u(k, Math.max(0, (details[k] || 0) - 1))} style={counterBtn}>−</button>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{details[k] || 0}</span>
              <button onClick={() => u(k, (details[k] || 0) + 1)} style={counterBtnPlus}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>Frequency</label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {["weekly", "fortnightly", "monthly"].map(f => (
            <button key={f} onClick={() => u("frequency", f)} style={{
              padding: "8px 16px", borderRadius: 8,
              border: details.frequency === f ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
              background: details.frequency === f ? T.primaryLight : "#fff",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
              color: details.frequency === f ? T.primaryDark : T.textMuted,
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)} {f === "weekly" && "(-10%)"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 4 }}>
          Updated Total: <span style={{ fontSize: 22, color: T.primary }}>${calc.total.toFixed(2)}</span>
        </div>
        {calc.discountLabel && <div style={{ fontSize: 12, color: T.primaryDark }}>Includes {calc.discountLabel}</div>}
      </div>

      <button
        onClick={() => onSave({ ...quote, details, frequency: details.frequency.charAt(0).toUpperCase() + details.frequency.slice(1) })}
        style={{ width: "100%", padding: "12px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
      >
        Save Changes
      </button>
    </Modal>
  );
}
