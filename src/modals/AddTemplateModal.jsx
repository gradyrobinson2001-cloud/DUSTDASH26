import React, { useState } from "react";
import { T } from "../shared";
import { Modal } from "../components/ui";

export default function AddTemplateModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const canSave = name.trim() && content.trim();

  return (
    <Modal title="Add Message Template" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>TEMPLATE NAME</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Reschedule Request"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>MESSAGE CONTENT</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Type your message template here..."
            style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, resize: "vertical", lineHeight: 1.6 }} />
        </div>
        <div style={{ background: T.bg, borderRadius: 8, padding: "12px 16px", fontSize: 12, color: T.textMuted }}>
          💡 Use {"{NAME}"} for customer name, {"{FREQUENCY}"} for clean frequency
        </div>
        <button
          onClick={() => canSave && onSave({ name, content })}
          disabled={!canSave}
          style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: canSave ? T.primary : T.border, color: canSave ? "#fff" : T.textLight, fontWeight: 700, fontSize: 14, cursor: canSave ? "pointer" : "not-allowed" }}
        >
          Add Template
        </button>
      </div>
    </Modal>
  );
}
