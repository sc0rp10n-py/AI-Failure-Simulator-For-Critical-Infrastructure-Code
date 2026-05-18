# SentinelAI

Autonomous failure simulation and resilience analysis platform for production codebases.

## Live Demo
[Try it out](https://sentinel.sc0rp10n.space/)

## Demo Video
[![Watch Demo Here](/assets/landing.jpg)](https://youtu.be/IozeTPtL2n0)

## Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui, Framer Motion, GSAP, React Query, Zustand, Recharts
- **Backend**: Flask, SQLAlchemy (SQLite), structured JSON logging

## Quick start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

API: `http://localhost:5001`

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

App: `http://localhost:3000`

## Workflow

1. Open the landing page → **Start Analysis**
2. **Upload a project ZIP** (demo1–demo4 from your team, or any Express/Flask/FastAPI backend)
3. Watch the processing pipeline (real backend progress via polling)
4. Open the **risk dashboard** with live analysis, telemetry, and AI remediation

Demo catalog cards work when `demo1`…`demo4` folders exist at the repo root; otherwise upload ZIPs.

## API (prefix `/api`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload-project` | Upload ZIP |
| GET | `/projects` | List projects + demo catalog |
| POST | `/analyze` | Start analysis (`project_id` or `demo_id`) |
| GET | `/status/<job_id>` | Poll progress + logs |
| GET | `/results/<job_id>` | Full dashboard payload |
| GET | `/analysis-history` | Past runs |

Session: anonymous HTTP-only cookie `sentinel_session`.

## Analysis cache

- Re-running analysis on the same project returns the cached `job_id` unless you pass `force: true` or check **Force fresh analysis** in the UI.
- `GET /api/projects/:id/cache` returns the latest completed run metadata.

## Automatic sandbox (live injection)

For every upload or demo analysis, SentinelAI **automatically** tries to run the project:

1. **Docker** container (preferred) — isolated `docker run` with deps install + start
2. **Subprocess** fallback — `npm start` / `uvicorn` / `python app.py` on a free local port
3. If the project has `docker-compose.yml` (e.g. demo1 Postgres), compose services are started first

Health endpoints are discovered from routes in code, then failure injection runs against **live** URLs. No manual `npm start` required.

Configure via `SENTINEL_SANDBOX_*` in `backend/.env` (see `.env.example`). Requires Docker installed for container isolation.

## Log streaming

- `GET /api/stream/logs/:job_id` — Server-Sent Events for live pipeline logs (processing + dashboard).

## AI providers

Set in `backend/.env`:

- `SENTINEL_LLM_PROVIDER=heuristic` (default, no external API)
- `SENTINEL_LLM_PROVIDER=ollama` + Ollama URL/model (e.g. `gemma3:27b-cloud` via `SENTINEL_OLLAMA_MODEL`)

## Project layout

```
frontend/     Next.js UI
backend/      Flask API + analysis pipeline
demo1–demo4/  Target apps (upload as ZIP or place in repo root)
```
