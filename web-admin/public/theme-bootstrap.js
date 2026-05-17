// Theme bootstrap — applied before React hydrates to avoid FOUC.
// Default to dark; light is opt-in via toggle in localStorage.
//
// External file (not inline) so the strict CSP `script-src 'self'`
// doesn't reject it. Vite copies public/* to dist/ during build, so
// Express serves this from the same origin.
(function () {
  try {
    var stored = localStorage.getItem('qtassist-theme');
    var theme = stored === 'light' ? 'light' : 'dark';
    if (theme === 'dark') document.documentElement.classList.add('dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', theme === 'dark' ? '#08161c' : '#fafaf6');
  } catch (_) {}
})();
