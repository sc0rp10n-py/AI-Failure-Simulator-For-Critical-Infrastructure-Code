const express = require('express');
const bodyParser = require('body-parser');
const ingestion = require('./ingestion');
const detector = require('./detector');
const control = require('./control');
const alerting = require('./alerting');

const app = express();
app.use(bodyParser.json());

// Sensor ingestion endpoint
app.post('/ingest', (req, res) => {
  const ok = ingestion.ingest(req.body);
  if (!ok) return res.status(503).json({ ok: false, reason: 'queue_overflow' });
  res.json({ ok: true });
});

// Control center: status
app.get('/control/status', (req, res) => {
  res.json(control.status());
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'demo3-smart-grid', ...control.status() });
});

// Alerts
app.get('/alerts', (req, res) => {
  res.json(alerting.recent(50));
});

const port = process.env.PORT || 4003;
app.listen(port, '0.0.0.0', () => {
  console.log(`demo3 smart-grid backend listening on ${port}`);
  // Start detector after server is up
  detector.startDetector({ intervalMs: 150 });
});
