import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, supabaseReady } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Try to restore cached profile from localStorage for instant load
  const cachedProfile = (() => {
    try {
      const raw = localStorage.getItem('dustdash_profile');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const [session,        setSession]        = useState(null);
  const [profile,        setProfile]        = useState(cachedProfile);
  const [loading,        setLoading]        = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [debugMsg,       setDebugMsg]       = useState('Waiting for auth…');
  const initialised  = useRef(false);
  const profileCache = useRef(cachedProfile); // keep last good profile across token refreshes

  async function fetchProfile(userId) {
    if (!supabaseReady) return null;
    try {
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile query timed out after 10s')), 10000)
      );
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      if (error) {
        console.error('[AuthProvider] fetchProfile error:', error);
        setDebugMsg(`Profile fetch error: ${error.message} (code: ${error.code})`);
        return null;
      }
      setDebugMsg(`Profile loaded: ${data?.email} role=${data?.role}`);
      profileCache.current = data;
      try { localStorage.setItem('dustdash_profile', JSON.stringify(data)); } catch {}
      return data;
    } catch (e) {
      console.error('[AuthProvider] fetchProfile exception:', e);
      setDebugMsg(`Profile exception: ${e.message}`);
      return null;
    }
  }

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setDebugMsg(`Auth event: ${_event}, user: ${session?.user?.email ?? 'none'}`);

        if (session?.user) {
          // If we already have a cached profile for this user, use it immediately
          // and refresh in the background — no loading screen shown
          if (profileCache.current && profileCache.current.id === session.user.id) {
            setDebugMsg(`Using cached profile for ${session.user.email} (event: ${_event})`);
            setSession(session);
            setProfile(profileCache.current);
            setLoading(false);
            setProfileLoading(false);
            if (!initialised.current) initialised.current = true;
            // Silently refresh profile in background
            fetchProfile(session.user.id).then(prof => {
              if (prof) setProfile(prof);
            });
            return;
          }

          // First time loading — no cache yet, show loading spinner
          setProfileLoading(true);
          setSession(session);

          setDebugMsg(`Fetching profile for ${session.user.id}…`);
          const prof = await fetchProfile(session.user.id);
          setProfile(prof ?? null);
          setProfileLoading(false);
        } else {
          // Genuine sign-out — clear everything
          setSession(null);
          profileCache.current = null;
          setProfile(null);
          setProfileLoading(false);
        }

        if (!initialised.current) initialised.current = true;
        setLoading(false);
      }
    );

    // Hard safety net — never hang more than 8 seconds
    const timeout = setTimeout(() => {
      if (!initialised.current) {
        console.warn('[AuthProvider] timeout — forcing loading=false');
        initialised.current = true;
      }
      setLoading(false);
      setProfileLoading(false);
    }, 8000);

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    if (!supabaseReady) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    profileCache.current = null;
    try { localStorage.removeItem('dustdash_profile'); } catch {}
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileLoading, debugMsg, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Route guard — wraps admin-only routes
export function RequireAdmin({ children }) {
  const { session, profile, loading, profileLoading, debugMsg } = useAuth();
  const allowedRoles = new Set(['admin', 'finance']);

  // Show spinner while auth or profile is still loading
  if (loading || profileLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1117', color: '#fff', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 16 }}>Loading…</div>
      <div style={{ fontSize: 11, color: '#3A5A4A', marginTop: 4 }}>
        Supabase: {supabaseReady ? '✓ connected' : '✗ not connected'}
      </div>
      <div style={{ fontSize: 11, color: '#5A8A72', maxWidth: 400, textAlign: 'center', marginTop: 4 }}>
        {debugMsg}
      </div>
      <a href="/login" style={{ fontSize: 12, color: '#5A8A72', marginTop: 8 }}>Taking too long? Go to login →</a>
    </div>
  );

  // If Supabase isn't configured yet, allow through (dev mode)
  if (!supabaseReady) return children;

  // Logged in but no profile row exists — show a helpful message
  if (session && !profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1117', color: '#fff', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🔐</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Account not set up yet</div>
        <div style={{ fontSize: 14, color: '#8FBFA8', maxWidth: 420, lineHeight: 1.6 }}>
          You're logged in but your account doesn't have an admin profile yet.<br /><br />
          Go to <strong>Supabase → SQL Editor</strong> and run:<br />
        </div>
        <div style={{ background: '#1a1a1a', color: '#a8ff78', borderRadius: 8, padding: '14px 20px', fontFamily: 'monospace', fontSize: 13, lineHeight: 2, textAlign: 'left', maxWidth: 500, width: '100%' }}>
          INSERT INTO profiles (id, full_name, email, role, is_active)<br />
          VALUES (<br />
          &nbsp;&nbsp;'{session.user.id}',<br />
          &nbsp;&nbsp;'Your Name',<br />
          &nbsp;&nbsp;'{session.user.email}',<br />
          &nbsp;&nbsp;'admin',<br />
          &nbsp;&nbsp;true<br />
          ) ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
        </div>
        <div style={{ fontSize: 13, color: '#5A8A72' }}>After running that SQL, refresh this page.</div>
        <button
          onClick={() => { supabase.auth.signOut(); localStorage.removeItem('dustdash_profile'); window.location.href = '/login'; }}
          style={{ padding: '10px 24px', borderRadius: 8, background: 'transparent', border: '1px solid #3A5A4A', color: '#8FBFA8', cursor: 'pointer', fontSize: 13 }}
        >
          ← Sign out
        </button>
      </div>
    );
  }

  if (!profile || !allowedRoles.has(profile.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
