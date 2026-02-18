import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadTemplates, saveTemplates } from '../shared';

export function useTemplates() {
  const [templates, setTemplatesState] = useState(loadTemplates());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseReady) { setTemplatesState(loadTemplates()); setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data } = await supabase.from('templates').select('*').order('created_at');
      if (!mounted) return;
      if (data) setTemplatesState(data);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('templates').on('postgres_changes', { event: '*', schema: 'public', table: 'templates' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const addTemplate = async (t) => {
    if (!supabaseReady) { const updated = [...templates, { ...t, id: `t_${Date.now()}`, created_at: new Date().toISOString() }]; setTemplatesState(updated); saveTemplates(updated); return; }
    await supabase.from('templates').insert(t);
  };

  const removeTemplate = async (id) => {
    if (!supabaseReady) { const updated = templates.filter(t => t.id !== id); setTemplatesState(updated); saveTemplates(updated); return; }
    await supabase.from('templates').delete().eq('id', id);
  };

  const saveAllTemplates = async (updated) => {
    setTemplatesState(updated);
    if (!supabaseReady) { saveTemplates(updated); return; }
    // Upsert all
    await supabase.from('templates').upsert(updated);
  };

  return { templates, setTemplates: saveAllTemplates, loading, addTemplate, removeTemplate };
}
