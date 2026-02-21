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
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at 18% 14%, #EAF1E8 0%, ${T.bg} 38%, #ECE8DC 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'rgba(91,127,98,0.13)', top: -140, left: -110, filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'rgba(79,125,130,0.10)', bottom: -110, right: -80, filter: 'blur(2px)' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: '#FFFEFC', borderRadius: 22, border: `1px solid ${T.border}`, padding: 28, boxShadow: '0 20px 56px rgba(30,47,36,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: T.primaryLight, color: T.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
            🌿
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text, letterSpacing: 0.2 }}>Staff Portal</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
            Dust Bunnies Operations
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.55, display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="you@dustbunnies.com.au"
              autoComplete="email"
              style={{
                width: '100%',
                padding: '12px 13px',
                borderRadius: 11,
                border: `1.5px solid ${T.border}`,
                fontSize: 15,
                boxSizing: 'border-box',
                background: '#FAF9F6',
                color: T.text,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.55, display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '12px 13px',
                borderRadius: 11,
                border: `1.5px solid ${T.border}`,
                fontSize: 15,
                boxSizing: 'border-box',
                background: '#FAF9F6',
                color: T.text,
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{ textAlign: 'center', color: T.danger, fontSize: 13, marginBottom: 12, background: T.dangerLight, borderRadius: 9, padding: '8px 10px', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 11,
              border: 'none',
              background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryDark} 100%)`,
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.76 : 1,
              boxShadow: '0 10px 22px rgba(53,82,64,0.24)',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: T.textMuted }}>
          <button
            onClick={onDemoMode}
            style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Demo mode
          </button>
          <span style={{ color: T.border, margin: '0 8px' }}>·</span>
          <a href="/login" style={{ color: T.textMuted, fontSize: 12, textDecoration: 'underline' }}>Admin login</a>
        </div>
      </div>
    </div>
  );
}
