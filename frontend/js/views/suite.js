/* ====================================================================
   TF.Views.Suite – Halmaz nézet (tesztesetek listája, CRUD,
   Excel import/export, formátum útmutató)
==================================================================== */
window.TF = window.TF || {};
TF.Views = TF.Views || {};

TF.Views.Suite = (() => {
  const { esc, toast, openModal, closeModal, confirm, getStats, evalBadge, stepsHtml } = TF.UI;

  let currentSuiteId = null;
  let editingTcId = null;
  let activeFilters = new Set(); // 'Sikeres' | 'Sikertelen' | 'Megbeszélésre vár' | 'pending'

  /* ---------- render ---------- */

  async function render(container, suiteId) {
    container.dataset.view = 'suite';
    currentSuiteId = suiteId;
    activeFilters = new Set(); // szűrő reset oldalváltáskor
    const suite = await TF.Storage.getSuite(suiteId);
    if (!suite) {
      toast('A halmaz nem található.', 'danger');
      TF.Router.go('/');
      return;
    }

    document.getElementById('navbar-actions').innerHTML = `
      <button class="btn btn-light btn-sm" data-action="start-test" ${!suite.testCases.length ? 'disabled' : ''}>
        <i class="fa-solid fa-play"></i> Tesztelés indítása
      </button>`;

    const stats = getStats(suite.testCases);
    const total = suite.testCases.length;

    container.innerHTML = `
      <div class="breadcrumb-nav">
        <a href="#/">~/főoldal</a>
        <span class="sep">/</span>
        <span>${esc(suite.name)}</span>
      </div>

      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div>
          <h1 style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
            ${esc(suite.name)}
            ${suite.isCompleted ? `<span class="eval-badge success"><i class="fa-solid fa-circle-check"></i> Befejezett</span>` : ''}
          </h1>
          <p>${suite.notes ? esc(suite.notes) : '<span class="text-muted">Nincs megjegyzés</span>'}${suite.status ? ` &nbsp;·&nbsp; <strong>${esc(suite.status)}</strong>` : ''}</p>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
          ${suite.clickupId ? `
          <a class="btn btn-clickup btn-sm"
             href="https://app.clickup.com/t/2608008/${esc(suite.clickupId)}"
             target="_blank" rel="noopener noreferrer"
             title="Megnyitás ClickUpban: ${esc(suite.clickupId)}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> ${esc(suite.clickupId)} megnyitása
          </a>` : ''}
          <button class="btn btn-light btn-sm" data-action="edit-suite"><i class="fa-solid fa-pen"></i> Szerkesztés</button>
          <button class="btn btn-light btn-sm" data-action="open-revert" title="Halmaz visszaállítása – összes eredmény törlése">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </button>
        </div>
      </div>

      ${total > 0 ? `
      <div class="tc-toolbar filter-toolbar" id="filter-toolbar" style="justify-content:space-between;">
        <div class="stat-pills" id="filter-pills">
          <button class="stat-pill neutral" data-filter="all" title="Összes mutatása">
            <i class="fa-solid fa-list"></i> ${total} összesen
          </button>
          ${stats.s ? `<button class="stat-pill filterable success" data-filter="Sikeres" title="Szűrés: Sikeres">
            <i class="fa-solid fa-circle-check"></i> ${stats.s} Sikeres
            <span class="pill-remove-hint"><i class="fa-solid fa-xmark"></i> eltávolít</span>
          </button>` : ''}
          ${stats.f ? `<button class="stat-pill filterable danger" data-filter="Sikertelen" title="Szűrés: Sikertelen">
            <i class="fa-solid fa-circle-xmark"></i> ${stats.f} Sikertelen
            <span class="pill-remove-hint"><i class="fa-solid fa-xmark"></i> eltávolít</span>
          </button>` : ''}
          ${stats.d ? `<button class="stat-pill filterable warning" data-filter="Megbeszélésre vár" title="Szűrés: Megbeszélésre vár">
            <i class="fa-solid fa-comments"></i> ${stats.d} Megbeszélés
            <span class="pill-remove-hint"><i class="fa-solid fa-xmark"></i> eltávolít</span>
          </button>` : ''}
          ${stats.n ? `<button class="stat-pill filterable neutral" data-filter="pending" title="Szűrés: Nincs értékelés">
            <i class="fa-regular fa-clock"></i> ${stats.n} Nincs értékelés
            <span class="pill-remove-hint"><i class="fa-solid fa-xmark"></i> eltávolít</span>
          </button>` : ''}
          <span class="filter-active-label hidden" id="filter-active-label">
            <i class="fa-solid fa-filter"></i> Szűrő aktív
          </span>
        </div>
        <button class="btn btn-light btn-sm" data-action="open-filter-panel" style="flex-shrink:0;">
          <i class="fa-solid fa-sliders"></i> Szűrés
        </button>
      </div>` : ''}

      <div class="tc-toolbar">
        <div class="tc-toolbar-left">
          <button class="btn btn-primary" data-action="add-tc"><i class="fa-solid fa-plus"></i> Új teszteset</button>
          <button class="btn btn-light" data-action="open-import-modal"><i class="fa-solid fa-file-excel"></i> Excel import</button>
          <input type="file" id="import-excel-input" accept=".xlsx,.xls" class="hidden" />
        </div>
        <div class="tc-toolbar-right">
          ${stats.d ? `
          <button class="btn btn-warning" data-action="show-discuss">
            <i class="fa-solid fa-comments"></i> Megbeszélésre vár <span class="btn-badge">${stats.d}</span>
          </button>` : ''}
          ${(stats.f + stats.d) > 0 ? `
          <button class="btn btn-light btn-sm" data-action="open-clickup-gen">
            <i class="fa-solid fa-wand-magic-sparkles"></i> ClickUp
          </button>` : ''}
          <div class="dropdown-wrap">
            <button class="btn btn-light" data-action="toggle-export">
              <i class="fa-solid fa-file-export"></i> Exportálás <i class="fa-solid fa-chevron-down" style="font-size:.65rem;"></i>
            </button>
            <div class="dropdown-menu-custom" id="export-dropdown-menu">
              <div class="dropdown-label-custom">Tesztesetek</div>
              <button class="dropdown-item-custom" data-action="export-tc-xlsx"><i class="fa-solid fa-table"></i> Tesztesetek (.xlsx) – újraimportálható</button>
              <button class="dropdown-item-custom" data-action="export-tc-csv"><i class="fa-solid fa-file-csv"></i> Tesztesetek (.csv)</button>
              ${(stats.f + stats.d) > 0 ? `<button class="dropdown-item-custom" data-action="open-md-export"><i class="fa-solid fa-file-code"></i> Sikertelen tesztek (.md)</button>` : ''}
              <div class="dropdown-divider-custom"></div>
              <div class="dropdown-label-custom">HTML Report</div>
              <button class="dropdown-item-custom" data-action="export-html-pre"><i class="fa-solid fa-file-code"></i> Futtatás előtti report (.html)</button>
              <button class="dropdown-item-custom" data-action="export-html-post"><i class="fa-solid fa-file-code"></i> Futtatás utáni report (.html)</button>
              <div class="dropdown-divider-custom"></div>
              <div class="dropdown-label-custom">Teljes halmaz</div>
              <button class="dropdown-item-custom" data-action="export-suite-xlsx"><i class="fa-solid fa-layer-group"></i> Teljes halmaz (.xlsx) – újraimportálható</button>
            </div>
          </div>
          <button class="btn btn-success" data-action="start-test" ${!total ? 'disabled' : ''}>
            <i class="fa-solid fa-${suite.testSession ? 'circle-play' : 'play'}"></i> ${suite.testSession ? 'Tesztelés folytatása' : 'Tesztelés indítása'}
          </button>
        </div>
      </div>

      <div class="tc-table-wrapper">
        <table class="tc-table">
          <thead>
            <tr><th>ID</th><th>Név</th><th>Lépések</th><th>Elvárt eredmény</th><th>Kapott eredmény</th><th>Értékelés</th><th></th></tr>
          </thead>
          <tbody id="tc-tbody">
            ${total ? suite.testCases.map(tcRow).join('') : `
            <tr><td colspan="7">
              <div class="empty-state" style="padding:2.25rem 1rem;">
                <i class="fa-solid fa-list-check" style="font-size:1.9rem;"></i>
                <h3>Még nincsenek tesztesetek</h3>
                <p>Adj hozzá kézzel vagy importálj Excel fájlból!</p>
              </div>
            </td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="filter-empty-state hidden" id="filter-empty-state">
        <i class="fa-solid fa-filter-circle-xmark"></i>
        <p>Nincs a szűrőnek megfelelő teszteset.</p>
        <button class="btn btn-light btn-sm" data-action="clear-filter">Szűrő törlése</button>
      </div>`;

    bindEvents(container);
    bindBatchEvents(container);
    setupUndoFloat();
    // Batch bar törlése navigációkor
    clearBatchSelection();
    document.getElementById('batch-bar')?.classList.add('hidden');
    // Undo history törlése új suite megnyitásakor
    TF.Undo.clear();

    // Oszlop-átméretezés inicializálása (a táblázat DOM-ban van)
    requestAnimationFrame(() => TF.ColResize.init(suiteId));

    // ---- Sticky kontextuális sáv (toolbar eltűnésekor jelenik meg) ----
    document.getElementById('sticky-bar')?.remove();

    if (total) {
      const bar = document.createElement('div');
      bar.id = 'sticky-bar';
      bar.className = 'sticky-bar';
      bar.innerHTML = `
        <div class="sticky-bar-inner">
          <div class="sticky-bar-left">
            <button class="btn btn-primary btn-sm" id="sbar-add-tc">
              <i class="fa-solid fa-plus"></i> Új teszteset
            </button>
            <button class="btn btn-light btn-sm" id="sbar-import">
              <i class="fa-solid fa-file-excel"></i> Import
            </button>
            ${stats.d ? `<button class="btn btn-warning btn-sm" id="sbar-discuss">
              <i class="fa-solid fa-comments"></i> Megbeszélés <span class="btn-badge">${stats.d}</span>
            </button>` : ''}
          </div>
          <div class="sticky-bar-right">
            <div class="dropdown-wrap">
              <button class="btn btn-light btn-sm" id="sbar-export-toggle">
                <i class="fa-solid fa-file-export"></i> Export <i class="fa-solid fa-chevron-down" style="font-size:.6rem;"></i>
              </button>
              <div class="dropdown-menu-custom" id="sbar-export-menu">
                <div class="dropdown-label-custom">Tesztesetek</div>
                <button class="dropdown-item-custom" id="sbar-exp-tc-xlsx"><i class="fa-solid fa-table"></i> Tesztesetek (.xlsx)</button>
                <button class="dropdown-item-custom" id="sbar-exp-tc-csv"><i class="fa-solid fa-file-csv"></i> Tesztesetek (.csv)</button>
                <div class="dropdown-divider-custom"></div>
                <div class="dropdown-label-custom">HTML Report</div>
                <button class="dropdown-item-custom" id="sbar-exp-html-pre"><i class="fa-solid fa-file-code"></i> Futtatás előtti (.html)</button>
                <button class="dropdown-item-custom" id="sbar-exp-html-post"><i class="fa-solid fa-file-code"></i> Futtatás utáni (.html)</button>
                <div class="dropdown-divider-custom"></div>
                <div class="dropdown-label-custom">Teljes halmaz</div>
                <button class="dropdown-item-custom" id="sbar-exp-suite"><i class="fa-solid fa-layer-group"></i> Teljes halmaz (.xlsx)</button>
              </div>
            </div>
            <button class="btn btn-success btn-sm" id="sbar-start-test">
              <i class="fa-solid fa-play"></i> Tesztelés indítása
            </button>
          </div>
        </div>`;

      document.body.appendChild(bar);

      // Gomb események a sávban
      bar.querySelector('#sbar-add-tc').addEventListener('click', openNewTcModal);
      bar.querySelector('#sbar-import')?.addEventListener('click', () => {
        container.querySelector('#import-excel-input')?.click();
      });
      bar.querySelector('#sbar-discuss')?.addEventListener('click', () => openDiscussModal());
      bar.querySelector('#sbar-start-test').addEventListener('click', () => TF.Views.Testing.start(currentSuiteId));

      const sbarExportToggle = bar.querySelector('#sbar-export-toggle');
      const sbarExportMenu = bar.querySelector('#sbar-export-menu');
      sbarExportToggle.addEventListener('click', e => { e.stopPropagation(); sbarExportMenu.classList.toggle('is-open'); });
      bar.querySelector('#sbar-exp-tc-xlsx').addEventListener('click', () => { sbarExportMenu.classList.remove('is-open'); TF.Excel.exportTestCasesXlsx(currentSuiteId); });
      bar.querySelector('#sbar-exp-tc-csv').addEventListener('click', () => { sbarExportMenu.classList.remove('is-open'); TF.Excel.exportTestCasesCsv(currentSuiteId); });
      bar.querySelector('#sbar-exp-suite').addEventListener('click', () => { sbarExportMenu.classList.remove('is-open'); TF.Excel.exportFullSuiteXlsx(currentSuiteId); });
      bar.querySelector('#sbar-exp-html-pre')?.addEventListener('click', () => { sbarExportMenu.classList.remove('is-open'); TF.HtmlReport.exportHtml(currentSuiteId, 'pre'); });
      bar.querySelector('#sbar-exp-html-post')?.addEventListener('click', () => { sbarExportMenu.classList.remove('is-open'); TF.HtmlReport.exportHtml(currentSuiteId, 'post'); });
      document.addEventListener('click', () => sbarExportMenu?.classList.remove('is-open'));

      // IntersectionObserver: a toolbar eltűnésekor mutatja a sávot
      const mainToolbar = container.querySelector('.tc-toolbar');
      if (mainToolbar && 'IntersectionObserver' in window) {
        const obs = new IntersectionObserver(entries => {
          bar.classList.toggle('is-visible', !entries[0].isIntersecting);
        }, { threshold: 0, rootMargin: '-60px 0px 0px 0px' });
        obs.observe(mainToolbar);
        container._stickyCleanup = () => { obs.disconnect(); bar.remove(); };
      }
    }
  }

  function tcRow(tc) {
    const evalKey = tc.evaluation || 'pending';
    return `
      <tr data-evaluation="${esc(evalKey)}" data-tc-id="${esc(tc.id)}" draggable="true">
        <td>
          <div style="display:flex;align-items:center;gap:.4rem;">
            <input type="checkbox" class="tc-batch-cb" data-tc-id="${esc(tc.id)}"
              aria-label="${esc(tc.id)} kijelölése"
              style="accent-color:var(--blue);width:15px;height:15px;cursor:pointer;flex-shrink:0;" />
            <span class="tc-drag-handle" title="Húzd az átrendezéshez"><i class="fa-solid fa-grip-vertical"></i></span>
            <span class="tc-id-badge">${esc(tc.id)}</span>
          </div>
        </td>
        <td>
          <div class="tc-name-wrap">
            <div class="tc-name">${esc(tc.name)}</div>
            ${tc.attachments?.length ? `<span class="tc-att-badge" title="${tc.attachments.length} csatolmány"><i class="fa-solid fa-paperclip"></i> ${tc.attachments.length}</span>` : ''}
          </div>
        </td>
        <td>${stepsHtml(tc.steps)}</td>
        <td class="tc-cell-clip">${tc.expectedResult ? esc(tc.expectedResult) : '<span class="text-muted">–</span>'}</td>
        <td class="tc-cell-clip">${tc.actualResult ? esc(tc.actualResult) : '<span class="text-muted">–</span>'}</td>
        <td class="eval-cell">
          <div class="eval-dropdown-wrap" data-tc-id="${esc(tc.id)}">
            <button class="eval-dropdown-trigger" data-action="open-eval-dd" data-id="${esc(tc.id)}" title="Kattints az értékelés módosításához">
              ${evalBadge(tc.evaluation)}
              <i class="fa-solid fa-chevron-down eval-dd-caret"></i>
            </button>
            <div class="eval-dropdown-menu hidden" id="eval-dd-${esc(tc.id)}">
              <button class="eval-dd-item" data-action="set-eval" data-id="${esc(tc.id)}" data-eval="Sikeres"><span class="eval-badge success"><i class="fa-solid fa-circle-check"></i> Sikeres</span></button>
              <button class="eval-dd-item" data-action="set-eval" data-id="${esc(tc.id)}" data-eval="Sikertelen"><span class="eval-badge fail"><i class="fa-solid fa-circle-xmark"></i> Sikertelen</span></button>
              <button class="eval-dd-item" data-action="set-eval" data-id="${esc(tc.id)}" data-eval="Megbeszélésre vár"><span class="eval-badge discuss"><i class="fa-solid fa-comments"></i> Megbeszélésre vár</span></button>
              <button class="eval-dd-item eval-dd-item--clear" data-action="set-eval" data-id="${esc(tc.id)}" data-eval=""><span class="eval-badge pending"><i class="fa-solid fa-xmark"></i> Törlés</span></button>
            </div>
          </div>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn btn-light btn-sm" data-action="view-tc" data-id="${esc(tc.id)}" aria-label="Megtekintés" title="Megtekintés"><i class="fa-solid fa-eye"></i></button>
            <button class="btn btn-light btn-sm" data-action="edit-tc" data-id="${esc(tc.id)}" aria-label="Szerkesztés" title="Szerkesztés"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-light btn-sm" data-action="duplicate-tc" data-id="${esc(tc.id)}" aria-label="Másolat létrehozása" title="Másolat létrehozása"><i class="fa-solid fa-copy"></i></button>
            <button class="btn btn-danger btn-sm" data-action="delete-tc" data-id="${esc(tc.id)}" aria-label="Törlés" title="Törlés"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }

  /* ---------- szűrési logika ---------- */

  function applyFilters() {
    const tbody = document.getElementById('tc-tbody');
    const emptyState = document.getElementById('filter-empty-state');
    const activeLabel = document.getElementById('filter-active-label');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr[data-evaluation]'));
    const hasFilters = activeFilters.size > 0;
    let visibleCount = 0;

    rows.forEach(row => {
      const ev = row.dataset.evaluation;
      const show = !hasFilters || activeFilters.has(ev);
      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    if (emptyState) emptyState.classList.toggle('hidden', visibleCount > 0);
    if (activeLabel) activeLabel.classList.toggle('hidden', !hasFilters);

    document.querySelectorAll('.stat-pill.filterable').forEach(btn => {
      btn.classList.toggle('is-active', activeFilters.has(btn.dataset.filter));
    });

    const allPill = document.querySelector('.stat-pill[data-filter="all"]');
    if (allPill) allPill.classList.toggle('is-dimmed', hasFilters);
  }

  function toggleFilter(filterKey) {
    if (filterKey === 'all') {
      activeFilters.clear();
    } else if (activeFilters.has(filterKey)) {
      activeFilters.delete(filterKey);
    } else {
      activeFilters.add(filterKey);
    }
    applyFilters();
  }

  /* ---------- események ----------
     A delegált click-listener EGYSZER kötődik a tartós #app-view konténerre,
     a fájl-input change listenere viszont minden rendernél, mert maga az
     input elem cserélődik az innerHTML-lel. */

  let _bound = false;

  function bindEvents(container) {
    if (_bound) return;
    _bound = true;

    container.addEventListener('click', e => {
      if (container.dataset.view !== 'suite') return;

      // Szűrő pill kattintás (nem data-action, hanem data-filter alapú)
      const pill = e.target.closest('.stat-pill[data-filter]');
      if (pill) return toggleFilter(pill.dataset.filter);

      const el = e.target.closest('[data-action]');
      if (!el) return;
      const { action, id } = el.dataset;

      switch (action) {
        case 'add-tc':            return openNewTcModal();
        case 'view-tc':           return openViewTcModal(id);
        case 'edit-tc':           return openEditTcModal(id);
        case 'duplicate-tc':      return duplicateTc(id);
        case 'delete-tc':         return deleteTc(id);
        case 'edit-suite':        return TF.Views.Home.openEditSuiteModal(id || currentSuiteId);
        case 'reset-suite':       return resetSuite();
        case 'open-import-modal': return openImportExcelModal();
        case 'open-filter-panel': return openFilterPanel();
        case 'open-clickup-gen':  return openClickupGen();
        case 'open-md-export':    return openMdExport();
        case 'open-revert':       return openRevertModal();
        case 'show-discuss':      return openDiscussModal();
        case 'clear-filter':      return clearAdvancedFilters();
        case 'open-eval-dd':      return toggleEvalDropdown(id, e);
        case 'set-eval':          return setEvaluation(id, el.dataset.eval);
        case 'toggle-export': {
          e.stopPropagation();
          document.getElementById('export-dropdown-menu')?.classList.toggle('is-open');
          return;
        }
        case 'export-tc-xlsx':    closeExportMenu(); return TF.Excel.exportTestCasesXlsx(currentSuiteId);
        case 'export-tc-csv':     closeExportMenu(); return TF.Excel.exportTestCasesCsv(currentSuiteId);
        case 'export-suite-xlsx': closeExportMenu(); return TF.Excel.exportFullSuiteXlsx(currentSuiteId);
        case 'export-html-pre':   closeExportMenu(); return TF.HtmlReport.exportHtml(currentSuiteId, 'pre');
        case 'export-html-post':  closeExportMenu(); return TF.HtmlReport.exportHtml(currentSuiteId, 'post');
      }
    });

    // ---- Teszteset sor drag-and-drop ----
    let _dragTcId     = null;
    let _dragOverTcId = null;
    let _tcScrollRaf  = null;

    function _dragScroll(e) {
      const ZONE = 100, SPEED = 12;
      const y = e.clientY;
      const vh = window.innerHeight;
      cancelAnimationFrame(_tcScrollRaf);
      if (y < ZONE) {
        const step = () => { window.scrollBy(0, -SPEED); _tcScrollRaf = requestAnimationFrame(step); };
        _tcScrollRaf = requestAnimationFrame(step);
      } else if (y > vh - ZONE) {
        const step = () => { window.scrollBy(0, SPEED); _tcScrollRaf = requestAnimationFrame(step); };
        _tcScrollRaf = requestAnimationFrame(step);
      }
    }

    container.addEventListener('dragstart', e => {
      if (container.dataset.view !== 'suite') return;
      const row = e.target.closest('tr[data-tc-id]');
      if (!row) return;
      _dragTcId = row.dataset.tcId;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', _dragTcId);
    });

    container.addEventListener('dragend', () => {
      cancelAnimationFrame(_tcScrollRaf); _tcScrollRaf = null;
      document.querySelectorAll('tr[data-tc-id]').forEach(r =>
        r.classList.remove('is-dragging', 'drag-over'));
      _dragTcId = null;
      _dragOverTcId = null;
    });

    container.addEventListener('dragover', e => {
      if (container.dataset.view !== 'suite') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      _dragScroll(e);
      const row = e.target.closest('tr[data-tc-id]');
      if (!row || row.dataset.tcId === _dragTcId) return;
      if (row.dataset.tcId !== _dragOverTcId) {
        document.querySelectorAll('tr[data-tc-id]').forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
        _dragOverTcId = row.dataset.tcId;
      }
    });

    container.addEventListener('dragleave', e => {
      const row = e.target.closest('tr[data-tc-id]');
      if (row && !row.contains(e.relatedTarget)) row.classList.remove('drag-over');
    });

    container.addEventListener('drop', async e => {
      if (container.dataset.view !== 'suite') return;
      e.preventDefault();
      const targetRow = e.target.closest('tr[data-tc-id]');
      if (!targetRow || !_dragTcId || targetRow.dataset.tcId === _dragTcId) return;

      const suite = await TF.Storage.getSuite(currentSuiteId);
      if (!suite) return;

      const tcs = suite.testCases;
      const fromIdx = tcs.findIndex(t => t.id === _dragTcId);
      const toIdx   = tcs.findIndex(t => t.id === targetRow.dataset.tcId);
      if (fromIdx < 0 || toIdx < 0) return;

      // Átrendezés
      const [moved] = tcs.splice(fromIdx, 1);
      tcs.splice(toIdx, 0, moved);

      // ID újraszámozás
      suite.testCases = TF.IdRenumber.renumber(tcs);

      try {
        await TF.Storage.upsertSuite(suite);
        activeFilters.clear();
        TF.Router.refresh();
      } catch (err) {
        TF.UI.toast('Mentési hiba: ' + err.message, 'danger');
      }
    });
  }

  function closeExportMenu() {
    document.getElementById('export-dropdown-menu')?.classList.remove('is-open');
  }

  // A navbar "Tesztelés indítása" gombja + dropdown kívülre-kattintás zárása
  // egyetlen, globális delegált handlerrel (nem halmozódik render-enként).
  function initStatic() {
    document.addEventListener('click', e => {
      const startBtn = e.target.closest('[data-action="start-test"]');
      if (startBtn && !startBtn.disabled && currentSuiteId) {
        TF.Views.Testing.start(currentSuiteId);
        return;
      }
      if (!e.target.closest('.dropdown-wrap')) closeExportMenu();
      if (!e.target.closest('.eval-dropdown-wrap')) {
        document.querySelectorAll('.eval-dropdown-menu').forEach(m => m.classList.add('hidden'));
      }
    });

    document.getElementById('btn-save-tc').addEventListener('click', saveTc);

    // Excel import modal
    document.getElementById('import-excel-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      const nameEl = document.getElementById('excel-import-file-name');
      const preview = document.getElementById('excel-import-preview');
      const importBtn = document.getElementById('btn-do-excel-import');
      if (!file) return;
      if (nameEl) nameEl.textContent = file.name;
      if (preview) {
        preview.classList.remove('hidden');
        preview.innerHTML = `<div class="info-box"><i class="fa-solid fa-circle-check" style="color:var(--green);"></i><span>Fájl kiválasztva: <strong>${TF.UI.esc(file.name)}</strong></span></div>`;
      }
      if (importBtn) importBtn.disabled = false;
    });

    document.getElementById('btn-do-excel-import')?.addEventListener('click', async () => {
      const fileInput = document.getElementById('import-excel-input');
      const file = fileInput?.files[0];
      if (!file || !currentSuiteId) return;
      try {
        const { added, updated } = await TF.Excel.importTestCases(file, currentSuiteId);
        closeModal('modal-excel-import');
        const parts = [];
        if (added) parts.push(`${added} új`);
        if (updated) parts.push(`${updated} frissítve`);
        TF.UI.toast(`Import kész: ${parts.join(', ')}.`, 'success');
        fileInput.value = '';
        TF.Router.refresh();
      } catch (err) {
        TF.UI.toast('Importálási hiba: ' + err.message, 'danger');
      }
    });

    document.getElementById('btn-excel-import-template')?.addEventListener('click', TF.Excel.downloadTemplate);

    initFilterPanel();
    initClickupGen();
    initMdExport();
    initRevertModal();
  }

  /* ---------- teszteset megtekintés modal ---------- */

  async function openViewTcModal(tcId) {
    const suite = await TF.Storage.getSuite(currentSuiteId);
    const tc = suite?.testCases.find(t => t.id === tcId);
    if (!tc) { toast('A teszteset nem található.', 'danger'); return; }

    const evalLabels = {
      'Sikeres': `<span class="eval-badge success"><i class="fa-solid fa-circle-check"></i> Sikeres</span>`,
      'Sikertelen': `<span class="eval-badge fail"><i class="fa-solid fa-circle-xmark"></i> Sikertelen</span>`,
      'Megbeszélésre vár': `<span class="eval-badge discuss"><i class="fa-solid fa-comments"></i> Megbeszélésre vár</span>`,
    };

    function viewField(label, value, mono = false) {
      if (!value) return '';
      return `
        <div class="view-tc-field">
          <div class="view-tc-label">${label}</div>
          <div class="view-tc-value${mono ? ' mono' : ''}">${esc(value)}</div>
        </div>`;
    }

    document.getElementById('view-tc-modal-body').innerHTML = `
      <div class="view-tc-header">
        <span class="tc-id-badge" style="font-size:.82rem;padding:3px 10px;">${esc(tc.id)}</span>
        ${tc.evaluation ? evalLabels[tc.evaluation] || '' : `<span class="eval-badge pending"><i class="fa-regular fa-clock"></i> Nincs értékelés</span>`}
      </div>
      <div class="view-tc-name">${esc(tc.name)}</div>
      ${viewField('Lépések', tc.steps)}
      ${viewField('Elvárt eredmény', tc.expectedResult)}
      ${viewField('Kapott eredmény', tc.actualResult)}
    `;

    // A Szerkesztés gomb átnyit a szerkesztő modalba
    document.getElementById('btn-view-tc-edit').onclick = () => {
      closeModal('modal-view-tc');
      openEditTcModal(tcId);
    };

    openModal('modal-view-tc');
  }

  /* ---------- teszteset modal ---------- */

  function generateTcId(suites_testCases) {
    // TC-NNN alakú, ahol NNN az eddigi max + 1, legalább 3 jeggyel
    const nums = (suites_testCases || [])
      .map(t => parseInt((t.id || '').replace(/^TC-0*/i, ''), 10))
      .filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return 'TC-' + String(next).padStart(3, '0');
  }

  function openNewTcModal() {
    editingTcId = null;
    document.getElementById('modal-tc-title').textContent = 'Új teszteset';
    ['tc-name', 'tc-steps', 'tc-expected', 'tc-actual']
      .forEach(fid => document.getElementById(fid).value = '');
    document.getElementById('tc-evaluation').value = '';

    // Auto-generált ID – a mező szerkeszthető, de előre ki van töltve
    TF.Storage.getSuite(currentSuiteId).then(suite => {
      const autoId = generateTcId(suite?.testCases);
      const idField = document.getElementById('tc-id');
      idField.value = autoId;
      idField.readOnly = false;
      idField.title = 'Automatikusan generált, de felülírható';
      // Halvány stílusjelzés az auto-értékre
      idField.classList.add('auto-filled');
      idField.addEventListener('input', () => idField.classList.remove('auto-filled'), { once: true });
    });

    openModal('modal-testcase');
    document.getElementById('tc-name').focus();
  }

  async function openEditTcModal(tcId) {
    const suite = await TF.Storage.getSuite(currentSuiteId);
    const tc = suite?.testCases.find(t => t.id === tcId);
    if (!tc) { toast('A teszteset nem található.', 'danger'); return; }
    editingTcId = tcId;
    document.getElementById('modal-tc-title').textContent = 'Teszteset szerkesztése';

    const idField = document.getElementById('tc-id');
    idField.value = tc.id;
    idField.readOnly = false;
    idField.title = '';
    idField.classList.remove('auto-filled');

    document.getElementById('tc-name').value = tc.name;
    document.getElementById('tc-steps').value = tc.steps || '';
    document.getElementById('tc-expected').value = tc.expectedResult || '';
    document.getElementById('tc-actual').value = tc.actualResult || '';
    document.getElementById('tc-evaluation').value = tc.evaluation || '';
    openModal('modal-testcase');
  }

  async function saveTc() {
    const tcId = document.getElementById('tc-id').value.trim();
    const name = document.getElementById('tc-name').value.trim();
    if (!name) { TF.UI.shakeModal('modal-testcase'); toast('A Név megadása kötelező!', 'danger'); return; }
    if (!tcId) { TF.UI.shakeModal('modal-testcase'); toast('Az ID nem lehet üres!', 'danger'); return; }

    const suite = await TF.Storage.getSuite(currentSuiteId);
    if (!suite) { toast('A halmaz nem található.', 'danger'); return; }

    // Javítva: szerkesztésnél is tiltjuk az ID-ütközést (ha másik
    // tesztesettel ütközne az új ID)
    const conflict = suite.testCases.find(t => t.id === tcId && t.id !== editingTcId);
    if (conflict) { toast('Már létezik teszteset ezzel az ID-val!', 'danger'); return; }

    const tc = {
      id: tcId,
      name,
      steps: document.getElementById('tc-steps').value.trim(),
      expectedResult: document.getElementById('tc-expected').value.trim(),
      actualResult: document.getElementById('tc-actual').value.trim(),
      evaluation: document.getElementById('tc-evaluation').value
    };

    if (editingTcId) {
      const idx = suite.testCases.findIndex(t => t.id === editingTcId);
      if (idx >= 0) suite.testCases[idx] = tc;
      else suite.testCases.push(tc); // időközben törölhették – visszatesszük
    } else {
      suite.testCases.push(tc);
    }

    try {
      await TF.Storage.upsertSuite(suite);
      closeModal('modal-testcase');
      toast('Teszteset mentve!', 'success');
      TF.Router.refresh();
    } catch (e) {
      toast('Mentési hiba: ' + e.message, 'danger');
    }
  }

  /* Másolat: a forrás TC tartalmával nyitja meg a modált, de új ID-val és
     „Másolat: …" előtaggal a névben – az összes mező szerkeszthető. */
  async function duplicateTc(sourceTcId) {
    const suite = await TF.Storage.getSuite(currentSuiteId);
    const src = suite?.testCases.find(t => t.id === sourceTcId);
    if (!src) { toast('A teszteset nem található.', 'danger'); return; }

    editingTcId = null; // új tesztesetként mentjük

    document.getElementById('modal-tc-title').textContent = 'Másolat létrehozása';

    const autoId = generateTcId(suite.testCases);
    const idField = document.getElementById('tc-id');
    idField.value = autoId;
    idField.readOnly = false;
    idField.classList.add('auto-filled');
    idField.addEventListener('input', () => idField.classList.remove('auto-filled'), { once: true });

    document.getElementById('tc-name').value = `Másolat: ${src.name}`;
    document.getElementById('tc-steps').value = src.steps || '';
    document.getElementById('tc-expected').value = src.expectedResult || '';
    document.getElementById('tc-actual').value = '';         // eredmény ne másolódjon
    document.getElementById('tc-evaluation').value = '';    // értékelés se

    openModal('modal-testcase');
    document.getElementById('tc-name').focus();
    // A névben lévő „Másolat: " előtagot rögtön kijelöljük,
    // hogy könnyen felülírható legyen
    const nameField = document.getElementById('tc-name');
    nameField.setSelectionRange(0, nameField.value.length);
  }

  async function deleteTc(tcId) {
    const suite = await TF.Storage.getSuite(currentSuiteId);
    const tc = suite?.testCases.find(t => t.id === tcId);
    if (!tc) { toast('A teszteset nem található.', 'danger'); return; }
    const ok = await confirm('Teszteset törlése', `Biztosan törlöd a(z) „${tc.name}" tesztesetet?`);
    if (!ok) return;

    TF.Undo.push(suite, `Törlés: ${tc.id}`);

    suite.testCases = suite.testCases.filter(t => t.id !== tcId);
    try {
      await TF.Storage.upsertSuite(suite);
      toast('Teszteset törölve.', 'danger');
      TF.Router.refresh();
    } catch (e) {
      toast('Törlési hiba: ' + e.message, 'danger');
    }
  }

  async function resetSuite() {
    const suite = await TF.Storage.getSuite(currentSuiteId);
    if (!suite) return;
    suite.isCompleted = false;
    try {
      await TF.Storage.upsertSuite(suite);
      toast('Halmaz visszaállítva – újratesztelhető!');
      TF.Router.refresh();
    } catch (e) {
      toast('Mentési hiba: ' + e.message, 'danger');
    }
  }

  /* ---------- Excel import modal ---------- */

  function openImportExcelModal() {
    const suite = TF.Storage.getSuite ? null : null; // just open modal
    const fileNameEl = document.getElementById('excel-import-file-name');
    const fileInput  = document.getElementById('import-excel-input');
    if (fileNameEl) fileNameEl.textContent = 'Fájl kiválasztása…';
    if (fileInput)  fileInput.value = '';
    document.getElementById('excel-import-preview')?.classList.add('hidden');
    openModal('modal-excel-import');
  }

  /* ---------- Excel import (handled via modal in initStatic) ---------- */

  /* ---------- Megbeszélésre vár modal ---------- */

  async function openDiscussModal() {
    const suite = await TF.Storage.getSuite(currentSuiteId);
    const list = (suite?.testCases || []).filter(tc => tc.evaluation === 'Megbeszélésre vár');

    const body = document.getElementById('discuss-modal-body');
    if (!list.length) {
      body.innerHTML = `<p class="text-muted" style="text-align:center;padding:1rem 0;">Nincs egyetlen "Megbeszélésre vár" értékelésű teszteset sem.</p>`;
    } else {
      body.innerHTML = list.map(tc => `
        <div class="discuss-item">
          <div class="discuss-item-header">
            <span class="tc-id-badge">${esc(tc.id)}</span>
            <span class="discuss-item-name">${esc(tc.name)}</span>
          </div>
          ${tc.steps ? `
          <div class="discuss-field">
            <span class="discuss-field-label">Lépések</span>
            <span class="discuss-field-value">${esc(tc.steps)}</span>
          </div>` : ''}
          ${tc.expectedResult ? `
          <div class="discuss-field">
            <span class="discuss-field-label">Elvárt eredmény</span>
            <span class="discuss-field-value">${esc(tc.expectedResult)}</span>
          </div>` : ''}
          ${tc.actualResult ? `
          <div class="discuss-field">
            <span class="discuss-field-label">Kapott eredmény</span>
            <span class="discuss-field-value">${esc(tc.actualResult)}</span>
          </div>` : ''}
        </div>`).join('');
    }

    openModal('modal-discuss');
  }

  function getCurrentSuiteId() { return currentSuiteId; }

  /* ---------- Értékelés inline dropdown ---------- */

  function toggleEvalDropdown(tcId, e) {
    e.stopPropagation();
    const menu = document.getElementById(`eval-dd-${tcId}`);
    if (!menu) return;
    // Zárjuk be az összes többi
    document.querySelectorAll('.eval-dropdown-menu').forEach(m => {
      if (m !== menu) m.classList.add('hidden');
    });
    menu.classList.toggle('hidden');
  }

  async function setEvaluation(tcId, evalValue) {
    document.querySelectorAll('.eval-dropdown-menu').forEach(m => m.classList.add('hidden'));

    const suite = await TF.Storage.getSuite(currentSuiteId);
    if (!suite) return;
    const tc = suite.testCases.find(t => t.id === tcId);
    if (!tc) return;

    // Undo snapshot mentése a változtatás ELŐTT
    TF.Undo.push(suite, `Értékelés: ${tc.id}`);

    tc.evaluation = evalValue;
    try {
      await TF.Storage.upsertSuite(suite);
      TF.Router.refresh();
    } catch(e) {
      toast('Mentési hiba: ' + e.message, 'danger');
    }
  }

  /* ---------- Haladó szűrés sidepanel ---------- */

  let advancedFilters = {};

  function openFilterPanel() {
    // Visszatölt előző állapot
    const { evals = [], hasSteps, hasExpected, hasActual, noEval, text = '' } = advancedFilters;
    document.querySelectorAll('#fp-eval-checks input').forEach(cb => {
      cb.checked = evals.includes(cb.value);
    });
    document.getElementById('fp-has-steps').checked = !!hasSteps;
    document.getElementById('fp-has-expected').checked = !!hasExpected;
    document.getElementById('fp-has-actual').checked = !!hasActual;
    document.getElementById('fp-no-eval').checked = !!noEval;
    document.getElementById('fp-text-search').value = text;
    document.getElementById('sidepanel-filter').classList.add('is-open');
  }

  function applyAdvancedFilters() {
    const tbody = document.getElementById('tc-tbody');
    const emptyState = document.getElementById('filter-empty-state');
    if (!tbody) return;

    const { evals = [], hasSteps, hasExpected, hasActual, noEval, text = '' } = advancedFilters;
    const lowerText = text.toLowerCase().trim();
    const hasAny = evals.length || hasSteps || hasExpected || hasActual || noEval || lowerText;

    const rows = Array.from(tbody.querySelectorAll('tr[data-evaluation]'));
    let visibleCount = 0;

    rows.forEach(row => {
      if (!hasAny) { row.style.display = ''; visibleCount++; return; }

      const ev = row.dataset.evaluation;
      const tcId = row.dataset.tcId;

      // Eval filter
      if (evals.length && !evals.includes(ev)) { row.style.display = 'none'; return; }

      // Content filters – get cell text
      const cells = row.querySelectorAll('td');
      const stepsText = cells[2]?.textContent.trim() || '';
      const expectedText = cells[3]?.textContent.trim() || '';
      const actualText = cells[4]?.textContent.trim() || '';
      const nameText = cells[1]?.textContent.trim() || '';
      const idText = cells[0]?.textContent.trim() || '';

      if (hasSteps && !stepsText) { row.style.display = 'none'; return; }
      if (hasExpected && !expectedText) { row.style.display = 'none'; return; }
      if (hasActual && !actualText) { row.style.display = 'none'; return; }
      if (noEval && ev !== 'pending') { row.style.display = 'none'; return; }

      if (lowerText) {
        const haystack = [idText, nameText, stepsText, expectedText, actualText].join(' ').toLowerCase();
        if (!haystack.includes(lowerText)) { row.style.display = 'none'; return; }
      }

      row.style.display = '';
      visibleCount++;
    });

    if (emptyState) emptyState.classList.toggle('hidden', visibleCount > 0);

    // Visszajelzés az aktív szűrőkről a filter-active-label-ben
    const activeLabel = document.getElementById('filter-active-label');
    if (activeLabel) activeLabel.classList.toggle('hidden', !hasAny);
  }

  function clearAdvancedFilters() {
    advancedFilters = {};
    activeFilters.clear();
    applyAdvancedFilters();
    // Reset pill gombok is
    document.querySelectorAll('.stat-pill.filterable').forEach(b => b.classList.remove('is-active'));
    const allPill = document.querySelector('.stat-pill[data-filter="all"]');
    if (allPill) allPill.classList.remove('is-dimmed');
  }

  function initFilterPanel() {
    document.getElementById('btn-close-filter-panel').addEventListener('click', () => {
      document.getElementById('sidepanel-filter').classList.remove('is-open');
    });
    document.getElementById('sidepanel-filter').addEventListener('click', e => {
      if (e.target === document.getElementById('sidepanel-filter')) {
        document.getElementById('sidepanel-filter').classList.remove('is-open');
      }
    });
    document.getElementById('btn-filter-reset').addEventListener('click', () => {
      advancedFilters = {};
      document.querySelectorAll('#sidepanel-filter input[type="checkbox"]').forEach(cb => cb.checked = false);
      document.getElementById('fp-text-search').value = '';
    });
    document.getElementById('btn-filter-apply').addEventListener('click', () => {
      const evals = Array.from(document.querySelectorAll('#fp-eval-checks input:checked')).map(cb => cb.value);
      advancedFilters = {
        evals,
        hasSteps:    document.getElementById('fp-has-steps').checked,
        hasExpected: document.getElementById('fp-has-expected').checked,
        hasActual:   document.getElementById('fp-has-actual').checked,
        noEval:      document.getElementById('fp-no-eval').checked,
        text:        document.getElementById('fp-text-search').value
      };
      document.getElementById('sidepanel-filter').classList.remove('is-open');
      applyAdvancedFilters();
    });
  }

  /* ---------- ClickUp tétel generátor ---------- */

  async function openClickupGen() {
    const suite = await TF.Storage.getSuite(currentSuiteId);
    if (!suite) return;

    // Töltsük fel a select listát a sikertelen és megbeszélés tesztesetekkel
    const sel = document.getElementById('cu-tc-select');
    sel.innerHTML = '';
    const candidates = suite.testCases.filter(tc =>
      tc.evaluation === 'Sikertelen' || tc.evaluation === 'Megbeszélésre vár' || !tc.evaluation
    );
    if (!candidates.length) {
      sel.innerHTML = '<option disabled>Nincs sikertelen vagy értékelt teszteset</option>';
    } else {
      candidates.forEach(tc => {
        const opt = document.createElement('option');
        opt.value = tc.id;
        opt.textContent = `[${tc.evaluation || 'Nincs értékelés'}] ${tc.id} – ${tc.name}`;
        if (tc.evaluation === 'Sikertelen') opt.selected = true;
        sel.appendChild(opt);
      });
    }

    document.getElementById('cu-preview-wrap').classList.add('hidden');
    openModal('modal-clickup-gen');
  }

  function buildClickupText(suite) {
    const browser = document.getElementById('cu-env-browser').value.trim() || 'N/A';
    const system  = document.getElementById('cu-env-system').value.trim() || 'N/A';
    const client  = document.getElementById('cu-env-client').value.trim() || 'N/A';
    const user    = document.getElementById('cu-env-user').value.trim() || 'N/A';
    const notes   = document.getElementById('cu-extra-notes').value.trim();

    const selectedIds = Array.from(document.getElementById('cu-tc-select').selectedOptions).map(o => o.value);
    const tcs = suite.testCases.filter(tc => selectedIds.includes(tc.id));

    let out = `## Tesztkörnyezet\n`;
    out += `- **böngésző:** ${browser}\n`;
    out += `- **rendszer:** ${system}\n`;
    out += `- **ügyfél:** ${client}\n`;
    out += `- **felhasználó:** ${user}\n\n`;
    out += `---\n\n`;

    tcs.forEach((tc, i) => {
      out += `## ${i + 1}. ${tc.id} – ${tc.name}\n\n`;
      if (tc.steps) {
        out += `### Reprodukálási lépések\n`;
        tc.steps.split('\n').forEach((step, si) => {
          if (step.trim()) out += `${si + 1}. ${step.replace(/^\d+[.)]\s*/, '')}\n`;
        });
        out += '\n';
      }
      if (tc.expectedResult) {
        out += `### Elvárt működés\n${tc.expectedResult}\n\n`;
      }
      if (tc.actualResult) {
        out += `### Leírás\n${tc.actualResult}\n\n`;
      }
      out += `---\n\n`;
    });

    if (notes) out += `## További megjegyzések\n${notes}\n`;
    return out.trim();
  }

  function initClickupGen() {
    document.getElementById('btn-cu-preview').addEventListener('click', async () => {
      const suite = await TF.Storage.getSuite(currentSuiteId);
      if (!suite) return;
      const text = buildClickupText(suite);
      document.getElementById('cu-preview').textContent = text;
      document.getElementById('cu-preview-wrap').classList.remove('hidden');
    });

    document.getElementById('btn-cu-copy').addEventListener('click', async () => {
      const suite = await TF.Storage.getSuite(currentSuiteId);
      if (!suite) return;
      const text = buildClickupText(suite);
      try {
        await navigator.clipboard.writeText(text);
        toast('Szöveg vágólapra másolva!', 'success');
      } catch {
        // fallback
        document.getElementById('cu-preview').textContent = text;
        document.getElementById('cu-preview-wrap').classList.remove('hidden');
        toast('Másold ki manuálisan az előnézetből.', '');
      }
    });
  }

  /* ---------- .md export ---------- */

  async function openMdExport() {
    const suite = await TF.Storage.getSuite(currentSuiteId);
    if (!suite) return;
    // Default cím
    document.getElementById('md-title').value = `${suite.name} – Sikertelen tesztesetek`;
    document.getElementById('md-scope').value = suite.status || '';
    document.getElementById('md-preview-wrap').classList.add('hidden');
    openModal('modal-md-export');
  }

  function buildMdText(suite) {
    const title    = document.getElementById('md-title').value.trim() || suite.name;
    const scope    = document.getElementById('md-scope').value.trim();
    const template = document.getElementById('md-template').value;
    const incFail    = document.getElementById('md-inc-sikertelen').checked;
    const incDiscuss = document.getElementById('md-inc-discuss').checked;
    const incNoEval  = document.getElementById('md-inc-no-eval').checked;

    const tcs = suite.testCases.filter(tc => {
      if (tc.evaluation === 'Sikertelen' && incFail) return true;
      if (tc.evaluation === 'Megbeszélésre vár' && incDiscuss) return true;
      if (!tc.evaluation && incNoEval) return true;
      return false;
    });

    const now = new Date().toLocaleDateString('hu-HU');
    let out = `# ${title}\n\n`;
    out += `**Dátum:** ${now}  \n`;
    if (scope) out += `**Hatókör:** ${scope}  \n`;
    out += `**Összesen:** ${tcs.length} teszteset\n\n`;
    out += `---\n\n`;

    if (!tcs.length) {
      out += '_Nincs a feltételeknek megfelelő teszteset._\n';
      return out;
    }

    tcs.forEach((tc, i) => {
      if (template === 'compact') {
        out += `## ${tc.id} – ${tc.name}\n`;
        out += `**Értékelés:** ${tc.evaluation || 'Nincs értékelés'}  \n`;
        if (tc.actualResult) out += `**Kapott eredmény:** ${tc.actualResult}\n`;
        out += '\n---\n\n';
      } else if (template === 'clickup') {
        out += `## ${i + 1}. ${tc.id} – ${tc.name}\n\n`;
        if (tc.steps) {
          out += `### Reprodukálási lépések\n`;
          tc.steps.split('\n').forEach((s, si) => {
            if (s.trim()) out += `${si + 1}. ${s.replace(/^\d+[.)]\s*/, '')}\n`;
          });
          out += '\n';
        }
        if (tc.expectedResult) out += `### Elvárt működés\n${tc.expectedResult}\n\n`;
        if (tc.actualResult) out += `### Leírás (kapott eredmény)\n${tc.actualResult}\n\n`;
        out += `**Értékelés:** ${tc.evaluation || 'Nincs értékelés'}\n\n---\n\n`;
      } else {
        // standard
        out += `## ${tc.id} – ${tc.name}\n\n`;
        out += `| Mező | Tartalom |\n|---|---|\n`;
        out += `| **Értékelés** | ${tc.evaluation || 'Nincs értékelés'} |\n`;
        if (tc.steps) out += `| **Lépések** | ${tc.steps.replace(/\n/g, '<br>').replace(/\|/g, '&#124;')} |\n`;
        if (tc.expectedResult) out += `| **Elvárt eredmény** | ${tc.expectedResult.replace(/\|/g, '&#124;')} |\n`;
        if (tc.actualResult) out += `| **Kapott eredmény** | ${tc.actualResult.replace(/\|/g, '&#124;')} |\n`;
        out += '\n---\n\n';
      }
    });

    return out.trim();
  }

  function initMdExport() {
    document.getElementById('btn-md-preview').addEventListener('click', async () => {
      const suite = await TF.Storage.getSuite(currentSuiteId);
      if (!suite) return;
      const text = buildMdText(suite);
      document.getElementById('md-preview').textContent = text;
      document.getElementById('md-preview-wrap').classList.remove('hidden');
    });

    document.getElementById('btn-md-download').addEventListener('click', async () => {
      const suite = await TF.Storage.getSuite(currentSuiteId);
      if (!suite) return;
      const text = buildMdText(suite);
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(document.getElementById('md-title').value || suite.name).replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ _-]/g, '_')}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast('.md fájl letöltve!', 'success');
    });
  }

  /* ---------- Batch műveletek ---------- */

  function getSelectedIds() {
    return Array.from(document.querySelectorAll('.tc-batch-cb:checked')).map(cb => cb.dataset.tcId);
  }

  function updateBatchBar() {
    const ids = getSelectedIds();
    const bar = document.getElementById('batch-bar');
    if (!bar) return;
    bar.classList.toggle('hidden', ids.length === 0);
    if (ids.length > 0) document.getElementById('batch-bar-count').textContent = `${ids.length} kijelölve`;
  }

  function clearBatchSelection() {
    document.querySelectorAll('.tc-batch-cb').forEach(cb => cb.checked = false);
    updateBatchBar();
  }

  let _batchBound = false;

  function bindBatchEvents(container) {
    // Checkbox változás – per-render kell mert a tbody cserélődik
    container.addEventListener('change', e => {
      if (container.dataset.view !== 'suite') return;
      if (e.target.classList.contains('tc-batch-cb')) updateBatchBar();
    });

    if (_batchBound) return;
    _batchBound = true;

    // "Mind kijelöl"
    document.getElementById('batch-select-all').addEventListener('click', () => {
      document.querySelectorAll('.tc-batch-cb').forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') cb.checked = true;
      });
      updateBatchBar();
    });

    // "Kijelölés törlése"
    document.getElementById('batch-deselect').addEventListener('click', () => {
      clearBatchSelection();
    });

    // Batch értékelés dropdown – felfelé nyíló, stopPropagation
    const evalToggle = document.getElementById('batch-eval-toggle');
    const evalMenu   = document.getElementById('batch-eval-menu');
    evalToggle.addEventListener('click', e => {
      e.stopPropagation();
      evalMenu.classList.toggle('hidden');
    });

    evalMenu.addEventListener('click', e => e.stopPropagation());

    evalMenu.querySelectorAll('[data-batch-eval]').forEach(btn => {
      btn.addEventListener('click', async () => {
        evalMenu.classList.add('hidden');
        const ids = getSelectedIds();
        if (!ids.length) { TF.UI.toast('Nincs kijelölt teszteset.', 'danger'); return; }
        const suite = await TF.Storage.getSuite(currentSuiteId);
        if (!suite) return;
        TF.Undo.push(suite, `Batch értékelés (${ids.length} TC)`);
        suite.testCases.forEach(tc => {
          if (ids.includes(tc.id)) tc.evaluation = btn.dataset.batchEval;
        });
        try {
          await TF.Storage.upsertSuite(suite);
          TF.UI.toast(`${ids.length} teszteset értékelése frissítve.`, 'success');
          TF.Router.refresh();
        } catch(err) { TF.UI.toast('Hiba: ' + err.message, 'danger'); }
      });
    });

    // Batch törlés
    document.getElementById('batch-delete').addEventListener('click', async () => {
      const ids = getSelectedIds();
      if (!ids.length) return;
      const ok = await TF.UI.confirm('Batch törlés', `Biztosan törlöd a(z) ${ids.length} kijelölt tesztesetet?`);
      if (!ok) return;
      const suite = await TF.Storage.getSuite(currentSuiteId);
      if (!suite) return;
      TF.Undo.push(suite, `Batch törlés (${ids.length} TC)`);
      suite.testCases = suite.testCases.filter(tc => !ids.includes(tc.id));
      try {
        await TF.Storage.upsertSuite(suite);
        TF.UI.toast(`${ids.length} teszteset törölve.`, 'danger');
        TF.Router.refresh();
      } catch(err) { TF.UI.toast('Hiba: ' + err.message, 'danger'); }
    });

    // Batch xlsx export
    document.getElementById('batch-export-xlsx').addEventListener('click', async () => {
      const ids = getSelectedIds();
      if (!ids.length) return;
      const suite = await TF.Storage.getSuite(currentSuiteId);
      if (!suite) return;
      const tcs = suite.testCases.filter(tc => ids.includes(tc.id));
      const rows = tcs.map(tc => ({
        'ID': tc.id, 'Név': tc.name, 'Lépések': tc.steps || '',
        'Elvárt eredmény': tc.expectedResult || '',
        'Kapott eredmény': tc.actualResult || '',
        'Értékelés': tc.evaluation || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{wch:12},{wch:36},{wch:44},{wch:36},{wch:36},{wch:20}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tesztesetek');
      XLSX.writeFile(wb, `${suite.name}_kivalasztott_${ids.length}db.xlsx`);
      TF.UI.toast(`${ids.length} teszteset exportálva.`, 'success');
    });
  }

  /* ---------- Undo lebegő gomb (jobb alul) ---------- */

  let _undoFloatEl = null;

  function setupUndoFloat() {
    if (!_undoFloatEl) {
      _undoFloatEl = document.createElement('button');
      _undoFloatEl.id = 'undo-float-btn';
      _undoFloatEl.className = 'undo-float-btn hidden';
      _undoFloatEl.innerHTML = `<i class="fa-solid fa-rotate-left"></i> <span id="undo-float-label">Visszavonás</span>`;
      _undoFloatEl.addEventListener('click', () => TF.Undo.pop());
      document.body.appendChild(_undoFloatEl);
    }

    function refreshUndoFloat() {
      if (!_undoFloatEl) return;
      const can = TF.Undo.canUndo();
      _undoFloatEl.classList.toggle('hidden', !can);
      const lbl = document.getElementById('undo-float-label');
      if (can && lbl) lbl.textContent = TF.Undo.peekLabel();
    }

    TF.Undo.onChange(refreshUndoFloat);
    refreshUndoFloat();
  }

  /* ---------- Tesztelés folytatása gomb ---------- */

  function getTestButtonLabel(suite) {
    return suite.testSession ? 'Tesztelés folytatása' : 'Tesztelés indítása';
  }

  /* ---------- Visszaállítás modal (süti) ---------- */

  function openRevertModal() {
    const modal = document.getElementById('modal-revert');
    const input = document.getElementById('revert-confirm-input');
    const btn   = document.getElementById('btn-revert-confirm');
    input.value = '';
    btn.disabled = true;
    openModal('modal-revert');
    setTimeout(() => input.focus(), 80);
  }

  function initRevertModal() {
    const input = document.getElementById('revert-confirm-input');
    const btn   = document.getElementById('btn-revert-confirm');
    if (!input || !btn) return;

    input.addEventListener('input', () => {
      btn.disabled = input.value.trim().toLowerCase() !== 'süti';
    });

    btn.addEventListener('click', async () => {
      const suite = await TF.Storage.getSuite(currentSuiteId);
      if (!suite) return;
      // Töröljük az összes értékelést, actualResult-ot és testSession-t
      suite.testCases.forEach(tc => { tc.evaluation = ''; tc.actualResult = ''; });
      suite.isCompleted = false;
      delete suite.testSession;
      suite.status = 'Új';
      try {
        await TF.Storage.upsertSuite(suite);
        closeModal('modal-revert');
        TF.UI.toast('Halmaz visszaállítva – minden eredmény törölve.', 'success');
        TF.Router.refresh();
      } catch(e) {
        TF.UI.toast('Hiba: ' + e.message, 'danger');
      }
    });
  }

  return { render, initStatic, getCurrentSuiteId, openViewTcFromSearch: openViewTcModal };
})();
