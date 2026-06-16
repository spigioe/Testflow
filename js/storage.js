/* ====================================================================
   TF.Storage – fájl-alapú tárolás (File System Access API)
   A tárolás módja változatlan: az adatok egy felhasználó által
   kiválasztott .json fájlban élnek.
==================================================================== */
window.TF = window.TF || {};

TF.Storage = (() => {
  let _fileHandle = null;   // FileSystemFileHandle
  let _cache = null;        // a fájl tartalmának memóriabeli tükre
  let _writeQueue = Promise.resolve(); // írások sorosítása versenyhelyzet ellen

  const EMPTY = () => ({ suites: [] });


  /* ---------- adatmigráció ----------
     Régi verziókból érkező fájlok "javítása":
     - Ha a JSON gyökér egy tömb volt (nagyon régi verzió), becsomagoljuk
     - Hiányzó mezők pótlása az összes suiten és teszteseten
  --------------------------------------------------------- */
  function _migrate(raw) {
    let data = raw;

    // Ha a gyökér tömb (legrégebbi verzió), becsomagoljuk
    if (Array.isArray(data)) {
      data = { suites: data };
    }

    // Biztonsági háló: suites mező garantálása
    if (!data || typeof data !== 'object') data = { suites: [] };
    if (!Array.isArray(data.suites)) data.suites = [];

    // Suite-szintű mezők pótlása
    data.suites = data.suites.map(s => ({
      id:          s.id          ?? `suite_migrated_${Math.random().toString(36).slice(2,7)}`,
      name:        s.name        ?? 'Névtelen halmaz',
      notes:       s.notes       ?? '',
      status:      s.status      ?? '',
      clickupId:   s.clickupId   ?? '',
      isCompleted: s.isCompleted ?? false,
      testSession: s.testSession ?? null,  // folytatási pont
      testCases:   Array.isArray(s.testCases) ? s.testCases.map(tc => ({
        id:             tc.id             ?? `TC_migrated_${Math.random().toString(36).slice(2,7)}`,
        name:           tc.name           ?? 'Névtelen teszteset',
        steps:          tc.steps          ?? '',
        expectedResult: tc.expectedResult ?? '',
        actualResult:   tc.actualResult   ?? '',
        evaluation:     tc.evaluation     ?? ''
      })) : []
    }));

    return data;
  }

  async function _readFile() {
    if (!_fileHandle) throw new Error('Nincs megnyitott adatfájl.');
    const file = await _fileHandle.getFile();
    const text = await file.text();
    if (!text.trim()) return _migrate({});

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // JSON szintaktikai hiba: megpróbáljuk a törött fájlt legalább részben megmenteni
      // BOM vagy trailing comma eltávolítással
      try {
        const cleaned = text
          .replace(/^\uFEFF/, '')           // BOM
          .replace(/,\s*([}\]])/g, '$1');   // trailing commas
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error(
          'A fájl tartalma nem értelmezhető JSON-ként. ' +
          'Ha régebbi verzióból mentett fájlod van, ' +
          'próbáld meg egy szövegszerkesztőben ellenőrizni.'
        );
      }
    }

    return _migrate(parsed);
  }

  function _writeFile(data) {
    // Sorba állítjuk az írásokat, hogy két gyors mentés ne fusson párhuzamosan
    _writeQueue = _writeQueue.then(async () => {
      if (!_fileHandle) throw new Error('Nincs megnyitott adatfájl.');
      const writable = await _fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    });
    return _writeQueue;
  }

  /* ---------- fájlkezelés ---------- */

  function isSupported() {
    return typeof window.showOpenFilePicker === 'function'
        && typeof window.showSaveFilePicker === 'function';
  }

  function isReady() { return _fileHandle !== null; }
  function getFileName() { return _fileHandle ? _fileHandle.name : null; }

  async function createNew() {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'testflow_adatok.json',
      types: [{ description: 'TestFlow adatfájl', accept: { 'application/json': ['.json'] } }]
    });
    _fileHandle = handle;
    _cache = EMPTY();
    await _writeFile(_cache);
  }

  async function openExisting() {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'TestFlow adatfájl', accept: { 'application/json': ['.json'] } }],
      multiple: false
    });
    // Csak akkor cseréljük le az aktuális handle-t, ha a fájl érvényes
    const prevHandle = _fileHandle;
    _fileHandle = handle;
    try {
      _cache = await _readFile();
    } catch (e) {
      _fileHandle = prevHandle;
      throw e;
    }
  }

  /* ---------- adathozzáférés ---------- */

  async function _ensureCache() {
    if (!_cache) _cache = await _readFile();
    return _cache;
  }

  async function getSuites() {
    const d = await _ensureCache();
    return d.suites;
  }

  async function getSuite(id) {
    const suites = await getSuites();
    return suites.find(s => s.id === id) || null;
  }

  async function upsertSuite(suite) {
    const d = await _ensureCache();
    const idx = d.suites.findIndex(s => s.id === suite.id);
    if (idx >= 0) d.suites[idx] = suite;
    else d.suites.push(suite);
    await _writeFile(d);
  }

  // Teljes suites tömb mentése (drag-and-drop átrendezéshez)
  async function saveSuites(suites) {
    const d = await _ensureCache();
    d.suites = suites;
    await _writeFile(d);
  }

  async function deleteSuite(id) {
    const d = await _ensureCache();
    d.suites = d.suites.filter(s => s.id !== id);
    await _writeFile(d);
  }

  function genId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  return {
    isSupported, isReady, getFileName,
    createNew, openExisting,
    getSuites, getSuite, upsertSuite, saveSuites, deleteSuite, genId
  };
})();
