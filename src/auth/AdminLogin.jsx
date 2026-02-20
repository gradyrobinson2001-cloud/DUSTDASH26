import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseReady } from '../lib/supabase';
import { T } from '../shared';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [mode,     setMode]     = useState('login'); // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabaseReady) { setError('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'); return; }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message);
      setLoading(false);
    } else {
      // AuthProvider will pick up the session; navigate to dashboard
      navigate('/', { replace: true });
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address first.'); return; }
    if (!supabaseReady) { setError('Supabase not configured.'); return; }
    setLoading(true);
    setError('');

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
  };

  // ── Reset sent confirmation ──
  if (resetSent) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: T.card, borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>Check your email</div>
          <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 24 }}>
            We sent a password reset link to <strong style={{ color: T.text }}>{email}</strong>.<br /><br />
            Click the link in the email to set a new password. It may take a minute to arrive.
          </div>
          <button
            onClick={() => { setMode('login'); setResetSent(false); setError(''); }}
            style={{ padding: '10px 24px', borderRadius: 8, background: T.primary, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🫧</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>Dust Bunnies</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>
            {mode === 'login' ? 'Admin Dashboard' : 'Reset Password'}
          </div>
        </div>

        {mode === 'login' ? (
          /* ── Login Form ── */
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="owner@dustbunnies.com.au"
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); }}
                  style={{ background: 'none', border: 'none', color: T.primary, fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 500 }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 24 }} />

            {error && (
              <div style={{ background: '#3a1a1a', border: '1px solid #D4645C', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#D4645C', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: 8, background: T.primary, color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* ── Reset Password Form ── */
          <form onSubmit={handleResetRequest}>
            <div style={{ background: T.primaryLight, borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: T.primaryDark }}>
              Enter your email address and we'll send you a link to reset your password.
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="owner@dustbunnies.com.au"
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ background: '#3a1a1a', border: '1px solid #D4645C', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#D4645C', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: 8, background: T.primary, color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom: 12 }}
            >
              {loading ? 'Sending…' : '📧 Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'transparent', color: T.textMuted, fontWeight: 600, fontSize: 14, border: `1px solid ${T.border}`, cursor: 'pointer' }}
            >
              ← Back to Login
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: T.textMuted }}>
          Staff access? <a href="/cleaner" style={{ color: T.primary, textDecoration: 'none' }}>Go to Staff Portal →</a>
        </div>
      </div>
    </div>
  );
}
