import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadClients, saveClients } from '../shared';

const ALLOWED_STATUSES = new Set(['active', 'inactive', 'paused']);

const normalizeStatus = (value, fallback = 'active') => {
  const next = String(value || '').trim().toLowerCase();
  if (ALLOWED_STATUSES.has(next)) return next;
  if (next === 'cancelled') return 'inactive';
  return fallback;
};

const mapDbToClient = (row) => {
  const preferredDay = row?.preferred_day ?? row?.preferredDay ?? 'monday';
  const preferredTime = row?.preferred_time ?? row?.preferredTime ?? 'anytime';
  const estimatedDuration = row?.estimated_duration ?? row?.estimatedDuration ?? null;
  const customDuration = row?.custom_duration ?? row?.customDuration ?? null;
  const accessNotes = row?.access_notes ?? row?.accessNotes ?? '';
  const isDemo = Boolean(row?.is_demo ?? row?.isDemo ?? false);
  const status = normalizeStatus(row?.status, 'active');
  return {
    ...(row || {}),
    preferred_day: preferredDay,
    preferredDay,
    preferred_time: preferredTime,
    preferredTime,
    estimated_duration: estimatedDuration,
    estimatedDuration,
    custom_duration: customDuration,
    customDuration,
    access_notes: accessNotes,
    accessNotes,
    is_demo: isDemo,
    isDemo,
    status,
  };
};

const toDbClient = (client) => {
  const input = client || {};
  const out = {};

  if (input.name !== undefined) out.name = input.name;
  if (input.email !== undefined) out.email = input.email;
  if (input.phone !== undefined) out.phone = input.phone;
  if (input.address !== undefined) out.address = input.address;
  if (input.suburb !== undefined) out.suburb = input.suburb;
  if (input.bedrooms !== undefined) out.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) out.bathrooms = input.bathrooms;
  if (input.living !== undefined) out.living = input.living;
  if (input.kitchen !== undefined) out.kitchen = input.kitchen;
  if (input.frequency !== undefined) out.frequency = input.frequency;
  if (input.preferred_day !== undefined || input.preferredDay !== undefined) {
    out.preferred_day = input.preferred_day ?? input.preferredDay ?? null;
  }
  if (input.preferred_time !== undefined || input.preferredTime !== undefined) {
    out.preferred_time = input.preferred_time ?? input.preferredTime ?? null;
  }
  if (input.assigned_team !== undefined) out.assigned_team = input.assigned_team;
  if (input.estimated_duration !== undefined || input.estimatedDuration !== undefined) {
    out.estimated_duration = input.estimated_duration ?? input.estimatedDuration ?? null;
  }
  if (input.custom_duration !== undefined || input.customDuration !== undefined) {
    out.custom_duration = input.custom_duration ?? input.customDuration ?? null;
  }
  if (input.status !== undefined) out.status = normalizeStatus(input.status, 'active');
  if (input.notes !== undefined) out.notes = input.notes;
  if (input.access_notes !== undefined || input.accessNotes !== undefined) {
    out.access_notes = input.access_notes ?? input.accessNotes ?? null;
  }
  if (input.lat !== undefined) out.lat = input.lat;
  if (input.lng !== undefined) out.lng = input.lng;
  if (input.is_demo !== undefined || input.isDemo !== undefined) {
    out.is_demo = Boolean(input.is_demo ?? input.isDemo);
  }

  return out;
};

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const fetchingRef = useRef(false);

  const refreshClients = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setClients((data ?? []).map(mapDbToClient));
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady) {
      setClients((loadClients() || []).map(mapDbToClient));
      setLoading(false);
      return;
    }
    let mounted = true;
    const safeRefresh = async () => { if (mounted) await refreshClients(); };
    safeRefresh();
    const ch = supabase
      .channel('clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, safeRefresh)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [refreshClients]);

  const addClient = async (c) => {
    const normalized = mapDbToClient(c);
    if (!supabaseReady) {
      const inserted = mapDbToClient({ ...normalized, id: `local_${Date.now()}`, created_at: new Date().toISOString() });
      const updated = [...clients, inserted];
      setClients(updated);
      saveClients(updated);
      return inserted;
    }
    const payload = toDbClient(normalized);
    const { data, error } = await supabase.from('clients').insert(payload).select('*').single();
    if (error) throw error;
    const inserted = mapDbToClient(data);
    setClients(prev => [inserted, ...prev.filter(x => x.id !== inserted.id)]);
    return inserted;
  };

  const updateClient = async (id, updates) => {
    const normalized = mapDbToClient(updates || {});
    if (!supabaseReady) {
      let nextClient = null;
      const updated = clients.map(c => {
        if (c.id !== id) return c;
        nextClient = mapDbToClient({ ...c, ...normalized });
        return nextClient;
      });
      setClients(updated);
      saveClients(updated);
      return nextClient;
    }
    const payload = toDbClient(normalized);
    const { data, error } = await supabase.from('clients').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    const updatedClient = mapDbToClient(data);
    setClients(prev => prev.map(c => c.id === id ? updatedClient : c));
    return updatedClient;
  };

  const removeClient = async (id) => {
    if (!supabaseReady) { const updated = clients.filter(c => c.id !== id); setClients(updated); saveClients(updated); return; }
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    setClients(prev => prev.filter(c => c.id !== id));
  };

  return { clients, setClients, loading, error, refreshClients, addClient, updateClient, removeClient };
}
