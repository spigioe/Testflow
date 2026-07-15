/* ====================================================================
   TF.Undo – Visszavonás kezelő (in-memory, max 10 lépés)

   Minden destruktív vagy módosító művelet előtt snapshot-ot mentünk
   az érintett suite-ról. Ctrl+Z megnyomásakor vagy az Undo gombra
   kattintva visszaállítjuk az előző állapotot.

   API:
     TF.Undo.push(suiteSnapshot, label)  – snapshot mentése
     TF.Undo.pop()                        – legutóbbi visszaállítása
     TF.Undo.canUndo()                    – van-e visszavonható?
     TF.Undo.clear()                      – ürítés (navigációkor)
==================================================================== */
window.TF = window.TF || {};

TF.Undo = (() => {
  const MAX = 10;
  const _stack = [];   // [{ suite: {...}, label: '' }, ...]
  let _onChangeCallback = null;

  /* Snapshot mentése visszavonáshoz (MIELŐTT a változás megtörténik) */
  function push(suite, label = 'Változtatás') {
    // Mélymásolat JSON-on keresztül
    _stack.push({ suite: JSON.parse(JSON.stringify(suite)), label });
    if (_stack.length > MAX) _stack.shift();
    _notifyChange();
  }

  /* Visszavonás: visszaállítja a legutóbbi snapshotot */
  async function pop() {
    if (!_stack.length) return;
    const { suite, label } = _stack.pop();
    try {
      await TF.Storage.upsertSuite(suite);
      TF.UI.toast(`Visszavonva: ${label}`, 'success');
      TF.Router.refresh();
    } catch (e) {
      TF.UI.toast('Visszavonási hiba: ' + e.message, 'danger');
    }
    _notifyChange();
  }

  function canUndo() { return _stack.length > 0; }
  function peekLabel() { return _stack.length ? _stack[_stack.length - 1].label : ''; }
  function clear() { _stack.length = 0; _notifyChange(); }

  function onChange(cb) { _onChangeCallback = cb; }
  function _notifyChange() { _onChangeCallback?.(); }

  /* Ctrl+Z / Cmd+Z globális billentyűparancs */
  function init() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Ne avatkozzunk be szövegmezőkbe
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        if (canUndo()) pop();
        else TF.UI.toast('Nincs visszavonható művelet.', '');
      }
    });
  }

  return { push, pop, canUndo, peekLabel, clear, onChange, init };
})();
