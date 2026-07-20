const root = document.documentElement;
root.classList.add('js');
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('#site-nav');
const toast = document.querySelector('.toast');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let config = null;
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 5000);
}

function preferredTheme() {
  const saved = localStorage.getItem('aniwebscale-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme, persist = false) {
  root.dataset.theme = theme;
  if (persist) localStorage.setItem('aniwebscale-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0a17' : '#f6f5f1');
  document.querySelector('.theme-button')?.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

setTheme(preferredTheme());
document.querySelector('.theme-button')?.addEventListener('click', () => {
  setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
});

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  nav?.classList.toggle('open', open);
});
nav?.addEventListener('click', event => {
  if (event.target.closest('a')) {
    menuButton?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }
});

document.querySelector('.gpu-notice a')?.addEventListener('click', () => {
  const requirements = document.querySelector('#gpu-requirements');
  if (requirements) requirements.open = true;
});

const observer = reduceMotion || !('IntersectionObserver' in window)
  ? null
  : new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(element => observer ? observer.observe(element) : element.classList.add('visible'));

const slider = document.querySelector('#compare-slider');
slider?.addEventListener('input', () => {
  const stage = slider.parentElement;
  const split = Math.round(Number(slider.value) / 5) * 5;
  for (const name of [...stage.classList]) if (name.startsWith('split-')) stage.classList.remove(name);
  stage.classList.add(`split-${split}`);
});

function currencyPrice(value) {
  return `${config?.prices.currency || '$'}${value}`;
}

function setExternalLink(selector, href) {
  const element = document.querySelector(selector);
  if (!element) return;
  if (href) {
    element.href = href;
    element.target = '_blank';
    element.rel = 'noopener';
  } else {
    element.setAttribute('aria-disabled', 'true');
    element.addEventListener('click', event => {
      event.preventDefault();
      showToast('This link has not been configured yet.');
    });
  }
}

function applyConfig() {
  if (!config) return;
  document.querySelector('[data-price="lifetime"]')?.replaceChildren(document.createTextNode(currencyPrice(config.prices.lifetime)));
  setExternalLink('[data-store="chrome"]', config.links.chrome);
  setExternalLink('[data-store="firefox"]', config.links.firefox);
  setExternalLink('[data-external="github"]', config.links.github);
  setExternalLink('[data-external="portal"]', config.links.portal);
  const emailLink = document.querySelector('[data-support-email]');
  if (emailLink && config.legal.email && !config.legal.email.startsWith('[')) emailLink.href = `mailto:${config.legal.email}`;
  const unavailable = !config.links.chrome && !config.links.firefox;
  document.querySelector('.availability-note')?.toggleAttribute('hidden', !unavailable);
  updateBilling(document.querySelector('.billing-toggle .active')?.dataset.billing || 'monthly');
}

function checkoutAvailable(plan) {
  if (plan === 'pro_monthly') return Boolean(config?.checkout?.proMonthly);
  if (plan === 'pro_yearly') return Boolean(config?.checkout?.proYearly);
  if (plan === 'lifetime') return Boolean(config?.checkout?.lifetime);
  return false;
}

function updateCheckoutAvailability() {
  const buttons = [...document.querySelectorAll('.checkout-button')];
  for (const button of buttons) {
    const available = checkoutAvailable(button.dataset.plan);
    button.disabled = !available;
    button.dataset.unavailable = String(!available);
    button.title = available ? '' : 'Checkout will open after Pro license activation is connected.';
  }
  const checkoutNote = document.querySelector('[data-checkout-note]');
  if (checkoutNote) {
    const ready = buttons.length > 0 && buttons.every(button => !button.disabled);
    checkoutNote.textContent = ready
      ? 'Secure checkout powered by Stripe. Cancel recurring Pro anytime.'
      : 'Pro checkout is being prepared. No payment is accepted until license activation is ready.';
  }
}

function updateBilling(period) {
  document.querySelectorAll('[data-billing]').forEach(button => button.classList.toggle('active', button.dataset.billing === period));
  const price = period === 'yearly' ? config?.prices.yearly || '41.99' : config?.prices.monthly || '4.99';
  const priceNode = document.querySelector('[data-price="pro"]');
  if (priceNode) priceNode.textContent = currencyPrice(price);
  const periodNode = document.querySelector('[data-period]');
  if (periodNode) periodNode.textContent = period === 'yearly' ? '/ year' : '/ month';
  const checkout = document.querySelector('.featured .checkout-button');
  if (checkout) checkout.dataset.plan = period === 'yearly' ? 'pro_yearly' : 'pro_monthly';
  updateCheckoutAvailability();
}

document.querySelector('.billing-toggle')?.addEventListener('click', event => {
  const button = event.target.closest('[data-billing]');
  if (button) updateBilling(button.dataset.billing);
});

async function startCheckout(button) {
  window.location.assign(`/account?plan=${encodeURIComponent(button.dataset.plan)}`);
}

document.querySelectorAll('.checkout-button').forEach(button => button.addEventListener('click', () => startCheckout(button)));

fetch('/api/config')
  .then(response => response.ok ? response.json() : Promise.reject(new Error('Config unavailable')))
  .then(value => { config = value; applyConfig(); })
  .catch(() => {
    config = { prices: { monthly: '4.99', yearly: '41.99', lifetime: '59.99', currency: '$' }, links: {}, legal: {} };
    applyConfig();
  });
