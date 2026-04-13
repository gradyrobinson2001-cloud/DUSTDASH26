import React, { useState } from "react";
import { T } from "../shared";
import { Modal } from "../components/ui";

export default function EditPriceModal({ serviceKey, pricing, onSave, onClose }) {
  const [price, setPrice] = useState(pricing[serviceKey].price);
  return (
    <Modal title={`Edit ${pricing[serviceKey].label} Price`} onClose={onClose}>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>Price ($)</label>
        <input
          type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0} step={5}
          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 20, fontWeight: 800, marginTop: 6, color: T.primary }}
        />
      </div>
      <button
        onClick={() => onSave(serviceKey, price)}
        style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
      >
        Update Price
      </button>
    </Modal>
  );
}
