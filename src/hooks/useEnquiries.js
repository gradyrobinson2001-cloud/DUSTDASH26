import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { getInitialEnquiries } from '../shared';

export function useEnquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!supabaseReady) {
      setEnquiries(getInitialEnquiries());
      setLoading(false);
      return;
    }
    let mounted = true;
    const fetch = async () => {
      const { data, error } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false });
      if (!mounted) return;
      if (error) setError(error); else setEnquiries(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('enquiries').on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const addEnquiry = async (e) => {
    if (!supabaseReady) {
      const newEnq = { ...e, id: Date.now(), created_at: new Date().toISOString() };
      setEnquiries(prev => [newEnq, ...prev]);
      return newEnq;
    }
    const { data, error } = await supabase.from('enquiries').insert(e).select().single();
    if (error) throw error;
    return data;
  };

  const updateEnquiry = async (id, updates) => {
    if (!supabaseReady) {
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      return;
    }
    const { error } = await supabase.from('enquiries').update(updates).eq('id', id);
    if (error) throw error;
  };

  const removeEnquiry = async (id) => {
    if (!supabaseReady) {
      setEnquiries(prev => prev.filter(e => e.id !== id));
      return;
    }
    const { error } = await supabase.from('enquiries').delete().eq('id', id);
    if (error) throw error;
  };

  return { enquiries, setEnquiries, loading, error, addEnquiry, updateEnquiry, removeEnquiry };
}
