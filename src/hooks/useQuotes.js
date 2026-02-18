import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { getInitialQuotes } from '../shared';

export function useQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!supabaseReady) { setQuotes(getInitialQuotes()); setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
      if (!mounted) return;
      if (error) setError(error); else setQuotes(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('quotes').on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const addQuote = async (q) => {
    if (!supabaseReady) {
      const newQ = { ...q, id: `Q${String(Date.now()).slice(-3)}`, created_at: new Date().toISOString() };
      setQuotes(prev => [newQ, ...prev]);
      return newQ;
    }
    const { data, error } = await supabase.from('quotes').insert(q).select().single();
    if (error) throw error;
    return data;
  };

  const updateQuote = async (id, updates) => {
    if (!supabaseReady) { setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q)); return; }
    const { error } = await supabase.from('quotes').update(updates).eq('id', id);
    if (error) throw error;
  };

  const removeQuote = async (id) => {
    if (!supabaseReady) { setQuotes(prev => prev.filter(q => q.id !== id)); return; }
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) throw error;
  };

  return { quotes, setQuotes, loading, error, addQuote, updateQuote, removeQuote };
}
