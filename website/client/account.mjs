import { createNeonAuthClient } from './neon-auth-client.mjs';
import {
  isCompleteVerificationCode,
  normalizeVerificationCode,
} from './verification.mjs';

const signedOut = document.getElementById('signed-out');
const signedIn = document.getElementById('signed-in');
const verification = document.getElementById('verification');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authSwitch = document.getElementById('auth-switch');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const showVerificationButton = document.getElementById('show-verification');
const verificationForm = document.getElementById('verification-form');
const verificationEmailInput = document.getElementById('verification-email');
const verificationCodeInput = document.getElementById('verification-code');
const verificationSubmit = document.getElementById('verification-submit');
const resendVerification = document.getElementById('resend-verification');
const backToAuth = document.getElementById('back-to-auth');
const accountEmail = document.getElementById('account-email');
const planName = document.getElementById('plan-name');
const planStatus = document.getElementById('plan-status');
const accountMessage = document.getElementById('account-message');
const checkoutMessage = document.getElementById('checkout-message');
const signOutButton = document.getElementById('sign-out');
const portalButton = document.getElementById('manage-billing');
const downloadAccountDataButton = document.getElementById('download-account-data');
const refreshButton = document.getElementById('refresh-license');
const revokeAllSessionsButton = document.getElementById('revoke-all-sessions');
const accountCreated = document.getElementById('account-created');
const browserSessionCount = document.getElementById('browser-session-count');
const extensionSessionCount = document.getElementById('extension-session-count');
const securityMessage = document.getElementById('security-message');
const sessionList = document.getElementById('session-list');
const legalCheckbox = document.getElementById('accept-legal');
const performanceCheckbox = document.getElementById('request-performance');
const taxNotice = document.getElementById('tax-notice');
const extensionAuthorizationPanel = document.getElementById('extension-authorization');
const authorizeExtensionButton = document.getElementById('authorize-extension');
const extensionDeviceName = document.getElementById('extension-device-name');
const openDeleteAccountButton = document.getElementById('open-delete-account');
const deleteAccountDialog = document.getElementById('delete-account-dialog');
const deleteAccountForm = document.getElementById('delete-account-form');
const deleteConfirmationEmail = document.getElementById('delete-confirmation-email');
const deletePassword = document.getElementById('delete-password');
const deleteAcknowledgement = document.getElementById('delete-acknowledgement');
const deleteAccountMessage = document.getElementById('delete-account-message');
const cancelDeleteAccountButton = document.getElementById('cancel-delete-account');
const confirmDeleteAccountButton = document.getElementById('confirm-delete-account');

const params = new URLSearchParams(window.location.search);
const requestedPlan = ['pro_monthly', 'pro_yearly', 'lifetime'].includes(params.get('plan'))
  ? params.get('plan')
  : null;
let signUpMode = params.get('mode') === 'signup';
const extensionAuthorization = params.get('extension_authorize') === '1'
  ? {
      redirectUri: params.get('redirect_uri') || '',
      codeChallenge: params.get('code_challenge') || '',
      state: params.get('state') || '',
      deviceName: (params.get('device_name') || 'AniWebScale browser extension').slice(0, 80),
    }
  : null;
let config;
let authClient;
let currentUser = null;
let verificationInFlight = false;
let lastAutoSubmittedVerification = '';

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function errorMessage(error, fallback) {
  return error?.message || error?.error?.message || fallback;
}

function formattedDate(value, fallback = 'Not available') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
    : fallback;
}

function renderSessions(security) {
  sessionList.replaceChildren();
  const sessions = [
    ...(security.browserSessions.items || []),
    ...(security.extensionSessions.items || []),
  ];
  for (const session of sessions) {
    const item = document.createElement('li');
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = session.kind === 'extension'
      ? session.deviceName || 'AniWebScale extension'
      : 'Browser session';
    const meta = document.createElement('span');
    meta.textContent = session.kind === 'extension'
      ? `Last used ${formattedDate(session.lastUsedAt)} · expires ${formattedDate(session.expiresAt)}`
      : `Expires ${formattedDate(session.expiresAt)}`;
    const revoke = document.createElement('button');
    revoke.type = 'button';
    revoke.className = 'text-button';
    revoke.textContent = 'Revoke';
    revoke.setAttribute('aria-label', `Revoke ${title.textContent}`);
    revoke.addEventListener('click', async () => {
      revoke.disabled = true;
      setMessage(securityMessage, `Revoking ${title.textContent}…`);
      try {
        await api('/api/account/revoke-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: session.kind, id: session.id }),
        });
        await refreshSecurity();
      } catch (error) {
        setMessage(securityMessage, errorMessage(error, 'Could not revoke the session.'), true);
        revoke.disabled = false;
      }
    });
    details.append(title, meta);
    item.append(details, revoke);
    sessionList.append(item);
  }
  if (sessions.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No active sessions.';
    sessionList.append(empty);
  }
}

function updateAuthMode() {
  authTitle.textContent = signUpMode ? 'Create your account' : 'Sign in';
  authSubmit.textContent = signUpMode ? 'Create account' : 'Sign in';
  authSwitch.textContent = signUpMode
    ? 'Already have an account? Sign in'
    : 'New here? Create an account';
  passwordInput.autocomplete = signUpMode ? 'new-password' : 'current-password';
}

function setAuthControlsDisabled(disabled) {
  authForm.querySelectorAll('input, button').forEach(element => { element.disabled = disabled; });
  authSwitch.disabled = disabled;
  showVerificationButton.disabled = disabled;
}

function showVerification(email = '', message = 'Enter the numeric code from your email.') {
  currentUser = null;
  signedOut.hidden = true;
  signedIn.hidden = true;
  verification.hidden = false;
  verificationEmailInput.value = email;
  verificationCodeInput.value = '';
  lastAutoSubmittedVerification = '';
  setMessage(accountMessage, message);
  verificationCodeInput.focus();
}

function showSignedOut() {
  verification.hidden = true;
  signedIn.hidden = true;
  signedOut.hidden = false;
}

async function accessToken() {
  const tokenResult = await authClient.token();
  if (tokenResult?.error) throw new Error(errorMessage(tokenResult.error, 'Could not retrieve account token.'));
  const token = tokenResult?.data?.token;
  if (!token) throw new Error('Your session expired. Please sign in again.');
  return token;
}

async function api(path, options = {}) {
  const token = await accessToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const supportCode = response.headers.get('x-request-id');
    const message = body.error || 'The request failed.';
    throw new Error(supportCode ? `${message} Support code: ${supportCode}` : message);
  }
  return body;
}

async function signUpOnWebsite(email, password) {
  const response = await fetch('/api/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name: email.split('@')[0] || 'AniWebScale user',
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Account creation failed.');
  return body;
}

async function refreshAccount() {
  if (!currentUser) return;
  refreshButton.disabled = true;
  setMessage(accountMessage, 'Checking your license…');
  try {
    const license = await api('/api/license');
    planName.textContent = license.plan === 'lifetime'
      ? 'Lifetime Pro'
      : license.plan === 'pro' ? 'Pro' : 'Free';
    if (license.plan === 'free') {
      planStatus.textContent = 'Anime4K + WebGPU';
    } else if (license.plan === 'lifetime') {
      planStatus.textContent = 'Permanent access · Native + AI + Frame generation';
    } else {
      const period = formattedDate(license.currentPeriodEnd, 'date unavailable');
      planStatus.textContent = license.cancelAtPeriodEnd
        ? `Access ends ${period} · Native + AI + Frame generation`
        : `${license.status === 'trialing' ? 'Trial' : 'Active'} · Current period ends ${period}`;
    }
    setMessage(accountMessage, params.get('checkout') === 'success'
      ? 'Payment received. Stripe may need a few seconds to activate Pro.'
      : 'License status is up to date.');
  } catch (error) {
    planName.textContent = 'Unavailable';
    planStatus.textContent = 'Free features remain available';
    setMessage(accountMessage, errorMessage(error, 'Could not load license status.'), true);
  } finally {
    refreshButton.disabled = false;
  }
}

async function refreshSecurity() {
  if (!currentUser) return;
  revokeAllSessionsButton.disabled = true;
  setMessage(securityMessage, 'Checking active sessions…');
  try {
    const security = await api('/api/account/security');
    accountCreated.textContent = formattedDate(security.accountCreatedAt);
    browserSessionCount.textContent = `${security.browserSessions.active} active`;
    extensionSessionCount.textContent = security.extensionSessions.lastUsedAt
      ? `${security.extensionSessions.active} active · used ${formattedDate(security.extensionSessions.lastUsedAt)}`
      : `${security.extensionSessions.active} active`;
    renderSessions(security);
    setMessage(securityMessage, 'Session information is up to date.');
  } catch (error) {
    accountCreated.textContent = 'Unavailable';
    browserSessionCount.textContent = 'Unavailable';
    extensionSessionCount.textContent = 'Unavailable';
    sessionList.replaceChildren();
    setMessage(securityMessage, errorMessage(error, 'Could not load session information.'), true);
  } finally {
    revokeAllSessionsButton.disabled = false;
  }
}

async function showSession() {
  const sessionResult = await authClient.getSession();
  if (sessionResult?.error) {
    throw new Error(errorMessage(sessionResult.error, 'Could not read the account session.'));
  }
  currentUser = sessionResult?.data?.user || sessionResult?.data?.session?.user || null;
  verification.hidden = true;
  signedOut.hidden = Boolean(currentUser);
  signedIn.hidden = !currentUser;
  if (!currentUser) {
    extensionAuthorizationPanel.hidden = true;
    return;
  }
  accountEmail.textContent = currentUser.email || 'Signed-in account';
  extensionAuthorizationPanel.hidden = !extensionAuthorization;
  if (extensionAuthorization) extensionDeviceName.value = extensionAuthorization.deviceName;
  await Promise.all([refreshAccount(), refreshSecurity()]);
}

async function beginCheckout(plan, button) {
  const readyKey = plan === 'pro_monthly' ? 'proMonthly'
    : plan === 'pro_yearly' ? 'proYearly' : 'lifetime';
  if (!config.checkout?.[readyKey]) {
    return setMessage(checkoutMessage, 'Test checkout still needs the local Stripe and webhook secrets.', true);
  }
  if (!legalCheckbox.checked || !performanceCheckbox.checked) {
    setMessage(checkoutMessage, 'Please confirm both legal notices before continuing.', true);
    legalCheckbox.focus();
    return;
  }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Opening Stripe…';
  setMessage(checkoutMessage, 'Opening secure Stripe Checkout…');
  try {
    const result = await api('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        plan,
        legalAccepted: true,
        immediatePerformanceRequested: true,
        legalVersion: config.legal.version,
      }),
    });
    window.location.assign(result.url);
  } catch (error) {
    setMessage(checkoutMessage, errorMessage(error, 'Checkout could not be started.'), true);
    button.disabled = false;
    button.textContent = original;
  }
}

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (signUpMode && !config.auth?.signupReady) {
    setMessage(accountMessage, 'New account registration is temporarily disabled pending data-protection approval.', true);
    return;
  }
  authSubmit.disabled = true;
  setMessage(accountMessage, signUpMode ? 'Creating account…' : 'Signing in…');
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const result = signUpMode
      ? await signUpOnWebsite(email, password)
      : await authClient.signIn.email({ email, password });
    if (result?.error) throw new Error(errorMessage(result.error, 'Authentication failed.'));
    passwordInput.value = '';
    if (signUpMode) {
      showVerification(
        email,
        'If this address can be registered, a verification code has been sent. Enter it below.',
      );
      return;
    }
    await showSession();
    if (requestedPlan) {
      document.querySelector(`[data-account-plan="${requestedPlan}"]`)?.focus();
      setMessage(checkoutMessage, 'Account ready. Confirm the plan below to continue to Stripe.');
    }
  } catch (error) {
    const text = errorMessage(error, 'Authentication failed.');
    if (!signUpMode && /verif/i.test(text)) {
      showVerification(emailInput.value.trim(), 'Enter the verification code sent to your email.');
    } else {
      setMessage(accountMessage, text, true);
    }
  } finally {
    authSubmit.disabled = false;
  }
});

authSwitch.addEventListener('click', () => {
  if (!signUpMode && !config.auth?.signupReady) {
    setMessage(accountMessage, 'New account registration is temporarily disabled pending data-protection approval.', true);
    return;
  }
  signUpMode = !signUpMode;
  updateAuthMode();
  setMessage(accountMessage, '');
});

showVerificationButton.addEventListener('click', () => {
  showVerification(emailInput.value.trim());
});

backToAuth.addEventListener('click', () => {
  showSignedOut();
  setMessage(accountMessage, '');
});

async function verifyEmail() {
  if (verificationInFlight) return;
  const otp = normalizeVerificationCode(verificationCodeInput.value);
  verificationCodeInput.value = otp;
  if (!isCompleteVerificationCode(otp) || !verificationEmailInput.checkValidity()) return;

  verificationInFlight = true;
  verificationSubmit.disabled = true;
  setMessage(accountMessage, 'Verifying email…');
  try {
    const email = verificationEmailInput.value.trim();
    const result = await authClient.emailOtp.verifyEmail({ email, otp });
    if (result?.error) throw new Error(errorMessage(result.error, 'Email verification failed.'));
    verificationCodeInput.value = '';
    await showSession();
    if (!currentUser) {
      signUpMode = false;
      updateAuthMode();
      showSignedOut();
      setMessage(accountMessage, 'Email verified. You can now sign in.');
    } else {
      setMessage(accountMessage, 'Email verified.');
    }
  } catch (error) {
    setMessage(accountMessage, errorMessage(error, 'Email verification failed.'), true);
  } finally {
    verificationInFlight = false;
    verificationSubmit.disabled = false;
  }
}

verificationForm.addEventListener('submit', event => {
  event.preventDefault();
  void verifyEmail();
});

function autoVerifyCompletedCode() {
  const normalized = normalizeVerificationCode(verificationCodeInput.value);
  if (verificationCodeInput.value !== normalized) verificationCodeInput.value = normalized;
  if (!isCompleteVerificationCode(normalized)) {
    lastAutoSubmittedVerification = '';
    return;
  }
  if (!verificationEmailInput.checkValidity()) return;

  const attempt = `${verificationEmailInput.value.trim().toLowerCase()}\n${normalized}`;
  if (attempt === lastAutoSubmittedVerification) return;
  lastAutoSubmittedVerification = attempt;
  verificationForm.requestSubmit();
}

verificationCodeInput.addEventListener('input', autoVerifyCompletedCode);
verificationCodeInput.addEventListener('change', autoVerifyCompletedCode);

resendVerification.addEventListener('click', async () => {
  resendVerification.disabled = true;
  try {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email: verificationEmailInput.value.trim(),
      type: 'email-verification',
    });
    if (result?.error) {
      throw new Error(errorMessage(result.error, 'A new code could not be requested.'));
    }
    lastAutoSubmittedVerification = '';
    verificationCodeInput.value = '';
    verificationCodeInput.focus();
    setMessage(
      accountMessage,
      'If this address is awaiting verification, a new code has been sent.',
    );
  } catch {
    setMessage(accountMessage, 'A new code could not be requested. Please try again shortly.', true);
  } finally {
    resendVerification.disabled = false;
  }
});

signOutButton.addEventListener('click', async () => {
  signOutButton.disabled = true;
  try {
    const result = await authClient.signOut();
    if (result?.error) throw new Error(errorMessage(result.error, 'Sign out failed.'));
    currentUser = null;
    await showSession();
  } catch (error) {
    setMessage(accountMessage, errorMessage(error, 'Sign out failed.'), true);
  } finally {
    signOutButton.disabled = false;
  }
});

refreshButton.addEventListener('click', refreshAccount);

authorizeExtensionButton.addEventListener('click', async () => {
  if (!extensionAuthorization) return;
  authorizeExtensionButton.disabled = true;
  setMessage(accountMessage, 'Connecting extension…');
  try {
    extensionAuthorization.deviceName = extensionDeviceName.value.trim();
    if (!extensionDeviceName.checkValidity() || !extensionAuthorization.deviceName) {
      extensionDeviceName.reportValidity();
      throw new Error('Enter a device name for this extension session.');
    }
    const result = await api('/api/extension-auth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extensionAuthorization),
    });
    const target = new URL(result.redirectUrl);
    const expected = new URL(extensionAuthorization.redirectUri);
    if (target.origin !== expected.origin
      || target.pathname !== expected.pathname
      || target.searchParams.get('state') !== extensionAuthorization.state
      || !target.searchParams.get('code')) {
      throw new Error('The extension authorization response was invalid.');
    }
    window.location.replace(target.toString());
  } catch (error) {
    setMessage(accountMessage, errorMessage(error, 'Extension connection failed.'), true);
    authorizeExtensionButton.disabled = false;
  }
});

portalButton.addEventListener('click', async () => {
  portalButton.disabled = true;
  try {
    const result = await api('/api/create-portal-session', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    window.location.assign(result.url);
  } catch (error) {
    setMessage(accountMessage, errorMessage(error, 'Billing management could not be opened.'), true);
    portalButton.disabled = false;
  }
});

downloadAccountDataButton.addEventListener('click', async () => {
  downloadAccountDataButton.disabled = true;
  setMessage(accountMessage, 'Preparing your account export…');
  try {
    const result = await api('/api/account/export');
    const blob = new Blob([`${JSON.stringify(result, null, 2)}\n`], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `aniwebscale-account-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
    setMessage(
      accountMessage,
      `Your account export from ${formattedDate(result.generatedAt)} was downloaded. Contact support if you also need provider-held records.`,
    );
  } catch (error) {
    setMessage(accountMessage, errorMessage(error, 'Account export failed.'), true);
  } finally {
    downloadAccountDataButton.disabled = false;
  }
});

revokeAllSessionsButton.addEventListener('click', async () => {
  if (!window.confirm('Sign out every browser and connected extension session?')) return;
  revokeAllSessionsButton.disabled = true;
  setMessage(securityMessage, 'Revoking all sessions…');
  try {
    const result = await api('/api/account/revoke-sessions', { method: 'POST' });
    await authClient.signOut().catch(() => undefined);
    window.location.replace(`/account?sessions_revoked=1&browser=${result.revokedBrowserSessions}&extension=${result.revokedExtensionSessions}`);
  } catch (error) {
    setMessage(securityMessage, errorMessage(error, 'Could not revoke account sessions.'), true);
    revokeAllSessionsButton.disabled = false;
  }
});

openDeleteAccountButton.addEventListener('click', () => {
  deleteAccountForm.reset();
  deleteConfirmationEmail.placeholder = currentUser?.email || 'you@example.com';
  setMessage(deleteAccountMessage, '');
  deleteAccountDialog.showModal();
  deleteConfirmationEmail.focus();
});

cancelDeleteAccountButton.addEventListener('click', () => {
  deleteAccountDialog.close();
});

deleteAccountDialog.addEventListener('cancel', event => {
  if (confirmDeleteAccountButton.disabled) event.preventDefault();
});

deleteAccountDialog.addEventListener('close', () => {
  if (confirmDeleteAccountButton.disabled) return;
  deleteAccountForm.reset();
  setMessage(deleteAccountMessage, '');
});

deleteAccountForm.addEventListener('submit', async event => {
  event.preventDefault();
  const confirmationEmail = deleteConfirmationEmail.value.trim().toLowerCase();
  const expectedEmail = String(currentUser?.email || '').trim().toLowerCase();
  if (!expectedEmail || confirmationEmail !== expectedEmail) {
    setMessage(deleteAccountMessage, 'The email does not match this account.', true);
    deleteConfirmationEmail.focus();
    return;
  }
  if (!deleteAcknowledgement.checked) {
    setMessage(deleteAccountMessage, 'Confirm that you understand the deletion is permanent.', true);
    deleteAcknowledgement.focus();
    return;
  }

  confirmDeleteAccountButton.disabled = true;
  cancelDeleteAccountButton.disabled = true;
  setMessage(deleteAccountMessage, 'Deleting your account and ending paid access…');
  try {
    await api('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmationEmail,
        password: deletePassword.value,
        acknowledged: true,
      }),
    });
    deletePassword.value = '';
    await authClient.signOut().catch(() => undefined);
    currentUser = null;
    window.location.replace('/account?deleted=1');
  } catch (error) {
    setMessage(deleteAccountMessage, errorMessage(error, 'Account deletion failed.'), true);
    deletePassword.value = '';
    deletePassword.focus();
  } finally {
    confirmDeleteAccountButton.disabled = false;
    cancelDeleteAccountButton.disabled = false;
  }
});

document.querySelectorAll('[data-account-plan]').forEach(button => {
  button.addEventListener('click', () => beginCheckout(button.dataset.accountPlan, button));
  if (button.dataset.accountPlan === requestedPlan) button.classList.add('selected');
});

async function init() {
  updateAuthMode();
  const response = await fetch('/api/config');
  config = await response.json();
  if (config.legal?.taxNotice) taxNotice.textContent = config.legal.taxNotice;
  if (!config.auth?.ready || !config.auth.url) {
    setAuthControlsDisabled(true);
    setMessage(accountMessage, 'Account authentication is not configured on this server yet.', true);
    return;
  }
  if (!config.auth?.signupReady) {
    signUpMode = false;
    updateAuthMode();
    authSwitch.hidden = true;
  }
  authClient = createNeonAuthClient(config.auth.url);
  await showSession();
  if (!currentUser && params.get('deleted') === '1') {
    setMessage(accountMessage, 'Your account has been permanently deleted.');
  } else if (!currentUser && params.get('sessions_revoked') === '1') {
    setMessage(accountMessage, 'All browser and extension sessions were revoked. Sign in again to continue.');
  }
  setAuthControlsDisabled(false);
}

init().catch(error => setMessage(accountMessage, errorMessage(error, 'Account page could not start.'), true));
