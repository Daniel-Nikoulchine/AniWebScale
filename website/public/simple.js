const savedTheme = localStorage.getItem('aniwebscale-theme') || localStorage.getItem('anime4k-theme');
const theme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#20263a' : '#fffaf3');
