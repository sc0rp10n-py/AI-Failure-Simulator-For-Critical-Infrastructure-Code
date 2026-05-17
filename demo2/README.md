# Demo 2 Backend

Healthcare emergency dispatch backend prototype built with FastAPI.

## What it includes

- Patient intake
- Ambulance assignment
- Hospital availability service
- External mapping API integration
- Synthetic telemetry and logs for the failure scenarios in the prompt

## Intentional weaknesses

- Coarse global lock around dispatch-critical data
- Synchronous request path with blocking `time.sleep` calls
- Blocking external mapping call via `requests.get`
- Shared in-memory state acting as a single point of failure

## Run

```bash
cd demo2
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

## Key endpoints

- `POST /intake`
- `POST /dispatch`
- `GET /hospitals/availability`
- `GET /telemetry`
- `GET /logs/recent`
- `POST /simulate/load`

## Sample artifacts

- `sample_telemetry.jsonl`
- `sample_logs.jsonl`
