const { queue } = require('./ingestion');
const detector = require('./detector');
const alerting = require('./alerting');

function status() {
  return {
    queue: queue.stats(),
    detector: detector.getMetrics(),
    alerts: { recent: alerting.recent(10).length }
  };
}

module.exports = { status };
