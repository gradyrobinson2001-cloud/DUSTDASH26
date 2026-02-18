import React, { useState } from "react";
import { T } from "../shared";
import { Modal } from "../components/ui";

export default function ScheduleSettingsModal({ settings, onSave, onSaveAndRegenerate, onClose }) {
  const [local, setLocal] = useState({ ...settings });
  const [saveAttempted, setSaveAttempted] = useState(false);

  // Validate team names are non-empty
  const teamErrors = local.teams.map(t => t.name.trim() ? "" : "Team name is required");
  // Validate working hours: end must be after start
  const hoursValid = local.workingHours.start < local.workingHours.end;
  // jobsPerTeamPerDay must be 1–6
  const jobsValid = local.jobsPerTeamPerDay >= 1 && local.jobsPerTeamPerDay <= 6;
  const canSave = teamErrors.every(e => !e) && hoursValid && jobsValid;
  const u = (path, value) => {
    const keys = path.split(".");
    setLocal(prev => {
      const updated = { ...prev };
      let obj = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  return (
    <Modal title="⚙️ Schedule Settings" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Teams */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Teams</label>
          {local.teams.map((team, i) => (
            <div key={team.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="text" value={team.name}
                  onChange={e => { const teams = [...local.teams]; teams[i] = { ...teams[i], name: e.target.value }; setLocal({ ...local, teams }); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${saveAttempted && teamErrors[i] ? "#D4645C" : T.border}`, fontSize: 14 }} />
                <input type="color" value={team.color}
                  onChange={e => { const teams = [...local.teams]; teams[i] = { ...teams[i], color: e.target.value }; setLocal({ ...local, teams }); }}
                  style={{ width: 50, height: 42, borderRadius: 8, border: `1.5px solid ${T.border}`, cursor: "pointer" }} />
              </div>
              {saveAttempted && teamErrors[i] && <p style={{ color: "#D4645C", fontSize: 12, marginTop: 4, fontWeight: 600 }}>{teamErrors[i]}</p>}
            </div>
          ))}
        </div>

        {/* Working Hours */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Working Hours</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {[["Start", "workingHours.start", "time"], ["End", "workingHours.end", "time"], ["Break (mins)", "workingHours.breakDuration", "number"], ["Travel Buffer", "workingHours.travelBuffer", "number"]].map(([label, path, type]) => (
              <div key={path}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{label}</div>
                <input type={type} value={path.split(".").reduce((o, k) => o[k], local)} onChange={e => u(path, type === "number" ? Number(e.target.value) : e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Duration Estimates */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Duration Estimates (minutes per room)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
            {[["bedroom", "🛏️"], ["bathroom", "🚿"], ["living", "🛋️"], ["kitchen", "🍳"], ["baseSetup", "🏠 Setup"]].map(([key, label]) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{label}</div>
                <input type="number" value={local.durationEstimates[key]} onChange={e => u(`durationEstimates.${key}`, Number(e.target.value))}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Working hours cross-field error */}
        {saveAttempted && !hoursValid && (
          <p style={{ color: "#D4645C", fontSize: 12, fontWeight: 600, margin: "-12px 0 0" }}>End time must be after start time</p>
        )}

        {/* Jobs Per Team */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Jobs Per Team Per Day</label>
          <input type="number" value={local.jobsPerTeamPerDay} onChange={e => setLocal({ ...local, jobsPerTeamPerDay: Number(e.target.value) })} min={1} max={6}
            style={{ width: 100, padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${saveAttempted && !jobsValid ? "#D4645C" : T.border}`, fontSize: 14 }} />
          {saveAttempted && !jobsValid && <p style={{ color: "#D4645C", fontSize: 12, marginTop: 4, fontWeight: 600 }}>Must be between 1 and 6</p>}
        </div>

        {/* Area Schedule */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Area Schedule (suburbs per day)</label>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.textMuted }}>Clients will be auto-assigned to days based on their suburb</p>
          {["monday", "tuesday", "wednesday", "thursday", "friday"].map(day => (
            <div key={day} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 80, fontSize: 13, fontWeight: 600, color: T.text, textTransform: "capitalize" }}>{day}</div>
              <input
                type="text"
                value={(local.areaSchedule[day] || []).join(", ")}
                onChange={e => { const areas = e.target.value.split(",").map(s => s.trim()).filter(Boolean); setLocal({ ...local, areaSchedule: { ...local.areaSchedule, [day]: areas } }); }}
                placeholder="e.g. Buderim, Kuluin"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13 }}
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setSaveAttempted(true); if (canSave) onSave(local); }}
            style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Save Only
          </button>
          <button onClick={() => { setSaveAttempted(true); if (canSave) onSaveAndRegenerate(local); }}
            style={{ flex: 2, padding: "14px", borderRadius: T.radiusSm, border: "none", background: canSave ? T.primary : T.border, color: "#fff", fontWeight: 700, fontSize: 14, cursor: canSave ? "pointer" : "not-allowed" }}>
            💫 Save & Regenerate Schedule
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: T.textMuted, textAlign: "center" }}>
          "Save & Regenerate" will rebuild the schedule based on new area assignments
        </p>
      </div>
    </Modal>
  );
}
