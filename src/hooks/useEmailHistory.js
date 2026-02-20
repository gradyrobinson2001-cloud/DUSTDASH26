import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadEmailHistory, saveEmailHistory } from '../shared';

export function useEmailHistory() {
  const [emailHistory, setEmailHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const refreshEmailHistory = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .order('sent_at', { ascending: false });
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setEmailHistory(data ?? []);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady) { setEmailHistory(loadEmailHistory()); setLoading(false); return; }
    let mounted = true;
    const safeRefresh = async () => {
      if (!mounted) return;
      await refreshEmailHistory();
    };
    safeRefresh();
    const ch = supabase
      .channel('email_history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_history' }, safeRefresh)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [refreshEmailHistory]);

  const addEmailHistory = async (entry) => {
    if (!supabaseReady) { const updated = [{ ...entry, id: `eh_${Date.now()}`, sent_at: new Date().toISOString() }, ...emailHistory]; setEmailHistory(updated); saveEmailHistory(updated); return; }
    const { data, error } = await supabase.from('email_history').insert(entry).select().single();
    if (error) throw error;
    setEmailHistory(prev => [data, ...prev.filter(x => x.id !== data.id)]);
  };

  return { emailHistory, setEmailHistory, loading, error, refreshEmailHistory, addEmailHistory };
}
