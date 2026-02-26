import React, { useState, useMemo, useCallback } from 'react';
import { T } from '../shared';
import { useProfiles } from '../hooks/useProfiles';
import { useScheduledJobs } from '../hooks/useScheduledJobs';
import { useStaffTimeEntries } from '../hooks/useStaffTimeEntries';
import { calcWorkedMinutesFromEntry } from '../utils/payroll';

// ═══════════════════════════════════════════════════════════
// STAFF HOURS TAB — Advanced Hour Tracking
// Shows scheduled hours vs actual clocked hours for each staff member.
// Supports daily & weekly views, individual or all-staff display.
// ═══════════════════════════════════════════════════════════

const TODAY = new Date().toISOString().split('T')[0];

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}
function shiftDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => shiftDays(monday, i));
}
function fmtWeekRange(monday) {
  const m = new Date(monday);
  const s = new Date(shiftDays(monday, 6));
  return `${m.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${s.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}
function minsToLabel(mins) {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
function hoursLabel(mins) {
  return `${(Math.max(0, mins) / 60).toFixed(1)}h`;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StaffHoursTab({ showToast, isMobile }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(TODAY));
  const [viewMode, setViewMode] = useState('weekly'); // 'daily' | 'weekly'
  const [staffFilter, setStaffFilter] = useState('all'); // 'all' | staffId
  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [expandedStaff, setExpandedStaff] = useState(null);

  const { staffMembers } = useProfiles();
  const { scheduledJobs } = useScheduledJobs();
  const { timeEntries, loading: entriesLoading, refreshTimeEntries } = useStaffTimeEntries({ weekStart });

  const week = useMemo(() => weekDates(weekStart), [weekStart]);

  const activeStaff = useMemo(
    () => (staffMembers || []).filter(s => s.role === 'staff' && s.is_active),
    [staffMembers]
  );

  const filteredStaff = useMemo(() => {
    if (staffFilter === 'all') return activeStaff;
    return activeStaff.filter(s => String(s.id) === staffFilter);
  }, [activeStaff, staffFilter]);

  // Build data per staff per day
  const staffDayData = useMemo(() => {
    const result = {};
    const weekEnd = shiftDays(weekStart, 6);
    const publishedJobs = (scheduledJobs || []).filter(j => {
      const d = j.date;
      return d >= weekStart && d <= weekEnd && !j.is_break && !j.isBreak && (j.is_published ?? true);
    });

    activeStaff.forEach(staff => {
      const sid = String(staff.id);
      result[sid] = {};

      week.forEach(date => {
        const dayJobs = publishedJobs.filter(j =>
          j.date === date && (j.assigned_staff || []).map(String).includes(sid)
        );
        const scheduledMins = dayJobs.reduce((sum, j) => sum + (j.duration || 0), 0);

        const entry = (timeEntries || []).find(e =>
          String(e.staff_id) === sid && e.work_date === date
        );
        const clockIn = entry?.clock_in_at || entry?.clockInAt || null;
        const clockOut = entry?.clock_out_at || entry?.clockOutAt || null;
        const breakMins = Number(entry?.break_minutes ?? 30);
        const workedMins = entry ? calcWorkedMinutesFromEntry(entry, date === TODAY) : 0;

        const completedJobs = dayJobs.filter(j => {
          const st = j.status || j.job_status || j.jobStatus;
          return st === 'completed';
        });

        result[sid][date] = {
          scheduledMins,
          workedMins,
          clockIn,
          clockOut,
          breakMins,
          jobCount: dayJobs.length,
          completedCount: completedJobs.length,
          jobs: dayJobs,
          entry,
        };
      });
    });
    return result;
  }, [activeStaff, week, weekStart, scheduledJobs, timeEntries]);

  // Weekly aggregates per staff
  const staffWeeklyTotals = useMemo(() => {
    const result = {};
    activeStaff.forEach(staff => {
      const sid = String(staff.id);
      const dayData = staffDayData[sid] || {};
      let totalScheduled = 0, totalWorked = 0, daysWorked = 0, totalJobs = 0, totalCompleted = 0;
      week.forEach(date => {
        const d = dayData[date] || {};
        totalScheduled += d.scheduledMins || 0;
        totalWorked += d.workedMins || 0;
        totalJobs += d.jobCount || 0;
        totalCompleted += d.completedCount || 0;
        if (d.workedMins > 0 || d.clockIn) daysWorked++;
      });
      result[sid] = { totalScheduled, totalWorked, daysWorked, totalJobs, totalCompleted };
    });
    return result;
  }, [activeStaff, staffDayData, week]);

  const filteredTotals = useMemo(() => {
    let scheduled = 0, worked = 0, jobs = 0, completed = 0;
    filteredStaff.forEach((staff) => {
      const totals = staffWeeklyTotals[String(staff.id)] || {};
      scheduled += totals.totalScheduled || 0;
      worked += totals.totalWorked || 0;
      jobs += totals.totalJobs || 0;
      completed += totals.totalCompleted || 0;
    });
    return { scheduled, worked, jobs, completed };
  }, [filteredStaff, staffWeeklyTotals]);

  const activeDay = useMemo(() => {
    if (week.includes(selectedDay)) return selectedDay;
    return week[0] || selectedDay;
  }, [week, selectedDay]);

  const navigateWeek = useCallback((dir) => {
    setWeekStart(prev => shiftDays(prev, dir * 7));
    setSelectedDay(prev => shiftDays(prev, dir * 7));
    setExpandedStaff(null);
  }, []);

  const toggleStaff = useCallback((sid) => {
    setExpandedStaff(prev => prev === sid ? null : sid);
  }, []);

  const variance = (scheduled, actual) => {
    const diff = actual - scheduled;
    if (diff === 0) return null;
    return { diff, label: diff > 0 ? `+${minsToLabel(diff)}` : `-${minsToLabel(Math.abs(diff))}`, isOver: diff > 0 };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900, color: T.text }}>Staff Hours</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textMuted }}>Track scheduled vs actual hours for your team</p>
        </div>
        <button
          onClick={() => refreshTimeEntries?.()}
          style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: T.text, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {/* Controls bar */}
      <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, boxShadow: T.shadow, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => navigateWeek(-1)} style={navBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, minWidth: 160, textAlign: 'center' }}>{fmtWeekRange(weekStart)}</div>
          <button onClick={() => navigateWeek(1)} style={navBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: T.border }} />

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 3, background: '#F3F1EA', borderRadius: 8, padding: 2 }}>
          {[{ id: 'weekly', label: 'Weekly' }, { id: 'daily', label: 'Daily' }].map(v => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              style={{
                border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: viewMode === v.id ? '#fff' : 'transparent',
                color: viewMode === v.id ? T.text : T.textMuted,
                boxShadow: viewMode === v.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: T.border }} />

        {/* Staff filter */}
        <select
          value={staffFilter}
          onChange={(e) => { setStaffFilter(e.target.value); setExpandedStaff(null); }}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: T.text, background: '#fff', cursor: 'pointer' }}
        >
          <option value="all">All Staff</option>
          {activeStaff.map(s => (
            <option key={s.id} value={String(s.id)}>{s.full_name || s.email}</option>
          ))}
        </select>
      </div>

      {/* Day selector for daily view */}
      {viewMode === 'daily' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {week.map((date, i) => {
            const isSel = date === activeDay;
            const isToday = date === TODAY;
            return (
              <button
                key={date}
                onClick={() => setSelectedDay(date)}
                style={{
                  flex: 1, padding: '8px 2px', borderRadius: 10, border: isSel ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                  background: isSel ? `${T.primary}0D` : '#fff', cursor: 'pointer', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: isSel ? T.primary : T.textMuted }}>{DAY_LABELS[i]}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: isSel ? T.primary : T.text }}>{new Date(date).getDate()}</div>
                {isToday && <div style={{ width: 4, height: 4, borderRadius: 4, background: T.primary, margin: '2px auto 0' }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        <SummaryCard
          title="Scheduled"
          value={hoursLabel(viewMode === 'daily' ? filteredStaff.reduce((s, st) => s + ((staffDayData[st.id]?.[activeDay]?.scheduledMins) || 0), 0) : filteredTotals.scheduled)}
          sub={viewMode === 'daily' ? new Date(activeDay).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : 'This week'}
        />
        <SummaryCard
          title="Actual"
          value={hoursLabel(viewMode === 'daily' ? filteredStaff.reduce((s, st) => s + ((staffDayData[st.id]?.[activeDay]?.workedMins) || 0), 0) : filteredTotals.worked)}
          sub="Clocked hours"
          accent
        />
        <SummaryCard
          title="Jobs"
          value={viewMode === 'daily' ? filteredStaff.reduce((s, st) => s + ((staffDayData[st.id]?.[activeDay]?.completedCount) || 0), 0) + '/' + filteredStaff.reduce((s, st) => s + ((staffDayData[st.id]?.[activeDay]?.jobCount) || 0), 0) : `${filteredTotals.completed}/${filteredTotals.jobs}`}
          sub="Completed / Total"
        />
        <SummaryCard
          title="Variance"
          value={(() => {
            const sched = viewMode === 'daily' ? filteredStaff.reduce((s, st) => s + ((staffDayData[st.id]?.[activeDay]?.scheduledMins) || 0), 0) : filteredTotals.scheduled;
            const actual = viewMode === 'daily' ? filteredStaff.reduce((s, st) => s + ((staffDayData[st.id]?.[activeDay]?.workedMins) || 0), 0) : filteredTotals.worked;
            const v = variance(sched, actual);
            return v ? v.label : '0m';
          })()}
          sub="Actual vs Scheduled"
        />
      </div>

      {entriesLoading && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: T.textMuted, border: `1px solid ${T.border}` }}>
          Loading time entries...
        </div>
      )}

      {!entriesLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredStaff.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: T.textMuted, border: `1px solid ${T.border}` }}>
              No active staff members found.
            </div>
          )}

          {filteredStaff.map(staff => {
            const sid = String(staff.id);
            const weekTotal = staffWeeklyTotals[sid] || {};
            const isExpanded = expandedStaff === sid;

            if (viewMode === 'daily') {
              // ── Daily view: one card per staff for selected day ──
              const dayData = staffDayData[sid]?.[activeDay] || {};
              const v = variance(dayData.scheduledMins || 0, dayData.workedMins || 0);
              const hasActivity = dayData.clockIn || dayData.scheduledMins > 0;

              return (
                <div key={sid} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: T.shadow }}>
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: T.primaryLight, color: T.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                        {initials(staff.full_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{staff.full_name}</div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>
                          {dayData.jobCount || 0} job{dayData.jobCount !== 1 ? 's' : ''}
                          {dayData.completedCount > 0 && ` · ${dayData.completedCount} done`}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: dayData.workedMins > 0 ? T.primaryDark : T.textLight }}>
                        {minsToLabel(dayData.workedMins)}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>
                        of {minsToLabel(dayData.scheduledMins)} sched
                      </div>
                    </div>
                  </div>

                  {hasActivity && (
                    <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                      <MiniDetail label="Clock In" value={fmtTime(dayData.clockIn)} />
                      <MiniDetail label="Clock Out" value={fmtTime(dayData.clockOut)} />
                      <MiniDetail label="Break" value={`${dayData.breakMins}m`} />
                      <MiniDetail label="Variance" value={v ? v.label : '—'} accent={v?.isOver ? 'over' : v ? 'under' : null} />
                    </div>
                  )}

                  {!hasActivity && (
                    <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px 14px', fontSize: 12, color: T.textLight }}>
                      No scheduled hours or clock activity for this day.
                    </div>
                  )}
                </div>
              );
            }

            // ── Weekly view: expandable card per staff ──
            const totalV = variance(weekTotal.totalScheduled || 0, weekTotal.totalWorked || 0);
            return (
              <div key={sid} style={{ background: '#fff', border: `1px solid ${isExpanded ? T.primary : T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: T.shadow }}>
                <button
                  onClick={() => toggleStaff(sid)}
                  style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.primaryLight, color: T.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                      {initials(staff.full_name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{staff.full_name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>
                        {weekTotal.daysWorked || 0} day{weekTotal.daysWorked !== 1 ? 's' : ''} active · {weekTotal.totalCompleted || 0}/{weekTotal.totalJobs || 0} jobs
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: T.primaryDark }}>{hoursLabel(weekTotal.totalWorked || 0)}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{hoursLabel(weekTotal.totalScheduled || 0)} sched</div>
                    </div>
                    {totalV && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                        background: totalV.isOver ? '#FFF4E4' : '#E8F5EE',
                        color: totalV.isOver ? '#9A6710' : '#2D7A5E',
                      }}>
                        {totalV.label}
                      </span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${T.border}` }}>
                    {/* Visual hour bars */}
                    <div style={{ padding: '14px 14px 8px', display: 'flex', gap: 4 }}>
                      {week.map((date, i) => {
                        const d = staffDayData[sid]?.[date] || {};
                        const maxMins = Math.max(
                          ...week.map(dd => Math.max(staffDayData[sid]?.[dd]?.scheduledMins || 0, staffDayData[sid]?.[dd]?.workedMins || 0)),
                          60
                        );
                        const schedH = Math.max(2, ((d.scheduledMins || 0) / maxMins) * 48);
                        const workH = Math.max(2, ((d.workedMins || 0) / maxMins) * 48);
                        const isToday = date === TODAY;
                        return (
                          <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div style={{ height: 52, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', width: '100%', position: 'relative' }}>
                              <div style={{ position: 'absolute', bottom: 0, width: '55%', height: schedH, borderRadius: 3, background: '#E8EFE4' }} />
                              <div style={{ position: 'relative', width: '55%', height: workH, borderRadius: 3, background: d.workedMins > 0 ? T.primary : 'transparent' }} />
                            </div>
                            <div style={{ fontSize: 10, fontWeight: isToday ? 800 : 600, color: isToday ? T.primary : T.textMuted }}>{DAY_LABELS[i]}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Day-by-day detail rows */}
                    {week.map((date, i) => {
                      const d = staffDayData[sid]?.[date] || {};
                      const dayV = variance(d.scheduledMins || 0, d.workedMins || 0);
                      const isToday = date === TODAY;
                      const hasData = d.clockIn || d.scheduledMins > 0;
                      if (!hasData) return null;
                      return (
                        <div key={date} style={{ padding: '10px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isToday ? `${T.primary}06` : 'transparent' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? T.primary : T.text }}>
                                {DAY_LABELS[i]}
                              </span>
                              <span style={{ fontSize: 12, color: T.textMuted }}>
                                {new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                              </span>
                              {isToday && <span style={{ fontSize: 9, fontWeight: 700, color: T.primary, background: T.primaryLight, padding: '1px 6px', borderRadius: 20 }}>Today</span>}
                            </div>
                            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                              {d.clockIn ? `${fmtTime(d.clockIn)} – ${d.clockOut ? fmtTime(d.clockOut) : 'Active'}` : 'No clock data'}
                              {d.clockIn && ` · ${d.breakMins}m break`}
                              {d.jobCount > 0 && ` · ${d.completedCount}/${d.jobCount} jobs`}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: d.workedMins > 0 ? T.primaryDark : T.textLight }}>
                              {minsToLabel(d.workedMins)}
                            </div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>
                              {minsToLabel(d.scheduledMins)} sched
                              {dayV && <span style={{ marginLeft: 4, color: dayV.isOver ? '#9A6710' : '#2D7A5E', fontWeight: 600 }}>({dayV.label})</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Week summary row */}
                    <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.border}`, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.primaryDark }}>Week Total</div>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ fontSize: 12, color: T.textMuted }}>Sched: {hoursLabel(weekTotal.totalScheduled || 0)}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.primaryDark }}>Actual: {hoursLabel(weekTotal.totalWorked || 0)}</div>
                        {totalV && <span style={{ fontSize: 11, fontWeight: 700, color: totalV.isOver ? '#9A6710' : '#2D7A5E' }}>({totalV.label})</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function SummaryCard({ title, value, sub, accent }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px', boxShadow: T.shadow }}>
      <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 3, fontSize: 22, fontWeight: 900, color: accent ? T.primaryDark : T.text }}>{value}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: T.textMuted }}>{sub}</div>}
    </div>
  );
}

function MiniDetail({ label, value, accent }) {
  const color = accent === 'over' ? '#9A6710' : accent === 'under' ? '#2D7A5E' : T.text;
  return (
    <div>
      <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const navBtn = {
  width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`,
  background: '#fff', color: T.text, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
