import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadClients, saveClients } from '../shared';

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!supabaseReady) {
      setClients(loadClients());
      setLoading(false);
      return;
    }
    let mounted = true;
    const fetch = async () => {
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (!mounted) return;
      if (error) setError(error); else setClients(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('clients').on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const addClient = async (c) => {
    if (!supabaseReady) { const updated = [...clients, { ...c, id: `local_${Date.now()}`, created_at: new Date().toISOString() }]; setClients(updated); saveClients(updated); return updated[updated.length-1]; }
    const { data, error } = await supabase.from('clients').insert(c).select().single();
    if (error) throw error;
    setClients(prev => [data, ...prev.filter(x => x.id !== data.id)]);
    return data;
  };

  const updateClient = async (id, updates) => {
    if (!supabaseReady) { const updated = clients.map(c => c.id === id ? { ...c, ...updates } : c); setClients(updated); saveClients(updated); return; }
    const { error } = await supabase.from('clients').update(updates).eq('id', id);
    if (error) throw error;
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeClient = async (id) => {
    if (!supabaseReady) { const updated = clients.filter(c => c.id !== id); setClients(updated); saveClients(updated); return; }
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    setClients(prev => prev.filter(c => c.id !== id));
  };

  return { clients, setClients, loading, error, addClient, updateClient, removeClient };
}
