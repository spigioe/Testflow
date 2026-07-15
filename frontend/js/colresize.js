/* ====================================================================
   TF.ColResize – tc-table oszlop-átméretezés
   ─ Drag a th jobb szélén lévő handle-lel
   ─ Szélességek localStorage-ban tárolódnak (suite ID szerint)
   ─ Dupla klikk: visszaállítja az adott oszlop alapértelmezését
==================================================================== */
window.TF = window.TF || {};

TF.ColResize = (() => {

  /* ── alapértelmezett oszlopszélességek (px) ── */
  const DEFAULTS = {
    0: 160,  // ID (checkbox + drag + badge)
    1: 200,  // Név
    2: 220,  // Lépések
    3: 200,  // Elvárt eredmény
    4: 200,  // Kapott eredmény
    5: 160,  // Értékelés
    6: 130,  // Műveletek
  };
  const MIN_W = 80;
  const STORE_KEY = 'tf_col_widths_v1';

  /* ── localStorage segédek ── */
  function loadWidths(suiteId) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const all = JSON.parse(raw);
      return all[suiteId] || null;
    } catch { return null; }
  }

  function saveWidths(suiteId, widths) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[suiteId] = widths;
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch {}
  }

  /* ── fő init ── */
  function init(suiteId) {
    const table = document.querySelector('.tc-table');
    if (!table) return;

    const ths = Array.from(table.querySelectorAll('thead th'));
    if (!ths.length) return;

    // table-layout: fixed → explicit width kell minden th-ra
    const saved = loadWidths(suiteId);

    ths.forEach((th, i) => {
      const w = (saved && saved[i] != null) ? saved[i] : (DEFAULTS[i] || 160);
      th.style.width = w + 'px';

      // Resize handle
      const handle = document.createElement('div');
      handle.className = 'col-resize-handle';
      handle.title = 'Húzd az átméretezéshez · dupla klikk: alapértelmezett';
      th.appendChild(handle);

      /* ── drag logic ── */
      let startX, startW;

      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        startX = e.clientX;
        startW = th.offsetWidth;
        handle.classList.add('is-resizing');
        document.body.classList.add('col-resizing');

        function onMove(ev) {
          const delta = ev.clientX - startX;
          const newW  = Math.max(MIN_W, startW + delta);
          th.style.width = newW + 'px';
        }

        function onUp() {
          handle.classList.remove('is-resizing');
          document.body.classList.remove('col-resizing');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
          // Mentés
          _persistAll(suiteId, ths);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      });

      /* ── dupla klikk: reset egy oszlop ── */
      handle.addEventListener('dblclick', e => {
        e.preventDefault();
        th.style.width = (DEFAULTS[i] || 160) + 'px';
        _persistAll(suiteId, ths);
      });
    });

    // Az összes szélesség elmentése első betöltéskor is (ha nem volt mentve)
    if (!saved) _persistAll(suiteId, ths);
  }

  function _persistAll(suiteId, ths) {
    const widths = {};
    ths.forEach((th, i) => { widths[i] = th.offsetWidth; });
    saveWidths(suiteId, widths);
  }

  /* reset: töröl egy suite mentett szélességeit */
  function resetForSuite(suiteId) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const all = JSON.parse(raw);
      delete all[suiteId];
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch {}
  }

  return { init, resetForSuite };
})();
