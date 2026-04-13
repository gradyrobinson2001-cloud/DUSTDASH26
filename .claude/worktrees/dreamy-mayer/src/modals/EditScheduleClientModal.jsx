import React, { useState } from "react";
import { T, SERVICED_AREAS, calculateDuration } from "../shared";
import { Modal } from "../components/ui";
import { isEmail, isPhone, errorStyle } from "../utils/validate";

export default function EditScheduleClientModal({ client, settings, onSave, onDelete, onClose }) {
  const isNew = !client.id;
  const [local, setLocal] = useState({
    name: client.name || "",
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
    suburb: client.suburb || SERVICED_AREAS[0],
    bedrooms: client.bedrooms || 3,
    bathrooms: client.bathrooms || 2,
    living: client.living || 1,
    kitchen: client.kitchen || 1,
    frequency: client.frequency || "fortnightly",
    preferredDay: client.preferredDay || "monday",
    preferredTime: client.preferredTime || "anytime",
    customDuration: client.customDuration || null,
    notes: client.notes || "",
    accessNotes: client.accessNotes || "",
    status: client.status || "active",
  });

  const u = (k, v) => setLocal({ ...local, [k]: v });
  const estimatedDuration = calculateDuration(local, settings);

  const [touched, setTouched] = useState({});
  const touch = (k) => setTouched(prev => ({ ...prev, [k]: true }));

  const errors = {
    name: touched.name && !local.name.trim() ? "Name is required" : "",
    email: touched.email && local.email && !isEmail(local.email) ? "Please enter a valid email address" : "",
    phone: touched.phone && local.phone && !isPhone(local.phone) ? "Please enter a valid phone number" : "",
  };
  const canSave = local.name.trim() && (!local.email || isEmail(local.email)) && (!local.phone || isPhone(local.phone));

  return (
    <Modal title={isNew ? "Add Client" : `Edit: ${client.name}`} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>NAME</label>
            <input type="text" value={local.name} onChange={e => u("name", e.target.value)} onBlur={() => touch("name")} placeholder="Client name"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${errors.name ? "#D4645C" : T.border}`, fontSize: 14 }} />
            {errors.name && <p style={errorStyle}>{errors.name}</p>}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>SUBURB</label>
            <select value={local.suburb} onChange={e => u("suburb", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              {SERVICED_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>FULL ADDRESS (for accurate distance)</label>
          <input type="text" value={local.address} onChange={e => u("address", e.target.value)} placeholder="e.g. 123 Smith Street, Buderim QLD 4556"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textLight }}>Used for precise route calculations. Leave blank to use suburb center.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>EMAIL</label>
            <input type="email" value={local.email} onChange={e => u("email", e.target.value)} onBlur={() => touch("email")} placeholder="email@example.com"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${errors.email ? "#D4645C" : T.border}`, fontSize: 14 }} />
            {errors.email && <p style={errorStyle}>{errors.email}</p>}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>PHONE</label>
            <input type="tel" value={local.phone} onChange={e => u("phone", e.target.value)} onBlur={() => touch("phone")} placeholder="0412 345 678"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${errors.phone ? "#D4645C" : T.border}`, fontSize: 14 }} />
            {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
          </div>
        </div>

        {/* Room Counts */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 10 }}>ROOMS</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {[["bedrooms", "🛏️ Bed"], ["bathrooms", "🚿 Bath"], ["living", "🛋️ Living"], ["kitchen", "🍳 Kitchen"]].map(([key, label]) => (
              <div key={key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>{label}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <button onClick={() => u(key, Math.max(0, local[key] - 1))} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", fontSize: 14 }}>-</button>
                  <span style={{ fontWeight: 700, width: 20, textAlign: "center" }}>{local[key]}</span>
                  <button onClick={() => u(key, local[key] + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.primary}`, background: T.primaryLight, cursor: "pointer", fontSize: 14, color: T.primary }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>FREQUENCY</label>
            <select value={local.frequency} onChange={e => u("frequency", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>PREFERRED DAY</label>
            <select value={local.preferredDay} onChange={e => u("preferredDay", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              {["monday", "tuesday", "wednesday", "thursday", "friday"].map(d => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Duration Override */}
        <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Estimated Duration: {estimatedDuration} mins</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Based on room counts</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>Override:</span>
              <input type="number" value={local.customDuration || ""} onChange={e => u("customDuration", e.target.value ? Number(e.target.value) : null)}
                placeholder={String(estimatedDuration)} style={{ width: 80, padding: "8px 10px", borderRadius: 6, border: `1.5px solid ${T.border}`, fontSize: 13 }} />
              <span style={{ fontSize: 11, color: T.textMuted }}>mins</span>
            </div>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>🔑 ACCESS DETAILS</label>
          <textarea value={local.accessNotes} onChange={e => u("accessNotes", e.target.value)} placeholder="e.g. Key under doormat, alarm code 1234..."
            rows={2} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, resize: "vertical" }} />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>📝 SPECIAL NOTES</label>
          <textarea value={local.notes} onChange={e => u("notes", e.target.value)} placeholder="e.g. Has 2 dogs, keep gate closed..."
            rows={2} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, resize: "vertical" }} />
        </div>

        {!isNew && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>STATUS</label>
            <select value={local.status} onChange={e => u("status", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {onDelete && (
            <button onClick={onDelete} style={{ padding: "12px 18px", borderRadius: T.radiusSm, border: "none", background: "#FDF0EF", color: T.danger, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🗑️ Delete
            </button>
          )}
          <button onClick={() => { setTouched({ name: true, email: true, phone: true }); if (canSave) { onSave(local); onClose(); } }} disabled={!canSave}
            style={{ flex: 1, padding: "12px", borderRadius: T.radiusSm, border: "none", background: canSave ? T.primary : T.border, color: "#fff", fontWeight: 700, fontSize: 14, cursor: canSave ? "pointer" : "not-allowed" }}>
            {isNew ? "Add Client" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
