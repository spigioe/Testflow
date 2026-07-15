/* ============================================================
   TestFlow – Runtime konfiguráció
   
   Ezt a fájlt a deploy előtt módosítani kell, vagy
   a Vercel "Build & Development Settings" alatt add meg:

     Environment variable:
       Neve:   TF_API_URL
       Értéke: https://testflow-api.fly.dev

   Alternativa: ezt a fájlt közvetlenül szerkeszd:
============================================================ */
window.TF_API_URL = 'https://testflow-api.fly.dev';
//                   ↑ Cseréld le a saját Fly.io app URL-edre!
//                     fly apps list  →  az app neve
//                     URL formátum: https://<app-neve>.fly.dev
