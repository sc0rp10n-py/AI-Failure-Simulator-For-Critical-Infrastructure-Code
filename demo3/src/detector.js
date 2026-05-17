const { queue } = require('./ingestion');
const alerting = require('./alerting');

// Metrics
let processed = 0;

function startDetector(options = {}) {
  const intervalMs = options.intervalMs || 200; // intentional slowness

  setInterval(async () => {
    // Batch process one item to simulate delayed processing
    const item = queue.pop();
    if (!item) return;
    processed += 1;

    // Artificial processing delay to simulate compute cost and backpressure
    const delay = 50 + Math.floor(Math.random() * 400);
    await new Promise((r) => setTimeout(r, delay));

    // Very simple anomaly logic: payload.value outside range
    const v = item.payload && item.payload.value;
    if (typeof v === 'number' && (v < 10 || v > 90)) {
      const a = {
        id: item.id,
        ts: Date.now(),
        value: v,
        reason: 'threshold'
      };
      alerting.pushAlert(a);
    } else if (Math.random() < 0.001) {
      // occasional probabilistic false positive
      alerting.pushAlert({ id: item.id, ts: Date.now(), reason: 'random' });
    }
  }, intervalMs);
}

function getMetrics() {
  return { processed };
}

module.exports = { startDetector, getMetrics };
