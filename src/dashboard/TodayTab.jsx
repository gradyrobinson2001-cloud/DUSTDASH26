import React, { useMemo } from 'react';
import { T } from '../shared';

const STATUS_COLORS = {
  scheduled: { bg: '#E8F0FF', color: '#305FA8' },
  in_progress: { bg: '#FFF4E4', color: '#9A6710' },
  completed: { bg: '#E8F5EE', color: '#2D7A5E' },
  cancelled: { bg: '#FDEEEE', color: '#A34242' },
};

const toLocalIsoDate = (value = new Date()) => {
  const d = new Date(value);
  const tzAdjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tzAdjusted.toISOString().split('T')[0];
};

const toMins = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const minsToLabel = (mins) => {
  if (!Number.isFinite(mins)) return '0h';
  const safe = Math.max(0, mins);
  const h = Math.floor(safe / 60);
  const m = Math.round(safe % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const formatTime = (value) => {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
};

function calcWorkedMins(entry) {
  if (!entry) return 0;
  const inAt = entry.clock_in_at || entry.clockInAt;
  if (!inAt) return 0;
  const outAt = entry.clock_out_at || entry.clockOutAt || new Date().toISOString();
  const start = new Date(inAt).getTime();
  const end = new Date(outAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const total = Math.round((end - start) / 60000);
  const breakMins = Number(entry.break_minutes || entry.breakMinutes || 0) || 0;
  return Math.max(0, total - breakMins);
}

function SummaryCard({ title, value, subValue }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: T.shadow,
      }}
    >
      <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 3, fontSize: 22, fontWeight: 900, color: T.text }}>{value}</div>
      {subValue ? <div style={{ marginTop: 4, fontSize: 12, color: T.textMuted }}>{subValue}</div> : null}
    </div>
  );
}

export default function TodayTab({
  clients,
  scheduledJobs,
  staffMembers,
  timeEntries,
  invoices,
  activeBroadcast,
  broadcastDraft,
  setBroadcastDraft,
  onPublishBroadcast,
  onClearBroadcast,
  broadcastSaving,
  onViewFloorPlan,
  onMessageStaff,
  onMarkComplete,
}) {
  const today = toLocalIsoDate();
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const staffById = useMemo(
    () => Object.fromEntries((staffMembers || []).map((s) => [String(s.id), s])),
    [staffMembers]
  );

  const clientById = useMemo(
    () => Object.fromEntries((clients || []).map((c) => [String(c.id), c])),
    [clients]
  );

  const todayJobs = useMemo(() => {
    return (scheduledJobs || [])
      .filter((job) => String(job.date || '') === today && !(job.is_break || job.isBreak))
      .sort((a, b) => String(a.start_time || a.startTime || '').localeCompare(String(b.start_time || b.startTime || '')));
  }, [scheduledJobs, today]);

  const todayTimeEntries = useMemo(
    () => (timeEntries || []).filter((entry) => String(entry.work_date || '') === today),
    [timeEntries, today]
  );

  const timeEntryByStaff = useMemo(
    () => Object.fromEntries(todayTimeEntries.map((entry) => [String(entry.staff_id), entry])),
    [todayTimeEntries]
  );

  const staffIdsFromJobs = useMemo(() => {
    const ids = new Set();
    todayJobs.forEach((job) => {
      const assigned = Array.isArray(job.assigned_staff) ? job.assigned_staff : [];
      assigned.forEach((id) => ids.add(String(id)));
    });
    return ids;
  }, [todayJobs]);

  const staffRows = useMemo(() => {
    const ids = new Set(staffIdsFromJobs);
    todayTimeEntries.forEach((entry) => ids.add(String(entry.staff_id)));

    return Array.from(ids)
      .map((staffId) => {
        const staff = staffById[staffId] || { id: staffId, full_name: 'Unknown Staff' };
        const jobs = todayJobs.filter((job) => (job.assigned_staff || []).map(String).includes(staffId));
        const entry = timeEntryByStaff[staffId] || null;

        const currentJob = jobs.find((job) => {
          const start = toMins(job.start_time || job.startTime);
          const end = toMins(job.end_time || job.endTime);
          if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
          return nowMins >= start && nowMins < end && String(job.status || 'scheduled') !== 'completed';
        });

        const late = jobs.length > 0 && (() => {
          const earliest = jobs
            .map((job) => toMins(job.start_time || job.startTime))
            .filter((v) => Number.isFinite(v))
            .sort((a, b) => a - b)[0];
          const hasClockIn = Boolean(entry?.clock_in_at || entry?.clockInAt);
          return Number.isFinite(earliest) && nowMins > earliest + 15 && !hasClockIn;
        })();

        return {
          id: staffId,
          name: staff.full_name || staff.email || 'Staff',
          jobs,
          entry,
          currentJob,
          workedMins: calcWorkedMins(entry),
          late,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staffById, staffIdsFromJobs, todayTimeEntries, timeEntryByStaff, todayJobs, nowMins]);

  const unassignedCount = todayJobs.filter((job) => (job.assigned_staff || []).length === 0).length;

  const clockedInCount = staffRows.filter((row) => {
    const inAt = row.entry?.clock_in_at || row.entry?.clockInAt;
    const outAt = row.entry?.clock_out_at || row.entry?.clockOutAt;
    return Boolean(inAt) && !outAt;
  }).length;

  const overdueInvoices = (invoices || []).filter((inv) => {
    const due = inv.due_date || inv.dueDate;
    if (!due) return false;
    const isUnpaid = String(inv.status || '').toLowerCase() !== 'paid';
    return isUnpaid && String(due) < today;
  }).length;

  const lateStaffCount = staffRows.filter((row) => row.late).length;

  const alerts = [
    lateStaffCount > 0 ? `${lateStaffCount} late/missing clock-ins` : null,
    unassignedCount > 0 ? `${unassignedCount} unassigned jobs` : null,
    overdueInvoices > 0 ? `${overdueInvoices} overdue invoices` : null,
  ].filter(Boolean);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 25, color: T.text, fontWeight: 900 }}>Today's Jobs Command Center</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textMuted }}>
          {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <section
        style={{
          background: '#fff',
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          boxShadow: T.shadow,
          padding: '12px 14px',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>Broadcast Message To All Staff</div>
        {activeBroadcast?.message && (
          <div style={{ background: T.accentLight, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8B6914', marginBottom: 2 }}>Active Broadcast</div>
            <div style={{ fontSize: 13, color: T.text }}>{activeBroadcast.message}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
              Sent {new Date(activeBroadcast.created_at || Date.now()).toLocaleString('en-AU')}
            </div>
          </div>
        )}
        <textarea
          value={broadcastDraft}
          onChange={(e) => setBroadcastDraft(e.target.value)}
          placeholder="Type a global update for all staff portals..."
          rows={3}
          style={{
            width: '100%',
            resize: 'vertical',
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '9px 10px',
            fontSize: 13,
            color: T.text,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={onPublishBroadcast}
            disabled={broadcastSaving}
            style={{ border: 'none', background: T.primary, color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: broadcastSaving ? 'not-allowed' : 'pointer', opacity: broadcastSaving ? 0.7 : 1 }}
          >
            {broadcastSaving ? 'Sending...' : 'Send Broadcast'}
          </button>
          {activeBroadcast?.message && (
            <button
              onClick={onClearBroadcast}
              disabled={broadcastSaving}
              style={{ border: `1px solid ${T.border}`, background: '#fff', color: T.text, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: broadcastSaving ? 'not-allowed' : 'pointer', opacity: broadcastSaving ? 0.7 : 1 }}
            >
              Clear Active Message
            </button>
          )}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <SummaryCard title="Jobs Scheduled" value={todayJobs.length} subValue={unassignedCount > 0 ? `${unassignedCount} unassigned` : 'All assigned'} />
        <SummaryCard title="Staff Working" value={staffIdsFromJobs.size} subValue={`${staffRows.length} tracked today`} />
        <SummaryCard title="Clocked In" value={clockedInCount} subValue={`${staffRows.length - clockedInCount} off shift`} />
        <SummaryCard title="Alerts" value={alerts.length} subValue={alerts[0] || 'No active alerts'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 12, alignItems: 'start' }}>
        <section
          style={{
            background: '#fff',
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            boxShadow: T.shadow,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 10 }}>Today's Jobs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todayJobs.length === 0 && (
              <div style={{ padding: 16, border: `1px dashed ${T.border}`, borderRadius: 10, color: T.textMuted, fontSize: 13 }}>
                No jobs scheduled for today.
              </div>
            )}
            {todayJobs.map((job) => {
              const clientId = String(job.client_id || job.clientId || '');
              const client = clientById[clientId] || null;
              const assigned = (job.assigned_staff || [])
                .map((id) => staffById[String(id)]?.full_name || 'Unknown')
                .join(', ');
              const status = String(job.status || 'scheduled').toLowerCase();
              const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.scheduled;
              const start = job.start_time || job.startTime || '--';
              const duration = Number(job.duration || 0);

              return (
                <div
                  key={job.id}
                  style={{
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: '11px 12px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800, color: T.text }}>{client?.name || job.client_name || job.clientName || 'Client'}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 8px', background: statusStyle.bg, color: statusStyle.color }}>
                        {status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <div style={{ marginTop: 3, fontSize: 12, color: T.textMuted }}>
                      {client?.address || `${job.suburb || client?.suburb || ''}, QLD`}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: T.text }}>
                      {start} · {duration > 0 ? `${duration} mins` : '--'} · {assigned || 'Unassigned'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={() => onViewFloorPlan(clientId)} style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '7px 8px', fontSize: 11, fontWeight: 700, color: T.text, cursor: 'pointer' }}>Floor Plan</button>
                    <button onClick={() => onMessageStaff(job)} style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '7px 8px', fontSize: 11, fontWeight: 700, color: T.text, cursor: 'pointer' }}>Message</button>
                    <button onClick={() => onMarkComplete(job)} disabled={status === 'completed'} style={{ border: 'none', background: status === 'completed' ? '#B4C3B9' : T.primary, color: '#fff', borderRadius: 8, padding: '7px 9px', fontSize: 11, fontWeight: 700, cursor: status === 'completed' ? 'default' : 'pointer' }}>Complete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section
          style={{
            background: '#fff',
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            boxShadow: T.shadow,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 10 }}>Staff Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {staffRows.length === 0 && (
              <div style={{ padding: 16, border: `1px dashed ${T.border}`, borderRadius: 10, color: T.textMuted, fontSize: 13 }}>
                No staff activity yet.
              </div>
            )}
            {staffRows.map((row) => {
              const inAt = row.entry?.clock_in_at || row.entry?.clockInAt;
              const outAt = row.entry?.clock_out_at || row.entry?.clockOutAt;
              return (
                <div
                  key={row.id}
                  style={{
                    border: `1px solid ${row.late ? '#E49A9A' : T.border}`,
                    borderRadius: 10,
                    padding: '10px 11px',
                    background: row.late ? '#FFF2F2' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{row.name}</div>
                    {row.late ? <span style={{ fontSize: 11, fontWeight: 700, color: '#B94C4C' }}>Late Clock-In</span> : null}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: T.textMuted }}>{row.jobs.length} assigned jobs</div>
                  <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                    <div style={{ color: T.text }}>In: {formatTime(inAt)}</div>
                    <div style={{ color: T.text }}>Out: {formatTime(outAt)}</div>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: T.text }}>
                    Current: {row.currentJob ? (row.currentJob.client_name || row.currentJob.clientName || clientById[String(row.currentJob.client_id || row.currentJob.clientId)]?.name || 'On route') : '--'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: T.primaryDark, fontWeight: 700 }}>
                    Worked: {minsToLabel(row.workedMins)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section
        style={{
          marginTop: 12,
          background: '#fff',
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          boxShadow: T.shadow,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 8 }}>Today's Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todayJobs.map((job) => {
            const start = toMins(job.start_time || job.startTime);
            const end = toMins(job.end_time || job.endTime);
            const left = Number.isFinite(start) ? Math.max(0, (start - 360) / (14 * 60) * 100) : 0;
            const width = Number.isFinite(start) && Number.isFinite(end)
              ? Math.max(6, ((end - start) / (14 * 60)) * 100)
              : 8;
            const clientName = job.client_name || job.clientName || clientById[String(job.client_id || job.clientId)]?.name || 'Client';
            return (
              <div key={`timeline-${job.id}`} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: T.text }}>{job.start_time || job.startTime || '--'} · {clientName}</div>
                <div style={{ position: 'relative', height: 20, borderRadius: 999, background: T.borderLight, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 2, left: `${left}%`, width: `${width}%`, height: 16, borderRadius: 999, background: T.primary }} />
                </div>
              </div>
            );
          })}
          {todayJobs.length === 0 && <div style={{ fontSize: 12, color: T.textMuted }}>Timeline will populate once jobs are scheduled.</div>}
        </div>
      </section>
    </div>
  );
}
