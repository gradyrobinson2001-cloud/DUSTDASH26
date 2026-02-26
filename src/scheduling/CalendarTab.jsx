import React, { useMemo, useState } from "react";
import { T, calculateDuration } from "../shared";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const getPhotoJobId = (photo) => String(photo?.job_id ?? photo?.jobId ?? "");
const getPhotoType = (photo) => (photo?.type === "after" ? "after" : "before");

const isBreakJob = (job) => Boolean(job?.isBreak || job?.is_break);
const getJobDate = (job) => String(job?.date || "");
const getJobId = (job) => String(job?.id || "");
const getJobStart = (job) => String(job?.startTime || job?.start_time || "");
const getJobEnd = (job) => String(job?.endTime || job?.end_time || "");
const getJobDuration = (job) => Number(job?.duration || 0);
const getJobStatus = (job) => String(job?.status || job?.job_status || job?.jobStatus || "scheduled");
const getAssignedIds = (job) => (job?.assigned_staff || []).map(String);
const isPublishedJob = (job) => Boolean(job?.is_published || job?.isPublished);

function shiftIsoDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function monthShift(monthKey, delta) {
  const [y, m] = String(monthKey || "").split("-").map(Number);
  const d = new Date((Number.isFinite(y) ? y : 2026), (Number.isFinite(m) ? m - 1 : 0) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  const d = new Date(`${monthKey}-01T00:00:00`);
  return d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

function buildMonthGrid(monthKey) {
  const start = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  const startDay = (start.getDay() + 6) % 7; // Monday=0
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - startDay);

  return Array.from({ length: 42 }, (_, idx) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + idx);
    return d.toISOString().split("T")[0];
  });
}

function dayLongLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
}

function summaryCard({ label, value, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: T.radiusSm, border: `1px solid ${T.borderLight}`, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, color: T.text, fontWeight: 900, lineHeight: 1.2 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: T.textLight }}>{sub}</div> : null}
    </div>
  );
}

export default function CalendarTab({
  scheduledJobs,
  scheduleClients,
  scheduleSettings,
  weekDates,
  calendarTravelTimes,
  demoMode,
  mapsLoaded,
  isMobile,
  navigateWeek,
  regenerateSchedule,
  syncRecurringSchedule,
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
  const [publishing, setPublishing] = useState(false);
  const [viewMode, setViewMode] = useState("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [monthCursor, setMonthCursor] = useState(() => new Date().toISOString().split("T")[0].slice(0, 7));
  const [staffFilter, setStaffFilter] = useState("all");
  const [showClients, setShowClients] = useState(false);

  const todayDate = new Date().toISOString().split("T")[0];

  const jobsByDate = useMemo(() => {
    const out = {};
    (scheduledJobs || []).forEach((job) => {
      if (isBreakJob(job)) return;
      const date = getJobDate(job);
      if (!date) return;
      if (!out[date]) out[date] = [];
      out[date].push(job);
    });
    Object.keys(out).forEach((date) => {
      out[date].sort((a, b) => getJobStart(a).localeCompare(getJobStart(b)));
    });
    return out;
  }, [scheduledJobs]);

  const weekJobs = useMemo(
    () => (weekDates || []).slice(0, 5).flatMap((date) => jobsByDate[date] || []),
    [jobsByDate, weekDates]
  );

  const activeClients = useMemo(
    () => (scheduleClients || []).filter((c) => String(c?.status || "").toLowerCase() === "active"),
    [scheduleClients]
  );

  const weekUnassigned = weekJobs.filter((job) => getAssignedIds(job).length === 0).length;
  const unpublishedCount = weekJobs.filter((job) => !isPublishedJob(job)).length;
  const allPublished = weekJobs.length > 0 && unpublishedCount === 0;

  const photoComplianceByJob = useMemo(() => {
    const out = {};
    (photos || []).forEach((photo) => {
      const jobId = getPhotoJobId(photo);
      if (!jobId) return;
      if (!out[jobId]) out[jobId] = { before: 0, after: 0, total: 0 };
      const type = getPhotoType(photo);
      out[jobId][type] += 1;
      out[jobId].total += 1;
    });
    return out;
  }, [photos]);

  const weekCompliance = useMemo(() => {
    const checkable = weekJobs.filter((job) => (
      String(getJobDate(job)) <= todayDate ||
      isPublishedJob(job) ||
      getJobStatus(job) === "completed"
    ));

    const missingBefore = checkable.filter((job) => (photoComplianceByJob[getJobId(job)]?.before || 0) === 0).length;
    const missingAfter = checkable.filter((job) => (photoComplianceByJob[getJobId(job)]?.after || 0) === 0).length;

    return { checkableCount: checkable.length, missingBefore, missingAfter };
  }, [photoComplianceByJob, todayDate, weekJobs]);

  const visibleJobsForDate = (date) => {
    const dayJobs = jobsByDate[date] || [];
    if (staffFilter === "all") return dayJobs;
    if (staffFilter === "unassigned") return dayJobs.filter((job) => getAssignedIds(job).length === 0);
    return dayJobs.filter((job) => getAssignedIds(job).includes(staffFilter));
  };

  const handlePublishWeek = async () => {
    if (!publishWeek || !weekDates?.[0]) return;
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
    const job = (scheduledJobs || []).find((j) => String(j.id) === String(jobId));
    if (!job) return;

    const staffKey = String(staffId);
    const current = getAssignedIds(job);
    const isRemoving = current.includes(staffKey);
    const updated = isRemoving ? current.filter((id) => id !== staffKey) : [...current, staffKey];

    try {
      await updateJob(jobId, { assigned_staff: updated });
      const staffName = staffMembers.find((s) => String(s.id) === staffKey)?.full_name || "Staff";
      showToast?.(isRemoving ? `Unassigned ${staffName}` : `Assigned ${staffName}`);
    } catch (e) {
      console.error("[calendar:assign-staff] failed", { jobId, staffId, error: e });
      showToast?.(`Failed to assign staff: ${e.message}`);
    }
  };

  const handlePrev = () => {
    if (viewMode === "week") {
      navigateWeek?.(-1);
      return;
    }
    if (viewMode === "day") {
      setSelectedDate((d) => shiftIsoDate(d, -1));
      return;
    }
    setMonthCursor((m) => monthShift(m, -1));
  };

  const handleNext = () => {
    if (viewMode === "week") {
      navigateWeek?.(1);
      return;
    }
    if (viewMode === "day") {
      setSelectedDate((d) => shiftIsoDate(d, 1));
      return;
    }
    setMonthCursor((m) => monthShift(m, 1));
  };

  const topLabel = viewMode === "week"
    ? `${formatDate(weekDates?.[0])} — ${formatDate(weekDates?.[6])}`
    : viewMode === "day"
      ? dayLongLabel(selectedDate)
      : monthLabel(monthCursor);

  const selectedDayJobs = visibleJobsForDate(selectedDate);
  const selectedTravel = calendarTravelTimes?.[`${selectedDate}_default`] || [];
  const monthGrid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  return (
    <>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Calendar</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
            {activeClients.length} active clients · {scheduledJobs.length} scheduled jobs
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {scheduleClients.length > 0 && (
            <button onClick={() => regenerateSchedule?.()} style={uiBtn.secondary}>Regenerate</button>
          )}
          {scheduleClients.length > 0 && (
            <button onClick={() => syncRecurringSchedule?.()} style={uiBtn.secondary}>Sync Recurring</button>
          )}
          {mapsLoaded && scheduledJobs.length > 0 && (
            <button onClick={calculateCalendarTravelTimes} style={uiBtn.secondary}>Calc Travel</button>
          )}
          <button onClick={() => setShowScheduleSettings(true)} style={uiBtn.ghost}>Settings</button>
          <button onClick={() => setEditingScheduleClient({})} style={uiBtn.primary}>+ Add Client</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
        {summaryCard({ label: "Today", value: visibleJobsForDate(todayDate).length, sub: "jobs" })}
        {summaryCard({ label: "This Week", value: weekJobs.length, sub: "jobs scheduled" })}
        {summaryCard({ label: "Unassigned", value: weekUnassigned, sub: "jobs this week" })}
        {summaryCard({ label: "To Publish", value: unpublishedCount, sub: allPublished ? "all published" : "pending" })}
      </div>

      <div style={{ background: demoMode ? T.accentLight : T.blueLight, borderRadius: T.radius, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: demoMode ? "#8B6914" : T.blue }}>
            {demoMode ? "Demo Mode Active" : "Demo Mode"}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted }}>
            {demoMode ? `${scheduleClients.filter((c) => c.isDemo || c.is_demo).length} demo clients loaded` : "Load sample data to test the calendar"}
          </div>
        </div>
        {!demoMode ? (
          <button onClick={loadDemoData} style={uiBtn.secondary}>Load 70 Demo Clients</button>
        ) : (
          <button onClick={wipeDemo} style={uiBtn.danger}>Wipe Demo Data</button>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: T.radius, boxShadow: T.shadow, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 6, background: T.bg, borderRadius: 12, padding: 4 }}>
            {[
              { id: "day", label: "Day" },
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setViewMode(mode.id);
                  if (mode.id === "month") setMonthCursor(selectedDate.slice(0, 7));
                }}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 800,
                  background: viewMode === mode.id ? "#fff" : "transparent",
                  color: viewMode === mode.id ? T.text : T.textMuted,
                  cursor: "pointer",
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={handlePrev} style={uiBtn.ghost}>←</button>
            <div style={{ minWidth: isMobile ? 160 : 220, textAlign: "center", fontSize: 13, fontWeight: 800, color: T.text }}>
              {topLabel}
            </div>
            <button onClick={handleNext} style={uiBtn.ghost}>→</button>
          </div>

          {weekJobs.length > 0 ? (
            <button
              onClick={handlePublishWeek}
              disabled={publishing || allPublished}
              style={{ ...uiBtn.primary, opacity: publishing ? 0.7 : 1, cursor: (publishing || allPublished) ? "default" : "pointer", background: allPublished ? T.primaryLight : T.primary, color: allPublished ? T.primaryDark : "#fff" }}
            >
              {allPublished ? "Published" : publishing ? "Publishing…" : `Update Rota (${unpublishedCount})`}
            </button>
          ) : <div />}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 12, color: T.text, background: "#fff" }}
          >
            <option value="all">All staff</option>
            <option value="unassigned">Unassigned only</option>
            {staffMembers.map((s) => (
              <option key={s.id} value={String(s.id)}>{s.full_name}</option>
            ))}
          </select>

          {weekCompliance.checkableCount > 0 && (
            <div style={{ fontSize: 12, color: T.textMuted }}>
              Photo compliance: <span style={{ color: weekCompliance.missingBefore > 0 ? T.danger : T.primaryDark, fontWeight: 700 }}>Before missing {weekCompliance.missingBefore}</span> · <span style={{ color: weekCompliance.missingAfter > 0 ? T.danger : T.primaryDark, fontWeight: 700 }}>After missing {weekCompliance.missingAfter}</span>
            </div>
          )}
        </div>
      </div>

      {viewMode === "day" && (
        <div style={{ background: "#fff", borderRadius: T.radius, boxShadow: T.shadow, padding: "14px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700 }}>{WEEKDAY_LONG[(new Date(`${selectedDate}T00:00:00`).getDay() + 6) % 7]}</div>
              <div style={{ fontSize: 20, color: T.text, fontWeight: 900 }}>{formatDate(selectedDate)}</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>{selectedDayJobs.length} job{selectedDayJobs.length === 1 ? "" : "s"}</div>
            </div>
            <button onClick={() => setEditingJob({ date: selectedDate, isNew: true })} style={uiBtn.primary}>+ Add Job</button>
          </div>

          {selectedDayJobs.length === 0 ? (
            <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: 26, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
              No jobs for this day.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selectedDayJobs.map((job, idx) => (
                <div key={getJobId(job)}>
                  <JobCard
                    job={job}
                    staffMembers={staffMembers}
                    photoComplianceByJob={photoComplianceByJob}
                    todayDate={todayDate}
                    onOpen={() => setEditingJob(job)}
                    onToggleStaff={(staffId) => handleStaffToggle(job.id, staffId)}
                  />
                  {idx < selectedTravel.length && (
                    <div style={{ margin: "6px 8px 0", fontSize: 11, color: T.textLight }}>
                      Travel to next: {selectedTravel[idx]?.duration ?? "?"} min · {selectedTravel[idx]?.distance ?? "?"} km
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === "week" && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(5, minmax(180px, 1fr))" : "repeat(5, 1fr)", gap: 10, minWidth: isMobile ? 940 : "auto" }}>
            {(weekDates || []).slice(0, 5).map((date, i) => {
              const dayJobs = visibleJobsForDate(date);
              const isToday = date === todayDate;

              return (
                <div key={date} style={{ background: "#fff", borderRadius: T.radius, border: `1px solid ${isToday ? T.primary : T.borderLight}`, boxShadow: T.shadow }}>
                  <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.borderLight}`, background: isToday ? T.primaryLight : "#fff" }}>
                    <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>{WEEKDAY_SHORT[i]}</div>
                    <div style={{ fontSize: 16, color: T.text, fontWeight: 900 }}>{formatDate(date)}</div>
                    <div style={{ fontSize: 11, color: T.textLight }}>{dayJobs.length} job{dayJobs.length === 1 ? "" : "s"}</div>
                  </div>

                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 510, overflowY: "auto" }}>
                    {dayJobs.length === 0 ? (
                      <div style={{ padding: "10px", background: T.bg, borderRadius: 8, fontSize: 12, color: T.textLight, textAlign: "center" }}>No jobs</div>
                    ) : (
                      dayJobs.map((job) => (
                        <JobCard
                          key={getJobId(job)}
                          job={job}
                          compact
                          staffMembers={staffMembers}
                          photoComplianceByJob={photoComplianceByJob}
                          todayDate={todayDate}
                          onOpen={() => setEditingJob(job)}
                          onToggleStaff={(staffId) => handleStaffToggle(job.id, staffId)}
                        />
                      ))
                    )}

                    <button onClick={() => setEditingJob({ date, isNew: true })} style={uiBtn.dashed}>+ Add Job</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "month" && (
        <div style={{ background: "#fff", borderRadius: T.radius, boxShadow: T.shadow, padding: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginBottom: 8 }}>
            {WEEKDAY_SHORT.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: T.textMuted, fontWeight: 700 }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
            {monthGrid.map((date) => {
              const jobs = visibleJobsForDate(date);
              const inMonth = date.startsWith(monthCursor);
              const isToday = date === todayDate;
              const isSelected = date === selectedDate;

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    minHeight: isMobile ? 88 : 96,
                    borderRadius: 10,
                    border: `1px solid ${isSelected ? T.primary : T.borderLight}`,
                    background: isSelected ? `${T.primary}12` : "#fff",
                    padding: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                    opacity: inMonth ? 1 : 0.45,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{new Date(`${date}T00:00:00`).getDate()}</span>
                    {isToday ? <span style={{ fontSize: 9, color: T.primaryDark, fontWeight: 800 }}>Today</span> : null}
                  </div>
                  <div style={{ fontSize: 11, color: jobs.length > 0 ? T.text : T.textLight, fontWeight: jobs.length > 0 ? 700 : 500 }}>
                    {jobs.length} job{jobs.length === 1 ? "" : "s"}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {jobs[0]?.clientName || jobs[0]?.client_name || ""}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: T.bg, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>Selected day</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{dayLongLabel(selectedDate)}</div>
              <div style={{ fontSize: 12, color: T.textLight }}>{selectedDayJobs.length} job{selectedDayJobs.length === 1 ? "" : "s"}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingJob({ date: selectedDate, isNew: true })} style={uiBtn.ghost}>+ Add Job</button>
              <button onClick={() => setViewMode("day")} style={uiBtn.primary}>Open Day View</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button onClick={() => setShowClients((v) => !v)} style={uiBtn.ghost}>
          {showClients ? "Hide Scheduled Clients" : "Show Scheduled Clients"}
        </button>

        {showClients && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>Scheduled Clients</h3>
              <span style={{ fontSize: 13, color: T.textMuted }}>
                {scheduleClients.filter((c) => !(c.isDemo || c.is_demo)).length} real · {scheduleClients.filter((c) => c.isDemo || c.is_demo).length} demo
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 10 }}>
              {scheduleClients.slice(0, 12).map((client) => {
                const duration = client.customDuration || client.custom_duration || client.estimatedDuration || client.estimated_duration || calculateDuration(client, scheduleSettings);
                const nextJob = scheduledJobs.find((j) =>
                  String(j.clientId || j.client_id) === String(client.id) &&
                  j.date >= todayDate
                );

                return (
                  <div
                    key={client.id}
                    onClick={() => setEditingScheduleClient(client)}
                    style={{ background: "#fff", borderRadius: T.radius, padding: "12px 14px", boxShadow: T.shadow, cursor: "pointer", borderLeft: `4px solid ${T.primary}`, opacity: client.isDemo ? 0.84 : 1 }}
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
                    <div style={{ display: "flex", gap: 10, fontSize: 11, color: T.textMuted, flexWrap: "wrap" }}>
                      <span>{duration} mins</span>
                      <span>{client.frequency}</span>
                      <span>{client.preferredDay || client.preferred_day}</span>
                    </div>
                    {nextJob && (
                      <div style={{ marginTop: 8, fontSize: 11, color: T.primary, fontWeight: 700 }}>
                        Next: {formatDate(nextJob.date)} at {getJobStart(nextJob)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function JobCard({ job, compact = false, staffMembers, photoComplianceByJob, todayDate, onOpen, onToggleStaff }) {
  const assignedIds = getAssignedIds(job);
  const assignedNames = assignedIds.map((id) => staffMembers.find((s) => String(s.id) === id)?.full_name).filter(Boolean);
  const isPublished = isPublishedJob(job);
  const photoState = photoComplianceByJob[getJobId(job)] || { before: 0, after: 0 };
  const requiresPhotoCheck = (
    String(getJobDate(job)) <= todayDate ||
    isPublished ||
    getJobStatus(job) === "completed"
  );

  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 7px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.2,
  };

  return (
    <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${T.borderLight}`, padding: compact ? "8px 9px" : "10px 12px" }}>
      <div onClick={onOpen} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div>
            <div style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: T.text }}>{job.clientName || job.client_name}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{job.suburb}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{getJobStart(job)} - {getJobEnd(job)}</div>
            <div style={{ fontSize: 10, color: T.textLight }}>{getJobDuration(job)} mins</div>
          </div>
        </div>

        <div style={{ marginTop: 7, display: "flex", gap: 5, flexWrap: "wrap" }}>
          <span style={{ ...badgeStyle, background: isPublished ? T.primaryLight : T.bg, color: isPublished ? T.primaryDark : T.textMuted }}>
            {isPublished ? "Published" : "Draft"}
          </span>
          {requiresPhotoCheck && (
            <>
              <span style={{ ...badgeStyle, background: photoState.before > 0 ? T.primaryLight : T.dangerLight, color: photoState.before > 0 ? T.primaryDark : T.danger }}>
                Before {photoState.before > 0 ? "✓" : "Missing"}
              </span>
              <span style={{ ...badgeStyle, background: photoState.after > 0 ? T.primaryLight : T.dangerLight, color: photoState.after > 0 ? T.primaryDark : T.danger }}>
                After {photoState.after > 0 ? "✓" : "Missing"}
              </span>
            </>
          )}
        </div>

        <div style={{ marginTop: 7, fontSize: 11, color: T.textMuted }}>
          {assignedNames.length > 0 ? assignedNames.join(", ") : "Unassigned"}
        </div>
      </div>

      {staffMembers.length > 0 && (
        <div style={{ marginTop: 7 }}>
          <StaffAssignDropdown
            job={job}
            staffMembers={staffMembers}
            onToggle={onToggleStaff}
          />
        </div>
      )}
    </div>
  );
}

function StaffAssignDropdown({ job, staffMembers, onToggle }) {
  const [open, setOpen] = useState(false);
  const assigned = getAssignedIds(job);

  return (
    <div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{ width: "100%", padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.border}`, background: "#fff", fontSize: 10, color: T.textMuted, cursor: "pointer", textAlign: "left" }}
      >
        {open ? "Close" : "Assign staff..."}
      </button>

      {open && (
        <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: 5, marginTop: 4, boxShadow: T.shadow }}>
          {staffMembers.map((staff) => {
            const isAssigned = assigned.includes(String(staff.id));
            return (
              <button
                key={staff.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(staff.id);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "none",
                  background: isAssigned ? T.primaryLight : "transparent",
                  fontSize: 11,
                  fontWeight: isAssigned ? 700 : 500,
                  color: isAssigned ? T.primaryDark : T.text,
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                {isAssigned ? "✓ " : ""}{staff.full_name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const uiBtn = {
  primary: {
    padding: "8px 14px",
    borderRadius: T.radiusSm,
    border: "none",
    background: T.primary,
    fontSize: 12,
    fontWeight: 800,
    color: "#fff",
    cursor: "pointer",
  },
  secondary: {
    padding: "8px 14px",
    borderRadius: T.radiusSm,
    border: `1.5px solid ${T.blue}`,
    background: T.blueLight,
    fontSize: 12,
    fontWeight: 700,
    color: T.blue,
    cursor: "pointer",
  },
  ghost: {
    padding: "8px 12px",
    borderRadius: T.radiusSm,
    border: `1.5px solid ${T.border}`,
    background: "#fff",
    fontSize: 12,
    fontWeight: 700,
    color: T.textMuted,
    cursor: "pointer",
  },
  danger: {
    padding: "8px 14px",
    borderRadius: T.radiusSm,
    border: "none",
    background: T.danger,
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
  },
  dashed: {
    width: "100%",
    padding: "7px",
    borderRadius: 8,
    border: `1.5px dashed ${T.border}`,
    background: "transparent",
    fontSize: 11,
    color: T.textMuted,
    cursor: "pointer",
  },
};
