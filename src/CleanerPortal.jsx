import React, { useState, useEffect, useRef } from "react";
import { T, CLEANER_PIN, loadScheduleSettings, loadScheduledJobs, saveScheduledJobs, loadScheduleClients, savePhoto, getPhotosForJob } from "./shared";

// ═══════════════════════════════════════════════════════════
// EMPLOYEE PORTAL - Daily runsheet, time tracking & photos
// ═══════════════════════════════════════════════════════════

export default function CleanerPortal() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [settings, setSettings] = useState(loadScheduleSettings);
  const [allJobs, setAllJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expandedJob, setExpandedJob] = useState(null);
  const [jobPhotos, setJobPhotos] = useState({});
  const [photoType, setPhotoType] = useState("before");
  const [toast, setToast] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [activeTimers, setActiveTimers] = useState({});
  const [showWeeklyHours, setShowWeeklyHours] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const timerIntervalRef = useRef({});

  const today = new Date().toISOString().split("T")[0];

  // Demo data
  const demoJobs = [
    {
      id: "demo_job_1", clientId: "demo_client_1", clientName: "Sarah Mitchell", suburb: "Buderim",
      date: today, startTime: "08:00", endTime: "10:15", duration: 135, teamId: "team_a", status: "scheduled",
      bedrooms: 3, bathrooms: 2, living: 1, kitchen: 1, extras: ["oven"],
    },
    {
      id: "demo_job_2", clientId: "demo_client_2", clientName: "James Cooper", suburb: "Maroochydore",
      date: today, startTime: "10:45", endTime: "12:45", duration: 120, teamId: "team_a", status: "scheduled",
      bedrooms: 4, bathrooms: 2, living: 2, kitchen: 1, extras: [],
    },
    {
      id: "demo_job_3", clientId: "demo_client_3", clientName: "Emma Collins", suburb: "Mooloolaba",
      date: today, startTime: "13:30", endTime: "15:30", duration: 120, teamId: "team_a", status: "scheduled",
      bedrooms: 2, bathrooms: 1, living: 1, kitchen: 1, extras: ["windows"],
    },
    {
      id: "demo_job_4", clientId: "demo_client_4", clientName: "Tom Wilson", suburb: "Alexandra Headland",
      date: today, startTime: "08:00", endTime: "10:30", duration: 150, teamId: "team_b", status: "scheduled",
      bedrooms: 4, bathrooms: 3, living: 2, kitchen: 1, extras: ["oven", "windows"],
    },
    {
      id: "demo_job_5", clientId: "demo_client_5", clientName: "Priya Sharma", suburb: "Twin Waters",
      date: today, startTime: "11:00", endTime: "13:00", duration: 120, teamId: "team_b", status: "scheduled",
      bedrooms: 3, bathrooms: 2, living: 1, kitchen: 1, extras: [],
    },
  ];

  const demoClients = [
    { id: "demo_client_1", name: "Sarah Mitchell", address: "23 Ballinger Crescent, Buderim QLD 4556", notes: "2 dogs - keep gate closed", accessNotes: "Key under front doormat, alarm code 1234#", frequency: "weekly" },
    { id: "demo_client_2", name: "James Cooper", address: "15 Duporth Avenue, Maroochydore QLD 4558", notes: "Baby sleeps 1-3pm, please be quiet", accessNotes: "Ring doorbell, client works from home", frequency: "fortnightly" },
    { id: "demo_client_3", name: "Emma Collins", address: "5 Parkyn Parade, Mooloolaba QLD 4557", notes: "", accessNotes: "Lockbox on side gate - code 5678", frequency: "weekly" },
    { id: "demo_client_4", name: "Tom Wilson", address: "11 Pacific Terrace, Alexandra Headland QLD 4572", notes: "Cat is friendly, don't let out", accessNotes: "Garage code 9999, enter through laundry", frequency: "fortnightly" },
    { id: "demo_client_5", name: "Priya Sharma", address: "7 Dodonaea Close, Twin Waters QLD 4564", notes: "Use eco products only - allergies", accessNotes: "Key in garden gnome by front door", frequency: "monthly" },
  ];

  const enterDemoMode = () => {
    setAllJobs(demoJobs);
    setClients(demoClients);
    setJobPhotos({});
    setDemoMode(true);
    setAuthenticated(true);
  };

  const exitDemoMode = () => {
    setDemoMode(false);
    setAuthenticated(false);
    setSelectedTeam(null);
    setAllJobs([]);
    setClients([]);
    setJobPhotos({});
    setActiveTimers({});
  };

  // Load real data
  useEffect(() => {
    if (!demoMode && authenticated) {
      const jobs = loadScheduledJobs();
      setAllJobs(jobs);
      setClients(loadScheduleClients());
    }
  }, [demoMode, authenticated]);

  // Refresh data periodically (sync with owner's changes)
  useEffect(() => {
    if (!demoMode && authenticated) {
      const interval = setInterval(() => {
        const jobs = loadScheduledJobs();
        setAllJobs(jobs);
        setClients(loadScheduleClients());
        setSettings(loadScheduleSettings());
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [demoMode, authenticated]);

  // Load photos for visible jobs
  useEffect(() => {
    const loadPhotos = async () => {
      const dayJobs = allJobs.filter(j => j.date === selectedDate && j.teamId === selectedTeam && !j.isBreak);
      const photosMap = {};
      for (const job of dayJobs) {
        try {
          const photos = await getPhotosForJob(job.id);
          photosMap[job.id] = {
            before: photos.filter(p => p.type === "before"),
            after: photos.filter(p => p.type === "after"),
          };
        } catch (e) {
          photosMap[job.id] = { before: [], after: [] };
        }
      }
      setJobPhotos(photosMap);
    };
    if (selectedTeam && allJobs.length > 0) {
      loadPhotos();
    }
  }, [allJobs, selectedDate, selectedTeam]);

  // Timer management
  useEffect(() => {
    const dayJobs = allJobs.filter(j => j.date === selectedDate && j.teamId === selectedTeam);
    
    dayJobs.forEach(job => {
      if (job.jobStatus === "in_progress" && job.arrivedAt && !timerIntervalRef.current[job.id]) {
        const startTime = new Date(job.arrivedAt).getTime();
        timerIntervalRef.current[job.id] = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setActiveTimers(prev => ({ ...prev, [job.id]: elapsed }));
        }, 1000);
      } else if (job.jobStatus !== "in_progress" && timerIntervalRef.current[job.id]) {
        clearInterval(timerIntervalRef.current[job.id]);
        delete timerIntervalRef.current[job.id];
      }
    });

    return () => {
      Object.values(timerIntervalRef.current).forEach(clearInterval);
    };
  }, [allJobs, selectedDate, selectedTeam]);

  const handlePinSubmit = () => {
    if (pinInput === CLEANER_PIN) {
      setAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateJobStatus = (jobId, newStatus) => {
    const now = new Date().toISOString();
    
    setAllJobs(prev => {
      const updated = prev.map(j => {
        if (j.id === jobId) {
          const updates = { ...j, jobStatus: newStatus };
          
          if (newStatus === "in_progress") {
            updates.arrivedAt = now;
            const startTime = Date.now();
            timerIntervalRef.current[jobId] = setInterval(() => {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              setActiveTimers(prev => ({ ...prev, [jobId]: elapsed }));
            }, 1000);
          } else if (newStatus === "completed") {
            updates.finishedAt = now;
            if (j.arrivedAt) {
              updates.actualDuration = Math.round((new Date(now) - new Date(j.arrivedAt)) / 60000);
            }
            if (timerIntervalRef.current[jobId]) {
              clearInterval(timerIntervalRef.current[jobId]);
              delete timerIntervalRef.current[jobId];
            }
          }
          
          return updates;
        }
        return j;
      });
      
      if (!demoMode) {
        saveScheduledJobs(updated);
      }
      
      return updated;
    });

    showToast(newStatus === "in_progress" ? "⏱️ Timer started!" : "✅ Job completed!");
  };

  const handlePhotoUpload = async (e, jobId, type) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        const job = allJobs.find(j => j.id === jobId);

        try {
          if (!demoMode) {
            await savePhoto({
              jobId,
              date: selectedDate,
              teamId: selectedTeam,
              clientId: job?.clientId,
              clientName: job?.clientName,
              type,
              data: base64Data,
            });
          }

          setJobPhotos(prev => ({
            ...prev,
            [jobId]: {
              ...prev[jobId],
              [type]: [...(prev[jobId]?.[type] || []), { data: base64Data, type, uploadedAt: new Date().toISOString() }],
            },
          }));

          showToast(`✅ ${type === "before" ? "Before" : "After"} photo added!`);
        } catch (error) {
          console.error("Failed to save photo:", error);
          showToast("❌ Failed to upload photo");
        }
      };
      reader.readAsDataURL(file);
    }

    e.target.value = "";
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatMinutes = (mins) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs > 0) return `${hrs}hr ${m > 0 ? `${m}min` : ""}`;
    return `${mins}min`;
  };

  const getWeeklyHours = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekJobs = allJobs.filter(j => {
      const jobDate = new Date(j.date);
      return j.teamId === selectedTeam && jobDate >= startOfWeek && jobDate <= endOfWeek && !j.isBreak;
    });

    const completedJobs = weekJobs.filter(j => j.jobStatus === "completed");
    const totalActualMins = completedJobs.reduce((sum, j) => sum + (j.actualDuration || j.duration || 0), 0);
    const totalScheduledMins = weekJobs.reduce((sum, j) => sum + (j.duration || 0), 0);

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const byDay = days.map((day, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      
      const dayJobs = weekJobs.filter(j => j.date === dateStr);
      const completed = dayJobs.filter(j => j.jobStatus === "completed");
      const mins = completed.reduce((sum, j) => sum + (j.actualDuration || j.duration || 0), 0);
      
      return { day, date: dateStr, jobs: dayJobs.length, completed: completed.length, hours: Math.round(mins / 60 * 10) / 10 };
    });

    return {
      completedJobs: completedJobs.length,
      totalJobs: weekJobs.length,
      actualHours: Math.round(totalActualMins / 60 * 10) / 10,
      scheduledHours: Math.round(totalScheduledMins / 60 * 10) / 10,
      byDay,
    };
  };

  const dayJobs = allJobs
    .filter(j => j.date === selectedDate && j.teamId === selectedTeam && !j.isBreak)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const selectedTeamData = settings.teams.find(t => t.id === selectedTeam);
  const totalScheduledMins = dayJobs.reduce((sum, j) => sum + (j.duration || 0), 0);
  const completedCount = dayJobs.filter(j => j.jobStatus === "completed").length;

  // ─── PIN Entry Screen ───
  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: "32px 28px", width: "100%", maxWidth: 360, boxShadow: T.shadowLg, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: T.text }}>Dust Bunnies</h1>
          <p style={{ margin: "0 0 24px", color: T.textMuted, fontSize: 14 }}>Employee Portal</p>
          
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter PIN"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(false); }}
              onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
              style={{ width: "100%", padding: "14px", fontSize: 22, textAlign: "center", letterSpacing: 8, borderRadius: T.radius, border: `2px solid ${pinError ? T.danger : T.border}`, outline: "none" }}
            />
            {pinError && <p style={{ color: T.danger, fontSize: 13, marginTop: 8 }}>Incorrect PIN</p>}
          </div>
          
          <button
            onClick={handlePinSubmit}
            disabled={pinInput.length < 4}
            style={{ width: "100%", padding: "14px", borderRadius: T.radius, border: "none", background: pinInput.length >= 4 ? T.primary : T.border, color: "#fff", fontSize: 15, fontWeight: 700, cursor: pinInput.length >= 4 ? "pointer" : "not-allowed" }}
          >
            Enter
          </button>
          
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
            <button
              onClick={enterDemoMode}
              style={{ width: "100%", padding: "14px", borderRadius: T.radius, border: `2px solid ${T.accent}`, background: T.accentLight, color: "#8B6914", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              🧪 Try Demo Mode
            </button>
            <p style={{ margin: "10px 0 0", fontSize: 11, color: T.textLight }}>Test with sample jobs</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Team Selection Screen ───
  if (!selectedTeam) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, padding: 20 }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          {demoMode && (
            <div style={{ background: T.accentLight, borderRadius: T.radius, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>🧪</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#8B6914" }}>Demo Mode</span>
              </div>
              <button onClick={exitDemoMode} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#fff", fontSize: 12, fontWeight: 600, color: T.textMuted, cursor: "pointer" }}>Exit</button>
            </div>
          )}
          
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, color: T.text }}>Select Your Team</h1>
            <p style={{ margin: 0, color: T.textMuted, fontSize: 14 }}>{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {settings.teams.map(team => {
              const teamJobCount = allJobs.filter(j => j.date === today && j.teamId === team.id && !j.isBreak).length;
              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team.id)}
                  style={{ padding: "24px", borderRadius: T.radius, border: `3px solid ${team.color}`, background: "#fff", cursor: "pointer", textAlign: "left", boxShadow: T.shadow }}
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
          
          {!demoMode && (
            <button onClick={() => setAuthenticated(false)} style={{ width: "100%", marginTop: 32, padding: "14px", borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              ← Sign Out
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Jobs Screen ───
  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: selectedTeamData?.color || T.primary, padding: "16px 20px", color: "#fff", position: "sticky", top: 0, zIndex: 20 }}>
        {demoMode && (
          <div style={{ background: "rgba(255,255,255,0.2)", padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>🧪 Demo Mode</div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedTeamData?.name}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>{completedCount}/{dayJobs.length} jobs · {formatMinutes(totalScheduledMins)}</div>
          </div>
          <button onClick={() => setSelectedTeam(null)} style={{ padding: "8px 14px", borderRadius: 20, border: "2px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Switch</button>
        </div>
        
        {/* Date Selector */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split("T")[0]); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 14, cursor: "pointer" }}>←</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 14, fontWeight: 600, textAlign: "center", width: "100%" }} />
          </div>
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split("T")[0]); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 14, cursor: "pointer" }}>→</button>
          {selectedDate !== today && (
            <button onClick={() => setSelectedDate(today)} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#fff", color: selectedTeamData?.color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Today</button>
          )}
        </div>
      </div>

      {/* Weekly Hours Button */}
      <div style={{ padding: "12px 20px", background: "#fff", borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => setShowWeeklyHours(!showWeeklyHours)} style={{ width: "100%", padding: "12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: showWeeklyHours ? T.primaryLight : "#fff", color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>📊 Weekly Hours</span>
          <span style={{ color: T.textMuted }}>{showWeeklyHours ? "▲" : "▼"}</span>
        </button>
        
        {showWeeklyHours && (() => {
          const weekly = getWeeklyHours();
          return (
            <div style={{ marginTop: 12, background: T.bg, borderRadius: T.radiusSm, padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "#fff", padding: 12, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: T.primary }}>{weekly.actualHours}h</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>Worked</div>
                </div>
                <div style={{ background: "#fff", padding: 12, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: T.text }}>{weekly.scheduledHours}h</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>Scheduled</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {weekly.byDay.map(d => (
                  <div key={d.day} onClick={() => setSelectedDate(d.date)} style={{ flex: 1, textAlign: "center", padding: "8px 4px", background: d.date === selectedDate ? T.primaryLight : "#fff", borderRadius: 6, cursor: "pointer" }}>
                    <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>{d.day}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: d.completed === d.jobs && d.jobs > 0 ? T.primary : T.text }}>{d.hours > 0 ? `${d.hours}h` : "-"}</div>
                    <div style={{ fontSize: 9, color: T.textLight }}>{d.completed}/{d.jobs}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Jobs List */}
      <div style={{ padding: 20 }}>
        {dayJobs.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: T.radius, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <p style={{ margin: 0, color: T.textMuted, fontSize: 16, fontWeight: 600 }}>No jobs scheduled</p>
            <p style={{ margin: "8px 0 0", color: T.textLight, fontSize: 14 }}>{selectedDate === today ? "Enjoy your day off!" : "Select a different date"}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {dayJobs.map((job, index) => {
              const client = clients.find(c => c.id === job.clientId);
              const photos = jobPhotos[job.id] || { before: [], after: [] };
              const isExpanded = expandedJob === job.id;
              const isInProgress = job.jobStatus === "in_progress";
              const isCompleted = job.jobStatus === "completed";
              const timer = activeTimers[job.id];

              return (
                <div key={job.id} style={{ background: "#fff", borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow }}>
                  {/* Job Header */}
                  <div style={{ padding: "16px 20px", background: isCompleted ? T.primaryLight : isInProgress ? T.accentLight : "#fff", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>JOB {index + 1}</span>
                          {client?.frequency && (
                            <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: client.frequency === "weekly" ? T.blueLight : client.frequency === "fortnightly" ? T.primaryLight : T.bg, color: client.frequency === "weekly" ? T.blue : client.frequency === "fortnightly" ? T.primary : T.textMuted }}>{client.frequency}</span>
                          )}
                          {isCompleted && <span style={{ fontSize: 14 }}>✅</span>}
                          {isInProgress && <span style={{ fontSize: 14 }}>⏱️</span>}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{job.clientName}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: selectedTeamData?.color }}>{job.startTime}</div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>⏱️ {formatMinutes(job.duration)}</div>
                      </div>
                    </div>
                    
                    {/* Timer Display */}
                    {isInProgress && timer !== undefined && (
                      <div style={{ background: T.accent, color: "#fff", padding: "10px 16px", borderRadius: T.radiusSm, textAlign: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, marginBottom: 2 }}>TIME ELAPSED</div>
                        <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace" }}>{formatDuration(timer)}</div>
                      </div>
                    )}

                    {/* Actual Duration (if completed) */}
                    {isCompleted && job.actualDuration && (
                      <div style={{ background: T.primary, color: "#fff", padding: "8px 16px", borderRadius: T.radiusSm, textAlign: "center", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
                        Completed in {formatMinutes(job.actualDuration)}
                        {job.actualDuration < job.duration && <span> · {job.duration - job.actualDuration}min early! 🎉</span>}
                        {job.actualDuration > job.duration && <span> · {job.actualDuration - job.duration}min over</span>}
                      </div>
                    )}
                    
                    {/* Address */}
                    <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 12 }}>📍 {client?.address || job.suburb}</div>
                    
                    {/* Room counts */}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                      {(job.bedrooms || client?.bedrooms) && <span style={{ fontSize: 13, color: T.text }}>🛏️ {job.bedrooms || client?.bedrooms} bed</span>}
                      {(job.bathrooms || client?.bathrooms) && <span style={{ fontSize: 13, color: T.text }}>🚿 {job.bathrooms || client?.bathrooms} bath</span>}
                      {(job.living || client?.living) && <span style={{ fontSize: 13, color: T.text }}>🛋️ {job.living || client?.living} living</span>}
                      {(job.kitchen || client?.kitchen) && <span style={{ fontSize: 13, color: T.text }}>🍳 {job.kitchen || client?.kitchen} kitchen</span>}
                    </div>

                    {/* Extras */}
                    {job.extras && job.extras.length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        {job.extras.map(extra => (
                          <span key={extra} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: T.accentLight, color: "#8B6914" }}>
                            ✨ {extra === "oven" ? "Oven Clean" : extra === "windows" ? "Windows" : extra}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Access & Notes */}
                  {(client?.accessNotes || client?.notes) && (
                    <div style={{ padding: "12px 20px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      {client?.accessNotes && (
                        <div style={{ display: "flex", gap: 8, marginBottom: client?.notes ? 8 : 0 }}>
                          <span style={{ fontSize: 16 }}>🔑</span>
                          <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{client.accessNotes}</span>
                        </div>
                      )}
                      {client?.notes && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>📝</span>
                          <span style={{ fontSize: 13, color: T.textMuted }}>{client.notes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                      <button onClick={() => { const address = encodeURIComponent(client?.address || `${job.suburb}, QLD, Australia`); window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, "_blank"); }} style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: "none", background: T.blue, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        🗺️ Navigate
                      </button>
                      <button onClick={() => setExpandedJob(isExpanded ? null : job.id)} style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: isExpanded ? T.primaryLight : "#fff", color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        📸 Photos ({photos.before.length + photos.after.length})
                      </button>
                    </div>

                    {/* Status Buttons */}
                    <div style={{ display: "flex", gap: 10 }}>
                      {!isInProgress && !isCompleted && (
                        <button onClick={() => updateJobStatus(job.id, "in_progress")} style={{ flex: 1, padding: "16px", borderRadius: T.radiusSm, border: "none", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                          ▶️ Arrived - Start Timer
                        </button>
                      )}
                      {isInProgress && (
                        <button onClick={() => updateJobStatus(job.id, "completed")} style={{ flex: 1, padding: "16px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                          ✅ Finished - Stop Timer
                        </button>
                      )}
                      {isCompleted && (
                        <div style={{ flex: 1, padding: "16px", borderRadius: T.radiusSm, background: T.primaryLight, color: T.primaryDark, fontSize: 15, fontWeight: 700, textAlign: "center" }}>
                          ✅ Job Completed
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Photos Section (Expandable) */}
                  {isExpanded && (
                    <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${T.border}`, marginTop: 0, paddingTop: 20 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <button onClick={() => setPhotoType("before")} style={{ flex: 1, padding: "10px", borderRadius: T.radiusSm, border: photoType === "before" ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`, background: photoType === "before" ? T.primaryLight : "#fff", color: photoType === "before" ? T.primaryDark : T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          Before ({photos.before.length})
                        </button>
                        <button onClick={() => setPhotoType("after")} style={{ flex: 1, padding: "10px", borderRadius: T.radiusSm, border: photoType === "after" ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`, background: photoType === "after" ? T.primaryLight : "#fff", color: photoType === "after" ? T.primaryDark : T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          After ({photos.after.length})
                        </button>
                      </div>

                      {photos[photoType].length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                          {photos[photoType].map((photo, i) => (
                            <div key={i} style={{ aspectRatio: "1", borderRadius: T.radiusSm, overflow: "hidden", background: T.bg }}>
                              <img src={photo.data} alt={`${photoType} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => cameraInputRef.current?.click()} style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          📷 Take Photo
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          📁 Upload
                        </button>
                      </div>

                      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, job.id, photoType)} style={{ display: "none" }} />
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handlePhotoUpload(e, job.id, photoType)} style={{ display: "none" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1B3A2D", color: "#fff", padding: "14px 24px", borderRadius: 30, fontSize: 14, fontWeight: 600, boxShadow: T.shadowLg, zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
