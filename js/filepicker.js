/* ====================================================================
   TF.FilePicker – induló képernyő: adatfájl megnyitása / létrehozása
==================================================================== */
window.TF = window.TF || {};

TF.FilePicker = (() => {
  const { esc, toast } = TF.UI;

  function render(container) {
    container.dataset.view = 'picker';
    document.getElementById('navbar-actions').innerHTML = '';

    if (!TF.Storage.isSupported()) {
      container.innerHTML = `
        <div class="fsp-shell">
          <div class="fsp-card">
            <div class="fsp-icon fsp-icon--warn"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h2 class="fsp-title">Nem támogatott böngésző</h2>
            <p class="fsp-sub">
              A fájlalapú tároláshoz a <strong>File System Access API</strong> szükséges,
              amelyet jelenleg a <strong>Chrome</strong> és az <strong>Edge</strong> böngészők támogatnak.<br>
              Kérlek, nyisd meg az alkalmazást ezek egyikében.
            </p>
          </div>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="fsp-shell">
        <div class="fsp-card">
          <div class="fsp-icon"><i class="fa-solid fa-flask-vial"></i></div>
          <h2 class="fsp-title">TestFlow</h2>
          <p class="fsp-sub">
            Az adatok egy általad választott <strong>.json fájlban</strong> tárolódnak a gépeden.<br>
            Nyiss meg egy meglévő fájlt, vagy hozz létre egy újat a kezdéshez.
          </p>
          <div class="fsp-actions">
            <button class="fsp-btn fsp-btn--primary" id="fsp-new">
              <span>Új adatfájl létrehozása</span>
              <small>Üres munkaterület, új .json fájl</small>
              <i class="fa-solid fa-file-circle-plus"></i>
            </button>
            <button class="fsp-btn fsp-btn--secondary" id="fsp-open">
              <span>Meglévő fájl megnyitása</span>
              <small>Korábban mentett .json fájl betöltése</small>
              <i class="fa-solid fa-folder-open"></i>
            </button>
          </div>
          <p class="fsp-note"><i class="fa-solid fa-shield-halved"></i> Az adatok soha nem hagyják el a gépedet – minden mentés közvetlenül a kiválasztott fájlba történik.</p>
        </div>
      </div>`;

    document.getElementById('fsp-new').addEventListener('click', () => pick('createNew'));
    document.getElementById('fsp-open').addEventListener('click', () => pick('openExisting'));
  }

  async function pick(method) {
    try {
      await TF.Storage[method]();
      updateNavbarIndicator();
      toast(`Adatfájl megnyitva: ${TF.Storage.getFileName()}`, 'success');
      TF.Router.go('/');
      TF.Router.refresh();
    } catch (e) {
      // A felhasználó által megszakított fájlválasztás nem hiba
      if (e?.name === 'AbortError') return;
      toast('Hiba: ' + e.message, 'danger');
    }
  }

  function updateNavbarIndicator() {
    const indicator = document.getElementById('navbar-file-indicator');
    if (TF.Storage.isReady()) {
      indicator.innerHTML = `<i class="fa-solid fa-file-code"></i> ${esc(TF.Storage.getFileName())}`;
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  }

  return { render, updateNavbarIndicator };
})();
