import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadScheduledJobs, saveScheduledJobs } from '../shared';

export function useScheduledJobs({ staffId } = {}) {
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!supabaseReady) {
      const all = loadScheduledJobs();
      if (staffId) {
        setScheduledJobs(all.filter(j =>
          (j.assigned_staff || []).includes(staffId) && j.is_published
        ));
      } else {
        setScheduledJobs(all);
      }
      setLoading(false);
      return;
    }
    let mounted = true;
    const fetch = async () => {
      let q = supabase.from('scheduled_jobs').select('*').order('date').order('start_time');
      // For staff portal: only show published jobs assigned to this staff member
      if (staffId) {
        q = q.contains('assigned_staff', [staffId]).eq('is_published', true);
      }
      const { data, error } = await q;
      if (!mounted) return;
      if (error) setError(error); else setScheduledJobs(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('scheduled_jobs').on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_jobs' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [staffId]);

  const addJob = async (j) => {
    if (!supabaseReady) { const updated = [...scheduledJobs, { ...j, id: `job_${Date.now()}`, created_at: new Date().toISOString() }]; setScheduledJobs(updated); saveScheduledJobs(updated); return updated[updated.length-1]; }
    const { data, error } = await supabase.from('scheduled_jobs').insert(j).select().single();
    if (error) throw error;
    return data;
  };

  const updateJob = async (id, updates) => {
    if (!supabaseReady) { const updated = scheduledJobs.map(j => j.id === id ? { ...j, ...updates } : j); setScheduledJobs(updated); saveScheduledJobs(updated); return; }
    const { error } = await supabase.from('scheduled_jobs').update(updates).eq('id', id);
    if (error) throw error;
  };

  const removeJob = async (id) => {
    if (!supabaseReady) { const updated = scheduledJobs.filter(j => j.id !== id); setScheduledJobs(updated); saveScheduledJobs(updated); return; }
    const { error } = await supabase.from('scheduled_jobs').delete().eq('id', id);
    if (error) throw error;
  };

  const bulkUpsertJobs = async (jobs) => {
    if (!supabaseReady) { setScheduledJobs(jobs); saveScheduledJobs(jobs); return; }
    const { error } = await supabase.from('scheduled_jobs').upsert(jobs);
    if (error) throw error;
  };

  // Publish all jobs for a given week (set is_published = true)
  const publishWeek = async (weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const endStr = weekEnd.toISOString().split('T')[0];

    if (!supabaseReady) {
      const updated = scheduledJobs.map(j =>
        j.date >= weekStart && j.date <= endStr ? { ...j, is_published: true } : j
      );
      setScheduledJobs(updated);
      saveScheduledJobs(updated);
      return;
    }

    const { error } = await supabase
      .from('scheduled_jobs')
      .update({ is_published: true })
      .gte('date', weekStart)
      .lte('date', endStr);
    if (error) throw error;
  };

  return { scheduledJobs, setScheduledJobs, loading, error, addJob, updateJob, removeJob, bulkUpsertJobs, publishWeek };
}
