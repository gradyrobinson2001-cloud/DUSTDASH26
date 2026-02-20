import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadScheduledJobs, saveScheduledJobs } from '../shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

const mapDbToJob = (row) => {
  const clientId = row.client_id ?? row.clientId ?? null;
  const clientName = row.client_name ?? row.clientName ?? '';
  const startTime = row.start_time ?? row.startTime ?? '';
  const endTime = row.end_time ?? row.endTime ?? '';
  const actualStartAt = row.actual_start_at ?? row.actualStartAt ?? row.arrived_at ?? row.arrivedAt ?? null;
  const actualEndAt = row.actual_end_at ?? row.actualEndAt ?? null;
  const actualDuration = row.actual_duration ?? row.actualDuration ?? null;
  const status = row.status ?? row.job_status ?? row.jobStatus ?? 'scheduled';
  const assignedStaff = Array.isArray(row.assigned_staff) ? row.assigned_staff : [];
  const isDemo = Boolean(row.is_demo ?? row.isDemo ?? false);
  const isBreak = Boolean(row.is_break ?? row.isBreak ?? false);
  const isPublished = Boolean(row.is_published ?? row.isPublished ?? false);

  return {
    ...row,
    client_id: clientId,
    clientId,
    client_name: clientName,
    clientName,
    start_time: startTime,
    startTime,
    end_time: endTime,
    endTime,
    actual_start_at: actualStartAt,
    actualStartAt,
    arrived_at: actualStartAt,
    arrivedAt: actualStartAt,
    actual_end_at: actualEndAt,
    actualEndAt,
    actual_duration: actualDuration,
    actualDuration,
    status,
    job_status: status,
    jobStatus: status,
    assigned_staff: assignedStaff,
    is_demo: isDemo,
    isDemo,
    is_break: isBreak,
    isBreak,
    is_published: isPublished,
    isPublished,
  };
};

const toDbJob = (job) => {
  const out = {};

  if (isUuid(job?.id)) out.id = job.id;
  if (job?.date) out.date = job.date;

  const clientId = job?.client_id ?? job?.clientId ?? null;
  if (clientId !== undefined) out.client_id = clientId;

  const clientName = job?.client_name ?? job?.clientName ?? null;
  if (clientName !== undefined) out.client_name = clientName;

  if (job?.suburb !== undefined) out.suburb = job.suburb;

  const startTime = job?.start_time ?? job?.startTime ?? null;
  if (startTime !== undefined) out.start_time = startTime;

  const endTime = job?.end_time ?? job?.endTime ?? null;
  if (endTime !== undefined) out.end_time = endTime;

  const actualStartAt = job?.actual_start_at ?? job?.actualStartAt ?? job?.arrived_at ?? job?.arrivedAt ?? null;
  if (actualStartAt !== undefined) out.actual_start_at = actualStartAt;

  const actualEndAt = job?.actual_end_at ?? job?.actualEndAt ?? null;
  if (actualEndAt !== undefined) out.actual_end_at = actualEndAt;

  const actualDuration = job?.actual_duration ?? job?.actualDuration ?? null;
  if (actualDuration !== undefined) out.actual_duration = actualDuration;

  if (job?.duration !== undefined) out.duration = job.duration;

  const status = job?.status ?? job?.job_status ?? job?.jobStatus;
  if (status !== undefined) out.status = status;

  if (job?.notes !== undefined) out.notes = job.notes;

  if (job?.assigned_staff !== undefined || job?.assignedStaff !== undefined) {
    out.assigned_staff = Array.isArray(job.assigned_staff)
      ? job.assigned_staff
      : (Array.isArray(job.assignedStaff) ? job.assignedStaff : []);
  }

  if (job?.is_published !== undefined || job?.isPublished !== undefined) {
    out.is_published = Boolean(job.is_published ?? job.isPublished);
  }

  if (job?.is_demo !== undefined || job?.isDemo !== undefined) {
    out.is_demo = Boolean(job.is_demo ?? job.isDemo);
  }

  if (job?.is_break !== undefined || job?.isBreak !== undefined) {
    out.is_break = Boolean(job.is_break ?? job.isBreak);
  }

  return out;
};

export function useScheduledJobs({ staffId } = {}) {
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const fetchingRef = useRef(false);

  const refreshScheduledJobs = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      let q = supabase
        .from('scheduled_jobs')
        .select('*')
        .order('date')
        .order('start_time');
      if (staffId) {
        q = q.contains('assigned_staff', [staffId]).eq('is_published', true);
      }
      const { data, error } = await q;
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setScheduledJobs((data ?? []).map(mapDbToJob));
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    if (!supabaseReady) {
      const all = (loadScheduledJobs() || []).map(mapDbToJob);
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
    const safeRefresh = async () => {
      if (!mounted) return;
      await refreshScheduledJobs();
    };
    safeRefresh();
    const ch = supabase
      .channel('scheduled_jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_jobs' }, safeRefresh)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [staffId, refreshScheduledJobs]);

  const addJob = async (j) => {
    const normalized = mapDbToJob(j);
    if (!supabaseReady) {
      const updated = [...scheduledJobs, { ...normalized, id: `job_${Date.now()}`, created_at: new Date().toISOString() }];
      setScheduledJobs(updated);
      saveScheduledJobs(updated);
      return updated[updated.length - 1];
    }
    const payload = toDbJob(normalized);
    const { data, error } = await supabase.from('scheduled_jobs').insert(payload).select().single();
    if (error) throw error;
    const inserted = mapDbToJob(data);
    setScheduledJobs(prev => [inserted, ...prev.filter(x => x.id !== inserted.id)]);
    return inserted;
  };

  const updateJob = async (id, updates) => {
    if (!supabaseReady) {
      const normalized = mapDbToJob(updates || {});
      const updated = scheduledJobs.map(j => j.id === id ? { ...j, ...normalized } : j);
      setScheduledJobs(updated);
      saveScheduledJobs(updated);
      return;
    }
    const payload = toDbJob(updates || {});
    delete payload.id;
    if (Object.keys(payload).length === 0) return;
    let snapshot = null;
    setScheduledJobs(prev => {
      snapshot = prev;
      return prev.map(j => (
        j.id === id ? mapDbToJob({ ...j, ...updates }) : j
      ));
    });

    const { data, error } = await supabase
      .from('scheduled_jobs')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (snapshot) setScheduledJobs(snapshot);
      throw error;
    }

    const updatedJob = mapDbToJob(data);
    setScheduledJobs(prev => prev.map(j => (
      j.id === id ? updatedJob : j
    )));
  };

  const removeJob = async (id) => {
    if (!supabaseReady) { const updated = scheduledJobs.filter(j => j.id !== id); setScheduledJobs(updated); saveScheduledJobs(updated); return; }
    const { error } = await supabase.from('scheduled_jobs').delete().eq('id', id);
    if (error) throw error;
    setScheduledJobs(prev => prev.filter(j => j.id !== id));
  };

  const bulkUpsertJobs = async (jobs) => {
    const normalized = (jobs || []).map(mapDbToJob);
    if (!supabaseReady) {
      setScheduledJobs(normalized);
      saveScheduledJobs(normalized);
      return;
    }
    const payload = normalized.map(toDbJob).filter(j => j.date && j.start_time);
    const { error } = await supabase.from('scheduled_jobs').upsert(payload);
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
    setScheduledJobs(prev => prev.map(j =>
      j.date >= weekStart && j.date <= endStr ? { ...j, is_published: true, isPublished: true } : j
    ));
  };

  const unpublishWeek = async (weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const endStr = weekEnd.toISOString().split('T')[0];

    if (!supabaseReady) {
      const updated = scheduledJobs.map(j =>
        j.date >= weekStart && j.date <= endStr ? { ...j, is_published: false, isPublished: false } : j
      );
      setScheduledJobs(updated);
      saveScheduledJobs(updated);
      return;
    }

    const { error } = await supabase
      .from('scheduled_jobs')
      .update({ is_published: false })
      .gte('date', weekStart)
      .lte('date', endStr);
    if (error) throw error;
    setScheduledJobs(prev => prev.map(j =>
      j.date >= weekStart && j.date <= endStr ? { ...j, is_published: false, isPublished: false } : j
    ));
  };

  return { scheduledJobs, setScheduledJobs, loading, error, refreshScheduledJobs, addJob, updateJob, removeJob, bulkUpsertJobs, publishWeek, unpublishWeek };
}
