import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadInvoices, saveInvoices } from '../shared';

export function useInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const fetchingRef = useRef(false);

  const refreshInvoices = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setInvoices(data ?? []);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady) { setInvoices(loadInvoices()); setLoading(false); return; }
    let mounted = true;
    const safeRefresh = async () => {
      if (!mounted) return;
      await refreshInvoices();
    };
    safeRefresh();
    const ch = supabase
      .channel('invoices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, safeRefresh)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [refreshInvoices]);

  const addInvoice = async (inv) => {
    if (!supabaseReady) { const updated = [{ ...inv, id: `inv_${Date.now()}`, created_at: new Date().toISOString() }, ...invoices]; setInvoices(updated); saveInvoices(updated); return updated[0]; }
    const { data, error } = await supabase.from('invoices').insert(inv).select().single();
    if (error) throw error;
    setInvoices(prev => [data, ...prev.filter(i => i.id !== data.id)]);
    return data;
  };

  const updateInvoice = async (id, updates) => {
    if (!supabaseReady) { const updated = invoices.map(i => i.id === id ? { ...i, ...updates } : i); setInvoices(updated); saveInvoices(updated); return; }
    const { error } = await supabase.from('invoices').update(updates).eq('id', id);
    if (error) throw error;
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  return { invoices, setInvoices, loading, error, refreshInvoices, addInvoice, updateInvoice };
}
