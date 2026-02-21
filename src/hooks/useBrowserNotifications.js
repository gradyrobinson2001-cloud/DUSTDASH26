import { useCallback, useEffect, useState } from 'react';

export function useBrowserNotifications(storageKey = 'dustdash_notifications_enabled') {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'denied'));
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported) return { ok: false, reason: 'unsupported' };
    const result = await Notification.requestPermission();
    setPermission(result);
    const granted = result === 'granted';
    setEnabled(granted);
    try { localStorage.setItem(storageKey, granted ? 'true' : 'false'); } catch {}
    return { ok: granted, reason: result };
  }, [storageKey, supported]);

  const notify = useCallback(({ title, body, tag, requireInteraction = false }) => {
    if (!supported || permission !== 'granted' || !enabled) return null;
    const safeTitle = String(title || '').trim() || 'Dust Bunnies';
    const safeBody = String(body || '').trim();
    const notification = new Notification(safeTitle, {
      body: safeBody,
      tag: tag || undefined,
      requireInteraction,
      silent: false,
    });
    return notification;
  }, [enabled, permission, supported]);

  const disable = useCallback(() => {
    setEnabled(false);
    try { localStorage.setItem(storageKey, 'false'); } catch {}
  }, [storageKey]);

  return {
    supported,
    permission,
    enabled,
    requestPermission,
    notify,
    disable,
  };
}
