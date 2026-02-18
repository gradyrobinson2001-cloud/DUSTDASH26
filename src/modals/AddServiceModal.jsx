import React, { useState } from "react";
import { T } from "../shared";
import { Modal } from "../components/ui";

const ICON_OPTIONS = ["🧹", "🚿", "🛏️", "🪟", "🍳", "🌿", "🧴", "🧺", "🏠", "✨", "🪣", "🧽"];

export default function AddServiceModal({ onSave, onClose }) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState(25);
  const [unit, setUnit] = useState("per room");
  const [icon, setIcon] = useState("🧹");
  const [category, setCategory] = useState("room");
  const [hasQuantity, setHasQuantity] = useState(false);

  const canSave = label.trim() && price > 0;

  return (
    <Modal title="Add New Service" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>SERVICE NAME</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Garage Clean"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>ICON</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ICON_OPTIONS.map(i => (
              <button key={i} onClick={() => setIcon(i)} style={{
                width: 40, height: 40, borderRadius: 8, fontSize: 20, cursor: "pointer",
                border: icon === i ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                background: icon === i ? T.primaryLight : "#fff",
              }}>{i}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>PRICE ($)</label>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 16, fontWeight: 700 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>UNIT</label>
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="per room"
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 8 }}>CATEGORY</label>
          <div style={{ display: "flex", gap: 10 }}>
            {[{ id: "room", label: "Room (counted)" }, { id: "addon", label: "Add-on (optional)" }].map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                flex: 1, padding: "12px", borderRadius: 8, cursor: "pointer",
                border: category === c.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                background: category === c.id ? T.primaryLight : "#fff",
                fontWeight: 700, fontSize: 13, color: category === c.id ? T.primaryDark : T.textMuted,
              }}>{c.label}</button>
            ))}
          </div>
        </div>

        {category === "addon" && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={hasQuantity} onChange={e => setHasQuantity(e.target.checked)} />
            <span style={{ fontSize: 13, color: T.text }}>Allow quantity selection (e.g. "How many windows?")</span>
          </label>
        )}

        <button
          onClick={() => canSave && onSave({ label, price, unit, icon, category, hasQuantity: category === "addon" && hasQuantity })}
          disabled={!canSave}
          style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: canSave ? T.primary : T.border, color: canSave ? "#fff" : T.textLight, fontWeight: 700, fontSize: 14, cursor: canSave ? "pointer" : "not-allowed" }}
        >
          Add Service
        </button>
      </div>
    </Modal>
  );
}
