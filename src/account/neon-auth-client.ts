interface AuthResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface AuthUser {
  id: string;
  email?: string;
}

function errorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === 'object') {
    const body = value as { message?: unknown; error?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (typeof body.error === 'string') return body.error;
    if (body.error && typeof body.error === 'object'
      && typeof (body.error as { message?: unknown }).message === 'string') {
      return (body.error as { message: string }).message;
    }
  }
  return fallback;
}

export function createNeonAuthClient(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, init: RequestInit = {}): Promise<AuthResult<T>> {
    try {
      const response = await fetch(`${root}/${path}`, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        return { data: null, error: { message: errorMessage(body, 'Authentication failed.') } };
      }
      return { data: body as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : 'Authentication service unavailable.' },
      };
    }
  }

  return {
    getSession: () => request<{ session: unknown; user: AuthUser }>('get-session'),
    token: () => request<{ token: string }>('token'),
    signIn: {
      email: (value: { email: string; password: string }) => request<{ user: AuthUser }>('sign-in/email', {
        method: 'POST',
        body: JSON.stringify(value),
      }),
    },
    signUp: {
      email: (value: { email: string; password: string; name: string }) => request<{ user: AuthUser }>('sign-up/email', {
        method: 'POST',
        body: JSON.stringify(value),
      }),
    },
    signOut: () => request<{ success?: boolean }>('sign-out', { method: 'POST', body: '{}' }),
  };
}
