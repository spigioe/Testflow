/* ====================================================================
   TF.Views.Testing – Futtatás mód (dedikált tesztelő nézet)
==================================================================== */
window.TF = window.TF || {};
TF.Views = TF.Views || {};

TF.Views.Testing = (() => {
  const { esc, toast, confirm } = TF.UI;

  const state = {
    suiteId: null,
    cases: [],
    current: 0,
    results: {}
  };

  /* ---------- indítás / leállítás ---------- */

  async function start(suiteId) {
    const suite = await TF.Storage.getSuite(suiteId);
    if (!suite || !suite.testCases.length) {
      toast('Ehhez a halmazhoz nincsenek tesztesetek.', 'danger');
      return;
    }

    state.suiteId = suiteId;
    state.cases = suite.testCases.map(tc => ({ ...tc }));
    state.results = {};

    // Folytatási pont visszaállítása ha van mentett session
    const savedSession = suite.testSession;
    let resumeFrom = -1;

    if (savedSession && savedSession.results) {
      // Betöltjük a mentett részeredményeket
      state.results = savedSession.results;
      resumeFrom = savedSession.currentIndex ?? -1;
      // Ellenőrizzük, hogy érvényes-e még (TC lista nem változott közben)
      const savedIds = new Set(Object.keys(savedSession.results));
      const currentIds = new Set(state.cases.map(t => t.id));
      const isValid = [...savedIds].every(id => currentIds.has(id));
      if (!isValid) { resumeFrom = -1; state.results = {}; }
    }

    if (Object.keys(state.results).length === 0) {
      for (const tc of state.cases) {
        state.results[tc.id] = {
          actualResult: tc.actualResult || '',
          evaluation:   tc.evaluation   || '',
          attachments:  tc.attachments  || []
        };
      }
    } else {
      // Folytatásnál is biztosítjuk az attachments mezőt
      for (const tc of state.cases) {
        if (state.results[tc.id] && !state.results[tc.id].attachments) {
          state.results[tc.id].attachments = tc.attachments || [];
        }
      }
    }

    // Folytatási pont meghatározása
    if (resumeFrom >= 0 && resumeFrom < state.cases.length) {
      state.current = resumeFrom;
      toast(`Folytatás a(z) ${resumeFrom + 1}. tesztesettől (mentett pont).`);
    } else {
      const firstPending = state.cases.findIndex(tc => !state.results[tc.id]?.evaluation);
      state.current = firstPending >= 0 ? firstPending : 0;
      if (firstPending > 0) {
        toast(`${firstPending} már értékelt teszteset átugorva – a ${firstPending + 1}. tesztesettől folytatjuk.`);
      }
    }

    document.getElementById('testing-suite-title').innerHTML =
      `<strong>${esc(suite.name)}</strong> – Tesztelés`;

    const TESTING_STATUS = 'Tesztelés alatt';
    if (suite.status !== TESTING_STATUS) {
      suite.status = TESTING_STATUS;
      try { await TF.Storage.upsertSuite(suite); } catch (_) { /* nem blokkoló */ }
    }

    document.getElementById('testing-overlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    renderStep();
  }

  function closeOverlay() {
    document.getElementById('testing-overlay').classList.remove('is-open');
    document.body.style.overflow = '';
  }

  async function exitAndSave() {
    captureCurrent();
    const suite = await TF.Storage.getSuite(state.suiteId);
    if (!suite) { closeOverlay(); return; }

    for (const tc of suite.testCases) {
      const r = state.results[tc.id];
      if (r) {
        tc.actualResult  = r.actualResult;
        tc.evaluation    = r.evaluation;
        tc.attachments   = r.attachments || [];
      }
    }

    // Folytatási pont elmentése
    suite.testSession = {
      currentIndex: state.current,
      results: { ...state.results },
      savedAt: new Date().toISOString()
    };

    try {
      await TF.Storage.upsertSuite(suite);
      toast('Részeredmények elmentve.', 'success');
    } catch (e) {
      toast('Mentési hiba kilépéskor: ' + e.message, 'danger');
    }
    closeOverlay();
    TF.Router.refresh();
  }

  async function finish() {
    captureCurrent();
    const suite = await TF.Storage.getSuite(state.suiteId);
    if (!suite) {
      toast('A halmaz időközben törlődött, az eredmények nem menthetők.', 'danger');
      closeOverlay();
      return;
    }
    for (const tc of suite.testCases) {
      const r = state.results[tc.id];
      if (r) {
        tc.actualResult  = r.actualResult;
        tc.evaluation    = r.evaluation;
        tc.attachments   = r.attachments || [];
      }
    }
    suite.isCompleted = true;
    suite.status = 'Tesztelés befejezve';
    // Folytatási pont törlése – kész a tesztelés
    delete suite.testSession;
    try {
      await TF.Storage.upsertSuite(suite);
      closeOverlay();
      toast('Tesztelés befejezve és elmentve!', 'success');
      TF.Router.go(`/suite/${state.suiteId}`);
      TF.Router.refresh();
    } catch (e) {
      toast('Mentési hiba: ' + e.message, 'danger');
    }
  }

  /* ---------- léptetés ---------- */

  function renderStep() {
    const tc = state.cases[state.current];
    const total = state.cases.length;

    document.getElementById('testing-step-label').textContent = `${state.current + 1} / ${total}`;
    document.getElementById('testing-progress-fill').style.width =
      `${Math.round(((state.current + 1) / total) * 100)}%`;

    document.getElementById('testing-card-top').innerHTML = `
      <div class="testing-tc-id">${esc(tc.id)}</div>
      <div class="testing-tc-name">${esc(tc.name)}</div>
      ${tc.steps ? `
      <div class="testing-field-block">
        <div class="testing-field-label"><i class="fa-solid fa-list-ol"></i> Lépések</div>
        <div class="testing-field-value">${esc(tc.steps)}</div>
      </div>` : ''}
      ${tc.expectedResult ? `
      <div class="testing-field-block">
        <div class="testing-field-label"><i class="fa-solid fa-bullseye"></i> Elvárt eredmény</div>
        <div class="testing-field-value">${esc(tc.expectedResult)}</div>
      </div>` : ''}
      ${!tc.steps && !tc.expectedResult ? `
      <div class="testing-field-block">
        <div class="testing-field-value text-muted">Ehhez a tesztesethez nincsenek rögzített lépések vagy elvárt eredmény.</div>
      </div>` : ''}`;

    const res = state.results[tc.id] || { actualResult: '', evaluation: '', attachments: [] };

    document.getElementById('testing-card-bottom').innerHTML = `
      <div class="form-group">
        <label class="form-label" for="t-actual">Kapott eredmény</label>
        <textarea class="form-textarea" id="t-actual" placeholder="Írd le, mi történt ténylegesen...">${esc(res.actualResult)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Értékelés</label>
        <div class="eval-buttons">
          <button class="eval-btn ${res.evaluation === 'Sikeres' ? 'selected-success' : ''}" data-eval="Sikeres"><i class="fa-solid fa-circle-check"></i> Sikeres</button>
          <button class="eval-btn ${res.evaluation === 'Sikertelen' ? 'selected-fail' : ''}" data-eval="Sikertelen"><i class="fa-solid fa-circle-xmark"></i> Sikertelen</button>
          <button class="eval-btn ${res.evaluation === 'Megbeszélésre vár' ? 'selected-discuss' : ''}" data-eval="Megbeszélésre vár"><i class="fa-solid fa-comments"></i> Megbeszélésre vár</button>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        ${TF.Attachments.renderAttachmentsSection(tc.id, res.attachments)}
      </div>`;

    // Csatolmány – kép hozzáadása gomb
    document.getElementById(`btn-att-add-${tc.id}`)?.addEventListener('click', async () => {
      const newAtts = await TF.Attachments.pickImages();
      if (!newAtts.length) return;
      // captureCurrent előbb, hogy az actual+eval ne vesszen el
      captureCurrent();
      const cur = state.results[tc.id] || { actualResult: '', evaluation: '', attachments: [] };
      cur.attachments = [...(cur.attachments || []), ...newAtts];
      state.results[tc.id] = cur;
      renderStep();
    });

    // Csatolmány – eltávolítás
    document.getElementById(`att-section-${tc.id}`)?.addEventListener('click', e => {
      const btn = e.target.closest('.att-remove-btn');
      if (!btn) return;
      captureCurrent();
      const idx = parseInt(btn.dataset.attIdx, 10);
      const cur = state.results[tc.id];
      if (!cur?.attachments) return;
      cur.attachments.splice(idx, 1);
      renderStep();
    });

    const isLast = state.current === total - 1;
    const hasSavedSession = !!state.cases[state.current]; // always true; indicator based on session
    document.getElementById('testing-nav').innerHTML = `
      <button class="btn-test-nav" data-tnav="prev" ${state.current === 0 ? 'disabled' : ''}>
        <i class="fa-solid fa-arrow-left"></i> Előző
      </button>
      <button class="btn-test-nav" data-tnav="exit">
        <i class="fa-solid fa-floppy-disk"></i> Mentés és kilépés
      </button>
      ${isLast
        ? `<button class="btn-test-nav btn-test-finish" data-tnav="finish"><i class="fa-solid fa-flag-checkered"></i> Tesztelés befejezése</button>`
        : `<button class="btn-test-nav" data-tnav="next">Következő <i class="fa-solid fa-arrow-right"></i></button>`}`;
  }

  function captureCurrent() {
    const tc = state.cases[state.current];
    if (!tc) return;
    const actual = document.getElementById('t-actual')?.value ?? '';
    const selected = document.querySelector('#testing-card-bottom .eval-btn[class*="selected-"]');
    const evaluation = selected
      ? selected.dataset.eval
      : (state.results[tc.id]?.evaluation || '');
    // Attachments megmaradnak – csak az actual+evaluation frissül
    state.results[tc.id] = {
      actualResult: actual,
      evaluation,
      attachments: state.results[tc.id]?.attachments || []
    };
  }

  async function finish() {
    captureCurrent();
    const suite = await TF.Storage.getSuite(state.suiteId);
    if (!suite) {
      toast('A halmaz időközben törlődött, az eredmények nem menthetők.', 'danger');
      closeOverlay();
      return;
    }
    for (const tc of suite.testCases) {
      const r = state.results[tc.id];
      if (r) {
        tc.actualResult = r.actualResult;
        tc.evaluation = r.evaluation;
      }
    }
    suite.isCompleted = true;
    suite.status = 'Tesztelés befejezve';
    try {
      await TF.Storage.upsertSuite(suite);
      closeOverlay();
      toast('Tesztelés befejezve és elmentve!', 'success');
      TF.Router.go(`/suite/${state.suiteId}`);
      TF.Router.refresh();
    } catch (e) {
      toast('Mentési hiba: ' + e.message, 'danger');
    }
  }

  /* ---------- statikus eseménykezelés (egyszer fut) ----------
     Az overlay-en delegált handlerek: render-enként nem halmozódnak. */
  function initStatic() {
    const overlay = document.getElementById('testing-overlay');

    overlay.addEventListener('click', e => {
      const evalBtn = e.target.closest('.eval-btn');
      if (evalBtn) {
        overlay.querySelectorAll('.eval-btn').forEach(b => {
          b.classList.remove('selected-success', 'selected-fail', 'selected-discuss');
        });
        const ev = evalBtn.dataset.eval;
        if (ev === 'Sikeres') evalBtn.classList.add('selected-success');
        else if (ev === 'Sikertelen') evalBtn.classList.add('selected-fail');
        else evalBtn.classList.add('selected-discuss');
        captureCurrent();
        return;
      }

      const nav = e.target.closest('[data-tnav]');
      if (!nav || nav.disabled) return;
      switch (nav.dataset.tnav) {
        case 'prev':
          captureCurrent(); state.current--; renderStep(); break;
        case 'next':
          captureCurrent(); state.current++; renderStep(); break;
        case 'finish':
          finish(); break;
        case 'exit':
          exitAndSave(); break;
      }
    });

    overlay.addEventListener('input', e => {
      if (e.target.id === 't-actual') captureCurrent();
    });
  }

  return { start, initStatic };
})();
