function errorMessage(value, fallback) {
  if (value && typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error === 'string') return value.error;
    if (typeof value.error?.message === 'string') return value.error.message;
  }
  return fallback;
}

export function createNeonAuthClient(baseUrl) {
  const root = baseUrl.replace(/\/$/, '');

  async function request(path, init = {}) {
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
      return { data: body, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Authentication service unavailable.' } };
    }
  }

  return {
    getSession: () => request('get-session'),
    token: () => request('token'),
    signIn: {
      email: value => request('sign-in/email', { method: 'POST', body: JSON.stringify(value) }),
    },
    emailOtp: {
      verifyEmail: value => request('email-otp/verify-email', {
        method: 'POST',
        body: JSON.stringify(value),
      }),
      sendVerificationOtp: value => request('email-otp/send-verification-otp', {
        method: 'POST',
        body: JSON.stringify(value),
      }),
    },
    signOut: () => request('sign-out', { method: 'POST', body: '{}' }),
  };
}
