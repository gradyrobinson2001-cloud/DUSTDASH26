import React, { useState, useEffect, useRef } from "react";
import { T, CLEANER_PIN, loadScheduleSettings, loadScheduledJobs, loadScheduleClients, savePhoto, getPhotosForJob } from "./shared";

// ═══════════════════════════════════════════════════════════
// CLEANER PORTAL - Simple interface for cleaners to upload photos
// ═══════════════════════════════════════════════════════════

export default function CleanerPortal() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [settings, setSettings] = useState(loadScheduleSettings);
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState(loadScheduleClients);
  const [uploadingFor, setUploadingFor] = useState(null); // { jobId, type: 'before' | 'after' }
  const [jobPhotos, setJobPhotos] = useState({}); // { jobId: { before: photoData, after: photoData } }
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const today = new Date().toISOString().split("T")[0];

  // Load today's jobs
  useEffect(() => {
    const allJobs = loadScheduledJobs();
    const todaysJobs = allJobs.filter(j => j.date === today && !j.isBreak);
    setJobs(todaysJobs);
    
    // Load existing photos for today's jobs
    const loadPhotos = async () => {
      const photosMap = {};
      for (const job of todaysJobs) {
        const photos = await getPhotosForJob(job.id);
        photosMap[job.id] = {
          before: photos.find(p => p.type === "before"),
          after: photos.find(p => p.type === "after"),
        };
      }
      setJobPhotos(photosMap);
    };
    loadPhotos();
  }, [today]);

  const handlePinSubmit = () => {
    if (pinInput === CLEANER_PIN) {
      setAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const handleTeamSelect = (teamId) => {
    setSelectedTeam(teamId);
  };

  const triggerFileInput = (jobId, photoType) => {
    setUploadingFor({ jobId, type: photoType });
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      
      const job = jobs.find(j => j.id === uploadingFor.jobId);
      
      try {
        await savePhoto({
          jobId: uploadingFor.jobId,
          date: today,
          teamId: selectedTeam,
          clientId: job?.clientId,
          clientName: job?.clientName,
          type: uploadingFor.type,
          data: base64Data,
        });
        
        // Update local state
        setJobPhotos(prev => ({
          ...prev,
          [uploadingFor.jobId]: {
            ...prev[uploadingFor.jobId],
            [uploadingFor.type]: { data: base64Data },
          },
        }));
        
        showToast(`✅ ${uploadingFor.type === "before" ? "Before" : "After"} photo uploaded!`);
      } catch (error) {
        console.error("Failed to save photo:", error);
        showToast("❌ Failed to upload photo");
      }
      
      setUploadingFor(null);
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    e.target.value = "";
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const teamJobs = selectedTeam ? jobs.filter(j => j.teamId === selectedTeam) : [];
  const selectedTeamData = settings.teams.find(t => t.id === selectedTeam);

  // ─── PIN Entry Screen ───
  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: "40px 32px", width: "100%", maxWidth: 360, boxShadow: T.shadowLg, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, color: T.text }}>Dust Bunnies</h1>
          <p style={{ margin: "0 0 32px", color: T.textMuted, fontSize: 14 }}>Cleaner Portal</p>
          
          <div style={{ marginBottom: 20 }}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter PIN"
              value={pinInput}
              onChange={e => {
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                setPinError(false);
              }}
              onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
              style={{
                width: "100%",
                padding: "16px",
                fontSize: 24,
                textAlign: "center",
                letterSpacing: 8,
                borderRadius: T.radius,
                border: `2px solid ${pinError ? T.danger : T.border}`,
                outline: "none",
              }}
            />
            {pinError && (
              <p style={{ color: T.danger, fontSize: 13, marginTop: 8 }}>Incorrect PIN</p>
            )}
          </div>
          
          <button
            onClick={handlePinSubmit}
            disabled={pinInput.length < 4}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: T.radius,
              border: "none",
              background: pinInput.length >= 4 ? T.primary : T.border,
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: pinInput.length >= 4 ? "pointer" : "not-allowed",
            }}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  // ─── Team Selection Screen ───
  if (!selectedTeam) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: 20 }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32, paddingTop: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, color: T.text }}>Select Your Team</h1>
            <p style={{ margin: 0, color: T.textMuted, fontSize: 14 }}>{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {settings.teams.map(team => {
              const teamJobCount = jobs.filter(j => j.teamId === team.id).length;
              return (
                <button
                  key={team.id}
                  onClick={() => handleTeamSelect(team.id)}
                  style={{
                    padding: "24px",
                    borderRadius: T.radius,
                    border: `3px solid ${team.color}`,
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: T.shadow,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: T.radius, background: `${team.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: team.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{team.name}</div>
                      <div style={{ fontSize: 14, color: T.textMuted }}>{teamJobCount} jobs today</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setAuthenticated(false)}
            style={{ width: "100%", marginTop: 32, padding: "14px", borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            ← Back to PIN
          </button>
        </div>
      </div>
    );
  }

  // ─── Jobs List Screen ───
  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: selectedTeamData?.color || T.primary, padding: "20px", color: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 500, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{selectedTeamData?.name}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{teamJobs.length} jobs today</div>
          </div>
          <button
            onClick={() => setSelectedTeam(null)}
            style={{ padding: "8px 16px", borderRadius: 20, border: "2px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Switch Team
          </button>
        </div>
      </div>

      {/* Jobs */}
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "20px" }}>
        {teamJobs.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: T.radius, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <p style={{ margin: 0, color: T.textMuted, fontSize: 16 }}>No jobs scheduled for today!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {teamJobs.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((job, index) => {
              const client = clients.find(c => c.id === job.clientId);
              const photos = jobPhotos[job.id] || {};
              const hasBeforePhoto = !!photos.before;
              const hasAfterPhoto = !!photos.after;
              
              return (
                <div key={job.id} style={{ background: "#fff", borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow }}>
                  {/* Job Header */}
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>JOB {index + 1}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{job.clientName}</div>
                      </div>
                      <div style={{ padding: "6px 12px", borderRadius: 20, background: T.primaryLight, fontSize: 13, fontWeight: 700, color: T.primaryDark }}>
                        {job.startTime}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 8 }}>
                      📍 {client?.address || job.suburb}
                    </div>
                    
                    {client?.notes && (
                      <div style={{ fontSize: 13, color: T.accent, background: T.accentLight, padding: "8px 12px", borderRadius: T.radiusSm }}>
                        📝 {client.notes}
                      </div>
                    )}
                    
                    {/* Navigate Button */}
                    <button
                      onClick={() => {
                        const address = encodeURIComponent(client?.address || `${job.suburb}, QLD, Australia`);
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, "_blank");
                      }}
                      style={{ marginTop: 12, width: "100%", padding: "12px", borderRadius: T.radiusSm, border: "none", background: T.blue, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                    >
                      🗺️ Navigate
                    </button>
                  </div>
                  
                  {/* Photo Upload Section */}
                  <div style={{ padding: "16px 20px", background: T.bg }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 12, textTransform: "uppercase" }}>Photos</div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {/* Before Photo */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Before</div>
                        {hasBeforePhoto ? (
                          <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: T.radiusSm, overflow: "hidden" }}>
                            <img src={photos.before.data} alt="Before" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <div style={{ position: "absolute", top: 8, right: 8, background: T.primary, color: "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✓</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => triggerFileInput(job.id, "before")}
                            style={{
                              width: "100%",
                              aspectRatio: "4/3",
                              borderRadius: T.radiusSm,
                              border: `2px dashed ${T.border}`,
                              background: "#fff",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            <span style={{ fontSize: 28 }}>📷</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>Add Before</span>
                          </button>
                        )}
                      </div>
                      
                      {/* After Photo */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>After</div>
                        {hasAfterPhoto ? (
                          <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: T.radiusSm, overflow: "hidden" }}>
                            <img src={photos.after.data} alt="After" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <div style={{ position: "absolute", top: 8, right: 8, background: T.primary, color: "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✓</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => triggerFileInput(job.id, "after")}
                            style={{
                              width: "100%",
                              aspectRatio: "4/3",
                              borderRadius: T.radiusSm,
                              border: `2px dashed ${T.border}`,
                              background: "#fff",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            <span style={{ fontSize: 28 }}>📷</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted }}>Add After</span>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Completion Status */}
                    {hasBeforePhoto && hasAfterPhoto && (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: T.primaryLight, borderRadius: T.radiusSm, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.primaryDark }}>✅ Photos Complete</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1B3A2D",
          color: "#fff",
          padding: "14px 24px",
          borderRadius: 30,
          fontSize: 14,
          fontWeight: 600,
          boxShadow: T.shadowLg,
          zIndex: 100,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
