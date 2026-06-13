const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await res.json() as { data?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed: ${res.status}`);
  return body.data as T;
}
