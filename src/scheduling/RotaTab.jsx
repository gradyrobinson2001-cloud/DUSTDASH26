import React, { useMemo, useState } from 'react';
import { T } from '../shared';

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

function formatWeekLabel(monday) {
  const d = new Date(monday);
  const sun = new Date(monday);
  sun.setDate(d.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${d.toLocaleDateString('en-AU', opts)} – ${sun.toLocaleDateString('en-AU', opts)}`;
}

function fmtMins(m) {
  const h = Math.floor((m || 0) / 60);
  const rem = (m || 0) % 60;
  return h > 0 ? `${h}h${rem > 0 ? ` ${rem}m` : ''}` : `${m || 0}m`;
}

export default function RotaTab({
  scheduledJobs = [],
  staffMembers = [],
  showToast,
  isMobile,
  publishWeek,
  unpublishWeek,
  initialWeekStart,
}) {
  const [weekStart, setWeekStart] = useState(() => getMonday(initialWeekStart || TODAY));
  const [updating, setUpdating] = useState(false);
  const days = weekDays(weekStart);

  const weekJobs = useMemo(() => (
    scheduledJobs
      .filter(j => days.includes(j.date) && !j.is_break && !j.isBreak)
      .sort((a, b) => (a.date + (a.start_time || a.startTime || '')).localeCompare(b.date + (b.start_time || b.startTime || '')))
  ), [scheduledJobs, days]);

  const unpublishedCount = weekJobs.filter(j => !j.is_published && !j.isPublished).length;
  const publishedCount = weekJobs.length - unpublishedCount;
  const allPublished = weekJobs.length > 0 && unpublishedCount === 0;

  const staffMap = useMemo(() => {
    const m = new Map();
    staffMembers.forEach(s => m.set(String(s.id), s));
    return m;
  }, [staffMembers]);

  const rows = useMemo(() => {
    const base = {};
    weekJobs.forEach(job => {
      const assigned = Array.isArray(job.assigned_staff) ? job.assigned_staff.map(String) : [];
      if (assigned.length === 0) {
        if (!base.unassigned) base.unassigned = { id: 'unassigned', name: 'Unassigned', jobs: [] };
        base.unassigned.jobs.push(job);
        return;
      }
      assigned.forEach(id => {
        if (!base[id]) {
          base[id] = {
            id,
            name: staffMap.get(id)?.full_name || 'Unknown Staff',
            jobs: [],
          };
        }
        base[id].jobs.push(job);
      });
    });
    return Object.values(base).sort((a, b) => a.name.localeCompare(b.name));
  }, [weekJobs, staffMap]);

  const navigate = (deltaDays) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const handlePublish = async () => {
    if (!publishWeek) return;
    setUpdating(true);
    try {
      await publishWeek(weekStart);
      showToast?.('Rota published for this week.');
    } catch (e) {
      showToast?.(`Failed to publish rota: ${e.message}`);
    }
    setUpdating(false);
  };

  const handleUnpublish = async () => {
    if (!unpublishWeek) return;
    setUpdating(true);
    try {
      await unpublishWeek(weekStart);
      showToast?.('Rota unpublished for this week.');
    } catch (e) {
      showToast?.(`Failed to unpublish rota: ${e.message}`);
    }
    setUpdating(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.text }}>Rota</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textMuted }}>
            {weekJobs.length} jobs · {publishedCount} published · {unpublishedCount} draft
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-7)} style={navBtn}>← Prev</button>
          <div style={{ padding: '8px 14px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: '#fff', fontSize: 13, fontWeight: 700, color: T.text }}>
            {formatWeekLabel(weekStart)}
          </div>
          <button onClick={() => navigate(7)} style={navBtn}>Next →</button>
          {allPublished ? (
            <button disabled={updating || weekJobs.length === 0} onClick={handleUnpublish} style={{ ...actionBtn, background: '#fff', color: T.danger, border: `1.5px solid ${T.danger}` }}>
              {updating ? '…' : 'Unpublish Week'}
            </button>
          ) : (
            <button disabled={updating || weekJobs.length === 0} onClick={handlePublish} style={actionBtn}>
              {updating ? '…' : `Publish Week (${unpublishedCount})`}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: T.radius, padding: 28, color: T.textMuted, textAlign: 'center', boxShadow: T.shadow }}>
          No jobs in this week.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map(row => {
            const totalMins = row.jobs.reduce((sum, j) => sum + (j.duration || 0), 0);
            return (
              <div key={row.id} style={{ background: '#fff', borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, color: T.text }}>{row.name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{row.jobs.length} jobs · {fmtMins(totalMins)}</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, minmax(${isMobile ? 120 : 150}px, 1fr))`, minWidth: isMobile ? 840 : 980 }}>
                    {days.map((d, idx) => {
                      const dayJobs = row.jobs
                        .filter(j => j.date === d)
                        .sort((a, b) => (a.start_time || a.startTime || '').localeCompare(b.start_time || b.startTime || ''));
                      return (
                        <div key={d} style={{ minHeight: 120, padding: 10, borderRight: idx < 6 ? `1px solid ${T.border}` : 'none', background: d === TODAY ? T.primaryLight : '#fff' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 6 }}>
                            {DAY_LABELS[idx]} {new Date(d).getDate()}
                          </div>
                          {dayJobs.length === 0 ? (
                            <div style={{ fontSize: 11, color: T.textLight }}>—</div>
                          ) : dayJobs.map(j => (
                            <div key={j.id} style={{ marginBottom: 6, padding: '6px 8px', borderRadius: 7, background: (j.is_published || j.isPublished) ? T.primaryLight : T.accentLight, border: `1px solid ${T.border}` }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{j.client_name || j.clientName}</div>
                              <div style={{ fontSize: 10, color: T.textMuted }}>
                                {(j.start_time || j.startTime)} · {fmtMins(j.duration || 0)}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn = {
  padding: '8px 14px',
  borderRadius: T.radiusSm,
  border: `1.5px solid ${T.border}`,
  background: '#fff',
  color: T.text,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const actionBtn = {
  padding: '9px 16px',
  borderRadius: T.radiusSm,
  border: 'none',
  background: T.primary,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

