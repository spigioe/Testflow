/* ====================================================================
   TF.App – belépési pont
   Sorrend: a statikus (modálokhoz kötött) eseménykezelők egyszer
   regisztrálódnak, majd elindul a router.
==================================================================== */
(() => {
  'use strict';

  function init() {
    TF.Theme.init();
    TF.Undo.init();
    TF.Views.Home.initStatic();
    TF.Views.Suite.initStatic();
    TF.Views.Testing.initStatic();
    TF.Search.init();
    TF.FilePicker.updateNavbarIndicator();
    TF.Router.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
