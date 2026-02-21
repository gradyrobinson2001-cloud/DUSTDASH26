import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

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

    const res = await fetch('/api/staff/clock-list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        staffId: staffId || null,
        weekStart: toIsoDate(weekStart),
      }),
    });
    const body = await parseJsonSafe(res);
    if (!res.ok || body?.error) {
      throw new Error(body?.error || body?.details || `Request failed (${res.status})`);
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
        // Fallback keeps local/dev and partial server deployments usable.
        try {
          const rows = await fetchViaSupabase();
          setError(null);
          setTimeEntries(rows);
        } catch (dbError) {
          setError(dbError || apiError);
          return;
        }
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [fetchViaApi, fetchViaSupabase]);

  useEffect(() => {
    if (!supabaseReady) {
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

  return { timeEntries, setTimeEntries, loading, error, refreshTimeEntries };
}
