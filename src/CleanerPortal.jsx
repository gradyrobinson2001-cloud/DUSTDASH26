import React, { useState, useEffect, useRef, useCallback } from 'react';
import StaffLogin from './auth/StaffLogin';
import { useScheduledJobs } from './hooks/useScheduledJobs';
import { useClients } from './hooks/useClients';
import { usePhotos } from './hooks/usePhotos';
import { useStaffTimeEntries } from './hooks/useStaffTimeEntries';
import { useStaffBroadcast } from './hooks/useStaffBroadcast';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';
import { supabase, supabaseReady } from './lib/supabase';
import { T } from './shared';
import { calcPayrollBreakdown, calcWorkedMinutesFromEntry, fmtCurrency } from './utils/payroll';

// ═══════════════════════════════════════════════════════════
// STAFF PORTAL — Minimal Redesign
// Auth: StaffLogin (email + password → Supabase session)
// Tabs: Today | Group Rota | Hours
// ═══════════════════════════════════════════════════════════

const TODAY = new Date().toISOString().split('T')[0];

const DEMO_JOBS = [
  { id: 'demo_1', client_id: 'dc1', client_name: 'Sarah Mitchell', suburb: 'Buderim', date: TODAY, start_time: '08:00', end_time: '10:15', duration: 135, assigned_staff: ['demo'], is_published: true, job_status: 'scheduled', bedrooms: 3, bathrooms: 2, living: 1, kitchen: 1, extras: ['oven'] },
  { id: 'demo_2', client_id: 'dc2', client_name: 'James Cooper', suburb: 'Maroochydore', date: TODAY, start_time: '10:45', end_time: '12:45', duration: 120, assigned_staff: ['demo'], is_published: true, job_status: 'scheduled', bedrooms: 4, bathrooms: 2, living: 2, kitchen: 1, extras: [] },
  { id: 'demo_3', client_id: 'dc3', client_name: 'Emma Collins', suburb: 'Mooloolaba', date: TODAY, start_time: '13:30', end_time: '15:30', duration: 120, assigned_staff: ['demo'], is_published: true, job_status: 'scheduled', bedrooms: 2, bathrooms: 1, living: 1, kitchen: 1, extras: ['windows'] },
];

const DEMO_CLIENTS = [
  { id: 'dc1', name: 'Sarah Mitchell', address: '23 Ballinger Crescent, Buderim QLD 4556', notes: '2 dogs – keep gate closed', access_notes: 'Key under front doormat, alarm 1234#', frequency: 'weekly' },
  { id: 'dc2', name: 'James Cooper', address: '15 Duporth Avenue, Maroochydore QLD 4558', notes: 'Baby sleeps 1–3pm, please be quiet', access_notes: 'Ring doorbell, client WFH', frequency: 'fortnightly' },
  { id: 'dc3', name: 'Emma Collins', address: '5 Parkyn Parade, Mooloolaba QLD 4557', notes: '', access_notes: 'Lockbox side gate – code 5678', frequency: 'weekly' },
];

const DEFAULT_BREAK_MINUTES = 30;
const CLOCK_LOCAL_PREFIX = 'dustdash_staff_time_entries_';

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
  return `${n.toFixed(1)}h`;
}
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}
function weekDays(anchorDate) {
  const d = new Date(anchorDate);
  const day = d.getDay();
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
  return `${m.toLocaleDateString('en-AU', opts)} – ${s.toLocaleDateString('en-AU', opts)}`;
}
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dayOrdinalLabel(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '--';
  const day = d.getDate();
  const modulo100 = day % 100;
  const suffix = (modulo100 >= 11 && modulo100 <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][day % 10] || 'th');
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
    bedrooms, bathrooms, living, kitchen,
    email: job?.email || "",
    phone: job?.phone || "",
    source: "job_snapshot",
  };
}

function isMissingClockTableMessage(raw) {
  const msg = String(raw || '').toLowerCase();
  return (
    msg.includes('staff_time_entries')
    && (msg.includes('does not exist') || msg.includes('could not find table') || msg.includes('schema cache') || msg.includes('relation'))
  );
}

function clockLocalKey(staffId) {
  return `${CLOCK_LOCAL_PREFIX}${String(staffId || 'unknown')}`;
}

function readLocalClockEntries(staffId) {
  try {
    const raw = localStorage.getItem(clockLocalKey(staffId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeLocalClockEntries(staffId, rows) {
  try {
    localStorage.setItem(clockLocalKey(staffId), JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {}
}

function filterClockEntriesForWeek(rows, weekStart) {
  if (!weekStart) return Array.isArray(rows) ? rows : [];
  const weekEnd = shiftDays(weekStart, 6);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const d = String(row?.work_date || '');
    return d >= weekStart && d <= weekEnd;
  });
}

// ─── Design Tokens ──────────────────────────────────────
const S = {
  // Colors - refined palette
  bg: '#F7F6F3',
  card: '#FFFFFF',
  cardAlt: '#FAFAF8',
  primary: '#2D3B35',
  primarySoft: '#3D5A4C',
  accent: '#5B7F62',
  accentLight: '#EDF3EE',
  accentPale: '#F4F8F5',
  warm: '#C8A765',
  warmLight: '#FBF6EC',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  border: '#EBEBEB',
  borderLight: '#F2F2F2',
  danger: '#D4645C',
  dangerLight: '#FDF0EF',
  success: '#5B7F62',
  successLight: '#EDF3EE',
  blue: '#4A7C8A',
  blueLight: '#EBF4F6',
  // Shadows
  shadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.06)',
  shadowLg: '0 12px 32px rgba(0,0,0,0.08)',
  // Radii
  r: 16,
  rSm: 12,
  rXs: 8,
  rPill: 100,
  // Transitions
  transition: 'all 0.2s ease',
};

// ─── Component ────────────────────────────────────────────
export default function CleanerPortal() {
  const [profile, setProfile] = useState(null);
  const [authHydrating, setAuthHydrating] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [expandedJob, setExpandedJob] = useState(null);
  const [photoType, setPhotoType] = useState('before');
  const [toast, setToast] = useState(null);
  const [activeTimers, setActiveTimers] = useState({});
  const [localPhotos, setLocalPhotos] = useState({});
  const [payslips, setPayslips] = useState([]);
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
  const [clockOfflineFallback, setClockOfflineFallback] = useState(false);
  const [rotaSelectedDay, setRotaSelectedDay] = useState(null);

  const timerRefs = useRef({});
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const uploadJobRef = useRef(null);

  const staffId = demoMode ? 'demo' : profile?.id;
  const weekDates_ = weekDays(selectedDate);
  const weekStart = getMonday(selectedDate);

  const { scheduledJobs, updateJob, refreshScheduledJobs } = useScheduledJobs(staffId ? { staffId } : {});
  const { clients, loading: clientsLoading } = useClients();
  const { photos: supaPhotos, uploadPhoto, getSignedUrl } = usePhotos();
  const { timeEntries, setTimeEntries, refreshTimeEntries, error: timeEntriesError } = useStaffTimeEntries(staffId ? { staffId, weekStart } : { weekStart });
  const { activeBroadcast } = useStaffBroadcast();
  const {
    supported: notificationSupported,
    permission: notificationPermission,
    enabled: notificationsEnabled,
    requestPermission: requestNotificationPermission,
    notify: notifyBrowser,
  } = useBrowserNotifications('dustdash_staff_notifications');

  const allJobs = demoMode ? DEMO_JOBS : scheduledJobs;
  const allClients = demoMode ? DEMO_CLIENTS : clients;
  const allTimeEntries = demoMode ? demoTimeEntries : timeEntries;

  const dayJobs = allJobs
    .filter(j => j.date === selectedDate && !j.is_break && !j.isBreak)
    .sort((a, b) => (a.start_time || a.startTime || '').localeCompare(b.start_time || b.startTime || ''));
  const dayJobIdsKey = dayJobs.map(j => String(j.id)).sort().join('|');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Auth hydration ─────────────────────────────────────
  useEffect(() => {
    if (!supabaseReady || demoMode) { setAuthHydrating(false); return; }
    let cancelled = false;
    const loadStaffProfile = async (session) => {
      const user = session?.user || null;
      if (!user) { if (!cancelled) { setProfile(null); setAuthHydrating(false); } return; }
      const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (cancelled) return;
      if (profErr || !prof || prof.role !== 'staff' || !prof.is_active) {
        await supabase.auth.signOut();
        setProfile(null); setAuthHydrating(false); return;
      }
      setProfile(prof); setAuthHydrating(false);
    };
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error) { setAuthHydrating(false); return; }
      await loadStaffProfile(data?.session || null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      loadStaffProfile(session || null);
    });
    return () => { cancelled = true; subscription?.subscription?.unsubscribe?.(); };
  }, [demoMode]);

  const enableStaffNotifications = useCallback(async () => {
    if (!notificationSupported) { showToast('Notifications not supported on this device.'); return; }
    const result = await requestNotificationPermission();
    if (result.ok) showToast('Notifications enabled');
    else if (result.reason === 'denied') showToast('Notifications blocked in browser settings');
  }, [notificationSupported, requestNotificationPermission, showToast]);

  const prevBroadcastIdRef = useRef(null);
  useEffect(() => {
    const id = activeBroadcast?.id || null;
    if (!id) { prevBroadcastIdRef.current = null; return; }
    if (prevBroadcastIdRef.current && prevBroadcastIdRef.current !== id && document.visibilityState !== 'visible') {
      notifyBrowser({ title: 'New owner broadcast', body: String(activeBroadcast?.message || '').slice(0, 120), tag: 'staff-broadcast', requireInteraction: true });
    }
    prevBroadcastIdRef.current = id;
  }, [activeBroadcast?.id, activeBroadcast?.message, notifyBrowser]);

  const prevDayJobsCountRef = useRef(dayJobs.length);
  useEffect(() => {
    if (demoMode) { prevDayJobsCountRef.current = dayJobs.length; return; }
    if (dayJobs.length > prevDayJobsCountRef.current && document.visibilityState !== 'visible') {
      notifyBrowser({ title: 'New job assigned', body: `${dayJobs.length} job${dayJobs.length === 1 ? '' : 's'} scheduled`, tag: 'staff-jobs' });
    }
    prevDayJobsCountRef.current = dayJobs.length;
  }, [dayJobs.length, demoMode, notifyBrowser, selectedDate]);

  const toggleExpandedRotaRow = useCallback((rowKey) => {
    setExpandedRotaRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey);
      return next;
    });
  }, []);

  const normalizeClockError = useCallback((rawMessage) => {
    const msg = String(rawMessage || '').toLowerCase();
    if (isMissingClockTableMessage(msg)) return 'Clock sync temporarily unavailable. Saved locally.';
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Network issue. Please retry.';
    return rawMessage || 'Unknown error';
  }, []);

  useEffect(() => {
    if (clockOfflineFallback && !isMissingClockTableMessage(timeEntriesError?.message)) {
      setClockOfflineFallback(false);
    }
  }, [clockOfflineFallback, timeEntriesError]);

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
      if (idx >= 0) next[idx] = { ...next[idx], ...entry }; else next.unshift(entry);
      return next;
    });
  }, [setTimeEntries]);

  const applyLocalClockFallback = useCallback((action) => {
    if (!staffId) return { ok: false, message: 'Staff account missing.' };
    const existing = readLocalClockEntries(staffId);
    const rows = Array.isArray(existing) ? [...existing] : [];
    const index = rows.findIndex((row) => String(row?.work_date || '') === selectedDate);
    const current = index >= 0 ? rows[index] : null;
    const now = new Date().toISOString();
    if (action === 'clock_in') {
      if (current?.clock_in_at && current?.clock_out_at) return { ok: false, message: 'Already clocked out today.' };
      if (current?.clock_in_at && !current?.clock_out_at) return { ok: true, message: 'Already clocked in (local).' };
      const nextEntry = { id: current?.id || `local_clock_${staffId}_${selectedDate}`, staff_id: staffId, work_date: selectedDate, clock_in_at: now, clock_out_at: null, break_minutes: breakMinutes, source: 'local_fallback', created_at: current?.created_at || now, updated_at: now };
      if (index >= 0) rows[index] = nextEntry; else rows.unshift(nextEntry);
      writeLocalClockEntries(staffId, rows);
      setTimeEntries(filterClockEntriesForWeek(rows, weekStart));
      return { ok: true, message: 'Clocked in (local).' };
    }
    if (action === 'clock_out') {
      if (!current?.clock_in_at) return { ok: false, message: 'Clock in first.' };
      if (current?.clock_out_at) return { ok: true, message: 'Already clocked out (local).' };
      const nextEntry = { ...current, break_minutes: breakMinutes, clock_out_at: now, updated_at: now };
      if (index >= 0) rows[index] = nextEntry; else rows.unshift(nextEntry);
      writeLocalClockEntries(staffId, rows);
      setTimeEntries(filterClockEntriesForWeek(rows, weekStart));
      return { ok: true, message: 'Clocked out (local).' };
    }
    return { ok: false, message: 'Unsupported action.' };
  }, [breakMinutes, selectedDate, setTimeEntries, staffId, weekStart]);

  // ── Data refresh ──────────────────────────────────────
  useEffect(() => {
    if (demoMode || !staffId) return;
    const refresh = async () => { await Promise.allSettled([refreshScheduledJobs?.(), refreshTimeEntries?.()]); };
    refresh();
    const onFocus = () => refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const intervalId = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(intervalId); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible); };
  }, [demoMode, refreshScheduledJobs, refreshTimeEntries, staffId]);

  // ── Team rota ─────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'rota') return;
    if (demoMode) {
      setTeamRotaJobs(DEMO_JOBS);
      setTeamRotaStaffById({ demo: { id: 'demo', full_name: 'Demo Staff', role: 'staff' } });
      setTeamRotaError('');
      return;
    }
    if (!supabaseReady || !supabase || !profile?.id) return;
    let cancelled = false;
    const loadRota = async () => {
      setTeamRotaLoading(true); setTeamRotaError('');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error('Session expired.');
        const res = await fetch('/api/staff/rota-overview', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ weekStart }) });
        let body = {}; try { body = await res.json(); } catch {}
        if (!res.ok || body?.error) throw new Error(body?.error || body?.details || `Failed (${res.status})`);
        if (cancelled) return;
        setTeamRotaJobs(Array.isArray(body?.jobs) ? body.jobs : []);
        setTeamRotaStaffById(body?.staffById || {});
      } catch (err) {
        if (cancelled) return;
        setTeamRotaJobs([]); setTeamRotaStaffById({});
        setTeamRotaError(err?.message || 'Failed to load rota.');
      } finally { if (!cancelled) setTeamRotaLoading(false); }
    };
    loadRota();
    return () => { cancelled = true; };
  }, [activeTab, demoMode, profile?.id, weekStart]);

  useEffect(() => { setExpandedRotaRows(new Set()); }, [weekStart, rotaViewMode]);

  // ── Timers ────────────────────────────────────────────
  useEffect(() => {
    dayJobs.forEach(job => {
      const arrivedAt = job.actual_start_at || job.actualStartAt || job.arrived_at || job.arrivedAt;
      const status = job.status || job.job_status || job.jobStatus;
      if (status === 'in_progress' && arrivedAt && !timerRefs.current[job.id]) {
        const start = new Date(arrivedAt).getTime();
        timerRefs.current[job.id] = setInterval(() => {
          setActiveTimers(p => ({ ...p, [job.id]: Math.floor((Date.now() - start) / 1000) }));
        }, 1000);
      } else if (status !== 'in_progress' && timerRefs.current[job.id]) {
        clearInterval(timerRefs.current[job.id]); delete timerRefs.current[job.id];
      }
    });
    return () => Object.values(timerRefs.current).forEach(clearInterval);
  }, [dayJobs]);

  // ── Photos ────────────────────────────────────────────
  useEffect(() => {
    if (demoMode) return;
    const jobIdSet = new Set(dayJobs.map(j => String(j.id)));
    const relevant = supaPhotos.filter(p => jobIdSet.has(String(p.job_id)));
    const buildMap = async () => {
      const map = {};
      for (const p of relevant) {
        const key = String(p.job_id);
        if (!map[key]) map[key] = { before: [], after: [] };
        const url = await getSignedUrl(p.storage_path);
        if (!url) continue;
        map[key][p.type].push({ id: p.id, url, storage_path: p.storage_path, uploaded_at: p.uploaded_at });
      }
      setLocalPhotos(map);
    };
    buildMap();
  }, [dayJobIdsKey, demoMode, getSignedUrl, supaPhotos]);

  // ── Client profiles for jobs ──────────────────────────
  useEffect(() => {
    if (demoMode) { setJobClientProfiles({}); return; }
    const loadProfiles = async () => {
      if (!supabaseReady || dayJobs.length === 0) { setJobClientProfiles({}); return; }
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error('Missing session');
        const res = await fetch('/api/staff/job-client-profiles', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ jobIds: dayJobs.map(j => j.id) }) });
        let body = {}; try { body = await res.json(); } catch {}
        if (!res.ok || body?.error) throw new Error(body?.error || body?.details || `Failed (${res.status})`);
        setJobClientProfiles(body?.profilesByJob || {});
      } catch (err) { setJobClientProfiles({}); }
    };
    loadProfiles();
  }, [demoMode, dayJobIdsKey]);

  // ── Payslips ──────────────────────────────────────────
  useEffect(() => {
    if (!supabaseReady || !profile?.id || demoMode) return;
    supabase.from('payslips').select('*, payroll_records(week_start, gross_pay, net_pay, tax_withheld, super_amount, hours_worked)').eq('staff_id', profile.id).order('created_at', { ascending: false }).then(({ data }) => setPayslips(data ?? []));
  }, [profile, demoMode]);

  // ── Job actions ───────────────────────────────────────
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
      if (arrivedAt) updates.actual_duration = Math.max(15, Math.round((new Date(now) - new Date(arrivedAt)) / 60000));
      if (timerRefs.current[jobId]) { clearInterval(timerRefs.current[jobId]); delete timerRefs.current[jobId]; }
    }
    if (!demoMode) {
      try { await updateJob(jobId, updates); } catch { showToast('Update failed'); return; }
    }
    showToast(newStatus === 'in_progress' ? 'Timer started' : 'Job completed');
  }, [allJobs, demoMode, updateJob, showToast]);

  const callStaffClockApi = useCallback(async (action, workDate) => {
    if (!supabaseReady || !supabase) throw new Error('Auth not configured.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    const token = data?.session?.access_token;
    if (!token) throw new Error('Session expired.');
    const res = await fetch('/api/staff/clock', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, workDate, breakMinutes }) });
    let body = {}; try { body = await res.json(); } catch {}
    if (!res.ok || body?.error) {
      const top = String(body?.error || '').trim();
      const details = String(body?.details || '').trim();
      throw new Error(top && details ? `${top}: ${details}` : (top || details || `Failed (${res.status})`));
    }
    return body?.entry || null;
  }, [breakMinutes]);

  const handleClockIn = useCallback(async () => {
    if (!window.confirm(`Clock in for ${new Date(selectedDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}?`)) return;
    setClockActionLoading(true);
    try {
      if (demoMode) {
        const now = new Date().toISOString();
        setDemoTimeEntries(prev => {
          const existing = prev.find(entry => entry.work_date === selectedDate);
          if (existing?.clock_out_at || existing?.clock_in_at) return prev;
          return [...prev.filter(entry => entry.work_date !== selectedDate), { id: `demo_clock_${selectedDate}`, staff_id: 'demo', work_date: selectedDate, clock_in_at: now, clock_out_at: null, break_minutes: breakMinutes }];
        });
        showToast('Clocked in');
      } else {
        const entry = await callStaffClockApi('clock_in', selectedDate);
        upsertLiveTimeEntry(entry); setClockOfflineFallback(false);
        await refreshTimeEntries(); showToast('Clocked in');
      }
    } catch (err) {
      if (!demoMode && isMissingClockTableMessage(err?.message)) {
        const fallback = applyLocalClockFallback('clock_in');
        if (fallback.ok) { setClockOfflineFallback(true); showToast(fallback.message); return; }
      }
      showToast(`Clock in failed: ${normalizeClockError(err?.message)}`);
    } finally { setClockActionLoading(false); }
  }, [applyLocalClockFallback, breakMinutes, callStaffClockApi, demoMode, normalizeClockError, refreshTimeEntries, selectedDate, showToast, upsertLiveTimeEntry]);

  const handleClockOut = useCallback(async () => {
    if (!window.confirm(`Clock out for ${new Date(selectedDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}?`)) return;
    setClockActionLoading(true);
    try {
      if (demoMode) {
        const now = new Date().toISOString();
        setDemoTimeEntries(prev => prev.map(entry => (entry.work_date === selectedDate ? { ...entry, clock_out_at: entry.clock_out_at || now, break_minutes: breakMinutes } : entry)));
        showToast('Clocked out');
      } else {
        const entry = await callStaffClockApi('clock_out', selectedDate);
        upsertLiveTimeEntry(entry); setClockOfflineFallback(false);
        await refreshTimeEntries(); showToast('Clocked out');
      }
    } catch (err) {
      if (!demoMode && isMissingClockTableMessage(err?.message)) {
        const fallback = applyLocalClockFallback('clock_out');
        if (fallback.ok) { setClockOfflineFallback(true); showToast(fallback.message); return; }
      }
      showToast(`Clock out failed: ${normalizeClockError(err?.message)}`);
    } finally { setClockActionLoading(false); }
  }, [applyLocalClockFallback, breakMinutes, callStaffClockApi, demoMode, normalizeClockError, refreshTimeEntries, selectedDate, showToast, upsertLiveTimeEntry]);

  // ── Photo upload ──────────────────────────────────────
  const handlePhotoFile = useCallback(async (e) => {
    const files = e.target.files;
    const jobId = uploadJobRef.current?.jobId;
    const type = uploadJobRef.current?.type;
    if (!files?.length || !jobId) return;
    const job = allJobs.find(j => j.id === jobId);
    for (const file of files) {
      if (demoMode) {
        const url = URL.createObjectURL(file);
        setLocalPhotos(prev => ({
          ...prev,
          [jobId]: { before: prev[jobId]?.before || [], after: prev[jobId]?.after || [], [type]: [...(prev[jobId]?.[type] || []), { url, uploaded_at: new Date().toISOString() }] },
        }));
        showToast(`${type === 'before' ? 'Before' : 'After'} photo added`);
        continue;
      }
      try {
        await uploadPhoto({ jobId, clientId: job?.client_id || job?.clientId, date: selectedDate, type, file, uploadedBy: profile?.id });
        showToast(`${type === 'before' ? 'Before' : 'After'} photo uploaded`);
      } catch (err) { showToast(`Upload failed: ${err?.message || 'Try again.'}`); }
    }
    e.target.value = '';
  }, [allJobs, demoMode, selectedDate, profile, uploadPhoto, showToast]);

  // ── Computed data ─────────────────────────────────────
  const selectedDayEntry = allTimeEntries.find(entry => entry.work_date === selectedDate) || null;
  useEffect(() => { setBreakMinutes(selectedDayEntry?.break_minutes ?? DEFAULT_BREAK_MINUTES); }, [selectedDayEntry?.id, selectedDayEntry?.break_minutes]);

  const weeklyStats = weekDates_.map((d, i) => {
    const dJobs = allJobs.filter(j => j.date === d && !j.is_break && !j.isBreak);
    const done = dJobs.filter(j => (j.status || j.job_status || j.jobStatus) === 'completed');
    const scheduledMins = dJobs.reduce((s, j) => s + (j.duration || 0), 0);
    const completedMins = done.reduce((s, j) => s + (j.actual_duration || j.actualDuration || j.duration || 0), 0);
    const timeEntry = allTimeEntries.find(entry => entry.work_date === d);
    const workedMins = timeEntry ? calcWorkedMinutesFromEntry(timeEntry, d === TODAY) : completedMins;
    return {
      label: DAY_LABELS[i], fullLabel: DAY_LABELS_FULL[i], date: d, jobs: dJobs.length, done: done.length, scheduledMins, workedMins, timeEntry,
      scheduledHours: Math.round((scheduledMins / 60) * 100) / 100,
      actualHours: Math.round((workedMins / 60) * 100) / 100,
    };
  });

  const teamRotaDays = (() => {
    const weekSet = new Set(weekDates_);
    const sourceJobs = (demoMode ? DEMO_JOBS : teamRotaJobs)
      .filter(job => weekSet.has(job?.date))
      .filter(job => !job?.is_break && !job?.isBreak)
      .filter(job => Boolean(job?.is_published ?? job?.isPublished ?? true));
    const dayMap = Object.fromEntries(weekDates_.map((date, i) => [date, { date, label: DAY_LABELS[i], fullLabel: DAY_LABELS_FULL[i], shifts: [], jobCount: 0 }]));
    weekDates_.forEach((date) => {
      const jobsForDate = sourceJobs.filter(job => job.date === date);
      const byStaff = {};
      jobsForDate.forEach((job) => {
        const assigned = Array.isArray(job.assigned_staff) && job.assigned_staff.length > 0 ? job.assigned_staff.map(String) : ['unassigned'];
        assigned.forEach((entryStaffId) => {
          if (rotaViewMode === 'mine' && String(entryStaffId) !== String(staffId)) return;
          if (!byStaff[entryStaffId]) {
            const staffProfile = teamRotaStaffById?.[entryStaffId] || null;
            byStaff[entryStaffId] = { staffId: entryStaffId, name: staffProfile?.full_name || (entryStaffId === 'unassigned' ? 'Unassigned' : 'Staff'), role: staffProfile?.role || 'staff', startMin: null, endMin: null, totalJobMinutes: 0, jobs: [] };
          }
          const row = byStaff[entryStaffId];
          const startText = job.start_time || job.startTime || '';
          const endText = job.end_time || job.endTime || '';
          const startMin = timeToMinutes(startText);
          const endMin = timeToMinutes(endText);
          if (startMin !== null) row.startMin = row.startMin === null ? startMin : Math.min(row.startMin, startMin);
          if (endMin !== null) row.endMin = row.endMin === null ? endMin : Math.max(row.endMin, endMin);
          row.totalJobMinutes += Number(job.duration || 0);
          row.jobs.push({ id: job.id, clientName: job.client_name || job.clientName || 'Client', start: startText, end: endText, startMin, endMin, suburb: job.suburb || '', address: job?.address || '', notes: job?.notes || '', accessNotes: job?.access_notes || '', bedrooms: job?.bedrooms, bathrooms: job?.bathrooms, living: job?.living, kitchen: job?.kitchen, frequency: job?.frequency || '' });
        });
      });
      const shifts = Object.values(byStaff).map((row) => {
        const sortedJobs = [...row.jobs].sort((a, b) => (Number.isFinite(a.startMin) ? a.startMin : 9999) - (Number.isFinite(b.startMin) ? b.startMin : 9999));
        const hasRange = row.startMin !== null && row.endMin !== null && row.endMin > row.startMin;
        const shiftMinutes = hasRange ? Math.max(row.endMin - row.startMin, row.totalJobMinutes) : row.totalJobMinutes;
        const shiftLabel = hasRange ? `${minsToClock(row.startMin)} – ${minsToClock(row.endMin)}` : 'TBD';
        return { ...row, shiftMinutes, shiftLabel, isYou: String(row.staffId) === String(staffId), jobs: sortedJobs };
      }).sort((a, b) => (a.startMin ?? 9999) - (b.startMin ?? 9999));
      dayMap[date].shifts = shifts;
      dayMap[date].jobCount = jobsForDate.length;
    });
    return weekDates_.map(date => dayMap[date]);
  })();

  const todayStats = (() => {
    const done = dayJobs.filter(j => (j.status || j.job_status || j.jobStatus) === 'completed');
    const scheduledMins = dayJobs.reduce((s, j) => s + (j.duration || 0), 0);
    const workedMins = selectedDayEntry ? calcWorkedMinutesFromEntry(selectedDayEntry, selectedDate === TODAY) : done.reduce((s, j) => s + (j.actual_duration || j.actualDuration || j.duration || 0), 0);
    return { done: done.length, total: dayJobs.length, scheduledMins, workedMins };
  })();

  const weeklyScheduledMinutes = weeklyStats.reduce((sum, s) => sum + s.scheduledMins, 0);
  const weeklyWorkedMinutes = weeklyStats.reduce((sum, s) => sum + s.workedMins, 0);
  const weeklyScheduledHours = Math.round((weeklyScheduledMinutes / 60) * 100) / 100;
  const weeklyWorkedHours = Math.round((weeklyWorkedMinutes / 60) * 100) / 100;
  const hourlyRate = Number(profile?.hourly_rate || 0);
  const payrollEstimate = calcPayrollBreakdown({ hoursWorked: weeklyWorkedHours || weeklyScheduledHours, hourlyRate, employmentType: profile?.employment_type || 'casual' });

  const handleSignOut = async () => {
    if (!demoMode && supabaseReady) await supabase.auth.signOut();
    setProfile(null); setDemoMode(false); setActiveTimers({}); setLocalPhotos({}); setDemoTimeEntries([]); setBreakMinutes(DEFAULT_BREAK_MINUTES);
  };

  const displayName = demoMode ? 'Demo Staff' : (profile?.full_name || 'Staff');
  const firstName = displayName.split(' ')[0];
  const staffNotificationsNeedsEnable = notificationSupported && (notificationPermission !== 'granted' || !notificationsEnabled);

  // Clock state
  const clockedIn = Boolean(selectedDayEntry?.clock_in_at || selectedDayEntry?.clockInAt);
  const clockedOut = Boolean(selectedDayEntry?.clock_out_at || selectedDayEntry?.clockOutAt);
  const isActiveShift = clockedIn && !clockedOut;

  // ══════════════════════════════════════════════════════
  // ── AUTH SCREEN ────────────────────────────────────────
  // ══════════════════════════════════════════════════════
  if (authHydrating && !demoMode) {
    return (
      <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: S.textTertiary, fontSize: 14, fontWeight: 500 }}>Loading...</div>
      </div>
    );
  }

  if (!profile && !demoMode) {
    return (
      <StaffLogin
        onAuthenticated={(prof) => setProfile(prof)}
        onDemoMode={() => { setDemoMode(true); setProfile({ id: 'demo', full_name: 'Demo Staff', role: 'staff' }); }}
      />
    );
  }

  // ══════════════════════════════════════════════════════
  // ── MAIN PORTAL ────────────────────────────────────────
  // ══════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, sans-serif", paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

      {/* ── Minimal Header ─────────────────────────────── */}
      <div style={{ padding: '16px 20px 12px', background: S.bg, position: 'sticky', top: 0, zIndex: 30, borderBottom: `1px solid ${S.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: S.text, letterSpacing: -0.5 }}>
              {activeTab === 'today' ? `Hey, ${firstName}` : activeTab === 'rota' ? 'Group Rota' : 'Hours'}
            </div>
            {activeTab === 'today' && (
              <div style={{ fontSize: 13, color: S.textSecondary, marginTop: 2 }}>
                {dayJobs.length === 0 ? 'No jobs today' : `${todayStats.total} job${todayStats.total !== 1 ? 's' : ''} today${todayStats.done > 0 ? ` · ${todayStats.done} done` : ''}`}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {demoMode && (
              <span style={{ fontSize: 11, fontWeight: 700, color: S.warm, background: S.warmLight, padding: '4px 10px', borderRadius: S.rPill }}>Demo</span>
            )}
            <button
              onClick={handleSignOut}
              style={{ width: 36, height: 36, borderRadius: S.rPill, border: `1.5px solid ${S.border}`, background: S.card, color: S.textSecondary, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Notification banner */}
      {staffNotificationsNeedsEnable && (
        <div style={{ padding: '0 16px', marginTop: 12 }}>
          <button
            onClick={enableStaffNotifications}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: S.rSm, border: `1px solid ${S.border}`, background: S.card, cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: S.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={S.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>Enable notifications</div>
              <div style={{ fontSize: 12, color: S.textTertiary }}>Get alerts for new jobs and broadcasts</div>
            </div>
          </button>
        </div>
      )}

      {/* Broadcast banner */}
      {activeBroadcast?.message && (
        <div style={{ padding: '0 16px', marginTop: 12 }}>
          <div style={{ padding: '12px 14px', borderRadius: S.rSm, background: S.warmLight, border: `1px solid #E8DFC0` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: S.warm, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Broadcast</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.text, lineHeight: 1.5 }}>{activeBroadcast.message}</div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TODAY TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'today' && (
        <div style={{ padding: '16px 16px 0' }}>

          {/* Date strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <button onClick={() => setSelectedDate(d => shiftDays(d, -7))} style={{ ...pillBtn, padding: '6px 8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ display: 'flex', gap: 4, flex: 1, overflow: 'auto', scrollbarWidth: 'none' }}>
              {weekDates_.map((d, i) => {
                const isToday = d === TODAY;
                const isSel = d === selectedDate;
                const stat = weeklyStats[i];
                const allDone = stat.done === stat.jobs && stat.jobs > 0;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    style={{
                      flex: '1 0 0', minWidth: 40, padding: '8px 2px', borderRadius: S.rSm, cursor: 'pointer', textAlign: 'center',
                      border: isSel ? `2px solid ${S.accent}` : '2px solid transparent',
                      background: isSel ? S.accentPale : 'transparent',
                      transition: S.transition,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: isSel ? S.accent : S.textTertiary, letterSpacing: 0.3 }}>{DAY_LABELS[i]}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: isSel ? S.accent : S.text, lineHeight: 1.4 }}>{new Date(d).getDate()}</div>
                    {isToday && <div style={{ width: 4, height: 4, borderRadius: 4, background: S.accent, margin: '2px auto 0' }} />}
                    {allDone && !isToday && <div style={{ width: 4, height: 4, borderRadius: 4, background: S.success, margin: '2px auto 0' }} />}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setSelectedDate(d => shiftDays(d, 7))} style={{ ...pillBtn, padding: '6px 8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Clock In / Out Card */}
          <div style={{ background: S.card, borderRadius: S.r, padding: '16px', marginBottom: 16, boxShadow: S.shadow, border: `1px solid ${S.borderLight}` }}>
            {clockOfflineFallback && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: S.rXs, background: S.blueLight, color: S.blue, fontSize: 12, fontWeight: 600 }}>
                Local sync mode — entries saved on device
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: S.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {new Date(selectedDate).toLocaleDateString('en-AU', { weekday: 'long' })}
                </div>
                <div style={{ fontSize: 13, color: S.textSecondary, marginTop: 2 }}>
                  {clockedIn ? `In at ${fmtTime(selectedDayEntry?.clock_in_at || selectedDayEntry?.clockInAt)}` : 'Not clocked in'}
                  {clockedOut ? ` · Out at ${fmtTime(selectedDayEntry?.clock_out_at || selectedDayEntry?.clockOutAt)}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 12, color: S.textTertiary }}>
                Break: {breakMinutes}m
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleClockIn}
                disabled={clockActionLoading || isActiveShift || clockedOut}
                style={{
                  flex: 1, padding: '12px', borderRadius: S.rSm, border: 'none', fontSize: 14, fontWeight: 700, cursor: (clockActionLoading || isActiveShift || clockedOut) ? 'not-allowed' : 'pointer',
                  background: (isActiveShift || clockedOut) ? S.borderLight : S.accent, color: (isActiveShift || clockedOut) ? S.textTertiary : '#fff',
                  opacity: clockActionLoading ? 0.7 : 1, transition: S.transition,
                }}
              >
                {clockActionLoading ? '...' : isActiveShift ? 'Clocked In' : clockedOut ? 'Done' : 'Clock In'}
              </button>
              <button
                onClick={handleClockOut}
                disabled={clockActionLoading || !isActiveShift}
                style={{
                  flex: 1, padding: '12px', borderRadius: S.rSm, border: 'none', fontSize: 14, fontWeight: 700, cursor: (clockActionLoading || !isActiveShift) ? 'not-allowed' : 'pointer',
                  background: isActiveShift ? S.primary : S.borderLight, color: isActiveShift ? '#fff' : S.textTertiary,
                  opacity: clockActionLoading ? 0.7 : 1, transition: S.transition,
                }}
              >
                {clockActionLoading ? '...' : 'Clock Out'}
              </button>
            </div>
          </div>

          {/* Scheduled hours mini bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <MiniStat label="Scheduled" value={fmtMins(todayStats.scheduledMins)} />
            <MiniStat label="Worked" value={fmtMins(todayStats.workedMins)} accent />
            <MiniStat label="Break" value={`${breakMinutes}m`} />
          </div>

          {/* Job Cards */}
          {dayJobs.length === 0 ? (
            <div style={{ background: S.card, borderRadius: S.r, padding: '48px 24px', textAlign: 'center', boxShadow: S.shadow, border: `1px solid ${S.borderLight}` }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.6 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={S.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              </div>
              <div style={{ fontWeight: 700, color: S.text, fontSize: 15, marginBottom: 4 }}>No jobs scheduled</div>
              <div style={{ fontSize: 13, color: S.textTertiary }}>{selectedDate === TODAY ? 'Enjoy your day off' : 'Nothing on this day'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dayJobs.map((job, idx) => {
                const clientFromLocal = resolveClientProfile(job, allClients);
                const clientFromApi = jobClientProfiles[String(job.id)] || null;
                const clientFromSnapshot = buildJobSnapshotProfile(job);
                const client = clientFromApi || clientFromLocal || clientFromSnapshot;
                const photos = localPhotos[job.id] || { before: [], after: [] };
                const isExp = expandedJob === job.id;
                const status = job.status || job.job_status || job.jobStatus || 'scheduled';
                const isRunning = status === 'in_progress';
                const isDone = status === 'completed';
                const timer = activeTimers[job.id];
                const startT = job.start_time || job.startTime || '';
                const endT = job.end_time || job.endTime || '';
                const actualDur = job.actual_duration || job.actualDuration || job.duration;
                const extras = job.extras || [];
                const clientNameDisplay = client?.name || job?.client_name || job?.clientName || 'Client';
                const address = client?.address || job?.address || '';
                const suburbLabel = job?.suburb || client?.suburb || '';
                const addressLabel = address || (suburbLabel ? `${suburbLabel}, QLD` : '');
                const accessNote = client?.access_notes || client?.accessNotes || job?.access_notes || job?.accessNotes;
                const clientNote = client?.notes || job?.notes;
                const bedrooms = job?.bedrooms ?? client?.bedrooms;
                const bathrooms = job?.bathrooms ?? client?.bathrooms;
                const living = job?.living ?? client?.living;
                const kitchen = job?.kitchen ?? client?.kitchen;
                const mapsDestination = client?.lat && client?.lng ? `${client.lat},${client.lng}` : (addressLabel || suburbLabel || '');
                const floorPlanClientId = demoMode ? null : (client?.id || job?.client_id || job?.clientId || null);

                return (
                  <div key={job.id} style={{ background: S.card, borderRadius: S.r, overflow: 'hidden', boxShadow: S.shadow, border: `1px solid ${isDone ? S.accentLight : isRunning ? '#F0E8D0' : S.borderLight}`, transition: S.transition }}>

                    {/* Timer banner */}
                    {isRunning && timer !== undefined && (
                      <div style={{ background: S.primary, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textTransform: 'uppercase' }}>In Progress</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{fmtSecs(timer)}</span>
                      </div>
                    )}

                    {/* Completed banner */}
                    {isDone && (
                      <div style={{ background: S.accentLight, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: S.accent }}>Complete</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: S.accent }}>
                          {fmtMins(actualDur)}
                          {actualDur < job.duration && ` · ${job.duration - actualDur}m early`}
                          {actualDur > job.duration && ` · ${actualDur - job.duration}m over`}
                        </span>
                      </div>
                    )}

                    {/* Card body */}
                    <div style={{ padding: '16px' }}>
                      {/* Top: Name + Time */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: S.text, letterSpacing: -0.3, lineHeight: 1.2 }}>{clientNameDisplay}</div>
                          <div style={{ fontSize: 13, color: S.textSecondary, marginTop: 4 }}>{addressLabel}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: S.text, letterSpacing: -0.5 }}>{startT}</div>
                          <div style={{ fontSize: 12, color: S.textTertiary, marginTop: 1 }}>{endT && `to ${endT}`} · {fmtMins(job.duration)}</div>
                        </div>
                      </div>

                      {/* Property chips */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {bedrooms != null && <Chip label={`${bedrooms} Bed`} />}
                        {bathrooms != null && <Chip label={`${bathrooms} Bath`} />}
                        {living != null && <Chip label={`${living} Living`} />}
                        {kitchen != null && <Chip label={`${kitchen} Kitchen`} />}
                        {extras.map(ex => <Chip key={ex} label={ex === 'oven' ? 'Oven' : ex === 'windows' ? 'Windows' : ex} accent />)}
                      </div>

                      {/* Notes section */}
                      {(accessNote || clientNote) && (
                        <div style={{ background: S.bg, borderRadius: S.rXs, padding: '10px 12px', marginBottom: 12 }}>
                          {accessNote && (
                            <div style={{ display: 'flex', gap: 8, marginBottom: clientNote ? 6 : 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: S.textTertiary, letterSpacing: 0.3, flexShrink: 0 }}>ACCESS</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{accessNote}</span>
                            </div>
                          )}
                          {clientNote && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: S.textTertiary, letterSpacing: 0.3, flexShrink: 0 }}>NOTES</span>
                              <span style={{ fontSize: 13, color: S.textSecondary }}>{clientNote}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action row: Navigation + Floor Plan + Photos */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <NavButton
                          label="Maps"
                          icon={<img src="/google-maps-mark.svg" alt="" style={{ width: 18, height: 18 }} />}
                          onClick={() => {
                            const dest = encodeURIComponent(mapsDestination);
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
                            const opened = window.open(url, '_blank', 'noopener,noreferrer');
                            if (!opened) window.location.href = url;
                          }}
                        />
                        <NavButton
                          label="Waze"
                          icon={<img src="/waze-mark.svg" alt="" style={{ width: 18, height: 18 }} />}
                          onClick={() => {
                            const dest = encodeURIComponent(mapsDestination);
                            const url = client?.lat && client?.lng ? `https://waze.com/ul?ll=${client.lat},${client.lng}&navigate=yes` : `https://waze.com/ul?q=${dest}&navigate=yes`;
                            const opened = window.open(url, '_blank', 'noopener,noreferrer');
                            if (!opened) window.location.href = url;
                          }}
                        />
                        <NavButton
                          label="Plan"
                          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>}
                          onClick={() => { if (floorPlanClientId) window.location.href = `/cleaner/floorplan/${floorPlanClientId}`; }}
                          disabled={!floorPlanClientId}
                        />
                        <NavButton
                          label={`Photos${(photos.before.length + photos.after.length) > 0 ? ` (${photos.before.length + photos.after.length})` : ''}`}
                          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                          onClick={() => setExpandedJob(isExp ? null : job.id)}
                          active={isExp}
                        />
                      </div>

                      {/* Status action button */}
                      {!isRunning && !isDone && (
                        <button
                          onClick={() => updateJobStatus(job.id, 'in_progress')}
                          style={{ width: '100%', padding: '14px', borderRadius: S.rSm, border: 'none', background: S.accent, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: S.transition }}
                        >
                          Arrived — Start Timer
                        </button>
                      )}
                      {isRunning && (
                        <button
                          onClick={() => updateJobStatus(job.id, 'completed')}
                          style={{ width: '100%', padding: '14px', borderRadius: S.rSm, border: 'none', background: S.primary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: S.transition }}
                        >
                          Finished — Complete Job
                        </button>
                      )}
                    </div>

                    {/* Photos panel */}
                    {isExp && (
                      <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${S.border}`, paddingTop: 12 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          {['before', 'after'].map(t => (
                            <button
                              key={t}
                              onClick={() => setPhotoType(t)}
                              style={{
                                flex: 1, padding: '8px', borderRadius: S.rXs, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: S.transition,
                                border: photoType === t ? `2px solid ${S.accent}` : `1.5px solid ${S.border}`,
                                background: photoType === t ? S.accentPale : S.card,
                                color: photoType === t ? S.accent : S.textSecondary,
                              }}
                            >
                              {t === 'before' ? 'Before' : 'After'} ({photos[t].length})
                            </button>
                          ))}
                        </div>
                        {photos[photoType].length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                            {photos[photoType].map((p, i) => (
                              <div key={i} style={{ aspectRatio: '1', borderRadius: S.rXs, overflow: 'hidden', background: '#111' }}>
                                <img src={p.url || p.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => { uploadJobRef.current = { jobId: job.id, type: photoType }; cameraRef.current?.click(); }}
                            style={{ flex: 1, padding: '10px', borderRadius: S.rXs, border: 'none', background: S.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Camera
                          </button>
                          <button
                            onClick={() => { uploadJobRef.current = { jobId: job.id, type: photoType }; fileRef.current?.click(); }}
                            style={{ flex: 1, padding: '10px', borderRadius: S.rXs, border: `1.5px solid ${S.border}`, background: S.card, color: S.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
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
          GROUP ROTA TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'rota' && (
        <div style={{ padding: '16px 16px 0' }}>
          {/* Week navigator + filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setSelectedDate(d => shiftDays(d, -7))} style={pillBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: S.text }}>{fmtWeekRange(weekStart)}</div>
            <button onClick={() => setSelectedDate(d => shiftDays(d, 7))} style={pillBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: S.bg, borderRadius: S.rSm, padding: 3 }}>
            {[{ id: 'all', label: 'Everyone' }, { id: 'mine', label: 'My Schedule' }].map(v => (
              <button
                key={v.id}
                onClick={() => setRotaViewMode(v.id)}
                style={{
                  flex: 1, padding: '8px', borderRadius: S.rXs, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: S.transition,
                  background: rotaViewMode === v.id ? S.card : 'transparent',
                  color: rotaViewMode === v.id ? S.text : S.textTertiary,
                  boxShadow: rotaViewMode === v.id ? S.shadow : 'none',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {teamRotaLoading && (
            <div style={{ background: S.card, borderRadius: S.r, padding: 40, textAlign: 'center', color: S.textTertiary, boxShadow: S.shadow, border: `1px solid ${S.borderLight}` }}>
              Loading schedule...
            </div>
          )}
          {!teamRotaLoading && teamRotaError && (
            <div style={{ background: S.dangerLight, borderRadius: S.r, padding: 16, color: S.danger, fontSize: 13 }}>
              {teamRotaError}
            </div>
          )}

          {!teamRotaLoading && !teamRotaError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teamRotaDays.map((day) => {
                const isExpanded = rotaSelectedDay === day.date;
                const isToday = day.date === TODAY;
                return (
                  <div key={day.date} style={{ background: S.card, borderRadius: S.r, overflow: 'hidden', boxShadow: S.shadow, border: `1px solid ${isToday ? S.accentLight : S.borderLight}`, transition: S.transition }}>
                    {/* Day header */}
                    <button
                      onClick={() => setRotaSelectedDay(isExpanded ? null : day.date)}
                      style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: isToday ? S.accent : S.text }}>{day.fullLabel}</span>
                          {isToday && <span style={{ fontSize: 10, fontWeight: 700, color: S.accent, background: S.accentPale, padding: '2px 8px', borderRadius: S.rPill }}>Today</span>}
                        </div>
                        <div style={{ fontSize: 12, color: S.textTertiary, marginTop: 2 }}>
                          {day.shifts.length} staff · {day.jobCount} job{day.jobCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={S.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: S.transition }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>

                    {/* Expanded day content */}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${S.border}`, padding: '12px 16px' }}>
                        {day.shifts.length === 0 ? (
                          <div style={{ fontSize: 13, color: S.textTertiary, padding: '8px 0' }}>No shifts scheduled</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {day.shifts.map((shift) => {
                              const rowKey = `${day.date}_${shift.staffId}`;
                              const isRowExp = expandedRotaRows.has(rowKey);
                              return (
                                <div key={rowKey} style={{ borderRadius: S.rSm, border: `1px solid ${isRowExp ? S.accent : S.border}`, overflow: 'hidden', transition: S.transition }}>
                                  <button
                                    onClick={() => toggleExpandedRotaRow(rowKey)}
                                    style={{ width: '100%', border: 'none', background: isRowExp ? S.accentPale : S.bg, cursor: 'pointer', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                                  >
                                    <div style={{ width: 36, height: 36, borderRadius: S.rXs, background: shift.isYou ? S.accentLight : S.card, color: shift.isYou ? S.accent : S.textTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, border: `1px solid ${S.border}` }}>
                                      {initialsFromName(shift.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{shift.name}</span>
                                        {shift.isYou && <span style={{ fontSize: 10, fontWeight: 700, color: S.accent, background: S.accentPale, padding: '1px 6px', borderRadius: S.rPill }}>You</span>}
                                      </div>
                                      <div style={{ fontSize: 12, color: S.textTertiary, marginTop: 1 }}>
                                        {shift.shiftLabel} · {shift.jobs.length} job{shift.jobs.length !== 1 ? 's' : ''} · {formatShiftMins(shift.shiftMinutes)}
                                      </div>
                                    </div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRowExp ? 'rotate(180deg)' : 'rotate(0)', transition: S.transition, flexShrink: 0 }}>
                                      <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                  </button>

                                  {isRowExp && (
                                    <div style={{ borderTop: `1px solid ${S.border}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {shift.jobs.length === 0 ? (
                                        <div style={{ fontSize: 12, color: S.textTertiary }}>No jobs assigned</div>
                                      ) : (
                                        shift.jobs.map((job, jIdx) => {
                                          const nextJob = shift.jobs[jIdx + 1] || null;
                                          const canGap = Number.isFinite(job.endMin) && Number.isFinite(nextJob?.startMin);
                                          const gapMins = canGap ? (nextJob.startMin - job.endMin) : null;
                                          return (
                                            <div key={job.id}>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: S.accent, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                                                  {job.start || '—'}
                                                </span>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{job.clientName}</span>
                                              </div>
                                              <div style={{ fontSize: 12, color: S.textTertiary, marginTop: 2, paddingLeft: 50 }}>
                                                {job.suburb || 'Address pending'}
                                                {job.bedrooms != null && ` · ${job.bedrooms}b${job.bathrooms ?? 0}b`}
                                              </div>
                                              {gapMins !== null && (
                                                <div style={{ marginTop: 6, marginLeft: 50, padding: '3px 8px', borderRadius: S.rPill, background: gapMins < 0 ? S.dangerLight : S.bg, color: gapMins < 0 ? S.danger : S.textTertiary, fontSize: 11, fontWeight: 600, display: 'inline-block' }}>
                                                  {gapMins < 0 ? `${Math.abs(gapMins)}m overlap` : `${gapMins}m travel`}
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          HOURS TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'hours' && (
        <div style={{ padding: '16px 16px 0' }}>

          {/* Week navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setSelectedDate(d => shiftDays(d, -7))} style={pillBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: S.text }}>{fmtWeekRange(weekStart)}</div>
            <button onClick={() => setSelectedDate(d => shiftDays(d, 7))} style={pillBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <SummaryCard label="Scheduled" value={fmtHours(weeklyScheduledHours)} />
            <SummaryCard label="Actual" value={fmtHours(weeklyWorkedHours)} accent />
            <SummaryCard label="Est. Gross" value={fmtCurrency(payrollEstimate.grossPay)} />
          </div>

          {/* Week visual bar */}
          <div style={{ background: S.card, borderRadius: S.r, padding: '16px', marginBottom: 16, boxShadow: S.shadow, border: `1px solid ${S.borderLight}` }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {weeklyStats.map(s => {
                const maxHours = Math.max(...weeklyStats.map(ws => ws.scheduledHours), 1);
                const barHeight = Math.max(4, (s.actualHours / maxHours) * 48);
                const schedBarHeight = Math.max(4, (s.scheduledHours / maxHours) * 48);
                return (
                  <div key={s.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ height: 52, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', width: '100%', position: 'relative' }}>
                      <div style={{ position: 'absolute', bottom: 0, width: '60%', height: schedBarHeight, borderRadius: 4, background: S.borderLight }} />
                      <div style={{ position: 'relative', width: '60%', height: barHeight, borderRadius: 4, background: s.actualHours > 0 ? S.accent : 'transparent' }} />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: s.date === selectedDate ? S.accent : S.textTertiary }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: S.accent }} />
                <span style={{ fontSize: 11, color: S.textTertiary }}>Actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: S.borderLight }} />
                <span style={{ fontSize: 11, color: S.textTertiary }}>Scheduled</span>
              </div>
            </div>
          </div>

          {/* Day-by-day breakdown */}
          <div style={{ background: S.card, borderRadius: S.r, overflow: 'hidden', boxShadow: S.shadow, border: `1px solid ${S.borderLight}`, marginBottom: 16 }}>
            {weeklyStats.map((s, idx) => {
              const clockIn = s.timeEntry?.clock_in_at || s.timeEntry?.clockInAt;
              const clockOut = s.timeEntry?.clock_out_at || s.timeEntry?.clockOutAt;
              const breakMins = Number(s.timeEntry?.break_minutes ?? DEFAULT_BREAK_MINUTES);
              const isToday = s.date === TODAY;
              return (
                <button
                  key={s.date}
                  onClick={() => setSelectedDate(s.date)}
                  style={{
                    width: '100%', border: 'none', cursor: 'pointer', padding: '12px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: s.date === selectedDate ? S.accentPale : S.card,
                    borderTop: idx > 0 ? `1px solid ${S.borderLight}` : 'none',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? S.accent : S.text }}>{s.label}</span>
                      <span style={{ fontSize: 12, color: S.textTertiary }}>{new Date(s.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div style={{ fontSize: 12, color: S.textTertiary, marginTop: 2 }}>
                      {clockIn ? `${fmtTime(clockIn)} – ${clockOut ? fmtTime(clockOut) : 'Active'}` : 'No clock data'}
                      {clockIn && ` · ${breakMins}m break`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.actualHours > 0 ? S.accent : S.textTertiary }}>{fmtHours(s.actualHours)}</div>
                    <div style={{ fontSize: 11, color: S.textTertiary }}>{fmtHours(s.scheduledHours)} sched</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pay estimate */}
          <div style={{ background: S.card, borderRadius: S.r, padding: '16px', boxShadow: S.shadow, border: `1px solid ${S.borderLight}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: S.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>Estimated Pay</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <PayRow label="Gross pay" value={fmtCurrency(payrollEstimate.grossPay)} bold />
              <PayRow label="Tax withheld" value={`-${fmtCurrency(payrollEstimate.taxWithheld)}`} muted />
              <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 4, paddingTop: 8 }}>
                <PayRow label="Estimated net" value={fmtCurrency(payrollEstimate.netPay)} accent />
              </div>
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: S.rXs, background: S.bg, fontSize: 12, color: S.textTertiary }}>
              Hours sync to admin payroll automatically. Final amounts may differ.
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Navigation ─────────────────────────── */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, background: S.card, borderTop: `1px solid ${S.border}`,
        display: 'flex', zIndex: 120, paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {[
          { id: 'today', label: 'Today', icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? S.accent : 'none'} stroke={active ? S.accent : S.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
          { id: 'rota', label: 'Rota', icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? S.accent : S.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
          { id: 'hours', label: 'Hours', icon: (active) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? S.accent : S.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, border: 'none', background: 'none', padding: '10px 4px 8px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              opacity: activeTab === tab.id ? 1 : 0.6,
              transition: S.transition,
            }}
          >
            {tab.icon(activeTab === tab.id)}
            <span style={{ fontSize: 10, fontWeight: activeTab === tab.id ? 800 : 600, color: activeTab === tab.id ? S.accent : S.textTertiary }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoFile} style={{ display: 'none' }} />
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoFile} style={{ display: 'none' }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
          background: S.primary, color: '#fff', padding: '12px 24px', borderRadius: S.rPill,
          fontSize: 14, fontWeight: 600, boxShadow: S.shadowLg, zIndex: 200, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════

const pillBtn = {
  width: 36, height: 36, borderRadius: 100, border: `1.5px solid ${S.border}`,
  background: S.card, color: S.textSecondary, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

function Chip({ label, accent }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: S.rPill, fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      background: accent ? S.warmLight : S.bg,
      color: accent ? '#8B6914' : S.textSecondary,
    }}>
      {label}
    </span>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div style={{ flex: 1, background: S.card, borderRadius: S.rSm, padding: '10px 12px', boxShadow: S.shadow, border: `1px solid ${S.borderLight}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: S.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: accent ? S.accent : S.text }}>{value}</div>
    </div>
  );
}

function NavButton({ label, icon, onClick, disabled, active }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        flex: 1, padding: '10px 4px', borderRadius: S.rXs, cursor: disabled ? 'not-allowed' : 'pointer',
        border: active ? `1.5px solid ${S.accent}` : `1.5px solid ${S.border}`,
        background: active ? S.accentPale : S.card,
        color: active ? S.accent : (disabled ? S.textTertiary : S.textSecondary),
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        opacity: disabled ? 0.4 : 1,
        transition: S.transition,
      }}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div style={{ background: S.card, borderRadius: S.rSm, padding: '14px 12px', boxShadow: S.shadow, border: `1px solid ${S.borderLight}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: S.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ? S.accent : S.text, letterSpacing: -0.5 }}>{value}</div>
    </div>
  );
}

function PayRow({ label, value, bold, muted, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: muted ? S.textTertiary : S.textSecondary, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 16 : accent ? 18 : 14, fontWeight: bold ? 700 : accent ? 800 : 600, color: accent ? S.accent : (muted ? S.textTertiary : S.text) }}>{value}</span>
    </div>
  );
}
