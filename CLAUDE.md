# ArtemisGO

CSV → SQL query tool. Go (Fiber) backend with in-memory SQLite, Next.js + Tailwind frontend with CodeMirror SQL editor.

## Running

**Backend** (port 8080):
```
cd backend
go run main.go
```

**Frontend** (port 3000, proxies /api to backend):
```
cd frontend
npm run dev
```

## Architecture

- `backend/` — Go + Fiber v2 + modernc.org/sqlite (pure Go, no CGO)
  - `main.go` — server entry, routes, CORS
  - `db/sqlite.go` — in-memory SQLite, CSV ingestion, type inference
  - `handlers/` — upload, query, stats endpoints
- `frontend/` — Next.js 14 (App Router) + Tailwind + CodeMirror 6
  - `app/page.tsx` — main page with upload → query flow
  - `components/` — UploadZone, SqlEditor, ResultsTable, StatsSidebar
  - `lib/api.ts` — fetch helpers

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Multipart CSV upload → creates `tablename` table |
| POST | `/api/query` | `{ "sql": "..." }` → `{ columns, rows }` |
| GET | `/api/stats` | Row/column count + schema info |
