import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

const CLOCK_LOCAL_PREFIX = 'dustdash_staff_time_entries_';

const toIsoDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const parseJsonSafe = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

const normalizeApiErrorMessage = (body, status) => {
  const top = String(body?.error || '').trim();
  const detail = String(body?.details || '').trim();
  if (top && detail) return `${top}: ${detail}`;
  if (top) return top;
  if (detail) return detail;
  return `Request failed (${status})`;
};

const isMissingClockTableError = (err) => {
  const code = String(err?.code || '');
  const message = String(err?.message || '').toLowerCase();
  const details = String(err?.details || '').toLowerCase();
  const haystack = `${message} ${details}`;
  if (code === '42P01') return true;
  return (
    haystack.includes('staff_time_entries')
    && (
      haystack.includes('does not exist')
      || haystack.includes('could not find table')
      || haystack.includes('schema cache')
      || haystack.includes('relation')
    )
  );
};

const localKey = (staffId) => `${CLOCK_LOCAL_PREFIX}${String(staffId || 'all')}`;

const readLocalEntries = (staffId, weekStart) => {
  try {
    let rows = [];
    if (staffId) {
      const raw = localStorage.getItem(localKey(staffId));
      const parsed = raw ? JSON.parse(raw) : [];
      rows = Array.isArray(parsed) ? parsed : [];
    } else {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(CLOCK_LOCAL_PREFIX)) continue;
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) rows.push(...parsed);
      }
    }
    const weekStartIso = toIsoDate(weekStart);
    if (!weekStartIso) return rows;
    const weekEndIso = addDays(weekStartIso, 6);
    return rows.filter((row) => {
      const d = String(row?.work_date || '');
      return d >= weekStartIso && d <= weekEndIso;
    });
  } catch {
    return [];
  }
};

const saveLocalEntries = (staffId, rows) => {
  try {
    localStorage.setItem(localKey(staffId), JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // ignore local storage failures
  }
};

export function useStaffTimeEntries({ staffId = null, weekStart = null } = {}) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const fetchViaApi = useCallback(async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Session expired. Please sign in again.');

    const res = await fetch('/api/staff/clock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'list',
        staffId: staffId || null,
        weekStart: toIsoDate(weekStart),
      }),
    });
    const body = await parseJsonSafe(res);
    if (!res.ok || body?.error) {
      const err = new Error(normalizeApiErrorMessage(body, res.status));
      if (body?.code) err.code = body.code;
      if (body?.details) err.details = body.details;
      throw err;
    }
    return Array.isArray(body?.entries) ? body.entries : [];
  }, [staffId, weekStart]);

  const fetchViaSupabase = useCallback(async () => {
    let query = supabase
      .from('staff_time_entries')
      .select('*')
      .order('work_date', { ascending: false });

    if (staffId) query = query.eq('staff_id', staffId);

    const weekStartIso = toIsoDate(weekStart);
    if (weekStartIso) {
      const weekEndIso = addDays(weekStartIso, 6);
      query = query.gte('work_date', weekStartIso).lte('work_date', weekEndIso);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }, [staffId, weekStart]);

  const refreshTimeEntries = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      try {
        const rows = await fetchViaApi();
        setError(null);
        setTimeEntries(rows);
      } catch (apiError) {
        if (isMissingClockTableError(apiError)) {
          setError(null);
          setTimeEntries(readLocalEntries(staffId, weekStart));
          return;
        }
        // Fallback keeps local/dev and partial server deployments usable.
        try {
          const rows = await fetchViaSupabase();
          setError(null);
          setTimeEntries(rows);
        } catch (dbError) {
          if (isMissingClockTableError(dbError)) {
            setError(null);
            setTimeEntries(readLocalEntries(staffId, weekStart));
            return;
          }
          setError(dbError || apiError);
          return;
        }
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [fetchViaApi, fetchViaSupabase, staffId, weekStart]);

  useEffect(() => {
    if (!supabaseReady) {
      setTimeEntries(readLocalEntries(staffId, weekStart));
      setLoading(false);
      return;
    }
    let mounted = true;
    const safeRefresh = async () => {
      if (!mounted) return;
      await refreshTimeEntries();
    };
    safeRefresh();
    const channel = supabase
      .channel(`staff_time_entries:${staffId || 'all'}:${weekStart || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_time_entries' }, safeRefresh)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [staffId, weekStart, refreshTimeEntries]);

  useEffect(() => {
    saveLocalEntries(staffId, timeEntries);
  }, [staffId, timeEntries]);

  return { timeEntries, setTimeEntries, loading, error, refreshTimeEntries };
}
