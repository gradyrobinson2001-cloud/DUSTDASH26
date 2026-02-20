import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { getInitialEnquiries } from '../shared';

export function useEnquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const fetchingRef = useRef(false);

  const refreshEnquiries = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('enquiries')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setEnquiries(data ?? []);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady) {
      setEnquiries(getInitialEnquiries());
      setLoading(false);
      return;
    }
    let mounted = true;

    const safeRefresh = async () => {
      if (!mounted) return;
      await refreshEnquiries();
    };

    safeRefresh();

    const ch = supabase
      .channel('enquiries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, safeRefresh)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[enquiries] realtime channel unhealthy, polling will continue');
        }
      });

    // Fallback for environments where realtime can be unreliable.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') safeRefresh();
    }, 15000);

    const onFocus = () => safeRefresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') safeRefresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      supabase.removeChannel(ch);
    };
  }, [refreshEnquiries]);

  const addEnquiry = async (e) => {
    if (!supabaseReady) {
      const newEnq = { ...e, id: Date.now(), created_at: new Date().toISOString() };
      setEnquiries(prev => [newEnq, ...prev]);
      return newEnq;
    }
    const { data, error } = await supabase.from('enquiries').insert(e).select().single();
    if (error) throw error;
    setEnquiries(prev => [data, ...prev.filter(x => x.id !== data.id)]);
    return data;
  };

  const updateEnquiry = async (id, updates) => {
    if (!supabaseReady) {
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      return;
    }
    const { error } = await supabase.from('enquiries').update(updates).eq('id', id);
    if (error) throw error;
    setEnquiries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const removeEnquiry = async (id) => {
    if (!supabaseReady) {
      setEnquiries(prev => prev.filter(e => e.id !== id));
      return;
    }
    const { error } = await supabase.from('enquiries').delete().eq('id', id);
    if (error) throw error;
    setEnquiries(prev => prev.filter(e => e.id !== id));
  };

  return { enquiries, setEnquiries, loading, error, refreshEnquiries, addEnquiry, updateEnquiry, removeEnquiry };
}
