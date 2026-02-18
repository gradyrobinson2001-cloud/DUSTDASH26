import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadInvoices, saveInvoices } from '../shared';

export function useInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!supabaseReady) { setInvoices(loadInvoices()); setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (!mounted) return;
      if (error) setError(error); else setInvoices(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('invoices').on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const addInvoice = async (inv) => {
    if (!supabaseReady) { const updated = [{ ...inv, id: `inv_${Date.now()}`, created_at: new Date().toISOString() }, ...invoices]; setInvoices(updated); saveInvoices(updated); return updated[0]; }
    const { data, error } = await supabase.from('invoices').insert(inv).select().single();
    if (error) throw error;
    return data;
  };

  const updateInvoice = async (id, updates) => {
    if (!supabaseReady) { const updated = invoices.map(i => i.id === id ? { ...i, ...updates } : i); setInvoices(updated); saveInvoices(updated); return; }
    const { error } = await supabase.from('invoices').update(updates).eq('id', id);
    if (error) throw error;
  };

  return { invoices, setInvoices, loading, error, addInvoice, updateInvoice };
}
