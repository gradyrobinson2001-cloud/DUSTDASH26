import React, { useState, useEffect, useRef, useCallback } from 'react';
import StaffLogin from './auth/StaffLogin';
import { useScheduledJobs } from './hooks/useScheduledJobs';
import { useClients } from './hooks/useClients';
import { usePhotos } from './hooks/usePhotos';
import { useStaffTimeEntries } from './hooks/useStaffTimeEntries';
import { supabase, supabaseReady } from './lib/supabase';
import { T } from './shared';
import { calcPayrollBreakdown, calcWorkedMinutesFromEntry, fmtCurrency } from './utils/payroll';

// ═══════════════════════════════════════════════════════════
// STAFF PORTAL
// Auth: StaffLogin (email + password → Supabase session)
// Data: Supabase Realtime — filters by assigned_staff + is_published
// Photos: Supabase Storage
// Tabs: Today | Rota | Hours | Payslips
// ═══════════════════════════════════════════════════════════

// ─── Demo data ───────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

const DEMO_JOBS = [
  { id: 'demo_1', client_id: 'dc1', client_name: 'Sarah Mitchell', suburb: 'Buderim',   date: TODAY, start_time: '08:00', end_time: '10:15', duration: 135, assigned_staff: ['demo'], is_published: true, job_status: 'scheduled', bedrooms: 3, bathrooms: 2, living: 1, kitchen: 1, extras: ['oven'] },
  { id: 'demo_2', client_id: 'dc2', client_name: 'James Cooper',   suburb: 'Maroochydore', date: TODAY, start_time: '10:45', end_time: '12:45', duration: 120, assigned_staff: ['demo'], is_published: true, job_status: 'scheduled', bedrooms: 4, bathrooms: 2, living: 2, kitchen: 1, extras: [] },
  { id: 'demo_3', client_id: 'dc3', client_name: 'Emma Collins',   suburb: 'Mooloolaba', date: TODAY, start_time: '13:30', end_time: '15:30', duration: 120, assigned_staff: ['demo'], is_published: true, job_status: 'scheduled', bedrooms: 2, bathrooms: 1, living: 1, kitchen: 1, extras: ['windows'] },
];

const DEMO_CLIENTS = [
  { id: 'dc1', name: 'Sarah Mitchell', address: '23 Ballinger Crescent, Buderim QLD 4556',      notes: '2 dogs – keep gate closed',           access_notes: 'Key under front doormat, alarm 1234#', frequency: 'weekly' },
  { id: 'dc2', name: 'James Cooper',   address: '15 Duporth Avenue, Maroochydore QLD 4558',     notes: 'Baby sleeps 1–3pm, please be quiet',  access_notes: 'Ring doorbell, client WFH',           frequency: 'fortnightly' },
  { id: 'dc3', name: 'Emma Collins',   address: '5 Parkyn Parade, Mooloolaba QLD 4557',         notes: '',                                    access_notes: 'Lockbox side gate – code 5678',       frequency: 'weekly' },
];

const DEFAULT_BREAK_MINUTES = 30;

// ─── Helpers ─────────────────────────────────────────────
function fmtSecs(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}
function fmtMins(m) {
  const h = Math.floor(m / 60), rem = m % 60;
  return h > 0 ? `${h}hr${rem > 0 ? ` ${rem}min` : ''}` : `${m}min`;
}
function fmtHours(hours) {
  const n = Number(hours) || 0;
  return `${n.toFixed(2)}h`;
}
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}
function weekDays(anchorDate) {
  const d = new Date(anchorDate);
  const day = d.getDay(); // 0=Sun
  const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon); dd.setDate(mon.getDate() + i);
    return dd.toISOString().split('T')[0];
  });
}
function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d.toISOString().split('T')[0];
}
function shiftDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function fmtWeekRange(monday) {
  const m = new Date(monday);
  const s = new Date(monday);
  s.setDate(m.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${m.toLocaleDateString('en-AU', opts)} - ${s.toLocaleDateString('en-AU', opts)}`;
}
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_SUFFIX = ['th', 'st', 'nd', 'rd'];

function dayOrdinalLabel(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '--';
  const day = d.getDate();
  const modulo100 = day % 100;
  const suffix = (modulo100 >= 11 && modulo100 <= 13) ? 'th' : (DAY_SUFFIX[day % 10] || 'th');
  return `${day}${suffix}`;
}

function timeToMinutes(timeValue) {
  if (!timeValue || typeof timeValue !== 'string') return null;
  const [hh, mm] = timeValue.split(':');
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return (h * 60) + m;
}

function minsToClock(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '—';
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function formatShiftMins(mins) {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function normalizeText(v) {
  return String(v || '').trim().toLowerCase();
}

function normalizePhone(v) {
  return String(v || '').replace(/\D/g, '');
}

function resolveClientProfile(job, clients) {
  const list = Array.isArray(clients) ? clients : [];
  if (!list.length) return null;

  const clientId = job?.client_id || job?.clientId;
  if (clientId) {
    const byId = list.find(c => String(c.id) === String(clientId));
    if (byId) return byId;
  }

  const jobEmail = normalizeText(job?.email);
  if (jobEmail) {
    const byEmail = list.find(c => normalizeText(c?.email) === jobEmail);
    if (byEmail) return byEmail;
  }

  const jobPhone = normalizePhone(job?.phone);
  if (jobPhone) {
    const byPhone = list.find(c => normalizePhone(c?.phone) === jobPhone);
    if (byPhone) return byPhone;
  }

  const jobName = normalizeText(job?.client_name || job?.clientName);
  const jobSuburb = normalizeText(job?.suburb);
  if (jobName) {
    const byNameSuburb = list.find(c =>
      normalizeText(c?.name) === jobName &&
      (!jobSuburb || normalizeText(c?.suburb) === jobSuburb)
    );
    if (byNameSuburb) return byNameSuburb;
  }

  return null;
}

function buildJobSnapshotProfile(job) {
  const bedrooms = job?.bedrooms;
  const bathrooms = job?.bathrooms;
  const living = job?.living;
  const kitchen = job?.kitchen;
  const hasSnapshot =
    Boolean(job?.address || job?.email || job?.phone || job?.notes || job?.access_notes || job?.accessNotes || job?.frequency || job?.preferred_day || job?.preferredDay || job?.preferred_time || job?.preferredTime) ||
    [bedrooms, bathrooms, living, kitchen].some(v => v !== null && v !== undefined);

  if (!hasSnapshot) return null;

  return {
    id: job?.client_id || job?.clientId || `job-${job?.id || Date.now()}`,
    name: job?.client_name || job?.clientName || "Client",
    address: job?.address || (job?.suburb ? `${job.suburb}, QLD` : ""),
    suburb: job?.suburb || "",
    notes: job?.notes || "",
    access_notes: job?.access_notes || job?.accessNotes || "",
    frequency: job?.frequency || "",
    preferred_day: job?.preferred_day || job?.preferredDay || "",
    preferred_time: job?.preferred_time || job?.preferredTime || "",
    bedrooms,
    bathrooms,
    living,
    kitchen,
    email: job?.email || "",
    phone: job?.phone || "",
    source: "job_snapshot",
  };
}

// ─── Component ────────────────────────────────────────────
export default function CleanerPortal() {
  const [profile,      setProfile]      = useState(null);
  const [demoMode,     setDemoMode]     = useState(false);
  const [activeTab,    setActiveTab]    = useState('today');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [expandedJob,  setExpandedJob]  = useState(null);
  const [photoType,    setPhotoType]    = useState('before');
  const [toast,        setToast]        = useState(null);
  const [activeTimers, setActiveTimers] = useState({});
  const [localPhotos,  setLocalPhotos]  = useState({});
  const [payslips,     setPayslips]     = useState([]);
  const [jobClientProfiles, setJobClientProfiles] = useState({});
  const [clockActionLoading, setClockActionLoading] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [demoTimeEntries, setDemoTimeEntries] = useState([]);
  const [teamRotaJobs, setTeamRotaJobs] = useState([]);
  const [teamRotaStaffById, setTeamRotaStaffById] = useState({});
  const [teamRotaLoading, setTeamRotaLoading] = useState(false);
  const [teamRotaError, setTeamRotaError] = useState('');
  const [rotaViewMode, setRotaViewMode] = useState('all');
  const [expandedRotaRows, setExpandedRotaRows] = useState(() => new Set());

  const timerRefs = useRef({});
  const cameraRef = useRef(null);
  const fileRef   = useRef(null);
  const uploadJobRef = useRef(null);

  const staffId = demoMode ? 'demo' : profile?.id;

  // ── Hooks ──────────────────────────────────────────────
  // For staff portal: useScheduledJobs filters by assigned_staff + is_published
  // Week for date strip
  const weekDates = weekDays(selectedDate);
  const weekStart = getMonday(selectedDate);

  const { scheduledJobs, updateJob, refreshScheduledJobs } = useScheduledJobs(staffId ? { staffId } : {});
  const { clients, loading: clientsLoading } = useClients();
  const { photos: supaPhotos, uploadPhoto, getSignedUrl } = usePhotos();
  const { timeEntries, setTimeEntries, refreshTimeEntries, error: timeEntriesError } = useStaffTimeEntries(staffId ? { staffId, weekStart } : { weekStart });

  // ── Active jobs for selected date ──────────────────────
  const allJobs = demoMode ? DEMO_JOBS : scheduledJobs;
  const allClients = demoMode ? DEMO_CLIENTS : clients;
  const allTimeEntries = demoMode ? demoTimeEntries : timeEntries;

  const dayJobs = allJobs
    .filter(j => {
      const jDate = j.date;
      return jDate === selectedDate && !j.is_break && !j.isBreak;
    })
    .sort((a, b) => (a.start_time || a.startTime || '').localeCompare(b.start_time || b.startTime || ''));
  const dayJobIdsKey = dayJobs.map(j => String(j.id)).sort().join('|');

  // ── Toast helper ───────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const toggleExpandedRotaRow = useCallback((rowKey) => {
    setExpandedRotaRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const normalizeClockError = useCallback((rawMessage) => {
    const msg = String(rawMessage || '').toLowerCase();
    if (msg.includes('staff_time_entries') && msg.includes('does not exist')) {
      return 'Time tracking database is not deployed yet. Run migration 20260220_staff_time_tracking.sql.';
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return 'Network issue while syncing clock times. Please retry.';
    }
    return rawMessage || 'Unknown clock error';
  }, []);

  const upsertLiveTimeEntry = useCallback((entry) => {
    if (!entry?.work_date) return;
    setTimeEntries((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const entryId = entry?.id ? String(entry.id) : null;
      const idx = next.findIndex((row) => {
        const sameId = entryId && String(row?.id || '') === entryId;
        const sameStaffDate = String(row?.staff_id || '') === String(entry?.staff_id || '') && String(row?.work_date || '') === String(entry?.work_date || '');
        return sameId || sameStaffDate;
      });
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...entry };
      } else {
        next.unshift(entry);
      }
      return next;
    });
  }, [setTimeEntries]);

  useEffect(() => {
    if (demoMode || !staffId) return;
    const refresh = async () => {
      await Promise.allSettled([
        refreshScheduledJobs?.(),
        refreshTimeEntries?.(),
      ]);
    };
    refresh();
    const onFocus = () => { refresh(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 15000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [demoMode, refreshScheduledJobs, refreshTimeEntries, staffId]);

  // ── Team rota overview (all staff) ────────────────────
  useEffect(() => {
    if (activeTab !== 'rota') return;
    if (demoMode) {
      setTeamRotaJobs(DEMO_JOBS);
      setTeamRotaStaffById({
        demo: { id: 'demo', full_name: 'Demo Staff', role: 'staff' },
      });
      setTeamRotaError('');
      return;
    }
    if (!supabaseReady || !supabase || !profile?.id) return;

    let cancelled = false;
    const loadRota = async () => {
      setTeamRotaLoading(true);
      setTeamRotaError('');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error('Session expired. Please sign in again.');

        const res = await fetch('/api/staff/rota-overview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ weekStart }),
        });
        let body = {};
        try { body = await res.json(); } catch {}
        if (!res.ok || body?.error) {
          throw new Error(body?.error || body?.details || `Request failed (${res.status})`);
        }
        if (cancelled) return;
        setTeamRotaJobs(Array.isArray(body?.jobs) ? body.jobs : []);
        setTeamRotaStaffById(body?.staffById || {});
      } catch (err) {
        if (cancelled) return;
        console.error('[staff:rota-overview] failed', err);
        setTeamRotaJobs([]);
        setTeamRotaStaffById({});
        setTeamRotaError(err?.message || 'Failed to load team rota.');
      } finally {
        if (!cancelled) setTeamRotaLoading(false);
      }
    };

    loadRota();
    return () => { cancelled = true; };
  }, [activeTab, demoMode, profile?.id, weekStart]);

  useEffect(() => {
    setExpandedRotaRows(new Set());
  }, [weekStart, rotaViewMode]);

  // ── Timer management ───────────────────────────────────
  useEffect(() => {
    dayJobs.forEach(job => {
      const arrivedAt = job.actual_start_at || job.actualStartAt || job.arrived_at || job.arrivedAt;
      const status    = job.status || job.job_status || job.jobStatus;
      if (status === 'in_progress' && arrivedAt && !timerRefs.current[job.id]) {
        const start = new Date(arrivedAt).getTime();
        timerRefs.current[job.id] = setInterval(() => {
          setActiveTimers(p => ({ ...p, [job.id]: Math.floor((Date.now() - start) / 1000) }));
        }, 1000);
      } else if (status !== 'in_progress' && timerRefs.current[job.id]) {
        clearInterval(timerRefs.current[job.id]);
        delete timerRefs.current[job.id];
      }
    });
    return () => Object.values(timerRefs.current).forEach(clearInterval);
  }, [dayJobs]);

  // ── Load Supabase photos for day jobs ─────────────────
  useEffect(() => {
    if (demoMode) return;
    const jobIds = dayJobs.map(j => j.id);
    const relevant = supaPhotos.filter(p => jobIds.includes(p.job_id));

    const buildMap = async () => {
      const map = {};
      for (const p of relevant) {
        if (!map[p.job_id]) map[p.job_id] = { before: [], after: [] };
        const url = await getSignedUrl(p.storage_path);
        map[p.job_id][p.type].push({ id: p.id, url, storage_path: p.storage_path, uploaded_at: p.uploaded_at });
      }
      setLocalPhotos(map);
    };
    buildMap();
  }, [supaPhotos, selectedDate, demoMode]);

  // ── Load client profiles for visible jobs via secure API fallback ─────
  useEffect(() => {
    if (demoMode) {
      setJobClientProfiles({});
      return;
    }

    const loadProfiles = async () => {
      if (!supabaseReady || dayJobs.length === 0) {
        setJobClientProfiles({});
        return;
      }
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error('Missing session token');

        const res = await fetch('/api/staff/job-client-profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ jobIds: dayJobs.map(j => j.id) }),
        });
        let body = {};
        try {
          body = await res.json();
        } catch {}

        if (!res.ok || body?.error) {
          throw new Error(body?.error || body?.details || `Request failed (${res.status})`);
        }

        setJobClientProfiles(body?.profilesByJob || {});
      } catch (err) {
        console.error('[staff:client-profiles] failed', err);
        setJobClientProfiles({});
      }
    };

    loadProfiles();
  }, [demoMode, dayJobIdsKey]);

  // ── Load payslips ─────────────────────────────────────
  useEffect(() => {
    if (!supabaseReady || !profile?.id || demoMode) return;
    supabase
      .from('payslips')
      .select('*, payroll_records(week_start, gross_pay, net_pay, tax_withheld, super_amount, hours_worked)')
      .eq('staff_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPayslips(data ?? []));
  }, [profile, demoMode]);

  // ── Job status update ─────────────────────────────────
  const updateJobStatus = useCallback(async (jobId, newStatus) => {
    const now = new Date().toISOString();
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return;

    const arrivedAt = job.actual_start_at || job.actualStartAt || job.arrived_at || job.arrivedAt;
    const updates = { status: newStatus };
    if (newStatus === 'in_progress') {
      updates.actual_start_at = now;
      const start = Date.now();
      timerRefs.current[jobId] = setInterval(() => {
        setActiveTimers(p => ({ ...p, [jobId]: Math.floor((Date.now() - start) / 1000) }));
      }, 1000);
    } else if (newStatus === 'completed') {
      updates.actual_end_at = now;
      if (arrivedAt) {
        const actualMinutes = Math.max(15, Math.round((new Date(now) - new Date(arrivedAt)) / 60000));
        updates.actual_duration = actualMinutes;
      }
      if (timerRefs.current[jobId]) { clearInterval(timerRefs.current[jobId]); delete timerRefs.current[jobId]; }
    }

    if (!demoMode) {
      try { await updateJob(jobId, updates); } catch (e) { showToast('Update failed'); return; }
    }

    showToast(newStatus === 'in_progress' ? 'Timer started!' : 'Job completed!');
  }, [allJobs, demoMode, updateJob, showToast]);

  const callStaffClockApi = useCallback(async (action, workDate) => {
    if (!supabaseReady || !supabase) throw new Error('Supabase auth is not configured.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message || 'Failed to load auth session.');
    const token = data?.session?.access_token;
    if (!token) throw new Error('Session expired. Please sign in again.');

    const res = await fetch('/api/staff/clock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        workDate,
        breakMinutes,
      }),
    });
    let body = {};
    try { body = await res.json(); } catch {}
    if (!res.ok || body?.error) {
      throw new Error(body?.error || body?.details || `Request failed (${res.status})`);
    }
    return body?.entry || null;
  }, [breakMinutes]);

  const handleClockIn = useCallback(async () => {
    if (!window.confirm(`Are you sure you want to clock in for ${selectedDate}?`)) return;
    setClockActionLoading(true);
    try {
      if (demoMode) {
        const now = new Date().toISOString();
        setDemoTimeEntries(prev => {
          const existing = prev.find(entry => entry.work_date === selectedDate);
          if (existing?.clock_out_at) return prev;
          if (existing?.clock_in_at) return prev;
          return [
            ...prev.filter(entry => entry.work_date !== selectedDate),
            {
              id: `demo_clock_${selectedDate}`,
              staff_id: 'demo',
              work_date: selectedDate,
              clock_in_at: now,
              clock_out_at: null,
              break_minutes: breakMinutes,
            },
          ];
        });
        showToast('✅ Clocked in');
      } else {
        const entry = await callStaffClockApi('clock_in', selectedDate);
        upsertLiveTimeEntry(entry);
        await refreshTimeEntries();
        showToast('✅ Clocked in');
      }
    } catch (err) {
      console.error('[staff:clock-in] failed', err);
      showToast(`❌ Clock in failed: ${normalizeClockError(err?.message)}`);
    } finally {
      setClockActionLoading(false);
    }
  }, [breakMinutes, callStaffClockApi, demoMode, normalizeClockError, refreshTimeEntries, selectedDate, showToast, upsertLiveTimeEntry]);

  const handleClockOut = useCallback(async () => {
    if (!window.confirm(`Are you sure you want to clock out for ${selectedDate}?`)) return;
    setClockActionLoading(true);
    try {
      if (demoMode) {
        const now = new Date().toISOString();
        setDemoTimeEntries(prev => prev.map(entry => (
          entry.work_date === selectedDate
            ? { ...entry, clock_out_at: entry.clock_out_at || now, break_minutes: breakMinutes }
            : entry
        )));
        showToast('✅ Clocked out');
      } else {
        const entry = await callStaffClockApi('clock_out', selectedDate);
        upsertLiveTimeEntry(entry);
        await refreshTimeEntries();
        showToast('✅ Clocked out');
      }
    } catch (err) {
      console.error('[staff:clock-out] failed', err);
      showToast(`❌ Clock out failed: ${normalizeClockError(err?.message)}`);
    } finally {
      setClockActionLoading(false);
    }
  }, [breakMinutes, callStaffClockApi, demoMode, normalizeClockError, refreshTimeEntries, selectedDate, showToast, upsertLiveTimeEntry]);

  // ── Photo upload ──────────────────────────────────────
  const handlePhotoFile = useCallback(async (e) => {
    const files = e.target.files;
    const jobId = uploadJobRef.current?.jobId;
    const type  = uploadJobRef.current?.type;
    if (!files?.length || !jobId) return;

    const job = allJobs.find(j => j.id === jobId);

    for (const file of files) {
      if (demoMode) {
        const url = URL.createObjectURL(file);
        setLocalPhotos(prev => ({
          ...prev,
          [jobId]: {
            before: prev[jobId]?.before || [],
            after:  prev[jobId]?.after  || [],
            [type]: [...(prev[jobId]?.[type] || []), { url, uploaded_at: new Date().toISOString() }],
          },
        }));
        showToast(`${type === 'before' ? 'Before' : 'After'} photo added!`);
        continue;
      }

      try {
        await uploadPhoto({
          jobId,
          clientId:   job?.client_id || job?.clientId,
          date:        selectedDate,
          type,
          file,
          uploadedBy: profile?.id,
        });
        showToast(`${type === 'before' ? 'Before' : 'After'} photo uploaded!`);
      } catch (err) {
        console.error('Photo upload failed:', err);
        showToast(`Upload failed: ${err?.message || 'Try again.'}`);
      }
    }
    e.target.value = '';
  }, [allJobs, demoMode, selectedDate, profile, uploadPhoto, showToast]);

  // ── Weekly hours summary ───────────────────────────────
  const selectedDayEntry = allTimeEntries.find(entry => entry.work_date === selectedDate) || null;
  useEffect(() => {
    setBreakMinutes(selectedDayEntry?.break_minutes ?? DEFAULT_BREAK_MINUTES);
  }, [selectedDayEntry?.id, selectedDayEntry?.break_minutes]);

  const weeklyStats = (() => {
    return weekDates.map((d, i) => {
      const dJobs = allJobs.filter(j => j.date === d && !j.is_break && !j.isBreak);
      const done  = dJobs.filter(j => (j.status || j.job_status || j.jobStatus) === 'completed');
      const scheduledMins = dJobs.reduce((s, j) => s + (j.duration || 0), 0);
      const completedMins = done.reduce((s, j) => s + (j.actual_duration || j.actualDuration || j.duration || 0), 0);
      const timeEntry = allTimeEntries.find(entry => entry.work_date === d);
      const workedMins = timeEntry
        ? calcWorkedMinutesFromEntry(timeEntry, d === TODAY)
        : completedMins;
      return {
        label: DAY_LABELS[i],
        date: d,
        jobs: dJobs.length,
        done: done.length,
        scheduledMins,
        workedMins,
        timeEntry,
        scheduledHours: Math.round((scheduledMins / 60) * 100) / 100,
        actualHours: Math.round((workedMins / 60) * 100) / 100,
      };
    });
  })();

  const teamRotaDays = (() => {
    const weekSet = new Set(weekDates);
    const sourceJobs = (demoMode ? DEMO_JOBS : teamRotaJobs)
      .filter(job => weekSet.has(job?.date))
      .filter(job => !job?.is_break && !job?.isBreak)
      .filter(job => Boolean(job?.is_published ?? job?.isPublished ?? true));

    const dayMap = Object.fromEntries(weekDates.map((date, i) => [date, {
      date,
      label: DAY_LABELS[i],
      shifts: [],
      jobCount: 0,
    }]));

    weekDates.forEach((date) => {
      const jobsForDate = sourceJobs.filter(job => job.date === date);
      const byStaff = {};

      jobsForDate.forEach((job) => {
        const assigned = Array.isArray(job.assigned_staff) && job.assigned_staff.length > 0
          ? job.assigned_staff.map(String)
          : ['unassigned'];

        assigned.forEach((entryStaffId) => {
          if (rotaViewMode === 'mine' && String(entryStaffId) !== String(staffId)) return;
          if (!byStaff[entryStaffId]) {
            const staffProfile = teamRotaStaffById?.[entryStaffId] || null;
            byStaff[entryStaffId] = {
              staffId: entryStaffId,
              name: staffProfile?.full_name || (entryStaffId === 'unassigned' ? 'Unassigned' : 'Staff'),
              role: staffProfile?.role || (entryStaffId === 'unassigned' ? 'scheduler' : 'staff'),
              startMin: null,
              endMin: null,
              totalJobMinutes: 0,
              jobs: [],
            };
          }

          const row = byStaff[entryStaffId];
          const startText = job.start_time || job.startTime || '';
          const endText = job.end_time || job.endTime || '';
          const startMin = timeToMinutes(startText);
          const endMin = timeToMinutes(endText);
          const clientProfile = job.client_profile || null;
          if (startMin !== null) row.startMin = row.startMin === null ? startMin : Math.min(row.startMin, startMin);
          if (endMin !== null) row.endMin = row.endMin === null ? endMin : Math.max(row.endMin, endMin);
          row.totalJobMinutes += Number(job.duration || 0);
          row.jobs.push({
            id: job.id,
            clientName: clientProfile?.name || job.client_name || job.clientName || 'Client',
            start: startText,
            end: endText,
            startMin,
            endMin,
            suburb: job.suburb || '',
            address: clientProfile?.address || '',
            notes: clientProfile?.notes || job?.notes || '',
            accessNotes: clientProfile?.access_notes || '',
            bedrooms: clientProfile?.bedrooms,
            bathrooms: clientProfile?.bathrooms,
            living: clientProfile?.living,
            kitchen: clientProfile?.kitchen,
            frequency: clientProfile?.frequency || '',
          });
        });
      });

      const shifts = Object.values(byStaff).map((row) => {
        const sortedJobs = [...row.jobs].sort((a, b) => {
          const aStart = Number.isFinite(a.startMin) ? a.startMin : 9999;
          const bStart = Number.isFinite(b.startMin) ? b.startMin : 9999;
          if (aStart !== bStart) return aStart - bStart;
          return String(a.clientName).localeCompare(String(b.clientName));
        });
        const hasRange = row.startMin !== null && row.endMin !== null && row.endMin > row.startMin;
        const shiftMinutes = hasRange ? Math.max(row.endMin - row.startMin, row.totalJobMinutes) : row.totalJobMinutes;
        const shiftLabel = hasRange ? `${minsToClock(row.startMin)} - ${minsToClock(row.endMin)}` : 'Unscheduled time';
        const jobsPreviewBits = sortedJobs.slice(0, 2).map(j => `${j.clientName} ${j.start || ''}`.trim());
        const jobsPreview = jobsPreviewBits.join(' · ') + (sortedJobs.length > 2 ? ` +${sortedJobs.length - 2} more` : '');
        return {
          ...row,
          shiftMinutes,
          shiftLabel,
          jobsPreview,
          isYou: String(row.staffId) === String(staffId),
          jobs: sortedJobs,
        };
      }).sort((a, b) => {
        const aStart = a.startMin === null ? 9999 : a.startMin;
        const bStart = b.startMin === null ? 9999 : b.startMin;
        if (aStart !== bStart) return aStart - bStart;
        return String(a.name).localeCompare(String(b.name));
      });

      dayMap[date].shifts = shifts;
      dayMap[date].jobCount = jobsForDate.length;
    });

    return weekDates.map(date => dayMap[date]);
  })();

  const selectedTeamRotaDay = teamRotaDays.find(day => day.date === selectedDate) || teamRotaDays[0] || null;

  const todayStats = (() => {
    const done = dayJobs.filter(j => (j.status || j.job_status || j.jobStatus) === 'completed');
    const scheduledMins = dayJobs.reduce((s, j) => s + (j.duration || 0), 0);
    const workedMins = selectedDayEntry
      ? calcWorkedMinutesFromEntry(selectedDayEntry, selectedDate === TODAY)
      : done.reduce((s, j) => s + (j.actual_duration || j.actualDuration || j.duration || 0), 0);
    return { done: done.length, total: dayJobs.length, scheduledMins, workedMins };
  })();

  const weeklyScheduledMinutes = weeklyStats.reduce((sum, s) => sum + s.scheduledMins, 0);
  const weeklyWorkedMinutes = weeklyStats.reduce((sum, s) => sum + s.workedMins, 0);
  const weeklyScheduledHours = Math.round((weeklyScheduledMinutes / 60) * 100) / 100;
  const weeklyWorkedHours = Math.round((weeklyWorkedMinutes / 60) * 100) / 100;
  const hourlyRate = Number(profile?.hourly_rate || 0);
  const payrollEstimate = calcPayrollBreakdown({
    hoursWorked: weeklyWorkedHours || weeklyScheduledHours,
    hourlyRate,
    employmentType: profile?.employment_type || 'casual',
  });

  // ── Sign out ───────────────────────────────────────────
  const handleSignOut = async () => {
    if (!demoMode && supabaseReady) await supabase.auth.signOut();
    setProfile(null);
    setDemoMode(false);
    setActiveTimers({});
    setLocalPhotos({});
    setDemoTimeEntries([]);
    setBreakMinutes(DEFAULT_BREAK_MINUTES);
  };

  const teamColor = T.primary;
  const displayName = demoMode ? 'Demo Staff' : (profile?.full_name || 'Staff');

  // ══════════════════════════════════════════════════════
  // ── AUTH SCREEN ────────────────────────────────────────
  // ══════════════════════════════════════════════════════
  if (!profile && !demoMode) {
    return (
      <StaffLogin
        onAuthenticated={(prof) => { setProfile(prof); }}
        onDemoMode={() => {
          setDemoMode(true);
          setProfile({ id: 'demo', full_name: 'Demo Staff', role: 'staff' });
        }}
      />
    );
  }

  // ══════════════════════════════════════════════════════
  // ── MAIN PORTAL ────────────────────────────────────────
  // ══════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: T.bg, paddingBottom: 112 }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ background: teamColor, padding: '16px 20px', color: '#fff', position: 'sticky', top: 0, zIndex: 30 }}>
        {demoMode && (
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
            Demo Mode
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{displayName}</div>
            {activeTab !== 'payslips' && (
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                {todayStats.done}/{todayStats.total} jobs · {fmtMins(todayStats.scheduledMins)} scheduled · {fmtMins(todayStats.workedMins)} worked
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            style={{ padding: '8px 14px', borderRadius: 20, border: '2px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>

        {/* Week strip */}
        {activeTab !== 'payslips' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <button
                onClick={() => setSelectedDate(d => shiftDays(d, -7))}
                style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                ← Prev Week
              </button>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.95 }}>{fmtWeekRange(weekStart)}</div>
              <button
                onClick={() => setSelectedDate(d => shiftDays(d, 7))}
                style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Next Week →
              </button>
            </div>

            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {weekDates.map((d, i) => {
                const isToday = d === TODAY;
                const isSel   = d === selectedDate;
                const stat    = weeklyStats[i];
                const allDone = stat.done === stat.jobs && stat.jobs > 0;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    style={{
                      flex: '0 0 auto', minWidth: 46,
                      padding: '6px 4px',
                      borderRadius: 10,
                      border: isSel ? '2px solid #fff' : '2px solid transparent',
                      background: isSel ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                      color: '#fff', cursor: 'pointer', textAlign: 'center',
                    }}
                    >
                    <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.8 }}>{DAY_LABELS[i]}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.3 }}>
                      {dayOrdinalLabel(d)}
                    </div>
                    <div style={{ fontSize: 8, opacity: 0.9 }}>{allDone ? 'done' : (isToday ? 'today' : '')}</div>
                  </button>
                );
              })}
              {selectedDate !== TODAY && (
                <button
                  onClick={() => setSelectedDate(TODAY)}
                  style={{ flex: '0 0 auto', padding: '6px 10px', borderRadius: 10, border: 'none', background: '#fff', color: teamColor, fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Today
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          TODAY TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'today' && (
        <div style={{ padding: '16px 16px 0' }}>
          {/* Daily clock in/out */}
          <div style={{ background: '#fff', borderRadius: T.radius, padding: '14px 14px', marginBottom: 16, boxShadow: T.shadow }}>
            {timeEntriesError && (
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#FCEAEA', color: T.danger, fontSize: 12, fontWeight: 600 }}>
                Clock sync warning: {normalizeClockError(timeEntriesError?.message || 'Failed to load time entries')}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted }}>TODAY'S WORKDAY</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{new Date(selectedDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, textAlign: 'right' }}>
                <div>Break: {breakMinutes} min/day</div>
                <div>Worked: {fmtMins(calcWorkedMinutesFromEntry(selectedDayEntry, selectedDate === TODAY))}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 2 }}>Clock In</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{fmtTime(selectedDayEntry?.clock_in_at || selectedDayEntry?.clockInAt)}</div>
              </div>
              <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 2 }}>Clock Out</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{fmtTime(selectedDayEntry?.clock_out_at || selectedDayEntry?.clockOutAt)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleClockIn}
                disabled={clockActionLoading || Boolean((selectedDayEntry?.clock_in_at || selectedDayEntry?.clockInAt) && !(selectedDayEntry?.clock_out_at || selectedDayEntry?.clockOutAt))}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: T.radiusSm,
                  border: 'none',
                  background: T.accent,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: clockActionLoading ? 'not-allowed' : 'pointer',
                  opacity: clockActionLoading ? 0.7 : 1,
                }}
              >
                {clockActionLoading ? '...' : 'Clock In'}
              </button>
              <button
                onClick={handleClockOut}
                disabled={clockActionLoading || !(selectedDayEntry?.clock_in_at || selectedDayEntry?.clockInAt) || Boolean(selectedDayEntry?.clock_out_at || selectedDayEntry?.clockOutAt)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: T.radiusSm,
                  border: 'none',
                  background: teamColor,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: clockActionLoading ? 'not-allowed' : 'pointer',
                  opacity: clockActionLoading ? 0.7 : 1,
                }}
              >
                {clockActionLoading ? '...' : 'Clock Out'}
              </button>
            </div>
          </div>

          {/* Weekly hours bar */}
          <div style={{ background: '#fff', borderRadius: T.radius, padding: '12px 14px', marginBottom: 16, boxShadow: T.shadow }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>THIS WEEK</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {weeklyStats.map(s => (
                <div
                  key={s.date}
                  onClick={() => setSelectedDate(s.date)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '6px 2px',
                    borderRadius: 8, cursor: 'pointer',
                    background: s.date === selectedDate ? `${teamColor}20` : T.bg,
                  }}
                >
                  <div style={{ fontSize: 9, color: T.textMuted }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: s.done === s.jobs && s.jobs > 0 ? teamColor : T.text }}>
                    {s.actualHours > 0 ? `${s.actualHours}h` : dayOrdinalLabel(s.date)}
                  </div>
                  <div style={{ fontSize: 9, color: T.textLight }}>{fmtHours(s.scheduledHours)} sch</div>
                </div>
              ))}
            </div>
          </div>

          {/* Job list */}
          {dayJobs.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: T.radius, padding: 48, textAlign: 'center', boxShadow: T.shadow }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ fontWeight: 700, color: T.text, marginBottom: 4 }}>No jobs scheduled</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>{selectedDate === TODAY ? 'Enjoy your day off!' : 'Pick a different day above'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dayJobs.map((job, idx) => {
                const clientFromLocal = resolveClientProfile(job, allClients);
                const clientFromApi = jobClientProfiles[String(job.id)] || null;
                const clientFromSnapshot = buildJobSnapshotProfile(job);
                const client = clientFromLocal || clientFromApi || clientFromSnapshot;
                const photos     = localPhotos[job.id] || { before: [], after: [] };
                const isExp      = expandedJob === job.id;
                const status     = job.status || job.job_status || job.jobStatus || 'scheduled';
                const isRunning  = status === 'in_progress';
                const isDone     = status === 'completed';
                const timer      = activeTimers[job.id];
                const startT     = job.start_time || job.startTime || '';
                const actualDur  = job.actual_duration || job.actualDuration || job.duration;
                const extras     = job.extras || [];
                const address    = client?.address || job?.address || `${job.suburb}, QLD`;
                const accessNote = client?.access_notes || client?.accessNotes || job?.access_notes || job?.accessNotes;
                const clientNote = client?.notes || job?.notes;
                const freq       = client?.frequency || job?.frequency;
                const email      = client?.email || job?.email;
                const phone      = client?.phone || job?.phone;
                const preferredDay = client?.preferred_day || client?.preferredDay;
                const preferredTime = client?.preferred_time || client?.preferredTime;
                const bedrooms   = job?.bedrooms ?? client?.bedrooms;
                const bathrooms  = job?.bathrooms ?? client?.bathrooms;
                const living     = job?.living ?? client?.living;
                const kitchen    = job?.kitchen ?? client?.kitchen;
                const hasJobSnapshot = Boolean(clientFromSnapshot);
                const mapsDestination = client?.lat && client?.lng
                  ? `${client.lat},${client.lng}`
                  : address;

                return (
                  <div key={job.id} style={{ background: '#fff', borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadow }}>
                    {/* Card header */}
                    <div style={{ padding: '14px 16px', background: isDone ? T.primaryLight : isRunning ? T.accentLight : '#fff', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted }}>JOB {idx + 1}</span>
                            {freq && (
                              <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: freq === 'weekly' ? T.blueLight : T.primaryLight, color: freq === 'weekly' ? T.blue : T.primaryDark }}>
                                {freq}
                              </span>
                            )}
                            {isDone   && <span>✓ Done</span>}
                            {isRunning && <span>In Progress</span>}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{job.client_name || job.clientName}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: teamColor }}>{startT}</div>
                          <div style={{ fontSize: 12, color: T.textMuted }}>{fmtMins(job.duration)}</div>
                        </div>
                      </div>

                      {/* Timer */}
                      {isRunning && timer !== undefined && (
                        <div style={{ background: T.accent, color: '#fff', borderRadius: T.radiusSm, padding: '8px 12px', textAlign: 'center', marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.9 }}>TIME ELAPSED</div>
                          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace' }}>{fmtSecs(timer)}</div>
                        </div>
                      )}

                      {/* Completed banner */}
                      {isDone && actualDur && (
                        <div style={{ background: teamColor, color: '#fff', borderRadius: T.radiusSm, padding: '6px 12px', textAlign: 'center', marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
                          Done in {fmtMins(actualDur)}
                          {actualDur < job.duration && <span> · {job.duration - actualDur}min early</span>}
                          {actualDur > job.duration && <span> · {actualDur - job.duration}min over</span>}
                        </div>
                      )}

                      {/* Address */}
                      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8 }}>{address}</div>

                      {/* Contact */}
                      {(email || phone) && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                          {phone && (
                            <a
                              href={`tel:${phone}`}
                              style={{ fontSize: 12, color: T.blue, textDecoration: 'none', fontWeight: 700 }}
                            >
                              {phone}
                            </a>
                          )}
                          {email && (
                            <a
                              href={`mailto:${email}`}
                              style={{ fontSize: 12, color: T.blue, textDecoration: 'none', fontWeight: 700 }}
                            >
                              {email}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Rooms */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        {bedrooms !== undefined && bedrooms !== null && <span style={{ fontSize: 13 }}>{bedrooms} bed</span>}
                        {bathrooms !== undefined && bathrooms !== null && <span style={{ fontSize: 13 }}>{bathrooms} bath</span>}
                        {living !== undefined && living !== null && <span style={{ fontSize: 13 }}>{living} living</span>}
                        {kitchen !== undefined && kitchen !== null && <span style={{ fontSize: 13 }}>{kitchen} kitchen</span>}
                        {freq && <span style={{ fontSize: 13 }}>{freq}</span>}
                        {preferredDay && <span style={{ fontSize: 13 }}>pref: {preferredDay}</span>}
                        {preferredTime && <span style={{ fontSize: 13 }}>{preferredTime}</span>}
                        {!client && !clientsLoading && !hasJobSnapshot && (
                          <span style={{ fontSize: 12, color: T.danger }}>
                            Client profile unavailable for this job
                          </span>
                        )}
                      </div>

                      {/* Extras */}
                      {extras.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {extras.map(ex => (
                            <span key={ex} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: T.accentLight, color: '#8B6914' }}>
                              {ex === 'oven' ? 'Oven Clean' : ex === 'windows' ? 'Windows' : ex}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Access & notes */}
                    {(accessNote || clientNote) && (
                      <div style={{ padding: '10px 16px', background: '#FFFDF5', borderBottom: `1px solid ${T.border}` }}>
                        {accessNote && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: clientNote ? 6 : 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{accessNote}</span>
                          </div>
                        )}
                        {clientNote && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 13, color: T.textMuted }}>{clientNote}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <button
                          onClick={() => {
                            const dest = encodeURIComponent(mapsDestination);
                            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
                            const opened = window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                            if (!opened) window.location.href = mapsUrl;
                          }}
                          style={{ padding: '10px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          aria-label="Navigate with Google Maps"
                          title="Google Maps"
                        >
                          <img src="/google-maps-mark.svg" alt="Google Maps" style={{ width: 24, height: 24, display: 'block' }} />
                        </button>
                        <button
                          onClick={() => {
                            const dest = encodeURIComponent(mapsDestination);
                            const wazeUrl = client?.lat && client?.lng
                              ? `https://waze.com/ul?ll=${client.lat},${client.lng}&navigate=yes`
                              : `https://waze.com/ul?q=${dest}&navigate=yes`;
                            const opened = window.open(wazeUrl, '_blank', 'noopener,noreferrer');
                            if (!opened) window.location.href = wazeUrl;
                          }}
                          style={{ padding: '10px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          aria-label="Navigate with Waze"
                          title="Waze"
                        >
                          <img src="/waze-mark.svg" alt="Waze" style={{ width: 24, height: 24, display: 'block' }} />
                        </button>
                        <button
                          onClick={() => setExpandedJob(isExp ? null : job.id)}
                          style={{ padding: '12px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: isExp ? T.primaryLight : '#fff', color: T.text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Photos ({photos.before.length + photos.after.length})
                        </button>
                      </div>

                      {/* Status button */}
                      {!isRunning && !isDone && (
                        <button
                          onClick={() => updateJobStatus(job.id, 'in_progress')}
                          style={{ width: '100%', padding: '14px', borderRadius: T.radiusSm, border: 'none', background: T.accent, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
                        >
                          Arrived — Start Timer
                        </button>
                      )}
                      {isRunning && (
                        <button
                          onClick={() => updateJobStatus(job.id, 'completed')}
                          style={{ width: '100%', padding: '14px', borderRadius: T.radiusSm, border: 'none', background: teamColor, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
                        >
                          Finished — Stop Timer
                        </button>
                      )}
                      {isDone && (
                        <div style={{ width: '100%', padding: '14px', borderRadius: T.radiusSm, background: T.primaryLight, color: T.primaryDark, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
                          Job Complete
                        </div>
                      )}
                    </div>

                    {/* Photos panel */}
                    {isExp && (
                      <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          {['before', 'after'].map(t => (
                            <button
                              key={t}
                              onClick={() => setPhotoType(t)}
                              style={{
                                flex: 1, padding: '9px', borderRadius: T.radiusSm,
                                border: photoType === t ? `2px solid ${teamColor}` : `1.5px solid ${T.border}`,
                                background: photoType === t ? `${teamColor}15` : '#fff',
                                color: photoType === t ? T.primaryDark : T.textMuted,
                                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              {t === 'before' ? 'Before' : 'After'} ({photos[t].length})
                            </button>
                          ))}
                        </div>

                        {photos[photoType].length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                            {photos[photoType].map((p, i) => (
                              <div key={i} style={{ aspectRatio: '1', borderRadius: T.radiusSm, overflow: 'hidden', background: T.bg }}>
                                <img src={p.url || p.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#111' }} />
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => { uploadJobRef.current = { jobId: job.id, type: photoType }; cameraRef.current?.click(); }}
                            style={{ flex: 1, padding: '12px', borderRadius: T.radiusSm, border: 'none', background: teamColor, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Camera
                          </button>
                          <button
                            onClick={() => { uploadJobRef.current = { jobId: job.id, type: photoType }; fileRef.current?.click(); }}
                            style={{ flex: 1, padding: '12px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: '#fff', color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          ROTA TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'rota' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 12 }}>
            <div style={{ background: '#fff', border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '7px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setSelectedDate(d => shiftDays(d, -7))}
                style={{ border: 'none', background: 'none', color: T.textMuted, fontSize: 20, fontWeight: 700, cursor: 'pointer', padding: '0 4px' }}
              >
                ‹
              </button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 800, color: T.text }}>{fmtWeekRange(weekStart)}</div>
              <button
                onClick={() => setSelectedDate(d => shiftDays(d, 7))}
                style={{ border: 'none', background: 'none', color: T.textMuted, fontSize: 20, fontWeight: 700, cursor: 'pointer', padding: '0 4px' }}
              >
                ›
              </button>
            </div>

            <button
              onClick={() => setRotaViewMode('all')}
              style={{
                border: `1.5px solid ${rotaViewMode === 'all' ? teamColor : T.border}`,
                background: rotaViewMode === 'all' ? `${teamColor}12` : '#fff',
                color: rotaViewMode === 'all' ? teamColor : T.text,
                borderRadius: 14,
                padding: '0 14px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              All
            </button>
            <button
              onClick={() => setRotaViewMode('mine')}
              style={{
                border: `1.5px solid ${rotaViewMode === 'mine' ? teamColor : T.border}`,
                background: rotaViewMode === 'mine' ? `${teamColor}12` : '#fff',
                color: rotaViewMode === 'mine' ? teamColor : T.text,
                borderRadius: 14,
                padding: '0 14px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Me
            </button>
          </div>

          {teamRotaLoading && (
            <div style={{ background: '#fff', borderRadius: T.radius, padding: 24, textAlign: 'center', color: T.textMuted, boxShadow: T.shadow }}>
              Loading rota...
            </div>
          )}
          {!teamRotaLoading && teamRotaError && (
            <div style={{ background: '#fff', borderRadius: T.radius, padding: 20, color: T.danger, boxShadow: T.shadow }}>
              Failed to load team rota: {teamRotaError}
            </div>
          )}

          {!teamRotaLoading && !teamRotaError && (
            <div style={{ background: '#fff', borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
              {teamRotaDays.map((day, index) => {
                const dateLabel = new Date(day.date).toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: '2-digit' });
                return (
                  <div key={day.date} style={{ borderTop: index === 0 ? 'none' : `1px solid ${T.border}`, padding: '14px 12px' }}>
                    <button
                      onClick={() => setSelectedDate(day.date)}
                      style={{ border: 'none', background: 'none', padding: 0, margin: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 900, color: day.date === selectedDate ? teamColor : T.text, marginBottom: 2 }}>{dateLabel}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>
                        {day.shifts.length} shift{day.shifts.length === 1 ? '' : 's'} · {day.jobCount} job{day.jobCount === 1 ? '' : 's'}
                      </div>
                    </button>

                    {day.shifts.length === 0 ? (
                      <div style={{ fontSize: 12, color: T.textMuted, padding: '2px 0 4px' }}>No shifts scheduled</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {day.shifts.map((shift) => {
                          const rowKey = `${day.date}_${shift.staffId}`;
                          const isExpanded = expandedRotaRows.has(rowKey);
                          return (
                            <div key={rowKey} style={{ borderRadius: 10, border: `1px solid ${isExpanded ? teamColor : T.border}`, background: isExpanded ? `${teamColor}08` : '#fff', overflow: 'hidden' }}>
                              <button
                                onClick={() => toggleExpandedRotaRow(rowKey)}
                                style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 10, alignItems: 'start', padding: '9px 8px', textAlign: 'left' }}
                              >
                                <div style={{ width: 44, height: 44, borderRadius: 10, background: shift.isYou ? `${teamColor}22` : T.bg, color: shift.isYou ? teamColor : T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900 }}>
                                  {initialsFromName(shift.name)}
                                </div>
                                <div>
                                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2, color: T.text }}>
                                    {shift.shiftLabel} ({formatShiftMins(shift.shiftMinutes)})
                                  </div>
                                  <div style={{ fontSize: 14, color: T.textMuted, marginTop: 1 }}>
                                    {shift.name}{shift.isYou ? ' · You' : ''} · {String(shift.role || 'staff').replace('_', ' ')}
                                  </div>
                                  <div style={{ fontSize: 14, color: T.textLight, marginTop: 2 }}>{shift.jobsPreview || 'No assigned jobs'}</div>
                                </div>
                                <div style={{ fontSize: 20, color: T.textLight, paddingTop: 6 }}>{isExpanded ? '⌃' : '⌄'}</div>
                              </button>

                              {isExpanded && (
                                <div style={{ borderTop: `1px solid ${T.border}`, padding: '8px 10px 10px 62px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {shift.jobs.length === 0 ? (
                                    <div style={{ fontSize: 12, color: T.textMuted }}>No jobs assigned.</div>
                                  ) : (
                                    shift.jobs.map((job, idx) => {
                                      const nextJob = shift.jobs[idx + 1] || null;
                                      const canGap = Number.isFinite(job.endMin) && Number.isFinite(nextJob?.startMin);
                                      const gapMins = canGap ? (nextJob.startMin - job.endMin) : null;
                                      const addressLabel = job.address || (job.suburb ? `${job.suburb}, QLD` : '');
                                      return (
                                        <div key={job.id}>
                                          <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                                            {(job.start || '—')} - {(job.end || '—')} · {job.clientName}
                                          </div>
                                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                                            {addressLabel || 'Address pending'}{job.frequency ? ` · ${job.frequency}` : ''}
                                          </div>
                                          {(job.bedrooms !== undefined && job.bedrooms !== null) && (
                                            <div style={{ fontSize: 11, color: T.textLight, marginTop: 1 }}>
                                              {job.bedrooms} bed · {job.bathrooms ?? 0} bath · {job.living ?? 0} living · {job.kitchen ?? 0} kitchen
                                            </div>
                                          )}
                                          {(job.accessNotes || job.notes) && (
                                            <div style={{ fontSize: 11, color: T.textLight, marginTop: 1 }}>
                                              {job.accessNotes ? `Access: ${job.accessNotes}` : ''}
                                              {job.accessNotes && job.notes ? ' · ' : ''}
                                              {job.notes ? `Notes: ${job.notes}` : ''}
                                            </div>
                                          )}
                                          {gapMins !== null && (
                                            <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 8, background: gapMins < 0 ? '#FCEAEA' : T.bg, color: gapMins < 0 ? T.danger : T.textMuted, fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                                              {gapMins < 0 ? `Overlap ${Math.abs(gapMins)}m` : `Travel gap ${gapMins}m`}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {selectedTeamRotaDay && (
            <div style={{ marginTop: 12, background: T.blueLight, borderRadius: T.radius, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.blue, marginBottom: 2 }}>
                Selected Day: {new Date(selectedTeamRotaDay.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {selectedTeamRotaDay.shifts.length} team shift{selectedTeamRotaDay.shifts.length === 1 ? '' : 's'} · {selectedTeamRotaDay.jobCount} published job{selectedTeamRotaDay.jobCount === 1 ? '' : 's'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          HOURS TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'hours' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Stat label="Scheduled Hours" value={fmtHours(weeklyScheduledHours)} />
            <Stat label="Worked Hours" value={fmtHours(weeklyWorkedHours)} highlight={teamColor} />
            <Stat label="Est. Gross" value={fmtCurrency(payrollEstimate.grossPay)} />
            <Stat label="Est. Net" value={fmtCurrency(payrollEstimate.netPay)} highlight={teamColor} />
          </div>

          <div style={{ background: '#fff', borderRadius: T.radius, padding: '12px 14px', marginBottom: 12, boxShadow: T.shadow }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, marginBottom: 10 }}>WEEK DETAIL · {fmtWeekRange(weekStart)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weeklyStats.map(s => {
                const clockIn = s.timeEntry?.clock_in_at || s.timeEntry?.clockInAt;
                const clockOut = s.timeEntry?.clock_out_at || s.timeEntry?.clockOutAt;
                const breakMins = Number(s.timeEntry?.break_minutes ?? DEFAULT_BREAK_MINUTES) || DEFAULT_BREAK_MINUTES;
                return (
                  <button
                    key={s.date}
                    onClick={() => setSelectedDate(s.date)}
                    style={{
                      border: s.date === selectedDate ? `1.5px solid ${teamColor}` : `1px solid ${T.border}`,
                      background: s.date === selectedDate ? `${teamColor}10` : '#fff',
                      borderRadius: 10,
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{s.label} {new Date(s.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{fmtHours(s.actualHours)} worked</div>
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      Scheduled {fmtHours(s.scheduledHours)} · Clock {fmtTime(clockIn)} - {fmtTime(clockOut)} · Break {breakMins}m
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ background: T.blueLight, borderRadius: T.radius, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.blue, marginBottom: 4 }}>Payroll Sync</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              Clocked hours sync to admin payroll automatically. Owners can still adjust before processing payslips.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          PAYSLIPS TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'payslips' && (
        <div style={{ padding: 16 }}>
          <PayslipsView payslips={payslips} demoMode={demoMode} teamColor={teamColor} />
        </div>
      )}

      {/* Bottom navigation */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', zIndex: 120 }}>
        {[
          { id: 'today', label: 'Today', icon: '🧼' },
          { id: 'rota', label: 'Rota', icon: '📅' },
          { id: 'hours', label: 'Hours', icon: '⏱️' },
          { id: 'payslips', label: 'Pay', icon: '💵' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: 'none',
              background: 'none',
              padding: '10px 4px 12px',
              color: activeTab === tab.id ? teamColor : T.textMuted,
              fontSize: 11,
              fontWeight: activeTab === tab.id ? 800 : 600,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 3 }}>{tab.icon}</div>
            <div>{tab.label}</div>
          </button>
        ))}
      </div>

      {/* Hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhotoFile} style={{ display: 'none' }} />
      <input ref={fileRef}   type="file" accept="image/jpeg,image/png,image/webp" multiple            onChange={handlePhotoFile} style={{ display: 'none' }} />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 74, left: '50%', transform: 'translateX(-50%)', background: '#1B3A2D', color: '#fff', padding: '13px 22px', borderRadius: 30, fontSize: 14, fontWeight: 600, boxShadow: T.shadowLg, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PAYSLIPS VIEW COMPONENT
// ══════════════════════════════════════════════════════════
function PayslipsView({ payslips, demoMode, teamColor }) {
  const fmt = (n) => `$${(n || 0).toFixed(2)}`;

  if (demoMode) {
    return (
      <div style={{ background: '#fff', borderRadius: T.radius, padding: 40, textAlign: 'center', boxShadow: T.shadow }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💵</div>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>Payslips not available in demo</div>
        <div style={{ fontSize: 13, color: T.textMuted }}>Sign in with your email and password to view your payslips.</div>
      </div>
    );
  }

  if (payslips.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: T.radius, padding: 40, textAlign: 'center', boxShadow: T.shadow }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💵</div>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>No payslips yet</div>
        <div style={{ fontSize: 13, color: T.textMuted }}>Your payslips will appear here once payroll is processed.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {payslips.map(slip => {
        const rec = slip.payroll_records;
        const weekStr = slip.week_start ? new Date(slip.week_start).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
        return (
          <div key={slip.id} style={{ background: '#fff', borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadow }}>
            <div style={{ padding: '14px 16px', background: `${teamColor}10`, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Week of {weekStr}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{rec?.hours_worked || 0}h worked</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: teamColor }}>{fmt(rec?.net_pay)}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>net pay</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Stat label="Gross Pay"    value={fmt(rec?.gross_pay)} />
                <Stat label="Tax"          value={fmt(rec?.tax_withheld)} />
                <Stat label="Superannuation" value={fmt(rec?.super_amount)} />
                <Stat label="Net Pay"      value={fmt(rec?.net_pay)} highlight={teamColor} />
              </div>
              {slip.storage_path && (
                <button
                  onClick={async () => {
                    if (!supabaseReady) return;
                    const { data } = await supabase.storage.from('payslips').createSignedUrl(slip.storage_path, 300);
                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                  }}
                  style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: T.radiusSm, border: `1.5px solid ${teamColor}`, background: '#fff', color: teamColor, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  View Payslip PDF
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{ background: T.bg, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: highlight || T.text }}>{value}</div>
    </div>
  );
}
