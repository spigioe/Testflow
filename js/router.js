/* ====================================================================
   TF.Router – hash-alapú SPA router
   Útvonalak:
     #/              → főoldal (halmazok)
     #/suite/:id     → halmaz nézet
   Ha nincs megnyitott adatfájl, minden útvonal a fájlválasztóra esik.
   A hash-routing miatt a böngésző vissza/előre gombja is működik.
==================================================================== */
window.TF = window.TF || {};

TF.Router = (() => {
  const view = () => document.getElementById('app-view');

  function parseHash() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const suiteMatch = hash.match(/^\/suite\/(.+)$/);
    if (suiteMatch) return { name: 'suite', suiteId: decodeURIComponent(suiteMatch[1]) };
    return { name: 'home' };
  }

  async function handleRoute() {
    const container = view();

    // Sticky bar cleanup minden navigációnál
    document.getElementById('sticky-bar')?.remove();
    if (container._stickyCleanup) { container._stickyCleanup(); container._stickyCleanup = null; }
    // Batch bar és undo float elrejtése navigációkor
    document.getElementById('batch-bar')?.classList.add('hidden');
    document.getElementById('undo-float-btn')?.classList.add('hidden');

    // Nincs adatfájl → fájlválasztó képernyő, útvonaltól függetlenül
    if (!TF.Storage.isReady()) {
      TF.FilePicker.render(container);
      return;
    }

    const route = parseHash();
    try {
      if (route.name === 'suite') {
        await TF.Views.Suite.render(container, route.suiteId);
      } else {
        await TF.Views.Home.render(container);
      }
    } catch (e) {
      TF.UI.toast('Hiba a nézet betöltésekor: ' + e.message, 'danger');
    }
  }

  function go(path) {
    const target = '#' + path;
    if (location.hash === target) handleRoute(); // ugyanaz az útvonal → újrarender
    else location.hash = target;
  }

  function refresh() { handleRoute(); }

  function init() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  return { init, go, refresh };
})();
