# TestFlow – Deploy útmutató
## Backend → Render.com | Frontend → Vercel

---

## 1. Backend deploy (Render) – csak böngésző kell

### 1.1 Render Blueprint (egy kattintás)

1. Menj: **[render.com](https://render.com)** → bejelentkezés GitHub-bal
2. **New → Blueprint**
3. Válaszd ki a GitHub repot
4. Render felismeri a `render.yaml`-t → automatikusan létrehozza:
   - `testflow-api` – ASP.NET Core Web API
   - `testflow-db`  – PostgreSQL adatbázis
5. Kattints: **Apply**

Néhány perc múlva elérhető:
```
https://testflow-api.onrender.com/health
```

### 1.2 CORS beállítása (Vercel URL ismerete után)

Render dashboard → `testflow-api` service → **Environment** → `FRONTEND_URL` értékét állítsd be:
```
https://testflow-XYZ.vercel.app
```
Majd: **Save Changes** → automatikus redeploy.

---

## 2. Frontend deploy (Vercel) – csak böngésző kell

### 2.1 API URL beállítása

Szerkeszd a `frontend/js/config.js` fájlt:
```js
window.TF_API_URL = 'https://testflow-api.onrender.com';
```

### 2.2 Vercel deploy

1. **[vercel.com](https://vercel.com)** → bejelentkezés GitHub-bal
2. **New Project** → importáld a repot
3. **Root Directory:** `frontend`
4. **Framework Preset:** Other
5. **Deploy**

---

## 3. Automatikus deploy (GitHub Actions)

### Backend: Render Deploy Hook

Render dashboard → `testflow-api` → **Settings** → **Deploy Hook** → másold ki az URL-t

GitHub repo → **Settings → Secrets → New secret:**
| Neve | Értéke |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | A Render deploy hook URL |

Ezután minden `backend/` változtatás automatikusan deploy-ol.

### Frontend: Vercel

Vercel automatikusan figyeli a repot – minden push-ra újradeploy-ol.

---

## 4. Régi JSON adat importálása

```bash
# Telepítés
dotnet tool install -g dotnet-script

# Connection string: Render dashboard → testflow-db → Info → External Connection String
cd tools
dotnet script import-json.csx -- /path/to/data.json "postgres://user:pass@host/db"
```

---

## ⚠️ Render ingyenes tier korlátai

| | Ingyenes |
|---|---|
| Web Service | Leáll 15 perc inaktivitás után (első kérés ~30mp) |
| PostgreSQL | **90 napig ingyenes**, utána törlődik! |

Ha hosszú távon használjátok: Render Starter plan (~7$/hó) ajánlott.

---

## Helyi fejlesztés

```bash
docker-compose up --build
# http://localhost
```

A `docker-compose.yml` helyi fejlesztéshez megmarad,
de SQLite-ot használ – production PostgreSQL-t Render kezeli.
