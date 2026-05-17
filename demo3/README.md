# Demo3 — Smart Power Grid Monitoring Backend

Components:
- sensor ingestion (`POST /ingest`)
- anomaly detector (background worker)
- control center API (`GET /control/status`)
- alerting service (`GET /alerts` + delivery attempts)

Intentional weaknesses included:
- bounded in-memory queue that drops on overflow (configurable via `QUEUE_MAX`)
- artificial processing delays in the detector to cause backlog
- no circuit breaker for alert delivery
- memory pressure if alert delivery is slow

Quick start:

Install deps and run server:
```bash
cd demo3
npm install
npm start
```

In another terminal run the simulator to generate a burst:
```bash
npm run simulate
```

Check status:
```bash
curl http://localhost:4003/control/status
curl http://localhost:4003/alerts
```
