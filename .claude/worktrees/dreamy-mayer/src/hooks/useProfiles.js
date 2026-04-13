import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, role, hourly_rate, employment_type, is_active, tfn_last4').order('full_name');
      if (!mounted) return;
      if (error) setError(error); else setProfiles(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const updateProfile = async (id, updates) => {
    if (!supabaseReady) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProfile = async (id) => {
    if (!supabaseReady) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
    setProfiles(prev => prev.filter(p => p.id !== id));
  };

  const addProfile = async (profile) => {
    if (!supabaseReady) return;
    const { data, error } = await supabase.from('profiles').insert(profile).select().single();
    if (error) throw error;
    setProfiles(prev => [...prev, data]);
    return data;
  };

  const staffMembers = profiles.filter(p => p.role === 'staff');

  return { profiles, setProfiles, staffMembers, loading, error, updateProfile, removeProfile, addProfile };
}
