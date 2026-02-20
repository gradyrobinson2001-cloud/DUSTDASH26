import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { getInitialQuotes } from '../shared';

export function useQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const fetchingRef = useRef(false);

  const refreshQuotes = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setQuotes(data ?? []);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady) { setQuotes(getInitialQuotes()); setLoading(false); return; }
    let mounted = true;
    const safeRefresh = async () => {
      if (!mounted) return;
      await refreshQuotes();
    };
    safeRefresh();
    const ch = supabase
      .channel('quotes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, safeRefresh)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [refreshQuotes]);

  const addQuote = async (q) => {
    if (!supabaseReady) {
      const newQ = { ...q, id: `Q${String(Date.now()).slice(-3)}`, created_at: new Date().toISOString() };
      setQuotes(prev => [newQ, ...prev]);
      return newQ;
    }
    const { data, error } = await supabase.from('quotes').insert(q).select().single();
    if (error) throw error;
    setQuotes(prev => [data, ...prev.filter(x => x.id !== data.id)]);
    return data;
  };

  const updateQuote = async (id, updates) => {
    if (!supabaseReady) { setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q)); return; }
    const { error } = await supabase.from('quotes').update(updates).eq('id', id);
    if (error) throw error;
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuote = async (id) => {
    if (!supabaseReady) { setQuotes(prev => prev.filter(q => q.id !== id)); return; }
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) throw error;
    setQuotes(prev => prev.filter(q => q.id !== id));
  };

  return { quotes, setQuotes, loading, error, refreshQuotes, addQuote, updateQuote, removeQuote };
}
