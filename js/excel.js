/* ====================================================================
   TF.Excel – Excel import / export / sablon
==================================================================== */
window.TF = window.TF || {};

TF.Excel = (() => {
  const { toast, esc } = TF.UI;

  /* ---------- közös segédek ---------- */

  const VALID_EVALS = ['Sikeres', 'Sikertelen', 'Megbeszélésre vár'];

  // Javítva: ismeretlen értékelés-érték NEM kerül be nyersen az adatba,
  // hanem üres ('Nincs értékelés') lesz.
  function mapEvaluation(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (/^(sikeres|pass(ed)?|successful)$/i.test(v)) return 'Sikeres';
    if (/^(sikertelen|fail(ed)?)$/i.test(v)) return 'Sikertelen';
    if (/^(megbeszélésre vár|discussion)$/i.test(v)) return 'Megbeszélésre vár';
    return '';
  }

  function cell(row, ...keys) {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        // Az Excelből \r\n sortörések jöhetnek – normalizáljuk
        return String(row[k]).replace(/\r\n/g, '\n').trim();
      }
    }
    return '';
  }

  function rowToTestCase(row) {
    const id = cell(row, 'ID', 'id', 'Id');
    const name = cell(row, 'Név', 'Name', 'name', 'nev');
    if (!id && !name) return null;
    const finalId = id || TF.Storage.genId('TC');
    return {
      id: finalId,
      name: name || finalId,
      steps: cell(row, 'Lépések', 'Steps', 'steps'),
      expectedResult: cell(row, 'Elvárt eredmény', 'Expected Result', 'expectedResult'),
      actualResult: cell(row, 'Kapott eredmény', 'Actual Result', 'actualResult'),
      evaluation: mapEvaluation(cell(row, 'Értékelés', 'Evaluation', 'evaluation'))
    };
  }

  function tcToRow(tc) {
    return {
      'ID': tc.id,
      'Név': tc.name,
      'Lépések': tc.steps || '',
      'Elvárt eredmény': tc.expectedResult || '',
      'Kapott eredmény': tc.actualResult || '',
      'Értékelés': tc.evaluation || ''
    };
  }

  const TC_COLS = [{ wch: 12 }, { wch: 36 }, { wch: 44 }, { wch: 36 }, { wch: 36 }, { wch: 20 }];

  function sanitizeFilename(name) {
    return String(name || 'export')
      .replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ _-]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80);
  }

  function readFileAsWorkbook(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('A fájl nem olvasható.'));
      reader.onload = e => {
        try {
          resolve(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }));
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ---------- Tesztesetek importálása egy halmazba ---------- */

  async function importTestCases(file, suiteId) {
    const wb = await readFileAsWorkbook(file);
    if (!wb.SheetNames.length) throw new Error('A fájl nem tartalmaz munkalapot.');

    // Ha van "Tesztesetek" nevű lap, azt használjuk, különben az elsőt
    const sheetName = wb.SheetNames.includes('Tesztesetek') ? 'Tesztesetek' : wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

    const suite = await TF.Storage.getSuite(suiteId);
    if (!suite) throw new Error('A halmaz nem található.');

    let added = 0, updated = 0;
    for (const row of rows) {
      const tc = rowToTestCase(row);
      if (!tc) continue;
      const idx = suite.testCases.findIndex(t => t.id === tc.id);
      if (idx >= 0) { suite.testCases[idx] = tc; updated++; }
      else { suite.testCases.push(tc); added++; }
    }

    if (!added && !updated) throw new Error('A fájlban nem található importálható teszteset. Ellenőrizd a fejléceket a Formátum útmutató szerint!');

    await TF.Storage.upsertSuite(suite);
    return { added, updated };
  }

  /* ---------- Teljes halmaz beolvasása (előnézethez) ---------- */

  async function parseSuiteFile(file) {
    const wb = await readFileAsWorkbook(file);
    const infoSheetName = wb.SheetNames.find(n => n === 'Suite Info');
    const tcSheetName = wb.SheetNames.find(n => n === 'Tesztesetek') || wb.SheetNames[0];

    const meta = { name: '', notes: '', status: '', isCompleted: false };

    if (infoSheetName) {
      const infoRows = XLSX.utils.sheet_to_json(wb.Sheets[infoSheetName], { header: 1, defval: '' });
      for (const row of infoRows) {
        const key = String(row[0] || '').trim();
        const val = String(row[1] || '').trim();
        if (key === 'Név') meta.name = val;
        else if (key === 'Megjegyzés') meta.notes = val;
        else if (key === 'Státusz') meta.status = val;
        else if (key === 'Befejezett') meta.isCompleted = /^igen$/i.test(val);
      }
    }

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[tcSheetName], { defval: '' });
    const testCases = rows.map(rowToTestCase).filter(Boolean);

    if (!meta.name) {
      meta.name = file.name
        .replace(/\.xlsx?$/i, '')
        .replace(/_halmaz_export$/i, '')
        .replace(/_/g, ' ')
        .trim() || 'Importált halmaz';
    }

    return { meta, testCases };
  }

  /* ---------- Exportok ---------- */

  async function exportTestCasesXlsx(suiteId) {
    const suite = await TF.Storage.getSuite(suiteId);
    if (!suite?.testCases?.length) { toast('Nincsenek exportálható tesztesetek.', 'danger'); return; }
    const ws = XLSX.utils.json_to_sheet(suite.testCases.map(tcToRow));
    ws['!cols'] = TC_COLS;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tesztesetek');
    XLSX.writeFile(wb, `${sanitizeFilename(suite.name)}_tesztesetek.xlsx`);
    toast('Tesztesetek exportálva!', 'success');
  }

  async function exportTestCasesCsv(suiteId) {
    const suite = await TF.Storage.getSuite(suiteId);
    if (!suite?.testCases?.length) { toast('Nincsenek exportálható tesztesetek.', 'danger'); return; }
    const ws = XLSX.utils.json_to_sheet(suite.testCases.map(tcToRow));
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(suite.name)}_tesztesetek.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV exportálva!', 'success');
  }

  async function exportFullSuiteXlsx(suiteId) {
    const suite = await TF.Storage.getSuite(suiteId);
    if (!suite) return;
    const wb = XLSX.utils.book_new();

    const infoData = [
      { Kulcs: 'Név',        Érték: suite.name },
      { Kulcs: 'Megjegyzés', Érték: suite.notes || '' },
      { Kulcs: 'Státusz',    Érték: suite.status || '' },
      { Kulcs: 'Befejezett', Érték: suite.isCompleted ? 'igen' : 'nem' }
    ];
    const wsInfo = XLSX.utils.json_to_sheet(infoData, { header: ['Kulcs', 'Érték'] });
    wsInfo['!cols'] = [{ wch: 16 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Suite Info');

    const wsTc = XLSX.utils.json_to_sheet(suite.testCases.map(tcToRow));
    wsTc['!cols'] = TC_COLS;
    XLSX.utils.book_append_sheet(wb, wsTc, 'Tesztesetek');

    XLSX.writeFile(wb, `${sanitizeFilename(suite.name)}_halmaz_export.xlsx`);
    toast('Teljes halmaz exportálva!', 'success');
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const rows = [
      { 'ID': 'TC-001', 'Név': 'Példa teszteset 1', 'Lépések': '1. Nyisd meg az oldalt\n2. Kattints a gombra\n3. Ellenőrizd az eredményt', 'Elvárt eredmény': 'A várt dolog megtörténik', 'Kapott eredmény': '', 'Értékelés': '' },
      { 'ID': 'TC-002', 'Név': 'Példa teszteset 2', 'Lépések': '1. Adj meg hibás adatot\n2. Kattints Mentés gombra', 'Elvárt eredmény': 'Hibaüzenet jelenik meg', 'Kapott eredmény': 'Hibaüzenet megjelent', 'Értékelés': 'Sikeres' },
      { 'ID': 'TC-003', 'Név': 'Példa teszteset 3', 'Lépések': '1. Navigálj a főoldalra', 'Elvárt eredmény': 'Főoldal betölt 2 mp-en belül', 'Kapott eredmény': 'Nem töltött be', 'Értékelés': 'Sikertelen' },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = TC_COLS;
    XLSX.utils.book_append_sheet(wb, ws, 'Tesztesetek');

    const infoRows = [
      { 'Oszlop': 'ID', 'Leírás': 'Egyedi azonosító (pl. TC-001). Egyező ID importnál felülírást jelent.', 'Kötelező?': 'Ajánlott' },
      { 'Oszlop': 'Név', 'Leírás': 'A teszteset neve.', 'Kötelező?': 'Igen' },
      { 'Oszlop': 'Lépések', 'Leírás': 'Sortöréssel (Alt+Enter) elválasztott lépések.', 'Kötelező?': 'Nem' },
      { 'Oszlop': 'Elvárt eredmény', 'Leírás': 'Mi az elvárt viselkedés.', 'Kötelező?': 'Nem' },
      { 'Oszlop': 'Kapott eredmény', 'Leírás': 'Teszteléskor kapott tényleges eredmény.', 'Kötelező?': 'Nem' },
      { 'Oszlop': 'Értékelés', 'Leírás': 'Sikeres / Sikertelen / Megbeszélésre vár (vagy Pass / Fail / Discussion)', 'Kötelező?': 'Nem' },
    ];
    const wsInfo = XLSX.utils.json_to_sheet(infoRows);
    wsInfo['!cols'] = [{ wch: 18 }, { wch: 58 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Útmutató');

    XLSX.writeFile(wb, 'TestFlow_minta_sablon.xlsx');
    toast('Minta sablon letöltve!', 'success');
  }

  return {
    importTestCases, parseSuiteFile,
    exportTestCasesXlsx, exportTestCasesCsv, exportFullSuiteXlsx,
    downloadTemplate, sanitizeFilename, VALID_EVALS
  };
})();
