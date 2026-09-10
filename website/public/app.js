const root = document.documentElement;
root.classList.add('js');
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('#site-nav');
const toast = document.querySelector('.toast');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer;

// Catalog lookup exposed by site-localize.js once the locale JSON is loaded;
// falls back to plain English until then (or if localization is unavailable).
function translate(key, fallback) {
  return typeof window.aniwebscaleT === 'function' ? window.aniwebscaleT(key, fallback) : fallback;
}

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
  document.querySelector('.theme-button')?.setAttribute('aria-label', theme === 'dark'
    ? translate('switchLightTheme', 'Switch to light theme')
    : translate('switchDarkTheme', 'Switch to dark theme'));
}

setTheme(preferredTheme());
// Re-apply the now-translatable theme label once the catalog has loaded.
window.addEventListener('aniwebscale:localized', () => setTheme(root.dataset.theme));
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
  for (const id of ['#gpu-requirements', '#protected-video']) document.querySelector(id)?.setAttribute('open', '');
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

// One-time slider hint: sweep 20 → 50 on first reveal so visitors discover
// the comparison. Skipped for reduced motion; any user input takes over.
if (slider && !reduceMotion && 'IntersectionObserver' in window) {
  let hintFinished = false;
  let hintCancelled = false;
  const cancelHint = () => { hintCancelled = true; };
  slider.addEventListener('pointerdown', cancelHint, { once: true });
  slider.addEventListener('keydown', cancelHint, { once: true });
  const setSplit = value => {
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const hintObserver = new IntersectionObserver(entries => {
    if (hintFinished || !entries.some(entry => entry.isIntersecting)) return;
    hintFinished = true;
    hintObserver.disconnect();
    setSplit(20);
    const startedAt = performance.now();
    const duration = 900;
    const frame = now => {
      if (hintCancelled) { setSplit(50); return; }
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 2);
      setSplit(Math.round(20 + (50 - 20) * eased));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, { threshold: 0.4 });
  hintObserver.observe(slider.parentElement);
}

const emailLink = document.querySelector('[data-support-email]');
if (emailLink && !emailLink.getAttribute('href')?.startsWith('mailto:')) {
  emailLink.href = 'mailto:support@korrespont.com';
}

// Store listings are not live yet: the buttons are honest placeholders.
// Prevent the href="#" jump-to-top and give the user feedback instead.
document.querySelectorAll('.store-link').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    showToast(translate('storeComingSoon', 'Store listing coming soon. The extension is not yet available in the store.'));
  });
});
