import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadScheduleSettings, saveScheduleSettings, normalizeScheduleSettings } from '../shared';

export function useScheduleSettings() {
  const [scheduleSettings, setSettingsState] = useState(loadScheduleSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseReady) { setSettingsState(loadScheduleSettings()); setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data } = await supabase.from('schedule_settings').select('data').eq('id', 1).single();
      if (!mounted) return;
      if (data?.data) setSettingsState(normalizeScheduleSettings(data.data));
      else setSettingsState(loadScheduleSettings());
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('schedule_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_settings' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const saveSettings = async (newSettings) => {
    const normalized = normalizeScheduleSettings(newSettings);
    setSettingsState(normalized);
    if (!supabaseReady) { saveScheduleSettings(normalized); return; }
    await supabase.from('schedule_settings').upsert({ id: 1, data: normalized, updated_at: new Date().toISOString() });
  };

  return { scheduleSettings, setScheduleSettings: saveSettings, loading };
}
