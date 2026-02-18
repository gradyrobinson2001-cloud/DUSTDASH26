import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadEmailHistory, saveEmailHistory } from '../shared';

export function useEmailHistory() {
  const [emailHistory, setEmailHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseReady) { setEmailHistory(loadEmailHistory()); setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data } = await supabase.from('email_history').select('*').order('sent_at', { ascending: false });
      if (!mounted) return;
      setEmailHistory(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('email_history').on('postgres_changes', { event: '*', schema: 'public', table: 'email_history' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const addEmailHistory = async (entry) => {
    if (!supabaseReady) { const updated = [{ ...entry, id: `eh_${Date.now()}`, sent_at: new Date().toISOString() }, ...emailHistory]; setEmailHistory(updated); saveEmailHistory(updated); return; }
    await supabase.from('email_history').insert(entry);
  };

  return { emailHistory, setEmailHistory, loading, addEmailHistory };
}
