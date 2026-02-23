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

function isBroadcastTableError(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || "").toLowerCase();
  return (
    code === "42P01" || // relation missing
    code === "42703" || // column missing
    code === "42501" || // permission denied
    message.includes("staff_broadcasts") ||
    message.includes("permission denied")
  );
}

function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function useStaffBroadcast() {
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const loadFromScheduleSettings = useCallback(async () => {
    if (!supabaseReady || !supabase) return null;
    const { data, error: settingsErr } = await supabase
      .from("schedule_settings")
      .select("id, data")
      .eq("id", 1)
      .maybeSingle();
    if (settingsErr) throw settingsErr;

    const payload = toObject(data?.data).staff_broadcast || toObject(data?.data).staffBroadcast || null;
    const normalized = normalizeBroadcast(payload);
    if (!normalized || !normalized.is_active || isExpired(normalized.expires_at)) return null;
    return normalized;
  }, []);

  const writeToScheduleSettings = useCallback(async (broadcastOrNull) => {
    if (!supabaseReady || !supabase) return null;
    const { data: current, error: currentErr } = await supabase
      .from("schedule_settings")
      .select("id, data")
      .eq("id", 1)
      .maybeSingle();
    if (currentErr) throw currentErr;

    const dataObj = toObject(current?.data);
    const nextData = { ...dataObj };
    if (!broadcastOrNull) {
      delete nextData.staff_broadcast;
      delete nextData.staffBroadcast;
    } else {
      nextData.staff_broadcast = {
        id: broadcastOrNull.id,
        message: broadcastOrNull.message,
        tone: broadcastOrNull.tone || "info",
        created_at: broadcastOrNull.created_at || new Date().toISOString(),
        created_by: broadcastOrNull.created_by || null,
        expires_at: broadcastOrNull.expires_at || null,
        is_active: true,
      };
      delete nextData.staffBroadcast;
    }

    const payload = { id: 1, data: nextData, updated_at: new Date().toISOString() };
    const { error: upsertErr } = await supabase
      .from("schedule_settings")
      .upsert(payload, { onConflict: "id" });
    if (upsertErr) throw upsertErr;
    return broadcastOrNull;
  }, []);

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

      const { data, error: queryError } = await supabase
        .from('staff_broadcasts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (queryError) {
        if (isBroadcastTableError(queryError)) {
          try {
            const fallback = await loadFromScheduleSettings();
            setActiveBroadcast(fallback);
            setError(null);
            return;
          } catch (fallbackErr) {
            setError(fallbackErr);
            return;
          }
        }
        setError(queryError);
        return;
      }

      setError(null);
      const list = Array.isArray(data) ? data : [];
      const active = list.find((row) => !isExpired(row?.expires_at)) || null;
      setActiveBroadcast(normalizeBroadcast(active));
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [loadFromScheduleSettings]);

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

    const broadcastChannel = supabase
      .channel('staff_broadcasts:active')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_broadcasts' }, run)
      .subscribe();
    const settingsChannel = supabase
      .channel('schedule_settings:staff-broadcast')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_settings' }, run)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(settingsChannel);
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

    try {
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
    } catch (err) {
      if (!isBroadcastTableError(err)) throw err;

      const next = normalizeBroadcast({
        id: `settings_${Date.now()}`,
        message: cleanMessage,
        tone,
        created_at: new Date().toISOString(),
        created_by: createdBy,
        expires_at: expiresAt,
        is_active: true,
      });
      await writeToScheduleSettings(next);
      setActiveBroadcast(next);
      setError(null);
      return next;
    }
  }, [writeToScheduleSettings]);

  const clearBroadcast = useCallback(async () => {
    if (!supabaseReady || !supabase) {
      localStorage.removeItem(STORAGE_KEY);
      setActiveBroadcast(null);
      return;
    }

    try {
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
    } catch (err) {
      if (!isBroadcastTableError(err)) throw err;
      await writeToScheduleSettings(null);
    }

    setActiveBroadcast(null);
    setError(null);
  }, [activeBroadcast?.id, writeToScheduleSettings]);

  return {
    activeBroadcast,
    loading,
    error,
    refreshBroadcast,
    publishBroadcast,
    clearBroadcast,
  };
}
