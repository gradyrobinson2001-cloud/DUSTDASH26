import React, { useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { T } from '../shared';

// Staff login component — email + password
// Returns onAuthenticated(profile) when successful
export default function StaffLogin({ onAuthenticated, onDemoMode }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (!password)     { setError('Please enter your password.'); return; }
    setLoading(true);
    setError('');

    if (!supabaseReady) {
      // Dev fallback
      if (password === '1234') {
        onAuthenticated({ id: 'dev', full_name: email.split('@')[0], role: 'staff' });
      } else {
        setError('Incorrect password. (Dev mode: use 1234)');
      }
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : authError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Login failed. Please try again.');
        setLoading(false);
        return;
      }

      // Fetch full profile
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profErr || !prof) {
        setError('Account found but no staff profile. Contact admin.');
        setLoading(false);
        return;
      }

      if (prof.role !== 'staff') {
        setError('This login is for staff only. Admins use /login.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (!prof.is_active) {
        setError('Your account is inactive. Contact admin.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      onAuthenticated(prof);
    } catch (err) {
      setError('Login failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 32, width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🫧</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Staff Portal</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Sign in with your email and password</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="your.email@example.com"
              autoComplete="email"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `1.5px solid ${T.border}`, fontSize: 15, boxSizing: 'border-box',
                background: T.bg, color: T.text,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `1.5px solid ${T.border}`, fontSize: 15, boxSizing: 'border-box',
                background: T.bg, color: T.text,
              }}
            />
          </div>

          {error && (
            <div style={{ textAlign: 'center', color: '#D4645C', fontSize: 13, marginBottom: 14 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: T.primary, color: '#fff', fontSize: 16, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onDemoMode}
            style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Demo mode
          </button>
          <span style={{ color: T.border, margin: '0 8px' }}>·</span>
          <a href="/login" style={{ color: T.textMuted, fontSize: 12 }}>Admin →</a>
        </div>
      </div>
    </div>
  );
}
