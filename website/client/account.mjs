import { createNeonAuthClient } from './neon-auth-client.mjs';

const signedOut = document.getElementById('signed-out');
const signedIn = document.getElementById('signed-in');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authSwitch = document.getElementById('auth-switch');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const accountEmail = document.getElementById('account-email');
const planName = document.getElementById('plan-name');
const planStatus = document.getElementById('plan-status');
const accountMessage = document.getElementById('account-message');
const checkoutMessage = document.getElementById('checkout-message');
const signOutButton = document.getElementById('sign-out');
const portalButton = document.getElementById('manage-billing');
const refreshButton = document.getElementById('refresh-license');

const params = new URLSearchParams(window.location.search);
const requestedPlan = ['pro_monthly', 'pro_yearly', 'lifetime'].includes(params.get('plan'))
  ? params.get('plan')
  : null;
let signUpMode = params.get('mode') === 'signup';
let config;
let authClient;
let currentUser = null;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function errorMessage(error, fallback) {
  return error?.message || error?.error?.message || fallback;
}

function updateAuthMode() {
  authTitle.textContent = signUpMode ? 'Create your account' : 'Sign in';
  authSubmit.textContent = signUpMode ? 'Create account' : 'Sign in';
  authSwitch.textContent = signUpMode
    ? 'Already have an account? Sign in'
    : 'New here? Create an account';
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
  if (!response.ok) throw new Error(body.error || 'The request failed.');
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
    planStatus.textContent = license.plan === 'free'
      ? 'Anime4K + WebGPU'
      : `${license.status === 'trialing' ? 'Trial' : 'Active'} · Native + AI + Frame generation`;
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

async function showSession() {
  const sessionResult = await authClient.getSession();
  currentUser = sessionResult?.data?.user || sessionResult?.data?.session?.user || null;
  signedOut.hidden = Boolean(currentUser);
  signedIn.hidden = !currentUser;
  if (!currentUser) return;
  accountEmail.textContent = currentUser.email || 'Signed-in account';
  await refreshAccount();
}

async function beginCheckout(plan, button) {
  const readyKey = plan === 'pro_monthly' ? 'proMonthly'
    : plan === 'pro_yearly' ? 'proYearly' : 'lifetime';
  if (!config.checkout?.[readyKey]) {
    return setMessage(checkoutMessage, 'Test checkout still needs the local Stripe and webhook secrets.', true);
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
      body: JSON.stringify({ plan }),
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
  authSubmit.disabled = true;
  setMessage(accountMessage, signUpMode ? 'Creating account…' : 'Signing in…');
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const result = signUpMode
      ? await authClient.signUp.email({ email, password, name: email.split('@')[0] || 'AniWebScale user' })
      : await authClient.signIn.email({ email, password });
    if (result?.error) throw new Error(errorMessage(result.error, 'Authentication failed.'));
    passwordInput.value = '';
    await showSession();
    if (requestedPlan) {
      document.querySelector(`[data-account-plan="${requestedPlan}"]`)?.focus();
      setMessage(checkoutMessage, 'Account ready. Confirm the plan below to continue to Stripe.');
    }
  } catch (error) {
    setMessage(accountMessage, errorMessage(error, 'Authentication failed.'), true);
  } finally {
    authSubmit.disabled = false;
  }
});

authSwitch.addEventListener('click', () => {
  signUpMode = !signUpMode;
  updateAuthMode();
  setMessage(accountMessage, '');
});

signOutButton.addEventListener('click', async () => {
  await authClient.signOut();
  currentUser = null;
  await showSession();
});

refreshButton.addEventListener('click', refreshAccount);

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

document.querySelectorAll('[data-account-plan]').forEach(button => {
  button.addEventListener('click', () => beginCheckout(button.dataset.accountPlan, button));
  if (button.dataset.accountPlan === requestedPlan) button.classList.add('selected');
});

async function init() {
  updateAuthMode();
  const response = await fetch('/api/config');
  config = await response.json();
  if (!config.auth?.ready || !config.auth.url) {
    authForm.querySelectorAll('input, button').forEach(element => { element.disabled = true; });
    setMessage(accountMessage, 'Account authentication is not configured on this server yet.', true);
    return;
  }
  authClient = createNeonAuthClient(config.auth.url);
  await showSession();
}

init().catch(error => setMessage(accountMessage, errorMessage(error, 'Account page could not start.'), true));
