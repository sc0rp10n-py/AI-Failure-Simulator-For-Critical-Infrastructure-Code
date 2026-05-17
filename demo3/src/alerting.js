// Simple alert store + delivery simulation
const axios = require('axios');

const alerts = [];

async function deliver(alert) {
  // Intentionally no circuit breaker and no retries — may block if remote slow
  try {
    // Simulate optional remote webhook delivery if configured
    if (process.env.ALERT_WEBHOOK) {
      await axios.post(process.env.ALERT_WEBHOOK, alert, { timeout: 2000 });
    }
  } catch (e) {
    // swallow to avoid crashing; this simulates cascading alerts in real systems
  }
}

function pushAlert(alert) {
  alerts.push(alert);
  // intentionally asynchronous, might accumulate memory if delivery is slow
  deliver(alert);
}

function recent(n = 50) {
  return alerts.slice(-n).reverse();
}

module.exports = { pushAlert, recent };
