'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import Link from 'next/link';
import { CadenceMark } from '@/components/shared/CadenceLogo';

export default function SignupPage() {
  const router             = useRouter();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.signup(name, email, password);
      router.push('/connect');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--bg)',
        position: 'relative',
      }}
    >
      {/* Atmospheric glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: [
            'radial-gradient(ellipse 70% 55% at 50% -5%, rgba(99,102,241,0.13) 0%, transparent 65%)',
            'radial-gradient(ellipse 40% 30% at 80% 90%, rgba(167,139,250,0.06) 0%, transparent 60%)',
          ].join(', '),
        }}
      />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 0 0 4px rgba(99,102,241,0.08)',
            }}
          >
            <CadenceMark size={28} />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--fg)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Create your account
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 6 }}>
            Start tracking your team&apos;s delivery in 2 minutes
          </p>
        </div>

        {/* Form card */}
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: 28,
            boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.06)',
          }}
        >
          {error && (
            <div
              style={{
                fontSize: 13,
                padding: '10px 14px',
                marginBottom: 20,
                background: 'var(--error-dim)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 9,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Your name"
                className="input"
              />
            </div>
            <div>
              <label className="label">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="input"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                placeholder="8+ characters"
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ justifyContent: 'center', marginTop: 4, padding: '10px 16px', fontSize: 14 }}
            >
              {loading ? 'Creating account…' : 'Get started'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 20, color: 'var(--fg-subtle)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
