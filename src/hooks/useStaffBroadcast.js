import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

const STORAGE_KEY = 'dustdash_staff_broadcast';

function normalizeBroadcast(row) {
  if (!row) return null;
  return {
    id: row.id || `local_${Date.now()}`,
    message: row.message || '',
    tone: row.tone || 'info',
    created_at: row.created_at || new Date().toISOString(),
    created_by: row.created_by || null,
    expires_at: row.expires_at || null,
    is_active: row.is_active !== false,
  };
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

export function useStaffBroadcast() {
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const refreshBroadcast = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      if (!supabaseReady || !supabase) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          const normalized = normalizeBroadcast(parsed);
          if (!normalized || !normalized.is_active || isExpired(normalized.expires_at)) {
            setActiveBroadcast(null);
          } else {
            setActiveBroadcast(normalized);
          }
          setError(null);
        } catch (localErr) {
          setError(localErr);
        }
        return;
      }

      const nowIso = new Date().toISOString();
      const { data, error: queryError } = await supabase
        .from('staff_broadcasts')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (queryError) {
        setError(queryError);
        return;
      }

      setError(null);
      setActiveBroadcast(normalizeBroadcast(data));
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await refreshBroadcast();
    };
    run();

    if (!supabaseReady || !supabase) {
      return () => { mounted = false; };
    }

    const channel = supabase
      .channel('staff_broadcasts:active')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_broadcasts' }, run)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [refreshBroadcast]);

  const publishBroadcast = useCallback(async ({ message, createdBy = null, tone = 'info', expiresAt = null }) => {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) throw new Error('Broadcast message is required.');

    if (!supabaseReady || !supabase) {
      const local = normalizeBroadcast({
        id: `local_${Date.now()}`,
        message: cleanMessage,
        tone,
        created_at: new Date().toISOString(),
        created_by: createdBy,
        expires_at: expiresAt,
        is_active: true,
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
      setActiveBroadcast(local);
      return local;
    }

    const deactivate = await supabase
      .from('staff_broadcasts')
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivate.error) throw deactivate.error;

    const insertRes = await supabase
      .from('staff_broadcasts')
      .insert({
        message: cleanMessage,
        tone,
        created_by: createdBy,
        expires_at: expiresAt,
        is_active: true,
      })
      .select('*')
      .single();

    if (insertRes.error) throw insertRes.error;
    const next = normalizeBroadcast(insertRes.data);
    setActiveBroadcast(next);
    return next;
  }, []);

  const clearBroadcast = useCallback(async () => {
    if (!supabaseReady || !supabase) {
      localStorage.removeItem(STORAGE_KEY);
      setActiveBroadcast(null);
      return;
    }

    if (activeBroadcast?.id) {
      const { error: clearError } = await supabase
        .from('staff_broadcasts')
        .update({ is_active: false })
        .eq('id', activeBroadcast.id);
      if (clearError) throw clearError;
    } else {
      const { error: clearAllError } = await supabase
        .from('staff_broadcasts')
        .update({ is_active: false })
        .eq('is_active', true);
      if (clearAllError) throw clearAllError;
    }

    setActiveBroadcast(null);
  }, [activeBroadcast?.id]);

  return {
    activeBroadcast,
    loading,
    error,
    refreshBroadcast,
    publishBroadcast,
    clearBroadcast,
  };
}
