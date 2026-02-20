import React, { useState, useMemo } from 'react';
import { T } from '../shared';
import { useRota } from '../hooks/useRota';
import { useAuth } from '../auth/AuthProvider';

// ═══════════════════════════════════════════════════════════
// ROTA MANAGEMENT TAB — Phase 4
// CSS grid: Mon–Sun columns
// Auto-populated from scheduled_jobs for the selected week
// Overrides stored in rota.overrides JSONB
// "Publish Rota" → sets is_published = true → Realtime push
// ═══════════════════════════════════════════════════════════

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TODAY = new Date().toISOString().split('T')[0];

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

function weekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function fmtMins(m) {
  const h = Math.floor(m / 60), rem = m % 60;
  return h > 0 ? `${h}h${rem > 0 ? ` ${rem}m` : ''}` : `${m}m`;
}

function prevMonday(monday) {
  const d = new Date(monday); d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function nextMonday(monday) {
  const d = new Date(monday); d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(monday) {
  const d = new Date(monday);
  const sun = new Date(monday); sun.setDate(d.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${d.toLocaleDateString('en-AU', opts)} – ${sun.toLocaleDateString('en-AU', opts)}`;
}

export default function RotaTab({ scheduledJobs, scheduleSettings, showToast, isMobile }) {
  const { profile } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getMonday(TODAY));
  const [publishing, setPublishing] = useState({}); // teamId → bool

  const { rotas, publishRota, unpublishRota, saveOverrides, getRotaForTeam } = useRota(weekStart);

  const days = weekDays(weekStart);
  const teams = scheduleSettings?.teams || [];

  // Build job grid: { [teamId]: { [date]: [jobs] } }
  const grid = useMemo(() => {
    const result = {};
    teams.forEach(t => {
      result[t.id] = {};
      days.forEach(d => { result[t.id][d] = []; });
    });
    scheduledJobs.forEach(j => {
      const d = j.date;
      const tid = j.team_id || j.teamId;
      if (!days.includes(d)) return;
      if (!result[tid]) return;
      if (!j.is_break && !j.isBreak) result[tid][d].push(j);
    });
    return result;
  }, [scheduledJobs, days, teams]);

  const handlePublish = async (teamId, currentlyPublished) => {
    setPublishing(p => ({ ...p, [teamId]: true }));
    try {
      if (currentlyPublished) {
        await unpublishRota(teamId);
        showToast('Rota unpublished');
      } else {
        await publishRota(teamId, profile?.id);
        showToast('✅ Rota published! Staff can now see it.');
      }
    } catch (e) {
      showToast('❌ Failed to update rota');
    }
    setPublishing(p => ({ ...p, [teamId]: false }));
  };

  return (
    <div>
      {/* ── Week navigator ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>🗓️ Rota</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: T.textMuted }}>Publish weekly schedules for your teams</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setWeekStart(prevMonday(weekStart))}
            style={{ padding: '8px 14px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: '#fff', color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >← Prev</button>
          <div style={{ padding: '8px 16px', borderRadius: T.radiusSm, background: weekStart === getMonday(TODAY) ? T.primaryLight : '#fff', border: `1.5px solid ${weekStart === getMonday(TODAY) ? T.primary : T.border}`, color: T.text, fontSize: 13, fontWeight: 700, minWidth: 180, textAlign: 'center' }}>
            {formatWeekLabel(weekStart)}
          </div>
          <button
            onClick={() => setWeekStart(nextMonday(weekStart))}
            style={{ padding: '8px 14px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: '#fff', color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >Next →</button>
          {weekStart !== getMonday(TODAY) && (
            <button
              onClick={() => setWeekStart(getMonday(TODAY))}
              style={{ padding: '8px 12px', borderRadius: T.radiusSm, border: 'none', background: T.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >This Week</button>
          )}
        </div>
      </div>

      {/* ── Team cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {teams.map(team => {
          const rotaRow = getRotaForTeam(team.id);
          const isPublished = rotaRow?.is_published ?? false;
          const publishedAt = rotaRow?.published_at;
          const teamDays = grid[team.id] || {};

          // Weekly totals
          const totalJobs = days.reduce((s, d) => s + (teamDays[d]?.length || 0), 0);
          const totalMins = days.reduce((s, d) => s + (teamDays[d] || []).reduce((sm, j) => sm + (j.duration || 0), 0), 0);

          return (
            <div key={team.id} style={{ background: '#fff', borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadowMd, border: `1px solid ${T.border}` }}>
              {/* Team header */}
              <div style={{ padding: '14px 20px', background: `${team.color}12`, borderBottom: `2px solid ${team.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: team.color }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{team.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{totalJobs} jobs · {fmtMins(totalMins)} total</div>
                  </div>
                  {isPublished && (
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#E8F5EE', color: T.primaryDark }}>
                      ✅ Published{publishedAt ? ` ${new Date(publishedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}
                    </span>
                  )}
                  {!isPublished && totalJobs > 0 && (
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: T.accentLight, color: '#8B6914' }}>
                      Draft
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handlePublish(team.id, isPublished)}
                  disabled={publishing[team.id] || totalJobs === 0}
                  style={{
                    padding: '9px 18px', borderRadius: T.radiusSm,
                    cursor: (publishing[team.id] || totalJobs === 0) ? 'not-allowed' : 'pointer',
                    background: isPublished ? '#fff' : team.color,
                    color: isPublished ? T.danger : '#fff',
                    border: isPublished ? `1.5px solid ${T.danger}` : '1px solid transparent',
                    fontSize: 13, fontWeight: 700,
                    opacity: (publishing[team.id] || totalJobs === 0) ? 0.6 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {publishing[team.id] ? '…' : isPublished ? 'Unpublish' : '📢 Publish Rota'}
                </button>
              </div>

              {/* Day grid */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, minmax(${isMobile ? 120 : 140}px, 1fr))`, minWidth: isMobile ? 840 : 980 }}>
                  {/* Day headers */}
                  {days.map((d, i) => {
                    const isToday = d === TODAY;
                    return (
                      <div
                        key={d}
                        style={{
                          padding: '8px 10px', textAlign: 'center',
                          background: isToday ? `${team.color}18` : T.bg,
                          borderBottom: `1px solid ${T.border}`,
                          borderRight: i < 6 ? `1px solid ${T.border}` : 'none',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? team.color : T.textMuted }}>{DAY_LABELS[i]}</div>
                        <div style={{ fontSize: 11, color: isToday ? team.color : T.textLight }}>
                          {new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </div>
                        {isToday && <div style={{ fontSize: 9, color: team.color, fontWeight: 700 }}>TODAY</div>}
                      </div>
                    );
                  })}

                  {/* Job cells */}
                  {days.map((d, i) => {
                    const dayJobs = teamDays[d] || [];
                    const dayMins = dayJobs.reduce((s, j) => s + (j.duration || 0), 0);
                    const isToday = d === TODAY;

                    return (
                      <div
                        key={d}
                        style={{
                          minHeight: 140, padding: '8px',
                          background: isToday ? `${team.color}06` : '#fff',
                          borderRight: i < 6 ? `1px solid ${T.border}` : 'none',
                          verticalAlign: 'top',
                        }}
                      >
                        {dayJobs.length === 0 ? (
                          <div style={{ color: T.textLight, fontSize: 11, textAlign: 'center', paddingTop: 20 }}>–</div>
                        ) : (
                          <>
                            {dayJobs
                              .sort((a, b) => (a.start_time || a.startTime || '').localeCompare(b.start_time || b.startTime || ''))
                              .map(j => (
                                <JobChip key={j.id} job={j} color={team.color} />
                              ))
                            }
                            <div style={{ marginTop: 6, fontSize: 10, color: T.textMuted, textAlign: 'right', fontWeight: 600 }}>
                              {fmtMins(dayMins)}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team weekly summary row */}
              <div style={{ padding: '10px 16px', background: T.bg, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {days.map((d, i) => {
                  const dj = teamDays[d] || [];
                  const mins = dj.reduce((s, j) => s + (j.duration || 0), 0);
                  return (
                    <div key={d} style={{ fontSize: 11, color: T.textMuted }}>
                      <span style={{ fontWeight: 700, color: T.text }}>{DAY_LABELS[i]}</span>
                      {' '}{dj.length > 0 ? fmtMins(mins) : '–'}
                    </div>
                  );
                })}
                <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: team.color }}>
                  Week total: {fmtMins(totalMins)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Info panel ── */}
      <div style={{ marginTop: 20, padding: '14px 18px', background: T.blueLight, borderRadius: T.radius, fontSize: 13, color: T.blue }}>
        <strong>ℹ️ How it works:</strong> Jobs shown here come from the Calendar. Once you publish a team's rota, staff see it instantly in the Staff Portal under the <strong>Rota</strong> tab. You can publish weeks in advance. Unpublishing hides it from staff.
      </div>
    </div>
  );
}

// ── Small job chip in the grid cell ──────────────────────
function JobChip({ job, color }) {
  const startT    = job.start_time || job.startTime || '';
  const name      = job.client_name || job.clientName || '—';
  const status    = job.job_status  || job.jobStatus  || 'scheduled';
  const isDone    = status === 'completed';
  const isRunning = status === 'in_progress';

  return (
    <div style={{
      marginBottom: 5, padding: '5px 7px', borderRadius: 7,
      background: isDone ? '#E8F5EE' : isRunning ? '#FFF8E7' : `${color}12`,
      border: `1px solid ${isDone ? '#A8D8BB' : isRunning ? '#F0D878' : `${color}30`}`,
      fontSize: 11,
    }}>
      <div style={{ fontWeight: 700, color: isDone ? T.primaryDark : color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isDone ? '✅ ' : isRunning ? '⏱ ' : ''}{name}
      </div>
      <div style={{ color: T.textMuted, marginTop: 1 }}>
        {startT} · {fmtMins(job.duration || 0)}
      </div>
      {job.suburb && <div style={{ color: T.textLight, fontSize: 10 }}>{job.suburb}</div>}
    </div>
  );
}
