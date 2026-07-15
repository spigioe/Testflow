/* ====================================================================
   TF.Attachments – képcsatolmány kezelő
   ─ Kép → Canvas → JPEG (max 1280px, 80%) → Base64 data URL
   ─ state.results[tcId].attachments = [ { dataUrl, name, size } ]
==================================================================== */
window.TF = window.TF || {};

TF.Attachments = (() => {

  const MAX_W    = 1280;
  const QUALITY  = 0.80;

  /* Egy File objektumot Base64 JPEG-gé tömörít */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Fájl olvasási hiba.'));
      reader.onload = ev => {
        const img = new Image();
        img.onerror = () => reject(new Error('Kép betöltési hiba.'));
        img.onload = () => {
          const scale = img.width > MAX_W ? MAX_W / img.width : 1;
          const w = Math.round(img.width  * scale);
          const h = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
          // Méret becslés (base64 karakterek * 0.75)
          const approxBytes = Math.round((dataUrl.length - 22) * 0.75);
          resolve({
            dataUrl,
            name:    file.name,
            sizePx:  `${w}×${h}`,
            sizeKb:  Math.round(approxBytes / 1024)
          });
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* Fájlválasztó megnyitása, eredmény: attachment objektum tömb */
  function pickImages() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type     = 'file';
      input.accept   = 'image/*';
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files);
        if (!files.length) { resolve([]); return; }
        try {
          const results = await Promise.all(files.map(compressImage));
          resolve(results);
        } catch (e) {
          TF.UI.toast('Képfeldolgozási hiba: ' + e.message, 'danger');
          resolve([]);
        }
      };
      input.click();
    });
  }

  /* ---- UI render: csatolmányok szekció a testing card bottomban ---- */

  function renderAttachmentsSection(tcId, attachments) {
    const list = (attachments || []).map((att, idx) => `
      <div class="att-thumb-wrap" data-att-idx="${idx}">
        <img class="att-thumb" src="${att.dataUrl}" alt="${TF.UI.esc(att.name)}"
             title="${TF.UI.esc(att.name)} · ${att.sizePx} · ${att.sizeKb} KB" />
        <div class="att-thumb-info">${TF.UI.esc(att.name.length > 18 ? att.name.slice(0,15)+'…' : att.name)}</div>
        <button class="att-remove-btn" data-att-idx="${idx}" data-tc-id="${TF.UI.esc(tcId)}"
                title="Eltávolítás" aria-label="Csatolmány eltávolítása">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`).join('');

    return `
      <div class="att-section" id="att-section-${TF.UI.esc(tcId)}">
        <div class="form-label" style="margin-bottom:.45rem;">
          <i class="fa-solid fa-paperclip"></i> Csatolmányok
          ${attachments?.length ? `<span class="att-count">${attachments.length} kép</span>` : ''}
        </div>
        ${list ? `<div class="att-thumbs" id="att-thumbs-${TF.UI.esc(tcId)}">${list}</div>` : ''}
        <button class="btn-att-add" id="btn-att-add-${TF.UI.esc(tcId)}" data-tc-id="${TF.UI.esc(tcId)}">
          <i class="fa-solid fa-image"></i> Kép hozzáadása
        </button>
      </div>`;
  }

  return { pickImages, compressImage, renderAttachmentsSection };
})();
