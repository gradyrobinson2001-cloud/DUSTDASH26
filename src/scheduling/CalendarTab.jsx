import React, { useMemo, useState } from "react";
import { T, calculateDuration } from "../shared";

const getPhotoJobId = (photo) => String(photo?.job_id ?? photo?.jobId ?? "");
const getPhotoType = (photo) => (photo?.type === "after" ? "after" : "before");

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
  staffMembers = [],
  publishWeek,
  updateJob,
  showToast,
  photos = [],
}) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [publishing, setPublishing] = useState(false);
  const todayDate = new Date().toISOString().split("T")[0];

  // Check if any jobs this week are unpublished
  const weekJobs = scheduledJobs.filter(j => weekDates.includes(j.date));
  const unpublishedCount = weekJobs.filter(j => !j.is_published && !j.isBreak).length;
  const allPublished = weekJobs.length > 0 && unpublishedCount === 0;
  const photoComplianceByJob = useMemo(() => {
    const out = {};
    (photos || []).forEach((photo) => {
      const jobId = getPhotoJobId(photo);
      if (!jobId) return;
      if (!out[jobId]) {
        out[jobId] = { before: 0, after: 0, total: 0 };
      }
      const type = getPhotoType(photo);
      out[jobId][type] += 1;
      out[jobId].total += 1;
    });
    return out;
  }, [photos]);

  const weekCompliance = useMemo(() => {
    const checkable = weekJobs.filter((job) =>
      !job.isBreak && !job.is_break &&
      (
        String(job.date || "") <= todayDate ||
        Boolean(job.is_published || job.isPublished) ||
        String(job.status || job.job_status || job.jobStatus) === "completed"
      )
    );

    const missingBefore = checkable.filter((job) => {
      const data = photoComplianceByJob[String(job.id)] || { before: 0 };
      return data.before === 0;
    }).length;

    const missingAfter = checkable.filter((job) => {
      const data = photoComplianceByJob[String(job.id)] || { after: 0 };
      return data.after === 0;
    }).length;

    return { checkableCount: checkable.length, missingBefore, missingAfter };
  }, [weekJobs, photoComplianceByJob, todayDate]);

  const handlePublishWeek = async () => {
    if (!publishWeek) return;
    setPublishing(true);
    try {
      await publishWeek(weekDates[0]);
      showToast?.("Rota published! Staff can now see this week's jobs.");
    } catch (e) {
      showToast?.(`Error: ${e.message}`);
    }
    setPublishing(false);
  };

  const handleStaffToggle = async (jobId, staffId) => {
    if (!updateJob) return;
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) return;
    const staffKey = String(staffId);
    const current = (job.assigned_staff || []).map(String);
    const isRemoving = current.includes(staffKey);
    const updated = isRemoving
      ? current.filter(id => id !== staffKey)
      : [...current, staffKey];
    try {
      await updateJob(jobId, { assigned_staff: updated });
      const staffName = staffMembers.find(s => String(s.id) === staffKey)?.full_name || "Staff";
      showToast?.(isRemoving ? `Unassigned ${staffName}` : `Assigned ${staffName}`);
    } catch (e) {
      console.error("[calendar:assign-staff] failed", { jobId, staffId, error: e });
      showToast?.(`Failed to assign staff: ${e.message}`);
    }
  };

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
              Regenerate
            </button>
          )}
          {mapsLoaded && scheduledJobs.length > 0 && (
            <button onClick={calculateCalendarTravelTimes} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.primary}`, background: T.primaryLight, fontSize: 12, fontWeight: 700, color: T.primaryDark, cursor: "pointer" }}>
              Calc Travel
            </button>
          )}
          <button onClick={() => setShowScheduleSettings(true)} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
            Settings
          </button>
          <button onClick={() => setEditingScheduleClient({})} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: "none", background: T.primary, fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            + Add Client
          </button>
        </div>
      </div>

      {/* Demo Mode Banner */}
      <div style={{ background: demoMode ? T.accentLight : T.blueLight, borderRadius: T.radius, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: demoMode ? "#8B6914" : T.blue }}>
              {demoMode ? "Demo Mode Active" : "Demo Mode"}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {demoMode ? `${scheduleClients.filter(c => c.isDemo || c.is_demo).length} demo clients loaded` : "Load sample data to test the calendar"}
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
              Wipe Demo Data
            </button>
          )}
        </div>
      </div>

      {/* Week Navigation + Update Rota */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <button onClick={() => navigateWeek(-1)} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 13, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>← Prev</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>{formatDate(weekDates[0])} — {formatDate(weekDates[6])}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {weekJobs.length > 0 && (
            <button
              onClick={handlePublishWeek}
              disabled={publishing || allPublished}
              style={{
                padding: "8px 16px", borderRadius: T.radiusSm, border: "none",
                background: allPublished ? T.primaryLight : T.primary,
                color: allPublished ? T.primaryDark : "#fff",
                fontSize: 12, fontWeight: 700,
                cursor: (publishing || allPublished) ? "default" : "pointer",
                opacity: publishing ? 0.7 : 1,
              }}
            >
              {allPublished ? "Published" : publishing ? "Publishing…" : `Update Rota (${unpublishedCount} unpublished)`}
            </button>
          )}
          <button onClick={() => navigateWeek(1)} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 13, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>Next →</button>
        </div>
      </div>

      {weekCompliance.checkableCount > 0 && (
        <div style={{ marginBottom: 16, background: "#fff", border: `1px solid ${T.borderLight}`, borderRadius: T.radiusSm, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: T.textMuted }}>
            Photo compliance for {weekCompliance.checkableCount} completed/published/past job{weekCompliance.checkableCount === 1 ? "" : "s"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: weekCompliance.missingBefore > 0 ? T.danger : T.primaryDark }}>
              Before missing: {weekCompliance.missingBefore}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: weekCompliance.missingAfter > 0 ? T.danger : T.primaryDark }}>
              After missing: {weekCompliance.missingAfter}
            </span>
          </div>
        </div>
      )}

      {/* Staff Legend */}
      {staffMembers.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {staffMembers.map((s, i) => {
            const colors = [T.primary, T.blue, "#E8C86A", "#D4645C", "#9B59B6", "#E67E22"];
            const color = colors[i % colors.length];
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.full_name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar Grid */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(5, minmax(140px, 1fr))" : "repeat(5, 1fr)", gap: 12, minWidth: isMobile ? 700 : "auto" }}>
          {weekDates.slice(0, 5).map((date, i) => {
            const isToday = date === new Date().toISOString().split("T")[0];
            const dayJobs = scheduledJobs
              .filter(j => j.date === date && !j.isBreak && !j.is_break)
              .sort((a, b) => (a.startTime || a.start_time || '').localeCompare(b.startTime || b.start_time || ''));

            return (
              <div key={date} style={{ background: "#fff", borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow, border: isToday ? `2px solid ${T.primary}` : "none" }}>
                <div style={{ background: isToday ? T.primary : T.sidebar, padding: "12px 14px", color: "#fff" }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{dayNames[i]}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{formatDate(date)}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
                    {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <div style={{ padding: "12px" }}>
                  {dayJobs.length === 0 ? (
                    <div style={{ padding: "8px 10px", background: T.bg, borderRadius: 6, fontSize: 11, color: T.textLight, textAlign: "center" }}>No jobs</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {dayJobs.map((job) => {
                        const assigned = (job.assigned_staff || []).map(String);
                        const assignedNames = assigned.map(id => staffMembers.find(s => String(s.id) === id)?.full_name).filter(Boolean);
                        const isPublished = Boolean(job.is_published || job.isPublished);
                        const photoState = photoComplianceByJob[String(job.id)] || { before: 0, after: 0, total: 0 };
                        const requiresPhotoCheck =
                          String(job.date || "") <= todayDate ||
                          isPublished ||
                          String(job.status || job.job_status || job.jobStatus) === "completed";
                        const missingBefore = requiresPhotoCheck && photoState.before === 0;
                        const missingAfter = requiresPhotoCheck && photoState.after === 0;
                        const hasPhotoWarning = missingBefore || missingAfter;

                        return (
                          <div key={job.id} style={{ position: "relative" }}>
                            <div
                              onClick={() => setEditingJob(job)}
                              style={{
                                padding: "8px 10px",
                                background: isPublished ? `${T.primary}10` : "#fff",
                                borderLeft: `3px solid ${assigned.length > 0 ? T.primary : T.border}`,
                                borderRadius: "0 6px 6px 0",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: 12, color: T.text, marginBottom: 2 }}>
                                {job.clientName || job.client_name}
                              </div>
                              <div style={{ fontSize: 10, color: T.textMuted }}>
                                {job.startTime || job.start_time} - {job.endTime || job.end_time}
                                <span> ({job.duration} mins)</span>
                              </div>
                              <div style={{ fontSize: 10, color: T.textMuted }}>
                                {job.suburb}
                              </div>

                              {requiresPhotoCheck && (
                                <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: photoState.before > 0 ? T.primaryLight : T.dangerLight, color: photoState.before > 0 ? T.primaryDark : T.danger }}>
                                    Before {photoState.before > 0 ? "✓" : "Missing"}
                                  </span>
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: photoState.after > 0 ? T.primaryLight : T.dangerLight, color: photoState.after > 0 ? T.primaryDark : T.danger }}>
                                    After {photoState.after > 0 ? "✓" : "Missing"}
                                  </span>
                                </div>
                              )}

                              {/* Assigned staff chips */}
                              {assignedNames.length > 0 ? (
                                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                                  {assignedNames.map(name => (
                                    <span key={name} style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: T.primaryLight, color: T.primaryDark }}>
                                      {name.split(' ')[0]}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: 9, color: T.textLight, fontStyle: "italic", marginTop: 3 }}>Unassigned</div>
                              )}

                              {/* Published indicator */}
                              {isPublished && (
                                <div style={{ position: "absolute", top: 4, right: 6, fontSize: 9, color: T.primary, fontWeight: 700 }}>
                                  Published
                                </div>
                              )}
                              {hasPhotoWarning && (
                                <div style={{ position: "absolute", top: 18, right: 6, fontSize: 9, color: T.danger, fontWeight: 700 }}>
                                  Photo check
                                </div>
                              )}
                            </div>

                            {/* Quick staff assign dropdown */}
                            {staffMembers.length > 0 && (
                              <StaffAssignDropdown
                                job={job}
                                staffMembers={staffMembers}
                                onToggle={(staffId) => handleStaffToggle(job.id, staffId)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => setEditingJob({ date, isNew: true })}
                    style={{ width: "100%", padding: "6px", borderRadius: 6, border: `1.5px dashed ${T.border}`, background: "transparent", fontSize: 11, color: T.textMuted, cursor: "pointer", marginTop: 8 }}
                  >
                    + Add Job
                  </button>
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
            {scheduleClients.filter(c => !(c.isDemo || c.is_demo)).length} real · {scheduleClients.filter(c => c.isDemo || c.is_demo).length} demo
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
          {scheduleClients.slice(0, 12).map(client => {
            const duration = client.customDuration || client.custom_duration || client.estimatedDuration || client.estimated_duration || calculateDuration(client, scheduleSettings);
            const nextJob = scheduledJobs.find(j =>
              String(j.clientId || j.client_id) === String(client.id) &&
              j.date >= new Date().toISOString().split("T")[0]
            );

            return (
              <div
                key={client.id}
                onClick={() => setEditingScheduleClient(client)}
                style={{ background: "#fff", borderRadius: T.radius, padding: "14px 16px", boxShadow: T.shadow, cursor: "pointer", borderLeft: `4px solid ${T.primary}`, opacity: client.isDemo ? 0.8 : 1 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>
                      {client.name}
                      {(client.isDemo || client.is_demo) && <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", background: T.accentLight, color: "#8B6914", borderRadius: 4 }}>DEMO</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{client.suburb}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.textMuted }}>
                  <span>{duration} mins</span>
                  <span>{client.frequency}</span>
                  <span>{client.preferredDay}</span>
                </div>
                {nextJob && (
                  <div style={{ marginTop: 8, fontSize: 11, color: T.primary, fontWeight: 600 }}>
                    Next: {formatDate(nextJob.date)} at {nextJob.startTime || nextJob.start_time}
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

// ─── Inline Staff Assignment Dropdown ──────────────────
function StaffAssignDropdown({ job, staffMembers, onToggle }) {
  const [open, setOpen] = useState(false);
  const assigned = (job.assigned_staff || []).map(String);

  return (
    <div style={{ marginTop: 2 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          width: "100%", padding: "3px 8px", borderRadius: 4, border: `1px solid ${T.border}`,
          background: "#fff", fontSize: 9, color: T.textMuted, cursor: "pointer", textAlign: "left",
        }}
      >
        {open ? "Close" : "Assign staff..."}
      </button>
      {open && (
        <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: 4, marginTop: 2, boxShadow: T.shadow }}>
          {staffMembers.map(s => {
            const isAssigned = assigned.includes(String(s.id));
            return (
              <button
                key={s.id}
                onClick={(e) => { e.stopPropagation(); onToggle(s.id); }}
                style={{
                  display: "block", width: "100%", padding: "4px 8px", borderRadius: 4,
                  border: "none", background: isAssigned ? T.primaryLight : "transparent",
                  fontSize: 11, fontWeight: isAssigned ? 700 : 400, color: isAssigned ? T.primaryDark : T.text,
                  cursor: "pointer", textAlign: "left", marginBottom: 1,
                }}
              >
                {isAssigned ? "✓ " : ""}{s.full_name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
