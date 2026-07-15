/* ====================================================================
   TF.Views.Home – Főoldal (halmazok listája) + halmaz modal +
   teljes halmaz import
==================================================================== */
window.TF = window.TF || {};
TF.Views = TF.Views || {};

TF.Views.Home = (() => {
  const { esc, toast, openModal, closeModal, confirm, getStats } = TF.UI;

  let editingSuiteId = null;
  let importSuiteData = null;

  /* ---------- rendezés ---------- */
  let _sortMode = 'status'; // 'status' | 'name' | 'count'

  function sortedSuites(suites) {
    const copy = [...suites];
    if (_sortMode === 'name') {
      copy.sort((a, b) => a.name.localeCompare(b.name, 'hu'));
    } else if (_sortMode === 'count') {
      copy.sort((a, b) => (b.testCases?.length || 0) - (a.testCases?.length || 0));
    } else {
      // status: STATUSES index szerint, ismeretlen / üres a végére
      copy.sort((a, b) => {
        const ai = getStatusIndex(a.status);
        const bi = getStatusIndex(b.status);
        const an = ai < 0 ? 999 : ai;
        const bn = bi < 0 ? 999 : bi;
        return an - bn || a.name.localeCompare(b.name, 'hu');
      });
    }
    return copy;
  }

  /* ---------- render ---------- */

  async function render(container) {
    container.dataset.view = 'home';
    const suites = await TF.Storage.getSuites();

    document.getElementById('navbar-actions').innerHTML = `
      <button class="btn btn-light btn-sm" id="btn-import-suite-home">
        <i class="fa-solid fa-file-import"></i> Halmaz importálása
      </button>`;
    document.getElementById('btn-import-suite-home')
      .addEventListener('click', openImportSuiteModal);

    if (!suites.length) {
      container.innerHTML = `
        <div class="page-header">
          <h1>Teszteset Halmazok</h1>
          <p>Hozz létre és kezelj tesztelési halmazokat, majd indítsd el a tesztelést!</p>
        </div>
        <div class="empty-state">
          <i class="fa-solid fa-flask-vial"></i>
          <h3>Még nincsenek teszteset halmazok</h3>
          <p>Kattints az alábbi gombra az első halmaz létrehozásához.</p>
          <button class="btn btn-primary btn-lg" data-action="new-suite" style="margin-top:1.5rem;">
            <i class="fa-solid fa-plus"></i> Első halmaz létrehozása
          </button>
        </div>`;
    } else {
      const displayed = sortedSuites(suites);
      container.innerHTML = `
        <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:.75rem;">
          <div>
            <h1>Teszteset Halmazok</h1>
            <p>Hozz létre és kezelj tesztelési halmazokat, majd indítsd el a tesztelést!</p>
          </div>
          <div class="sort-controls">
            <span class="sort-label">Rendezés:</span>
            <button class="sort-btn ${_sortMode==='status'?'is-active':''}" data-sort="status"><i class="fa-solid fa-arrow-down-short-wide"></i> Állapot</button>
            <button class="sort-btn ${_sortMode==='name'?'is-active':''}" data-sort="name"><i class="fa-solid fa-arrow-down-a-z"></i> ABC</button>
            <button class="sort-btn ${_sortMode==='count'?'is-active':''}" data-sort="count"><i class="fa-solid fa-list-ol"></i> Tesztesetek</button>
          </div>
        </div>
        <div class="suite-grid" id="suite-grid">
          ${displayed.map(suiteCard).join('')}
          <button class="add-suite-btn-card" data-action="new-suite">
            <i class="fa-solid fa-plus"></i>
            <span>Új Teszteset Halmaz</span>
          </button>
        </div>`;
    }

    bindEvents(container);
  }

  /* ---------- beépített folyamatstátuszok ---------- */
  const STATUSES = [
    { key: 'Új',                    color: '#718096', bg: '#F7F8FA' },
    { key: 'Tervezés alatt',        color: '#3A10E5', bg: '#F0EDFF' },
    { key: 'Tesztelésre kész',      color: '#B88700', bg: '#FFF6D6' },
    { key: 'Tesztelés alatt',       color: '#E94560', bg: '#FDE8EE' },
    { key: 'Tesztelés befejezve',   color: '#00A878', bg: '#E6F7F1' },
    { key: 'Clickupba felvéve',     color: '#8B5CF6', bg: '#F5F3FF' },
    { key: 'Kész',                  color: '#059669', bg: '#D1FAE5' },
  ];

  function getStatusIndex(status) {
    return STATUSES.findIndex(s => s.key === status);
  }

  function statusBanner(suite) {
    const idx = getStatusIndex(suite.status);
    const current = idx >= 0 ? STATUSES[idx] : null;
    const hasPrev = idx > 0;
    const hasNext = idx < STATUSES.length - 1 && idx >= 0;
    const isNoStatus = idx < 0;

    if (isNoStatus && !suite.status) {
      // Nincs státusz: kattintható "Státusz hozzáadása" gomb
      return `<button class="status-banner status-banner--empty" data-action="status-step" data-suite-id="${esc(suite.id)}" data-dir="next-from-none">
        <i class="fa-solid fa-plus"></i> Státusz hozzáadása
      </button>`;
    }

    const label = current ? current.key : (suite.status || '');
    const color = current ? current.color : '#718096';
    const bg    = current ? current.bg    : '#F7F8FA';

    return `
      <div class="status-banner" style="--s-color:${color};--s-bg:${bg};" data-suite-id="${esc(suite.id)}">
        <button class="status-banner__arrow status-banner__arrow--left ${hasPrev ? '' : 'invisible'}"
          data-action="status-step" data-suite-id="${esc(suite.id)}" data-dir="prev"
          title="Előző állapot" aria-label="Előző állapot">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="status-banner__label">${esc(label)}</span>
        <button class="status-banner__arrow status-banner__arrow--right ${hasNext ? '' : 'invisible'}"
          data-action="status-step" data-suite-id="${esc(suite.id)}" data-dir="next"
          title="Következő állapot" aria-label="Következő állapot">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>`;
  }

  function suiteCard(suite) {
    const stats = getStats(suite.testCases);
    const total = suite.testCases?.length || 0;
    const done = stats.s + stats.f + stats.d;
    const pct = total ? Math.round((done / total) * 100) : 0;

    // Státusz badge a fejléchez (kompakt, inline)
    const idx = getStatusIndex(suite.status);
    const st  = idx >= 0 ? STATUSES[idx] : null;
    const hasPrev = idx > 0;
    const hasNext = idx < STATUSES.length - 1 && idx >= 0;
    const noStatus = !suite.status;

    const statusInHeader = noStatus
      ? `<button class="card-status-badge card-status-badge--empty"
           data-action="status-step" data-suite-id="${esc(suite.id)}" data-dir="next-from-none"
           title="Státusz hozzáadása">
           <i class="fa-solid fa-plus"></i>
         </button>`
      : `<div class="card-status-badge" style="--s-color:${st ? st.color : '#718096'};--s-bg:${st ? st.bg : '#F7F8FA'};">
           <button class="card-status-arrow ${hasPrev ? '' : 'invisible'}"
             data-action="status-step" data-suite-id="${esc(suite.id)}" data-dir="prev"
             title="Előző állapot">
             <i class="fa-solid fa-chevron-left"></i>
           </button>
           <span class="card-status-label">${esc(st ? st.key : suite.status)}</span>
           <button class="card-status-arrow ${hasNext ? '' : 'invisible'}"
             data-action="status-step" data-suite-id="${esc(suite.id)}" data-dir="next"
             title="Következő állapot">
             <i class="fa-solid fa-chevron-right"></i>
           </button>
         </div>`;

    return `
      <div class="suite-card ${suite.isCompleted ? 'is-completed' : ''}"
           data-suite-id="${esc(suite.id)}"
           tabindex="0" role="button"
           aria-label="${esc(suite.name)} megnyitása"
           draggable="true">
        <div class="suite-card-header">
          <div class="suite-card-drag-handle" title="Húzd a kártya átrendezéséhez"><i class="fa-solid fa-grip-vertical"></i></div>
          <div class="suite-card-header-title">${esc(suite.name)}</div>
          ${statusInHeader}
        </div>
        <div class="suite-card-body">
          <div class="suite-meta">
            ${suite.clickupId ? `<span class="suite-meta-item clickup-id-badge"><i class="fa-solid fa-link"></i> ${esc(suite.clickupId)}</span>` : ''}
            <span class="suite-meta-item"><i class="fa-solid fa-list-check"></i> ${total} teszteset</span>
            ${suite.isCompleted ? `<span class="suite-meta-item" style="color:var(--green);"><i class="fa-solid fa-circle-check"></i> Kész</span>` : ''}
          </div>
          ${suite.notes ? `<div class="suite-notes">${esc(suite.notes)}</div>` : ''}
          ${total > 0 ? `
          <div class="test-progress">
            <div class="test-progress-label"><span>Lefedettség</span><span>${pct}%</span></div>
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="stat-pills">
            ${stats.s ? `<span class="stat-pill success">${stats.s} Sikeres</span>` : ''}
            ${stats.f ? `<span class="stat-pill danger">${stats.f} Sikertelen</span>` : ''}
            ${stats.d ? `<span class="stat-pill warning">${stats.d} Megbeszélés</span>` : ''}
            ${stats.n ? `<span class="stat-pill neutral">${stats.n} Nincs értékelés</span>` : ''}
          </div>` : ''}
        </div>
        <div class="suite-card-footer">
          <button class="btn btn-primary btn-sm" data-action="open-suite" data-id="${esc(suite.id)}"><i class="fa-solid fa-folder-open"></i> Megnyitás</button>
          <button class="btn btn-light btn-sm" data-action="edit-suite" data-id="${esc(suite.id)}"><i class="fa-solid fa-pen"></i> Szerkesztés</button>
          <button class="btn btn-light btn-sm" data-action="duplicate-suite" data-id="${esc(suite.id)}" title="Duplikálás" aria-label="Duplikálás"><i class="fa-solid fa-copy"></i></button>
          <button class="btn btn-danger btn-sm" data-action="delete-suite" data-id="${esc(suite.id)}" aria-label="Törlés"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  /* ---------- események (delegálva, EGYSZER kötve a tartós konténerre) ----------
     A #app-view elem render-ek között megmarad (csak az innerHTML cserélődik),
     így a delegált listener nem halmozódik. */

  let _bound = false;

  function bindEvents(container) {
    if (_bound) return;
    _bound = true;

    container.addEventListener('click', e => {
      if (container.dataset.view !== 'home') return;

      // Rendezés gombok
      const sortBtn = e.target.closest('[data-sort]');
      if (sortBtn) {
        _sortMode = sortBtn.dataset.sort;
        TF.Router.refresh();
        return;
      }

      const actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        const { action, id } = actionEl.dataset;
        if (action === 'new-suite') return openNewSuiteModal();
        if (action === 'open-suite') { e.stopPropagation(); return TF.Router.go(`/suite/${id}`); }
        if (action === 'edit-suite') { e.stopPropagation(); return openEditSuiteModal(id); }
        if (action === 'delete-suite') { e.stopPropagation(); return deleteSuite(id); }
        if (action === 'duplicate-suite') { e.stopPropagation(); return duplicateSuite(id); }
        if (action === 'status-step') {
          e.stopPropagation();
          return stepStatus(actionEl.dataset.suiteId, actionEl.dataset.dir);
        }
      }
      const card = e.target.closest('.suite-card');
      if (card) TF.Router.go(`/suite/${card.dataset.suiteId}`);
    });

    container.addEventListener('keydown', e => {
      if (container.dataset.view !== 'home') return;
      if (e.key === 'Enter' && e.target.classList.contains('suite-card')) {
        TF.Router.go(`/suite/${e.target.dataset.suiteId}`);
      }
    });

    // ---- Suite kártya drag-and-drop ----
    let _dragSuiteId = null;
    let _dragOverId  = null;
    let _scrollRaf   = null;

    function _dragScroll(e) {
      const ZONE = 100, SPEED = 12;
      const y = e.clientY;
      const vh = window.innerHeight;
      cancelAnimationFrame(_scrollRaf);
      if (y < ZONE) {
        const step = () => { window.scrollBy(0, -SPEED); _scrollRaf = requestAnimationFrame(step); };
        _scrollRaf = requestAnimationFrame(step);
      } else if (y > vh - ZONE) {
        const step = () => { window.scrollBy(0, SPEED); _scrollRaf = requestAnimationFrame(step); };
        _scrollRaf = requestAnimationFrame(step);
      }
    }

    container.addEventListener('dragstart', e => {
      if (container.dataset.view !== 'home') return;
      const card = e.target.closest('.suite-card[data-suite-id]');
      if (!card) return;
      _dragSuiteId = card.dataset.suiteId;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', _dragSuiteId);
    });

    container.addEventListener('dragend', () => {
      cancelAnimationFrame(_scrollRaf); _scrollRaf = null;
      container.querySelectorAll('.suite-card').forEach(c =>
        c.classList.remove('is-dragging', 'drag-over'));
      _dragSuiteId = null;
      _dragOverId  = null;
    });

    container.addEventListener('dragover', e => {
      if (container.dataset.view !== 'home') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      _dragScroll(e);
      const card = e.target.closest('.suite-card[data-suite-id]');
      if (!card || card.dataset.suiteId === _dragSuiteId) return;
      if (card.dataset.suiteId !== _dragOverId) {
        container.querySelectorAll('.suite-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
        _dragOverId = card.dataset.suiteId;
      }
    });

    container.addEventListener('dragleave', e => {
      const card = e.target.closest('.suite-card[data-suite-id]');
      if (card && !card.contains(e.relatedTarget)) card.classList.remove('drag-over');
    });

    container.addEventListener('drop', async e => {
      if (container.dataset.view !== 'home') return;
      e.preventDefault();
      const targetCard = e.target.closest('.suite-card[data-suite-id]');
      if (!targetCard || !_dragSuiteId || targetCard.dataset.suiteId === _dragSuiteId) return;

      const suites = await TF.Storage.getSuites();
      const fromIdx = suites.findIndex(s => s.id === _dragSuiteId);
      const toIdx   = suites.findIndex(s => s.id === targetCard.dataset.suiteId);
      if (fromIdx < 0 || toIdx < 0) return;

      const [moved] = suites.splice(fromIdx, 1);
      suites.splice(toIdx, 0, moved);

      try {
        await TF.Storage.saveSuites(suites);
        TF.Router.refresh();
      } catch (err) {
        TF.UI.toast('Mentési hiba: ' + err.message, 'danger');
      }
    });
  }

  /* ---------- státusz léptető ---------- */

  async function stepStatus(suiteId, dir) {
    const suite = await TF.Storage.getSuite(suiteId);
    if (!suite) return;
    const idx = getStatusIndex(suite.status);

    let newIdx;
    if (dir === 'next-from-none') {
      newIdx = 0;
    } else if (dir === 'prev') {
      newIdx = Math.max(0, idx - 1);
    } else {
      newIdx = Math.min(STATUSES.length - 1, idx + 1);
    }

    suite.status = STATUSES[newIdx].key;
    try {
      await TF.Storage.upsertSuite(suite);
      TF.Router.refresh();
    } catch (e) {
      toast('Mentési hiba: ' + e.message, 'danger');
    }
  }

  /* ---------- halmaz duplikálása ---------- */

  async function duplicateSuite(id) {
    const orig = await TF.Storage.getSuite(id);
    if (!orig) { TF.UI.toast('A halmaz nem található.', 'danger'); return; }
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = TF.Storage.genId('suite');
    copy.name = `${orig.name} – másolat`;
    copy.isCompleted = false;
    delete copy.testSession;
    // TC-k ID-jait is regeneráljuk, hogy ne legyen ütközés
    copy.testCases = copy.testCases.map(tc => ({
      ...tc,
      evaluation: '',
      actualResult: ''
    }));
    try {
      await TF.Storage.upsertSuite(copy);
      TF.UI.toast(`„${orig.name}" duplikálva!`, 'success');
      TF.Router.refresh();
    } catch(e) {
      TF.UI.toast('Hiba: ' + e.message, 'danger');
    }
  }

  /* ---------- halmaz modal ---------- */

  function openNewSuiteModal() {
    editingSuiteId = null;
    document.getElementById('modal-suite-title').textContent = 'Új Teszteset Halmaz';
    document.getElementById('suite-name').value = '';
    document.getElementById('suite-notes').value = '';
    document.getElementById('suite-status').value = '';
    document.getElementById('suite-clickup-id').value = '';
    openModal('modal-suite');
    document.getElementById('suite-name').focus();
  }

  async function openEditSuiteModal(id) {
    const suite = await TF.Storage.getSuite(id);
    if (!suite) { toast('A halmaz nem található.', 'danger'); return; }
    editingSuiteId = id;
    document.getElementById('modal-suite-title').textContent = 'Halmaz szerkesztése';
    document.getElementById('suite-name').value = suite.name;
    document.getElementById('suite-notes').value = suite.notes || '';
    document.getElementById('suite-status').value = suite.status || '';
    document.getElementById('suite-clickup-id').value = suite.clickupId || '';
    openModal('modal-suite');
  }

  async function saveSuite() {
    const name = document.getElementById('suite-name').value.trim();
    if (!name) { toast('A halmaz neve kötelező!', 'danger'); return; }
    const notes     = document.getElementById('suite-notes').value.trim();
    const status    = document.getElementById('suite-status').value.trim();
    const clickupId = document.getElementById('suite-clickup-id').value.trim();

    // ClickUp ID formátum validálás (DXP-{szám}), ha van megadva
    if (clickupId && !/^DXP-\d+$/i.test(clickupId)) {
      toast('A ClickUp ID formátuma: DXP-{szám} (pl. DXP-123)', 'danger');
      return;
    }

    try {
      if (editingSuiteId) {
        const suite = await TF.Storage.getSuite(editingSuiteId);
        if (!suite) { toast('A halmaz időközben törlődött.', 'danger'); closeModal('modal-suite'); return; }
        suite.name = name; suite.notes = notes; suite.status = status;
        suite.clickupId = clickupId.toUpperCase();
        await TF.Storage.upsertSuite(suite);
        toast('Halmaz frissítve!', 'success');
      } else {
        await TF.Storage.upsertSuite({
          id: TF.Storage.genId('suite'),
          name, notes, status,
          clickupId: clickupId.toUpperCase(),
          testCases: [], isCompleted: false
        });
        toast('Halmaz létrehozva!', 'success');
      }
      closeModal('modal-suite');
      TF.Router.refresh();
    } catch (e) {
      toast('Mentési hiba: ' + e.message, 'danger');
    }
  }

  async function deleteSuite(id) {
    const suite = await TF.Storage.getSuite(id);
    if (!suite) { toast('A halmaz nem található.', 'danger'); return; }
    const ok = await confirm('Halmaz törlése',
      `Biztosan törlöd a(z) „${suite.name}" halmazt és az összes benne lévő tesztesetet? A művelet nem vonható vissza.`);
    if (!ok) return;
    try {
      await TF.Storage.deleteSuite(id);
      toast('Halmaz törölve.', 'danger');
      TF.Router.refresh();
    } catch (e) {
      toast('Törlési hiba: ' + e.message, 'danger');
    }
  }

  /* ---------- teljes halmaz import ---------- */

  function openImportSuiteModal() {
    importSuiteData = null;
    const fileInput = document.getElementById('import-suite-file');
    const preview = document.getElementById('import-suite-preview');
    const nameEl = document.getElementById('import-suite-file-name');
    fileInput.value = '';
    if (nameEl) nameEl.textContent = 'Fájl kiválasztása…';
    preview.classList.add('hidden');
    preview.innerHTML = '';
    document.getElementById('btn-do-import-suite').disabled = true;
    openModal('modal-import-suite');
  }

  async function handleSuiteFileSelected(e) {
    const file = e.target.files[0];
    const importBtn = document.getElementById('btn-do-import-suite');
    const preview = document.getElementById('import-suite-preview');
    const nameEl = document.getElementById('import-suite-file-name');
    importSuiteData = null;
    importBtn.disabled = true;
    if (!file) return;

    if (nameEl) nameEl.textContent = file.name;

    try {
      const parsed = await TF.Excel.parseSuiteFile(file);
      importSuiteData = parsed;
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <div class="info-box" style="flex-direction:column;align-items:stretch;">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;">
            <i class="fa-solid fa-circle-check" style="color:var(--green);"></i>
            <strong>Fájl sikeresen beolvasva – előnézet:</strong>
          </div>
          <table class="preview-table">
            <tr><td>Halmaz neve:</td><td><strong>${esc(parsed.meta.name)}</strong></td></tr>
            ${parsed.meta.status ? `<tr><td>Státusz:</td><td>${esc(parsed.meta.status)}</td></tr>` : ''}
            <tr><td>Tesztesetek:</td><td><strong>${parsed.testCases.length} db</strong></td></tr>
            <tr><td>Befejezett:</td><td>${parsed.meta.isCompleted ? 'Igen' : 'Nem'}</td></tr>
          </table>
        </div>`;
      importBtn.disabled = false;
    } catch (err) {
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <div class="warn-box">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Hiba a fájl olvasásakor: ${esc(err.message)}</span>
        </div>`;
    }
  }

  async function doImportSuite() {
    if (!importSuiteData) return;
    const { meta, testCases } = importSuiteData;
    try {
      await TF.Storage.upsertSuite({
        id: TF.Storage.genId('suite'),
        name: meta.name,
        notes: meta.notes,
        status: meta.status,
        isCompleted: meta.isCompleted,
        testCases
      });
      closeModal('modal-import-suite');
      toast(`„${meta.name}" halmaz importálva (${testCases.length} teszteset)!`, 'success');
      TF.Router.go('/');
      TF.Router.refresh();
    } catch (e) {
      toast('Mentési hiba: ' + e.message, 'danger');
    }
  }

  /* ---------- statikus elemek bekötése (egyszer fut) ---------- */

  function initStatic() {
    document.getElementById('btn-save-suite').addEventListener('click', saveSuite);
    document.getElementById('import-suite-file').addEventListener('change', handleSuiteFileSelected);
    document.getElementById('btn-do-import-suite').addEventListener('click', doImportSuite);
  }

  return { render, initStatic, openEditSuiteModal };
})();
