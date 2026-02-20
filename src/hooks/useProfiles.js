import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const fetchingRef = useRef(false);

  const refreshProfiles = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, hourly_rate, employment_type, is_active, tfn_last4')
        .order('full_name');
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setProfiles(data ?? []);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }
    let mounted = true;
    const safeRefresh = async () => {
      if (!mounted) return;
      await refreshProfiles();
    };
    safeRefresh();
    const ch = supabase
      .channel('profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, safeRefresh)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [refreshProfiles]);

  const updateProfile = async (id, updates) => {
    if (!supabaseReady) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
    setProfiles(prev => prev.map(profile => (
      profile.id === id ? { ...profile, ...updates } : profile
    )));
  };

  const staffMembers = profiles.filter(p => p.role === 'staff');

  return { profiles, staffMembers, loading, error, refreshProfiles, updateProfile };
}
