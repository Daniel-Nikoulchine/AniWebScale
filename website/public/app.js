const root = document.documentElement;
root.classList.add('js');
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('#site-nav');
const toast = document.querySelector('.toast');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

const emailLink = document.querySelector('[data-support-email]');
if (emailLink && !emailLink.getAttribute('href')?.startsWith('mailto:')) {
  emailLink.href = 'mailto:support@korrespont.com';
}

// Store listings are not live yet: the buttons are honest placeholders.
// Prevent the href="#" jump-to-top and give the user feedback instead.
document.querySelectorAll('.store-link').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const msg = document.documentElement.lang === 'de'
      ? 'Store-Listing folgt bald. Die Erweiterung ist noch nicht im Store verfügbar.'
      : 'Store listing coming soon. The extension is not yet available in the store.';
    showToast(msg);
  });
});
