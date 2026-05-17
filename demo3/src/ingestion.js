const BoundedQueue = require('./queue');
const queue = new BoundedQueue(parseInt(process.env.QUEUE_MAX, 10) || 500);

function ingest(sensorEvent) {
  // Fast, non-blocking ingestion — returns whether queued
  const ok = queue.push({
    id: sensorEvent.id,
    ts: sensorEvent.ts || Date.now(),
    payload: sensorEvent.payload || {}
  });
  return ok;
}

module.exports = { ingest, queue };
