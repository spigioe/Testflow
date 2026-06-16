/* ====================================================================
   TF.UI – általános UI segédfüggvények
   (toast, modálok, megerősítő dialógus, HTML escape, badge-ek)
==================================================================== */
window.TF = window.TF || {};

TF.UI = (() => {

  /* ---------- HTML escape ----------
     Idézőjeleket is escape-eljük, mert attribútumokba is kerül érték. */
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Toast ---------- */
  function toast(message, type = '') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type ? 'is-' + type : ''}`;
    const icon = type === 'success' ? 'fa-circle-check'
               : type === 'danger'  ? 'fa-circle-exclamation'
               : 'fa-circle-info';
    // Az üzenet escape-elve kerül be, így halmaznév sem okozhat HTML injektálást
    t.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${esc(message)}</span>`;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  /* ---------- Modálok ---------- */
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('is-open');
  }

  /* ---------- Modal shake ---------- */
  function shakeModal(id) {
    const box = document.querySelector(`#${id} .modal-box`);
    if (!box) return;
    box.classList.remove('is-shaking');
    // Rövid timeout kell, hogy a class-eltávolítás után az animáció újrainduljon
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-shaking')));
    box.addEventListener('animationend', () => box.classList.remove('is-shaking'), { once: true });
  }

  /* ---------- "Védett" modalok listája ----------
     Ezeket overlay-kattintásra és Esc-re NEM zárjuk be, csak megrázunk. */
  const SHAKE_ONLY = new Set(['modal-testcase']);

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('is-open');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.is-open').forEach(m => {
      if (!SHAKE_ONLY.has(m.id)) m.classList.remove('is-open');
      else shakeModal(m.id);
    });
  }

  // data-close gombok + overlay kattintás.
  let _mouseDownTarget = null;
  document.addEventListener('mousedown', e => { _mouseDownTarget = e.target; });
  document.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      // A "Mégse" / X gombok mindig bezárnak (szándékos felhasználói akció)
      closeModal(closeBtn.dataset.close);
      return;
    }
    if (e.target.classList.contains('modal-overlay') && _mouseDownTarget === e.target) {
      const id = e.target.id;
      if (SHAKE_ONLY.has(id)) shakeModal(id);
      else closeModal(id);
    }
  });

  // Esc: védett modált ráz, többit bezárja
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });

  /* ---------- Megerősítő dialógus ----------
     Javítva: a Mégse / X / overlay-zárás is feloldja a Promise-t (false),
     és minden listener takarítva van — nem halmozódnak fel a kattintások. */
  function confirm(title, message) {
    return new Promise(resolve => {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;

      const modal = document.getElementById('modal-confirm');
      const okBtn = document.getElementById('btn-confirm-ok');

      function cleanup(result) {
        okBtn.removeEventListener('click', onOk);
        observer.disconnect();
        closeModal('modal-confirm');
        resolve(result);
      }
      function onOk() { cleanup(true); }

      // Ha bármilyen módon bezárul a modál (Mégse, X, overlay, Esc),
      // az is "false" eredménnyel zárja a Promise-t.
      const observer = new MutationObserver(() => {
        if (!modal.classList.contains('is-open')) cleanup(false);
      });

      okBtn.addEventListener('click', onOk);
      openModal('modal-confirm');
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ---------- Megjelenítési segédek ---------- */
  function evalBadge(val) {
    if (!val) return `<span class="eval-badge pending"><i class="fa-regular fa-clock"></i> Nincs értékelés</span>`;
    if (val === 'Sikeres') return `<span class="eval-badge success"><i class="fa-solid fa-circle-check"></i> Sikeres</span>`;
    if (val === 'Sikertelen') return `<span class="eval-badge fail"><i class="fa-solid fa-circle-xmark"></i> Sikertelen</span>`;
    return `<span class="eval-badge discuss"><i class="fa-solid fa-comments"></i> Megbeszélésre vár</span>`;
  }

  function getStats(testCases) {
    let s = 0, f = 0, d = 0, n = 0;
    for (const tc of testCases || []) {
      if (tc.evaluation === 'Sikeres') s++;
      else if (tc.evaluation === 'Sikertelen') f++;
      else if (tc.evaluation === 'Megbeszélésre vár') d++;
      else n++;
    }
    return { s, f, d, n };
  }

  function stepsHtml(steps) {
    if (!steps) return '<span class="text-muted">–</span>';
    const lines = String(steps).split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return '<span class="text-muted">–</span>';
    if (lines.length === 1) return `<span>${esc(lines[0])}</span>`;
    return `<ol class="steps-list">${lines.map(l => `<li>${esc(l.replace(/^\d+[.)]\s*/, ''))}</li>`).join('')}</ol>`;
  }

  return { esc, toast, openModal, closeModal, closeAllModals, shakeModal, confirm, evalBadge, getStats, stepsHtml };
})();
