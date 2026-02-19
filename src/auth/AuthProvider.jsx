import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const initialised = useRef(false);

  async function fetchProfile(userId) {
    if (!supabaseReady) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) { console.error('[AuthProvider] fetchProfile error:', error); return null; }
      return data;
    } catch (e) {
      console.error('[AuthProvider] fetchProfile exception:', e);
      return null;
    }
  }

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }

    // onAuthStateChange fires immediately with the current session —
    // use it as the single source of truth. Mark initialised after
    // the first event so we only show the loading screen once.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          const prof = await fetchProfile(session.user.id);
          setProfile(prof);
        } else {
          setProfile(null);
        }
        // After first event (initial session check) we're done loading
        if (!initialised.current) {
          initialised.current = true;
          setLoading(false);
        }
      }
    );

    // Hard safety net — never hang more than 6 seconds
    const timeout = setTimeout(() => {
      if (!initialised.current) {
        console.warn('[AuthProvider] timeout — forcing loading=false');
        initialised.current = true;
        setLoading(false);
      }
    }, 6000);

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    if (!supabaseReady) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
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
  const { session, profile, loading } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1117', color: '#fff', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 16 }}>Loading…</div>
      <a href="/login" style={{ fontSize: 12, color: '#5A8A72', marginTop: 8 }}>Taking too long? Go to login →</a>
    </div>
  );

  // If Supabase isn't configured yet, allow through (dev mode)
  if (!supabaseReady) return children;

  // Logged in but no profile row yet — show a helpful message instead of looping
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
          onClick={() => { supabase.auth.signOut(); window.location.href = '/login'; }}
          style={{ padding: '10px 24px', borderRadius: 8, background: 'transparent', border: '1px solid #3A5A4A', color: '#8FBFA8', cursor: 'pointer', fontSize: 13 }}
        >
          ← Sign out
        </button>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    window.location.href = '/login';
    return null;
  }

  return children;
}
