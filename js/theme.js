/* ====================================================================
   TF.Theme – Dark / Light mode
   Állapot: localStorage-ben 'tf_theme' kulcson ('dark' | 'light')
   data-theme attribútum a <html> elemen, CSS változókat a [:root] és
   [data-theme="dark"] blokkok kezelik.
==================================================================== */
window.TF = window.TF || {};

TF.Theme = (() => {
  const KEY = 'tf_theme';

  function current() {
    return localStorage.getItem(KEY) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.title = theme === 'dark' ? 'Váltás világos módra' : 'Váltás sötét módra';
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    apply(next);
  }

  function init() {
    apply(current());
    document.getElementById('theme-toggle')
      ?.addEventListener('click', toggle);

    // OS prefers-color-scheme változásra reagál, ha a user nem állított be explicit témát
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', e => {
        if (!localStorage.getItem(KEY)) apply(e.matches ? 'dark' : 'light');
      });
  }

  return { init, current, toggle };
})();
