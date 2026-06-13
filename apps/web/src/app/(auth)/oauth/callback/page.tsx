'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function OAuthCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const error = params.get('error');
    const connectionId = params.get('connectionId');

    if (error) {
      router.push(`/connect?error=${error}`);
    } else if (connectionId) {
      router.push(`/setup/state-mapping?connectionId=${connectionId}`);
    } else {
      router.push('/connect?error=unknown');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p style={{ color: 'var(--muted)' }}>Completing connection...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: 'var(--muted)' }}>Completing connection...</p>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
