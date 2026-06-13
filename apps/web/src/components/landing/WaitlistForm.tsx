'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function WaitlistForm({ size = 'default' }: { size?: 'default' | 'large' }) {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading' || status === 'success') return;

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setStatus('success');
        setEmail('');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  const isLarge  = size === 'large';
  const inputH   = isLarge ? 48 : 40;
  const fontSize = isLarge ? 15 : 13.5;
  const btnPad   = isLarge ? '0 22px' : '0 16px';

  if (status === 'success') {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: 'var(--success-dim)', border: '1px solid rgba(34,197,94,0.25)',
        borderRadius: 10, padding: isLarge ? '12px 20px' : '9px 16px',
      }}>
        <CheckCircle2 size={isLarge ? 18 : 15} color="var(--success)" strokeWidth={2.5} />
        <span style={{ fontSize, fontWeight: 600, color: 'var(--success)' }}>
          You're on the list. We'll let you know when it launches.
        </span>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{
        display: 'flex', alignItems: 'stretch',
        gap: 8, flexWrap: 'wrap',
      }}>
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setMessage(''); }}
          disabled={status === 'loading'}
          style={{
            flex: '1 1 200px', minWidth: 0,
            height: inputH, padding: '0 14px',
            fontSize, fontFamily: 'inherit',
            background: 'var(--surface-2)',
            border: `1px solid ${status === 'error' ? 'var(--error)' : 'var(--border)'}`,
            borderRadius: 9, color: 'var(--fg)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            height: inputH, padding: btnPad,
            fontSize, fontWeight: 600, color: '#fff',
            background: 'var(--accent)',
            border: 'none', borderRadius: 9, cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {status === 'loading'
            ? <><Loader2 size={14} strokeWidth={2.5} style={{ animation: 'spin 0.8s linear infinite' }} /> Joining...</>
            : <>Join the waitlist <ArrowRight size={14} /></>
          }
        </button>
      </form>

      {status === 'error' && message && (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--error)' }}>{message}</p>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="email"]::placeholder { color: var(--fg-subtle); }
        input[type="email"]:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--accent-dim);
        }
      `}</style>
    </div>
  );
}
