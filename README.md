# TestFlow – Fullstack (v1.0.0)

Vanilla JS frontend + ASP.NET Core 8 Web API + SQLite

## Indítás

```bash
docker-compose up --build
```

Az alkalmazás elérhető: **http://localhost**

Az API elérhető: **http://localhost/api/suites**

---

## Architektúra

```
testflow/
├── backend/              C# ASP.NET Core 8 Web API
│   └── TestFlow.API/
│       ├── Controllers/  REST végpontok
│       ├── Data/         Database + SuiteRepository
│       └── Models/       Domain modellek és DTO-k
├── frontend/             Vanilla JS SPA (nginx)
│   └── js/
│       ├── storage.js    ← REST API alapú (kiváltja a File System API-t)
│       └── views/
├── database/
│   └── schema.sql        SQLite séma
├── tools/
│   └── import-json.csx   JSON → DB migrációs szkript
└── docker-compose.yml
```

## REST API végpontok

| Metódus | Útvonal               | Leírás                    |
|---------|----------------------|---------------------------|
| GET     | /api/suites           | Összes halmaz lekérése    |
| GET     | /api/suites/{id}      | Egy halmaz lekérése       |
| PUT     | /api/suites/{id}      | Halmaz létrehozása/frissítése |
| DELETE  | /api/suites/{id}      | Halmaz törlése            |
| POST    | /api/suites/reorder   | Sorrend mentése           |
| GET     | /health               | Backend állapot           |

## Régi JSON adat importálása

Ha volt már egy meglévő TestFlow `.json` fájlod, az adatokat átviheted:

```bash
# Telepítés (egyszer):
dotnet tool install -g dotnet-script

# Import futtatása:
cd tools
dotnet script import-json.csx -- /path/to/testflow_data.json /path/to/testflow.db
```

Az SQLite fájlt ezután be kell másolni a Docker volume-ba:
```bash
docker cp testflow.db testflow-backend:/data/testflow.db
```

## Adatbázis séma

A séma az alkalmazás első indításakor automatikusan létrejön.
Manuális létrehozás:

```bash
sqlite3 testflow.db < database/schema.sql
```

## Fejlesztői mód (backend)

```bash
cd backend/TestFlow.API
dotnet run
# API: http://localhost:5000
```

A frontenden az `/api/` kérések Docker-ben a backendre proxyzódnak.
Fejlesztői módban az `nginx.conf`-ban lévő `proxy_pass` URL-t `http://localhost:5000`-re kell módosítani.
