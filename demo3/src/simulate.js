const axios = require('axios');

const TARGET = process.env.TARGET || 'http://localhost:4003/ingest';
const RATE = parseInt(process.env.RATE, 10) || 100; // events per second
const BURST = parseInt(process.env.BURST, 10) || 500; // total events to send in burst

async function sendEvent(i) {
  const event = {
    id: `sensor-${Math.floor(Math.random() * 1000)}`,
    ts: Date.now(),
    payload: { value: Math.floor(Math.random() * 120) }
  };
  try {
    await axios.post(TARGET, event, { timeout: 2000 });
  } catch (e) {
    // ignore errors
  }
}

async function burst() {
  console.log(`Sending ${BURST} events to ${TARGET} at ~${RATE} eps`);
  let sent = 0;
  const intervalMs = 1000 / RATE;
  const start = Date.now();

  while (sent < BURST) {
    // fire off a send (do not await) to create pressure
    sendEvent(sent);
    sent += 1;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.log('Burst complete', { sent, durationMs: Date.now() - start });
}

burst();
