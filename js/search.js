/* ====================================================================
   TF.Search – ClickUp-stílusú globális kereső modal
   Keres: halmaz nevében, ClickUp ID-ban, megjegyzésben, státuszban,
          teszteset névben, ID-ban, lépésekben, elvárt/kapott eredményben
==================================================================== */
window.TF = window.TF || {};

TF.Search = (() => {
  const { esc, openModal, closeModal } = TF.UI;

  let _debounceTimer = null;
  let _selectedIndex = -1;
  let _results = [];

  /* ---------- keresés logika ---------- */

  function tokenize(q) {
    return q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  function matches(tokens, ...fields) {
    const haystack = fields.join(' ').toLowerCase();
    return tokens.every(t => haystack.includes(t));
  }

  function highlight(text, tokens) {
    if (!text) return '';
    let safe = esc(text);
    tokens.forEach(t => {
      const rx = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      safe = safe.replace(rx, '<mark>$1</mark>');
    });
    return safe;
  }

  async function search(query) {
    if (!TF.Storage.isReady()) return [];
    const tokens = tokenize(query);
    if (!tokens.length) return [];

    const suites = await TF.Storage.getSuites();
    const results = [];

    for (const suite of suites) {
      // Halmaz találat
      if (matches(tokens, suite.name, suite.clickupId, suite.notes, suite.status)) {
        results.push({ type: 'suite', suite });
      }

      // Teszteset találatok ezen a halmazon belül
      for (const tc of suite.testCases || []) {
        if (matches(tokens, tc.id, tc.name, tc.steps, tc.expectedResult, tc.actualResult)) {
          results.push({ type: 'tc', suite, tc });
        }
      }
    }

    return results;
  }

  /* ---------- render ---------- */

  const EVAL_ICONS = {
    'Sikeres':            '<i class="fa-solid fa-circle-check" style="color:var(--green);"></i>',
    'Sikertelen':         '<i class="fa-solid fa-circle-xmark" style="color:var(--red);"></i>',
    'Megbeszélésre vár':  '<i class="fa-solid fa-comments" style="color:var(--amber);"></i>',
  };

  function renderResults(results, tokens) {
    const container = document.getElementById('search-results');
    _results = results;
    _selectedIndex = results.length ? 0 : -1;

    if (!results.length) {
      container.innerHTML = `
        <div class="search-empty">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>Nincs találat</p>
        </div>`;
      return;
    }

    // Csoportosítás: előbb halmazok, aztán tesztesetek
    const suiteHits = results.filter(r => r.type === 'suite');
    const tcHits    = results.filter(r => r.type === 'tc');

    let html = '';

    if (suiteHits.length) {
      html += `<div class="search-group-label"><i class="fa-solid fa-layer-group"></i> Teszteset halmazok</div>`;
      suiteHits.forEach((r, i) => {
        const idx = results.indexOf(r);
        const meta = [
          r.suite.clickupId ? `<span class="search-result-clickup">${esc(r.suite.clickupId)}</span>` : '',
          r.suite.status    ? `<span class="search-result-meta">${esc(r.suite.status)}</span>` : '',
          `<span class="search-result-meta">${r.suite.testCases?.length ?? 0} teszteset</span>`
        ].filter(Boolean).join('');

        html += `
          <button class="search-result-item ${idx === _selectedIndex ? 'is-selected' : ''}" data-result-index="${idx}">
            <div class="search-result-icon suite-icon"><i class="fa-solid fa-flask-vial"></i></div>
            <div class="search-result-content">
              <div class="search-result-title">${highlight(r.suite.name, tokens)}</div>
              ${meta ? `<div class="search-result-subtitle">${meta}</div>` : ''}
            </div>
            <div class="search-result-arrow"><i class="fa-solid fa-arrow-right"></i></div>
          </button>`;
      });
    }

    if (tcHits.length) {
      html += `<div class="search-group-label"><i class="fa-solid fa-list-check"></i> Tesztesetek</div>`;
      tcHits.forEach(r => {
        const idx = results.indexOf(r);
        const evalIcon = EVAL_ICONS[r.tc.evaluation] || '<i class="fa-regular fa-clock" style="color:var(--text-muted);"></i>';
        html += `
          <button class="search-result-item ${idx === _selectedIndex ? 'is-selected' : ''}" data-result-index="${idx}">
            <div class="search-result-icon tc-icon">${evalIcon}</div>
            <div class="search-result-content">
              <div class="search-result-title">
                <span class="tc-id-badge" style="font-size:.72rem;">${esc(r.tc.id)}</span>
                ${highlight(r.tc.name, tokens)}
              </div>
              <div class="search-result-subtitle">
                <span class="search-result-meta"><i class="fa-solid fa-layer-group"></i> ${esc(r.suite.name)}</span>
                ${r.suite.clickupId ? `<span class="search-result-clickup">${esc(r.suite.clickupId)}</span>` : ''}
              </div>
            </div>
            <div class="search-result-arrow"><i class="fa-solid fa-arrow-right"></i></div>
          </button>`;
      });
    }

    container.innerHTML = html;
    updateSelection();
  }

  function renderEmpty(query) {
    const container = document.getElementById('search-results');
    _results = [];
    _selectedIndex = -1;

    if (!query.trim()) {
      container.innerHTML = `
        <div class="search-empty">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>Írj be legalább 1 karaktert a kereséshez</p>
        </div>`;
      return;
    }
    container.innerHTML = `
      <div class="search-empty">
        <i class="fa-solid fa-circle-exclamation"></i>
        <p>Nincs találat erre: <strong>${esc(query)}</strong></p>
      </div>`;
  }

  function renderLoading() {
    document.getElementById('search-results').innerHTML = `
      <div class="search-empty">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Keresés…</p>
      </div>`;
  }

  /* ---------- navigáció ---------- */

  function updateSelection() {
    document.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.classList.toggle('is-selected', i === _selectedIndex || parseInt(el.dataset.resultIndex) === _selectedIndex);
    });
    // Görgetés a láthatóba
    const sel = document.querySelector('.search-result-item.is-selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function moveSelection(dir) {
    if (!_results.length) return;
    _selectedIndex = (_selectedIndex + dir + _results.length) % _results.length;
    updateSelection();
  }

  function activateSelected() {
    if (_selectedIndex < 0 || _selectedIndex >= _results.length) return;
    navigate(_results[_selectedIndex]);
  }

  function navigate(result) {
    closeModal('modal-search');
    if (result.type === 'suite') {
      TF.Router.go(`/suite/${result.suite.id}`);
    } else {
      // Teszteset: megnyitja a halmazt, majd a view-tc modalt
      TF.Router.go(`/suite/${result.suite.id}`);
      // Kis késleltetés, hogy a nézet renderelődjön
      setTimeout(() => {
        if (typeof TF.Views.Suite?.openViewTcFromSearch === 'function') {
          TF.Views.Suite.openViewTcFromSearch(result.tc.id);
        }
      }, 180);
    }
  }

  /* ---------- modal kezelés ---------- */

  function open() {
    if (!TF.Storage.isReady()) {
      TF.UI.toast('Előbb nyiss meg egy adatfájlt!', 'danger');
      return;
    }
    openModal('modal-search');
    const input = document.getElementById('search-input');
    input.value = '';
    renderEmpty('');
    _results = [];
    _selectedIndex = -1;
    setTimeout(() => input.focus(), 50);
  }

  /* ---------- init ---------- */

  function init() {
    // Keresés gomb a navbarban
    document.getElementById('navbar-search-btn')
      .addEventListener('click', open);

    // Ctrl+K / Cmd+K billentyűparancs
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        open();
      }
    });

    // Input handler
    document.getElementById('search-input').addEventListener('input', e => {
      const q = e.target.value;
      clearTimeout(_debounceTimer);
      if (!q.trim()) { renderEmpty(''); return; }
      renderLoading();
      _debounceTimer = setTimeout(async () => {
        const tokens = tokenize(q);
        const results = await search(q);
        if (results.length) renderResults(results, tokens);
        else renderEmpty(q);
      }, 120);
    });

    // Billentyű navigáció a modálban
    document.getElementById('search-input').addEventListener('keydown', e => {
      if (e.key === 'ArrowDown')  { e.preventDefault(); moveSelection(1); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); moveSelection(-1); }
      if (e.key === 'Enter')      { e.preventDefault(); activateSelected(); }
    });

    // Kattintás az eredményre
    document.getElementById('search-results').addEventListener('click', e => {
      const item = e.target.closest('.search-result-item');
      if (!item) return;
      const idx = parseInt(item.dataset.resultIndex, 10);
      if (!isNaN(idx) && _results[idx]) navigate(_results[idx]);
    });
  }

  return { init, open };
})();
