# TestFlow – Deploy útmutató
## Backend → Fly.io | Frontend → Vercel

---

## Előfeltételek

```bash
# Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Bejelentkezés
fly auth login
```

Vercelhez: [vercel.com](https://vercel.com) – GitHub fiókkal regisztrálj.

---

## 1. Backend deploy (Fly.io)

### 1.1 Volume létrehozása (SQLite perzisztencia)

```bash
cd backend

# App létrehozása (egyszer)
fly apps create testflow-api
# Ha a név foglalt, válassz másikat – majd frissítsd a fly.toml-ban is

# Perzisztens volume az SQLite fájlhoz (1 GB ingyenes)
fly volumes create testflow_data \
  --app testflow-api \
  --region ams \
  --size 1
```

### 1.2 CORS beállítása (a Vercel URL ismerete után)

```bash
# Vercel URL beállítása secret-ként
fly secrets set FRONTEND_URL=https://testflow-XYZ.vercel.app \
  --app testflow-api
```

### 1.3 Deploy

```bash
cd backend   # ahol a fly.toml van
fly deploy
```

Néhány perc múlva elérhető:
```
https://testflow-api.fly.dev/health
```

---

## 2. Frontend deploy (Vercel)

### 2.1 API URL beállítása

Szerkeszd a `frontend/js/config.js` fájlt:

```js
window.TF_API_URL = 'https://testflow-api.fly.dev';
//                   ↑ A Fly.io app URL-je (1. lépésből)
```

### 2.2 Deploy Vercel CLI-vel

```bash
npm i -g vercel
cd frontend
vercel --prod
```

Vagy GitHub-on keresztül:
1. Push a `frontend/` mappát egy GitHub repoba
2. Vercel dashboard → New Project → importáld
3. **Root Directory:** `frontend`
4. **Framework Preset:** Other
5. Deploy

### 2.3 CORS visszafrissítése

Ha megvan a Vercel URL (pl. `https://testflow-abc.vercel.app`):

```bash
fly secrets set FRONTEND_URL=https://testflow-abc.vercel.app \
  --app testflow-api
fly deploy --app testflow-api
```

---

## 3. Régi JSON adat importálása

```bash
# dotnet-script telepítése (egyszer)
dotnet tool install -g dotnet-script

# Import futtatása lokálisan
cd tools
dotnet script import-json.csx -- /path/to/data.json ./testflow.db

# DB másolása Fly.io volume-ra
fly sftp shell --app testflow-api
# > put testflow.db /data/testflow.db
# > exit
```

---

## Gyors összefoglaló

| | Szolgáltatás | URL |
|---|---|---|
| **Frontend** | Vercel | `https://testflow-XYZ.vercel.app` |
| **Backend API** | Fly.io | `https://testflow-api.fly.dev` |
| **Health check** | Fly.io | `https://testflow-api.fly.dev/health` |
| **SQLite volume** | Fly.io | `/data/testflow.db` |

---

## Hasznos parancsok

```bash
# Backend logok
fly logs --app testflow-api

# Backend újraindítás
fly machine restart --app testflow-api

# SQLite fájl állapota
fly ssh console --app testflow-api -C "ls -lh /data/"

# Volume lista
fly volumes list --app testflow-api
```

---

## Helyi fejlesztés (Docker Compose)

```bash
docker-compose up --build
# Frontend: http://localhost
# API:      http://localhost/api/suites
```
