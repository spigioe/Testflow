/* ====================================================================
   TF.IdRenumber – ID újraszámozás átrendezés után
   
   Szabályok:
   - A prefix az elválasztóig tart (kötőjel, pont, aláhúzás az utolsó
     szám előtt). Pl. "TC_VAL-003" → prefix="TC_VAL", sep="-", num=3, digits=3
   - Prefix-csoportonként külön számoz: TC_VAL-01, TC_VAL-02 | TC-01, TC-02
   - Az eredeti számjegyek hosszát megtartja: "001" → "001","002"... "01"→"01"...
   - Ha az ID-ban nincs szám → változatlan marad
   - Az átnevezés a teszteseteket is frissíti (actualResult, evaluation, stb.
     megmaradnak – csak az id mező változik)
==================================================================== */
window.TF = window.TF || {};

TF.IdRenumber = (() => {

  /* ---------------------------------------------------------------
     ID szétszedés / összerakás
  --------------------------------------------------------------- */

  // Bontja szét: prefix + separator + szám + maradék (ha van)
  // Pl. "TC_VAL-003"  → { prefix:"TC_VAL", sep:"-", num:3, digits:3, rest:"" }
  //     "TC-01b"      → { prefix:"TC", sep:"-", num:1, digits:2, rest:"b" }
  //     "TC_LOGIN"    → null  (nincs szám → érintetlen)
  function parseId(id) {
    // utolsó szám-blokkot keres, előtte elválasztó karakterrel
    const m = id.match(/^(.*?)([_\-\.])(\d+)([^0-9]*)$/);
    if (!m) return null;
    return {
      prefix: m[1],          // pl. "TC_VAL"
      sep:    m[2],          // pl. "-"
      num:    parseInt(m[3], 10),
      digits: m[3].length,   // az eredeti formátum hossza
      rest:   m[4]           // utólag illeszkedő nem-szám karakter
    };
  }

  function buildId(parsed, newNum) {
    return `${parsed.prefix}${parsed.sep}${String(newNum).padStart(parsed.digits, '0')}${parsed.rest}`;
  }

  /* ---------------------------------------------------------------
     Csoportkulcs: prefix + sep + digits + rest
     Két TC azonos csoportban van, ha ezek egyeznek.
  --------------------------------------------------------------- */
  function groupKey(parsed) {
    return `${parsed.prefix}${parsed.sep}__d${parsed.digits}__${parsed.rest}`;
  }

  /* ---------------------------------------------------------------
     Fő függvény: adott testCases tömb ID-jait újraszámozza.
     Visszaadja az új testCases tömböt (immutable – eredeti nem módosul).
     Az ID-ban nincs szám → változatlan.
  --------------------------------------------------------------- */
  function renumber(testCases) {
    // Első menet: meghatározzuk az egyes TC-k parsed értékét és csoportját
    const parsed = testCases.map(tc => parseId(tc.id));

    // Második menet: csoportonkénti számláló (1-től indul)
    const counters = {};

    const newIds = testCases.map((tc, i) => {
      const p = parsed[i];
      if (!p) return tc.id; // nincs szám → változatlan

      const key = groupKey(p);
      counters[key] = (counters[key] || 0) + 1;
      return buildId(p, counters[key]);
    });

    // Harmadik menet: ha változott valamelyik ID, térjünk vissza új tömbbel
    const changed = newIds.some((id, i) => id !== testCases[i].id);
    if (!changed) return testCases;

    return testCases.map((tc, i) => ({ ...tc, id: newIds[i] }));
  }

  return { renumber, parseId, buildId };
})();
