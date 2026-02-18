import React, { useState } from "react";
import { T } from "../shared";
import { Modal } from "../components/ui";

export default function EditJobModal({ job, clients, settings, onSave, onDelete, onClose }) {
  const [local, setLocal] = useState({
    date: job.date || "",
    clientId: job.clientId || "",
    teamId: job.teamId || settings.teams[0]?.id,
    startTime: job.startTime || "08:00",
    duration: job.duration || 120,
    status: job.status || "scheduled",
  });

  const selectedClient = clients.find(c => c.id === local.clientId);
  const u = (k, v) => setLocal({ ...local, [k]: v });

  const handleSave = () => {
    if (!local.date || !local.clientId) return;
    const client = clients.find(c => c.id === local.clientId);
    const [h, m] = local.startTime.split(":").map(Number);
    const endMins = h * 60 + m + local.duration;
    const endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
    onSave({ date: local.date, clientId: local.clientId, clientName: client?.name || "Unknown", suburb: client?.suburb || "", teamId: local.teamId, startTime: local.startTime, endTime, duration: local.duration, status: local.status, isDemo: client?.isDemo || false });
    onClose();
  };

  return (
    <Modal title={job.isNew ? "Add Job" : "Edit Job"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>DATE</label>
          <input type="date" value={local.date} onChange={e => u("date", e.target.value)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>CLIENT</label>
          <select value={local.clientId} onChange={e => {
            const client = clients.find(c => c.id === e.target.value);
            setLocal(prev => ({ ...prev, clientId: e.target.value, duration: client?.customDuration || client?.estimatedDuration || 120 }));
          }} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
            <option value="">Select client...</option>
            {clients.filter(c => c.status === "active").map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.suburb}){c.isDemo ? " [Demo]" : ""}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>TEAM</label>
            <select value={local.teamId} onChange={e => u("teamId", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              {settings.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>STATUS</label>
            <select value={local.status} onChange={e => u("status", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>START TIME</label>
            <input type="time" value={local.startTime} onChange={e => u("startTime", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>DURATION (mins)</label>
            <input type="number" value={local.duration} onChange={e => u("duration", Number(e.target.value))} min={30} step={15}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
        </div>

        {selectedClient && (
          <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "12px 14px", fontSize: 12, color: T.textMuted }}>
            📍 {selectedClient.suburb} · 🛏️ {selectedClient.bedrooms} bed · 🚿 {selectedClient.bathrooms} bath
            {selectedClient.notes && <div style={{ marginTop: 6, color: T.text }}>📝 {selectedClient.notes}</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {onDelete && (
            <button onClick={onDelete} style={{ padding: "12px 18px", borderRadius: T.radiusSm, border: "none", background: "#FDF0EF", color: T.danger, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🗑️ Delete
            </button>
          )}
          <button onClick={handleSave} disabled={!local.date || !local.clientId}
            style={{ flex: 1, padding: "12px", borderRadius: T.radiusSm, border: "none", background: local.date && local.clientId ? T.primary : T.border, color: "#fff", fontWeight: 700, fontSize: 14, cursor: local.date && local.clientId ? "pointer" : "not-allowed" }}>
            {job.isNew ? "Add Job" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
