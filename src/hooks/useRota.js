import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

export function useRota(weekStart) {
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!supabaseReady || !weekStart) { setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data, error } = await supabase.from('rota').select('*').eq('week_start', weekStart);
      if (!mounted) return;
      if (error) setError(error); else setRotas(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('rota').on('postgres_changes', { event: '*', schema: 'public', table: 'rota' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [weekStart]);

  const upsertRota = async (teamId, updates) => {
    if (!supabaseReady) return;
    const { error } = await supabase.from('rota').upsert({ week_start: weekStart, team_id: teamId, ...updates }, { onConflict: 'week_start,team_id' });
    if (error) throw error;
  };

  const publishRota = async (teamId, publishedBy) => {
    await upsertRota(teamId, { is_published: true, published_at: new Date().toISOString(), published_by: publishedBy });
  };

  const unpublishRota = async (teamId) => {
    await upsertRota(teamId, { is_published: false, published_at: null });
  };

  const saveOverrides = async (teamId, overrides) => {
    await upsertRota(teamId, { overrides });
  };

  const getRotaForTeam = (teamId) => rotas.find(r => r.team_id === teamId) ?? null;

  return { rotas, loading, error, upsertRota, publishRota, unpublishRota, saveOverrides, getRotaForTeam };
}
