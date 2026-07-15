/* ====================================================================
   TF.HtmlReport – HTML report generátor
   Két mód:
     'pre'  – futtatás előtti: ID, Név, Lépések, Elvárt eredmény
     'post' – futtatás utáni: minden oszlop + értékelés badge-ek
==================================================================== */
window.TF = window.TF || {};

TF.HtmlReport = (() => {

  /* ---------- segédek ---------- */

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stepsHtml(steps) {
    if (!steps || !steps.trim()) return '<span class="empty">–</span>';
    const lines = steps.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 1) return `<span>${esc(lines[0])}</span>`;
    return '<ol>' + lines.map(l => `<li>${esc(l.replace(/^\d+[.)]\s*/, ''))}</li>`).join('') + '</ol>';
  }

  function evalBadge(val) {
    if (!val) return '<span class="badge badge-pending">Nincs értékelés</span>';
    if (val === 'Sikeres')           return '<span class="badge badge-success">✓ Sikeres</span>';
    if (val === 'Sikertelen')        return '<span class="badge badge-fail">✗ Sikertelen</span>';
    if (val === 'Megbeszélésre vár') return '<span class="badge badge-discuss">⚑ Megbeszélésre vár</span>';
    return `<span class="badge badge-pending">${esc(val)}</span>`;
  }

  function sanitize(name) {
    return name.replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ _-]/g, '_').replace(/\s+/g, '_').slice(0, 80);
  }

  function statusColor(status) {
    const map = {
      'Új':                   { color: '#718096', bg: '#F7F8FA' },
      'Tervezés alatt':       { color: '#3A10E5', bg: '#F0EDFF' },
      'Tesztelésre kész':     { color: '#B88700', bg: '#FFF6D6' },
      'Tesztelés alatt':      { color: '#E5104C', bg: '#FDE8EE' },
      'Tesztelés befejezve':  { color: '#00A878', bg: '#E6F7F1' },
      'Clickupba felvéve':    { color: '#8B5CF6', bg: '#F5F3FF' },
      'Kész':                 { color: '#059669', bg: '#D1FAE5' },
    };
    return map[status] || { color: '#718096', bg: '#F7F8FA' };
  }

  /* ---------- fő generáló ---------- */

  function buildHtml(suite, mode) {
    const isPre = mode === 'pre';
    const now = new Date();
    const dateStr = now.toLocaleString('hu-HU', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    const modeLabel = isPre ? 'Futtatás előtti report' : 'Futtatás utáni report';
    const stats = suite.testCases.reduce((acc, tc) => {
      if (!isPre) {
        if (tc.evaluation === 'Sikeres')           acc.s++;
        else if (tc.evaluation === 'Sikertelen')   acc.f++;
        else if (tc.evaluation === 'Megbeszélésre vár') acc.d++;
        else acc.n++;
      }
      return acc;
    }, { s: 0, f: 0, d: 0, n: 0 });

    const total = suite.testCases.length;
    const pct = !isPre && total
      ? Math.round(((stats.s + stats.f + stats.d) / total) * 100)
      : null;

    const st = statusColor(suite.status);

    /* ---- header stat cards (only post) ---- */
    const statCards = isPre ? '' : `
      <div class="stat-grid">
        <div class="stat-card stat-total">
          <div class="stat-num">${total}</div>
          <div class="stat-label">Összes</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-num">${stats.s}</div>
          <div class="stat-label">Sikeres</div>
        </div>
        <div class="stat-card stat-fail">
          <div class="stat-num">${stats.f}</div>
          <div class="stat-label">Sikertelen</div>
        </div>
        <div class="stat-card stat-discuss">
          <div class="stat-num">${stats.d}</div>
          <div class="stat-label">Megbeszélés</div>
        </div>
        <div class="stat-card stat-pending">
          <div class="stat-num">${stats.n}</div>
          <div class="stat-label">Nincs értékelés</div>
        </div>
      </div>
      ${pct !== null ? `
      <div class="progress-wrap">
        <div class="progress-label">
          <span>Lefedettség</span><span>${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>` : ''}`;

    /* ---- table rows (post: sikertelen + megbeszélés elöl, sikeres hátul) ---- */
    const sortedCases = isPre
      ? suite.testCases          // pre: eredeti sorrend
      : [...suite.testCases].sort((a, b) => {
          const priority = v => {
            if (v === 'Sikertelen')        return 0;
            if (v === 'Megbeszélésre vár') return 1;
            if (!v)                        return 2;  // nincs értékelés
            if (v === 'Sikeres')           return 3;
            return 2;
          };
          return priority(a.evaluation) - priority(b.evaluation);
        });

    const rows = sortedCases.map((tc, i) => {
      const rowClass = !isPre && tc.evaluation
        ? (tc.evaluation === 'Sikeres' ? 'row-success'
          : tc.evaluation === 'Sikertelen' ? 'row-fail'
          : 'row-discuss')
        : '';

      return `
      <tr class="${rowClass}">
        <td class="cell-num">${i + 1}</td>
        <td class="cell-id"><span class="id-badge">${esc(tc.id)}</span></td>
        <td class="cell-name">
          ${esc(tc.name)}
          ${!isPre && tc.attachments?.length ? `<span class="att-indicator" title="${tc.attachments.length} csatolmány">📎 ${tc.attachments.length}</span>` : ''}
        </td>
        <td class="cell-steps">${stepsHtml(tc.steps)}</td>
        <td class="cell-expected">${tc.expectedResult ? esc(tc.expectedResult) : '<span class="empty">–</span>'}</td>
        ${isPre ? '' : `
        <td class="cell-actual">
          ${tc.actualResult ? esc(tc.actualResult) : '<span class="empty">–</span>'}
          ${tc.attachments?.length ? `
          <div class="att-grid">
            ${tc.attachments.map((att, ai) => `
            <figure class="att-figure">
              <img src="${att.dataUrl}" alt="${esc(att.name)}" class="att-img"
                   title="${esc(att.name)} · ${att.sizePx || ''} · ${att.sizeKb || '?'} KB" />
              <figcaption class="att-caption">${esc(att.name)}</figcaption>
            </figure>`).join('')}
          </div>` : ''}
        </td>
        <td class="cell-eval">${evalBadge(tc.evaluation)}</td>`}
      </tr>`;
    }).join('');

    /* ---- column headers ---- */
    const thead = `
      <thead>
        <tr>
          <th class="th-num">#</th>
          <th class="th-id">ID</th>
          <th class="th-name">Teszteset neve</th>
          <th class="th-steps">Lépések</th>
          <th class="th-expected">Elvárt eredmény</th>
          ${isPre ? '' : `
          <th class="th-actual">Kapott eredmény</th>
          <th class="th-eval">Értékelés</th>`}
        </tr>
      </thead>`;

    /* ---- full HTML document ---- */
    return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(suite.name)} – ${modeLabel}</title>
  <style>
    /* ---- Reset & fonts ---- */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F5F5FA;
      color: #10162F;
      font-size: 14px;
      line-height: 1.55;
      padding: 2rem 1.5rem 4rem;
    }

    /* ---- Header ---- */
    .report-header {
      background: #10162F;
      color: #fff;
      border-radius: 6px;
      padding: 2rem 2.25rem;
      margin-bottom: 1.75rem;
      border: 1px solid #10162F;
      box-shadow: 5px 5px 0 0 rgba(16,22,47,.18);
      position: relative;
      overflow: hidden;
    }
    .report-header::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: #FFD300;
    }
    .report-mode-tag {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #FFD300;
      font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
      margin-bottom: .6rem;
    }
    .report-title {
      font-size: 1.9rem;
      font-weight: 700;
      letter-spacing: -.3px;
      line-height: 1.2;
      margin-bottom: .5rem;
      font-family: 'Space Grotesk', 'Inter', sans-serif;
    }
    .report-meta {
      display: flex;
      flex-wrap: wrap;
      gap: .5rem 1.25rem;
      margin-top: .85rem;
      font-size: .78rem;
      color: rgba(255,255,255,.6);
      font-family: 'JetBrains Mono', monospace;
      align-items: center;
    }
    .report-meta span { display: inline-flex; align-items: center; gap: .3rem; }
    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 4px;
      font-size: .72rem;
      font-weight: 700;
      border: 1.5px solid;
    }
    ${suite.clickupId ? `.clickup-link {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      color: #FFD300;
      text-decoration: none;
      font-size: .78rem;
      font-weight: 600;
      border: 1px solid rgba(255,211,0,.35);
      border-radius: 4px;
      padding: 2px 9px;
    }
    .clickup-link:hover { background: rgba(255,211,0,.08); }` : ''}

    /* ---- Stat cards ---- */
    .stat-grid {
      display: flex;
      gap: .75rem;
      flex-wrap: wrap;
      margin-bottom: 1.1rem;
    }
    .stat-card {
      flex: 1;
      min-width: 90px;
      background: #fff;
      border: 1px solid #DBDDE8;
      border-radius: 6px;
      padding: .85rem 1rem;
      text-align: center;
      box-shadow: 3px 3px 0 0 rgba(16,22,47,.08);
    }
    .stat-num {
      font-size: 1.8rem;
      font-weight: 700;
      font-family: 'Space Grotesk', sans-serif;
      line-height: 1.1;
      margin-bottom: .15rem;
    }
    .stat-label { font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: #585C6D; }
    .stat-success .stat-num { color: #00A878; }
    .stat-fail    .stat-num { color: #E5104C; }
    .stat-discuss .stat-num { color: #B88700; }
    .stat-pending .stat-num { color: #585C6D; }
    .stat-total   .stat-num { color: #10162F; }

    /* ---- Progress ---- */
    .progress-wrap { margin-bottom: 1.5rem; }
    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: .75rem;
      font-family: monospace;
      color: #585C6D;
      margin-bottom: .3rem;
    }
    .progress-track {
      height: 10px;
      background: #DBDDE8;
      border-radius: 99px;
      overflow: hidden;
      border: 1px solid #DBDDE8;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00A878, #00cec9);
      border-radius: 99px;
    }

    /* ---- Table ---- */
    .table-wrap {
      background: #fff;
      border: 1px solid #10162F;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 5px 5px 0 0 rgba(16,22,47,.12);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead tr {
      background: #10162F;
    }
    thead th {
      color: rgba(255,255,255,.8);
      font-size: .7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .7px;
      font-family: 'JetBrains Mono', monospace;
      padding: .65rem .9rem;
      text-align: left;
      white-space: nowrap;
    }
    tbody tr {
      border-bottom: 1px solid #DBDDE8;
      transition: background .1s;
    }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:nth-child(even) { background: #F5F5FA; }
    tbody tr.row-success { background: #E6F7F1 !important; }
    tbody tr.row-fail    { background: #FDE8EE !important; }
    tbody tr.row-discuss { background: #FFF6D6 !important; }
    td {
      padding: .75rem .9rem;
      vertical-align: top;
    }
    .cell-num  { color: #585C6D; font-size: .72rem; font-family: monospace; width: 36px; text-align: center; }
    .cell-id   { width: 110px; }
    .cell-steps, .cell-expected, .cell-actual { min-width: 160px; white-space: pre-wrap; word-break: break-word; }
    .cell-eval { width: 155px; }

    .id-badge {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: .76rem;
      font-weight: 700;
      background: #F5F5FA;
      border: 1px solid #DBDDE8;
      border-radius: 4px;
      padding: 2px 7px;
      color: #3A10E5;
      white-space: nowrap;
    }
    .cell-name { font-weight: 600; }

    ol { padding-left: 1.2rem; margin: 0; }
    ol li { margin-bottom: .15rem; }
    .empty { color: #585C6D; font-style: italic; }

    /* ---- Badges ---- */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: .73rem;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 4px;
      border: 1.5px solid;
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap;
    }
    .badge-success { color: #00A878; border-color: #00A878; background: #E6F7F1; }
    .badge-fail    { color: #E5104C; border-color: #E5104C; background: #FDE8EE; }
    .badge-discuss { color: #B88700; border-color: #B88700; background: #FFF6D6; }
    .badge-pending { color: #585C6D; border-color: #DBDDE8; background: #F5F5FA; }

    /* ---- Footer ---- */
    .report-footer {
      margin-top: 2rem;
      text-align: center;
      font-size: .72rem;
      color: #585C6D;
      font-family: monospace;
    }
    .report-footer strong { color: #10162F; }

    /* ---- Attachments ---- */
    .att-grid {
      display: flex;
      flex-wrap: wrap;
      gap: .6rem;
      margin-top: .65rem;
    }
    .att-figure {
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 200px;
    }
    .att-img {
      width: 100%;
      max-width: 200px;
      height: auto;
      border: 1px solid #DBDDE8;
      border-radius: 4px;
      display: block;
      cursor: zoom-in;
      transition: box-shadow .15s;
    }
    .att-img:hover { box-shadow: 0 4px 16px rgba(16,22,47,.18); }
    .att-caption {
      font-size: .65rem;
      color: #585C6D;
      margin-top: .25rem;
      text-align: center;
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }
    .att-indicator {
      display: inline-block;
      font-size: .7rem;
      color: #3A10E5;
      background: #F0EDFF;
      border: 1px solid rgba(58,16,229,.2);
      border-radius: 4px;
      padding: 1px 6px;
      margin-left: .4rem;
      font-family: monospace;
      vertical-align: middle;
      white-space: nowrap;
    }
    /* Lightbox – kattintásra teljes méret */
    .att-img:active { cursor: zoom-out; }

    @media print {
      body { background: #fff; padding: 0; }
      .table-wrap { box-shadow: none; }
      .report-header { box-shadow: none; }
    }
    @media (max-width: 700px) {
      .stat-grid { gap: .5rem; }
      .stat-card { min-width: 70px; }
      .report-title { font-size: 1.4rem; }
    }
  </style>
</head>
<body>

  <div class="report-header">
    <div class="report-mode-tag">
      ${isPre ? '◉ Futtatás előtti report' : '◎ Futtatás utáni report'}
    </div>
    <div class="report-title">${esc(suite.name)}</div>
    <div class="report-meta">
      <span>📅 ${dateStr}</span>
      <span>📋 ${total} teszteset</span>
      ${suite.status ? `<span><span class="status-chip" style="color:${st.color};border-color:${st.color};background:${st.bg};">${esc(suite.status)}</span></span>` : ''}
      ${suite.clickupId ? `<a class="clickup-link" href="https://app.clickup.com/t/2608008/${esc(suite.clickupId)}" target="_blank" rel="noopener">↗ ${esc(suite.clickupId)}</a>` : ''}
      ${suite.notes ? `<span title="${esc(suite.notes)}">💬 ${esc(suite.notes.length > 60 ? suite.notes.slice(0, 60) + '…' : suite.notes)}</span>` : ''}
    </div>
  </div>

  ${statCards}

  <div class="table-wrap">
    <table>
      ${thead}
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class="report-footer">
    Generálva: <strong>TestFlow</strong> · ${dateStr} · ${isPre ? 'Futtatás előtti' : 'Futtatás utáni'} report
  </div>

  <script>
    // Lightbox: kép kattintásra teljes méretben megjelenik
    document.querySelectorAll('.att-img').forEach(img => {
      img.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out;';
        const big = document.createElement('img');
        big.src = img.src;
        big.alt = img.alt;
        big.style.cssText = 'max-width:92vw;max-height:92vh;border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,.6);';
        overlay.appendChild(big);
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
      });
    });
  </script>

</body>
</html>`;
  }

  /* ---------- export ---------- */

  async function exportHtml(suiteId, mode) {
    const suite = await TF.Storage.getSuite(suiteId);
    if (!suite) { TF.UI.toast('A halmaz nem található.', 'danger'); return; }
    if (!suite.testCases.length) { TF.UI.toast('Nincsenek tesztesetek.', 'danger'); return; }

    const html = buildHtml(suite, mode);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const suffix = mode === 'pre' ? 'futtatás_előtti' : 'futtatás_utáni';
    a.href     = url;
    a.download = `${suite.name.replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ _-]/g, '_')}_${suffix}_report.html`;
    a.click();
    URL.revokeObjectURL(url);

    TF.UI.toast(`HTML report letöltve (${mode === 'pre' ? 'futtatás előtti' : 'futtatás utáni'}).`, 'success');
  }

  return { exportHtml };
})();
