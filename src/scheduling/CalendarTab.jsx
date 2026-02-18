import React from "react";
import { T, calculateDuration } from "../shared";

export default function CalendarTab({
  scheduledJobs,
  scheduleClients,
  scheduleSettings,
  weekDates,
  calendarWeekStart,
  calendarTravelTimes,
  demoMode,
  mapsLoaded,
  isMobile,
  navigateWeek,
  regenerateSchedule,
  calculateCalendarTravelTimes,
  setShowScheduleSettings,
  setEditingJob,
  setEditingScheduleClient,
  loadDemoData,
  wipeDemo,
  formatDate,
}) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Calendar</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
            {scheduleClients.filter(c => c.status === "active").length} active clients · {scheduledJobs.length} scheduled jobs
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {scheduleClients.length > 0 && (
            <button onClick={() => regenerateSchedule()} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.blue}`, background: T.blueLight, fontSize: 12, fontWeight: 700, color: T.blue, cursor: "pointer" }}>
              🔄 Regenerate
            </button>
          )}
          {mapsLoaded && scheduledJobs.length > 0 && (
            <button onClick={calculateCalendarTravelTimes} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.primary}`, background: T.primaryLight, fontSize: 12, fontWeight: 700, color: T.primaryDark, cursor: "pointer" }}>
              🚗 Calc Travel
            </button>
          )}
          <button onClick={() => setShowScheduleSettings(true)} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
            ⚙️ Settings
          </button>
          <button onClick={() => setEditingScheduleClient({})} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: "none", background: T.primary, fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            + Add Client
          </button>
        </div>
      </div>

      {/* Demo Mode Banner */}
      <div style={{ background: demoMode ? T.accentLight : T.blueLight, borderRadius: T.radius, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🧪</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: demoMode ? "#8B6914" : T.blue }}>
              {demoMode ? "Demo Mode Active" : "Demo Mode"}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {demoMode ? `${scheduleClients.filter(c => c.isDemo).length} demo clients loaded` : "Load sample data to test the calendar"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!demoMode ? (
            <button onClick={loadDemoData} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Load 45 Demo Clients
            </button>
          ) : (
            <button onClick={wipeDemo} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.danger, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              ⚠️ Wipe Demo Data
            </button>
          )}
        </div>
      </div>

      {/* Week Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => navigateWeek(-1)} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 13, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>← Prev Week</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>{formatDate(weekDates[0])} — {formatDate(weekDates[6])}</div>
        <button onClick={() => navigateWeek(1)} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 13, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>Next Week →</button>
      </div>

      {/* Team Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        {scheduleSettings.teams.map(team => (
          <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: team.color }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{team.name}</span>
            <span style={{ fontSize: 12, color: T.textMuted }}>
              ({scheduledJobs.filter(j => j.teamId === team.id && weekDates.includes(j.date)).length} jobs this week)
            </span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(5, minmax(140px, 1fr))" : "repeat(5, 1fr)", gap: 12, minWidth: isMobile ? 700 : "auto" }}>
          {weekDates.slice(0, 5).map((date, i) => {
            const isToday = date === new Date().toISOString().split("T")[0];
            const areaForDay = scheduleSettings.areaSchedule[dayNames[i].toLowerCase()] || [];

            return (
              <div key={date} style={{ background: "#fff", borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow, border: isToday ? `2px solid ${T.primary}` : "none" }}>
                <div style={{ background: isToday ? T.primary : T.sidebar, padding: "12px 14px", color: "#fff" }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{dayNames[i]}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{formatDate(date)}</div>
                  {areaForDay.length > 0 && <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>📍 {areaForDay.join(", ")}</div>}
                </div>

                <div style={{ padding: "12px" }}>
                  {scheduleSettings.teams.map(team => {
                    const teamJobs = scheduledJobs.filter(j => j.date === date && j.teamId === team.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
                    return (
                      <div key={team.id} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: team.color, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: team.color }} />
                          {team.name} ({teamJobs.length}/{scheduleSettings.jobsPerTeamPerDay})
                        </div>

                        {teamJobs.length === 0 ? (
                          <div style={{ padding: "8px 10px", background: T.bg, borderRadius: 6, fontSize: 11, color: T.textLight, textAlign: "center" }}>No jobs</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {teamJobs.map((job, jobIndex) => {
                              const nextJob = teamJobs[jobIndex + 1];
                              const travelKey = `${date}_${team.id}`;
                              const travelData = calendarTravelTimes[travelKey]?.[jobIndex];

                              return (
                                <React.Fragment key={job.id}>
                                  <div
                                    onClick={() => !job.isBreak && setEditingJob(job)}
                                    style={{
                                      padding: "8px 10px",
                                      background: job.isBreak ? T.accentLight : job.status === "completed" ? "#D4EDDA" : `${team.color}15`,
                                      borderLeft: job.isBreak ? `3px solid ${T.accent}` : `3px solid ${team.color}`,
                                      borderRadius: "0 6px 6px 0",
                                      cursor: job.isBreak ? "default" : "pointer",
                                    }}
                                  >
                                    <div style={{ fontWeight: 700, fontSize: 12, color: job.isBreak ? "#8B6914" : T.text, marginBottom: 2 }}>
                                      {job.isBreak ? "🍴 Lunch Break" : job.clientName}
                                    </div>
                                    <div style={{ fontSize: 10, color: T.textMuted }}>
                                      {job.startTime} - {job.endTime}
                                      {!job.isBreak && <span> ({job.duration} mins)</span>}
                                    </div>
                                    {!job.isBreak && (
                                      <div style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                                        📍 {job.suburb}
                                        {job.status === "completed" && <span style={{ color: "#155724" }}>✓</span>}
                                      </div>
                                    )}
                                  </div>

                                  {nextJob && (
                                    <div style={{ padding: "4px 10px 4px 14px", fontSize: 9, color: T.textLight, display: "flex", alignItems: "center", gap: 4, borderLeft: `3px solid ${T.border}` }}>
                                      {travelData ? (
                                        <>
                                          <span>↓</span>
                                          <span style={{ color: T.textMuted }}>{travelData.duration} mins</span>
                                          <span>·</span>
                                          <span>{travelData.distance} km</span>
                                        </>
                                      ) : (
                                        <>
                                          <span>↓</span>
                                          <span style={{ fontStyle: "italic" }}>travel</span>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={() => setEditingJob({ date, teamId: scheduleSettings.teams[0].id, isNew: true })}
                    style={{ width: "100%", padding: "6px", borderRadius: 6, border: `1.5px dashed ${T.border}`, background: "transparent", fontSize: 11, color: T.textMuted, cursor: "pointer", marginTop: 4 }}
                  >
                    + Add Job
                  </button>

                  {/* Daily Travel Summary */}
                  {(() => {
                    let totalDistance = 0;
                    let totalDuration = 0;
                    let hasData = false;
                    scheduleSettings.teams.forEach(team => {
                      const travelData = calendarTravelTimes[`${date}_${team.id}`];
                      if (travelData) {
                        travelData.forEach(t => {
                          if (t.distance && !isNaN(parseFloat(t.distance))) { totalDistance += parseFloat(t.distance); hasData = true; }
                          if (t.duration && !isNaN(parseInt(t.duration))) { totalDuration += parseInt(t.duration); }
                        });
                      }
                    });
                    if (!hasData) return null;
                    return (
                      <div style={{ marginTop: 8, padding: "8px 10px", background: T.bg, borderRadius: 6, fontSize: 10, color: T.textMuted, display: "flex", justifyContent: "center", gap: 12 }}>
                        <span>🚗 {totalDistance.toFixed(1)} km</span>
                        <span>⏱️ {totalDuration} mins</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scheduled Clients List */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>Scheduled Clients</h3>
          <span style={{ fontSize: 13, color: T.textMuted }}>
            {scheduleClients.filter(c => !c.isDemo).length} real · {scheduleClients.filter(c => c.isDemo).length} demo
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
          {scheduleClients.slice(0, 12).map(client => {
            const team = scheduleSettings.teams.find(t => t.id === client.assignedTeam);
            const duration = client.customDuration || calculateDuration(client, scheduleSettings);
            const nextJob = scheduledJobs.find(j => j.clientId === client.id && j.date >= new Date().toISOString().split("T")[0]);

            return (
              <div
                key={client.id}
                onClick={() => setEditingScheduleClient(client)}
                style={{ background: "#fff", borderRadius: T.radius, padding: "14px 16px", boxShadow: T.shadow, cursor: "pointer", borderLeft: `4px solid ${team?.color || T.border}`, opacity: client.isDemo ? 0.8 : 1 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>
                      {client.name}
                      {client.isDemo && <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", background: T.accentLight, color: "#8B6914", borderRadius: 4 }}>DEMO</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>📍 {client.suburb}</div>
                  </div>
                  <div style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: (team?.color || T.primary) + "20", color: team?.color || T.primary, fontWeight: 700 }}>
                    {team?.name}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.textMuted }}>
                  <span>🕐 {duration} mins</span>
                  <span>📅 {client.frequency}</span>
                  <span>📆 {client.preferredDay}</span>
                </div>
                {nextJob && (
                  <div style={{ marginTop: 8, fontSize: 11, color: T.primary, fontWeight: 600 }}>
                    Next: {formatDate(nextJob.date)} at {nextJob.startTime}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {scheduleClients.length > 12 && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <span style={{ fontSize: 13, color: T.textMuted }}>+ {scheduleClients.length - 12} more clients</span>
          </div>
        )}
      </div>
    </>
  );
}
