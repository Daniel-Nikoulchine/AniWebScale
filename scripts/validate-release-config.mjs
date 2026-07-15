function httpsUrl(name, input, pathSuffix = '') {
  const raw = typeof input === 'string' ? input.trim().replace(/\/$/, '') : '';
  try {
    const parsed = new URL(raw);
    const placeholder = parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname.endsWith('.example')
      || parsed.hostname === 'example.com';
    const validPath = pathSuffix
      ? parsed.pathname.replace(/\/$/, '').endsWith(pathSuffix)
      : parsed.pathname === '/' || parsed.pathname === '';
    if (parsed.protocol === 'https:' && !placeholder && validPath) return raw;
  } catch {
    // Report a single actionable error below.
  }
  throw new Error(`${name} must be a non-placeholder HTTPS URL${pathSuffix ? ` ending in ${pathSuffix}` : ' with no path'}.`);
}

const accountApiUrl = httpsUrl('ANIME4K_ACCOUNT_API_URL', process.env.ANIME4K_ACCOUNT_API_URL);
const neonAuthUrl = httpsUrl('ANIME4K_NEON_AUTH_URL', process.env.ANIME4K_NEON_AUTH_URL, '/auth');

console.log(`Release account origin: ${new URL(accountApiUrl).origin}`);
console.log(`Release Neon Auth origin: ${new URL(neonAuthUrl).origin}`);
