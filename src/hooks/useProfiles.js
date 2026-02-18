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
      const { data, error } = await supabase.from('profiles').select('id, full_name, role, team_id, hourly_rate, employment_type, is_active, tfn_last4').order('full_name');
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
  };

  const staffMembers = profiles.filter(p => p.role === 'staff');

  return { profiles, staffMembers, loading, error, updateProfile };
}
