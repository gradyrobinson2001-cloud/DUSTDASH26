import React, { useState } from "react";
import { T } from "../shared";
import { Modal } from "../components/ui";

export default function EditJobModal({ job, clients, settings, onSave, onDelete, onClose }) {
  const [local, setLocal] = useState({
    date: job.date || "",
    clientId: job.clientId || job.client_id || "",
    startTime: job.startTime || job.start_time || "08:00",
    duration: job.duration || 120,
    status: job.status || job.job_status || job.jobStatus || "scheduled",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedClient = clients.find(c => String(c.id) === String(local.clientId));
  const u = (k, v) => setLocal({ ...local, [k]: v });

  const handleSave = async () => {
    if (!local.date || !local.clientId) return;
    const client = clients.find(c => String(c.id) === String(local.clientId));
    const [h, m] = local.startTime.split(":").map(Number);
    const endMins = h * 60 + m + local.duration;
    const endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
    setSaving(true);
    setError("");
    try {
      await Promise.resolve(onSave({
        date: local.date,
        clientId: local.clientId,
        clientName: client?.name || "Unknown",
        suburb: client?.suburb || "",
        address: client?.address || "",
        email: client?.email || "",
        phone: client?.phone || "",
        bedrooms: client?.bedrooms ?? null,
        bathrooms: client?.bathrooms ?? null,
        living: client?.living ?? null,
        kitchen: client?.kitchen ?? null,
        frequency: client?.frequency || null,
        preferred_day: client?.preferred_day || client?.preferredDay || null,
        preferred_time: client?.preferred_time || client?.preferredTime || null,
        access_notes: client?.access_notes || client?.accessNotes || null,
        notes: client?.notes || null,
        startTime: local.startTime,
        endTime,
        duration: local.duration,
        status: local.status,
        isDemo: client?.isDemo || client?.is_demo || false,
      }));
      onClose();
    } catch (e) {
      setError(e?.message || "Failed to save job");
    } finally {
      setSaving(false);
    }
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
            const client = clients.find(c => String(c.id) === String(e.target.value));
            setLocal(prev => ({ ...prev, clientId: e.target.value, duration: client?.customDuration || client?.custom_duration || client?.estimatedDuration || client?.estimated_duration || 120 }));
          }} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
            <option value="">Select client...</option>
            {clients.filter(c => c.status === "active").map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.suburb}){c.isDemo || c.is_demo ? " [Demo]" : ""}</option>
            ))}
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
          <button onClick={handleSave} disabled={!local.date || !local.clientId || saving}
            style={{ flex: 1, padding: "12px", borderRadius: T.radiusSm, border: "none", background: local.date && local.clientId ? T.primary : T.border, color: "#fff", fontWeight: 700, fontSize: 14, cursor: local.date && local.clientId ? "pointer" : "not-allowed" }}>
            {saving ? "Saving…" : job.isNew ? "Add Job" : "Save Changes"}
          </button>
        </div>
        {error && <div style={{ marginTop: 8, fontSize: 12, color: T.danger }}>{error}</div>}
      </div>
    </Modal>
  );
}
