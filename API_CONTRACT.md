# SentinelAI API Contract

Base URL: `http://localhost:5001`  
Prefix: `/api`  
Auth: anonymous session cookie `sentinel_session` (HTTP-only)  
Correlation: response header `X-Correlation-ID` on all requests

## Response envelope

```json
{ "success": true, "data": {}, "error": null }
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload-project` | multipart `file` (ZIP) |
| GET | `/projects` | projects + demo catalog |
| GET | `/projects/:id` | project detail |
| GET | `/projects/:id/cache` | latest cached completed run |
| GET | `/analysis-history` | past runs |
| POST | `/analyze` | body: `{ project_id?, demo_id?, use_cache?, force? }` |
| POST | `/simulate` | alias of analyze |
| POST | `/reanalyze/:project_id` | force new run |
| GET | `/status/:job_id` | progress + recent logs |
| GET | `/stream/logs/:job_id` | SSE log stream |
| GET | `/results/:job_id` | full dashboard payload |
| GET | `/logs/:job_id` | all logs |
| GET | `/metrics/:job_id` | metrics only |

## Automatic sandbox

Before simulation, the pipeline starts the uploaded project automatically:

- Docker container (if Docker is installed and `SENTINEL_SANDBOX_PREFER_DOCKER=true`)
- Otherwise a managed subprocess on a free port
- Optional `docker compose up` when `docker-compose.yml` exists

Progress stage: `sandbox_ready`. Telemetry includes `metrics.sandbox_mode` (`docker` | `subprocess` | `none`).

## Analyze cache

- `use_cache: true` (default) returns existing completed `job_id` if present.
- `force: true` always starts a new pipeline run.

## Results payload (data)

- `risk_score`, `severity`, `summary`
- `risk` — analyzer output
- `scenarios` — injected failure scenarios
- `telemetry` — metrics, timeline, dependency_graph, blast_radius
- `heatmap` — category × severity weights
- `ai` — root_cause, remediation, architecture_insights
