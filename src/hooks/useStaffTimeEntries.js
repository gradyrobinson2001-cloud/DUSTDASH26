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

export function useStaffTimeEntries({ staffId = null, weekStart = null } = {}) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const refreshTimeEntries = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      let query = supabase
        .from('staff_time_entries')
        .select('*')
        .order('work_date', { ascending: false });

      if (staffId) {
        query = query.eq('staff_id', staffId);
      }

      const weekStartIso = toIsoDate(weekStart);
      if (weekStartIso) {
        const weekEndIso = addDays(weekStartIso, 6);
        query = query.gte('work_date', weekStartIso).lte('work_date', weekEndIso);
      }

      const { data, error } = await query;
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setTimeEntries(data ?? []);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [staffId, weekStart]);

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
