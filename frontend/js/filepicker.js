/* ====================================================================
   TF.FilePicker – REST API módban nincs fájlválasztás.
   Az alkalmazás egyből a főoldalra megy.
==================================================================== */
window.TF = window.TF || {};

TF.FilePicker = (() => {

  function render(container) {
    // REST módban azonnal a főoldalra irányítunk
    TF.Router.go('/');
  }

  function updateNavbarIndicator() {
    const el = document.getElementById('navbar-file-indicator');
    if (el) {
      el.textContent = '● API';
      el.classList.remove('hidden');
      el.title = 'REST API kapcsolat aktív';
      el.style.color = '#00A878';
    }
  }

  return { render, updateNavbarIndicator };
})();
