/* ====================================================================
   TF.Storage – REST API alapú adatkezelés
   Az összes adat a /api/suites végponton keresztül érhető el.
   A File System Access API-t ez a modul teljesen kiváltja.
==================================================================== */
window.TF = window.TF || {};

TF.Storage = (() => {
  const BASE = '/api';

  /* ── segéd: fetch + JSON + hibajelzés ── */
  async function _fetch(path, options = {}) {
    const res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API hiba (${res.status}): ${text || res.statusText}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /* ── In-memory cache (gyors helyi olvasás között) ── */
  let _cache = null;

  async function _ensureCache() {
    if (!_cache) _cache = await _fetch('/suites');
    return _cache;
  }

  function _invalidate() { _cache = null; }

  /* ── Publikus API (megegyezik a régi TF.Storage interfészével) ── */

  function isSupported() { return true; }
  function isReady()     { return true; }  // REST mindig kész
  function getFileName() { return 'REST API'; }

  // Fájlválasztó helyett az API ellenőrzése
  async function init() {
    try {
      await _fetch('/suites');
      return true;
    } catch {
      return false;
    }
  }

  async function getSuites() {
    const suites = await _ensureCache();
    return suites ?? [];
  }

  async function getSuite(id) {
    // Gyors cache-ből
    if (_cache) {
      const found = _cache.find(s => s.id === id || s.Id === id);
      if (found) return _normalize(found);
    }
    const suite = await _fetch(`/suites/${id}`);
    return suite ? _normalize(suite) : null;
  }

  async function upsertSuite(suite) {
    const body = _denormalize(suite);
    await _fetch(`/suites/${body.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    _invalidate();
  }

  async function saveSuites(suites) {
    // Átrendezés
    const ids = suites.map(s => s.id || s.Id);
    await _fetch('/suites/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    _invalidate();
  }

  async function deleteSuite(id) {
    await _fetch(`/suites/${id}`, { method: 'DELETE' });
    _invalidate();
  }

  function genId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /* ── Normalizáció: API PascalCase → frontend camelCase ── */
  function _normalize(s) {
    return {
      id:          s.id          ?? s.Id          ?? '',
      name:        s.name        ?? s.Name        ?? '',
      notes:       s.notes       ?? s.Notes       ?? '',
      status:      s.status      ?? s.Status      ?? '',
      clickupId:   s.clickupId   ?? s.ClickupId   ?? '',
      isCompleted: s.isCompleted ?? s.IsCompleted ?? false,
      testSession: s.testSession ?? s.TestSession ?? null,
      testCases: (s.testCases ?? s.TestCases ?? []).map(tc => ({
        id:             tc.id             ?? tc.Id             ?? '',
        name:           tc.name           ?? tc.Name           ?? '',
        steps:          tc.steps          ?? tc.Steps          ?? '',
        expectedResult: tc.expectedResult ?? tc.ExpectedResult ?? '',
        actualResult:   tc.actualResult   ?? tc.ActualResult   ?? '',
        evaluation:     tc.evaluation     ?? tc.Evaluation     ?? '',
        attachments: (tc.attachments ?? tc.Attachments ?? []).map(a => ({
          dataUrl:  a.dataUrl  ?? a.DataUrl  ?? '',
          name:     a.fileName ?? a.FileName ?? '',
          sizePx:   a.sizePx   ?? a.SizePx   ?? '',
          sizeKb:   a.sizeKb   ?? a.SizeKb   ?? 0,
        })),
      })),
    };
  }

  /* ── Denormalizáció: frontend camelCase → API PascalCase ── */
  function _denormalize(s) {
    return {
      id:          s.id || s.Id,
      name:        s.name        ?? '',
      notes:       s.notes       ?? '',
      status:      s.status      ?? '',
      clickupId:   s.clickupId   ?? '',
      isCompleted: s.isCompleted ?? false,
      testSession: s.testSession ?? null,
      sortOrder:   s.sortOrder   ?? 0,
      testCases: (s.testCases ?? []).map((tc, i) => ({
        id:             tc.id             ?? '',
        name:           tc.name           ?? '',
        steps:          tc.steps          ?? '',
        expectedResult: tc.expectedResult ?? '',
        actualResult:   tc.actualResult   ?? '',
        evaluation:     tc.evaluation     ?? '',
        sortOrder:      i,
        attachments: (tc.attachments ?? []).map((a, j) => ({
          dataUrl:   a.dataUrl  ?? '',
          fileName:  a.name     ?? a.fileName ?? '',
          sizePx:    a.sizePx   ?? '',
          sizeKb:    a.sizeKb   ?? 0,
          sortOrder: j,
        })),
      })),
    };
  }

  return {
    isSupported, isReady, getFileName, init,
    getSuites, getSuite, upsertSuite, saveSuites, deleteSuite, genId,
    // Kompatibilitás: régi kód használja ezeket
    createNew:    async () => true,
    openExisting: async () => true,
  };
})();
