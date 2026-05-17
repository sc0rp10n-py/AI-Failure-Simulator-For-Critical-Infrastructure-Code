const express = require('express');
const { createLogger, createRequestContext } = require('./logger');
const { sleep } = require('./http');

function buildMockPaymentProvider() {
  const app = express();
  const logger = createLogger('payment-provider');

  app.use(express.json({ limit: '64kb' }));
  app.use(createRequestContext);

  app.post('/charge', async (req, res) => {
    const requestId = req.requestId;
    const delayMs = Number(process.env.PAYMENT_PROVIDER_BASE_DELAY_MS || 140) + Math.floor(Math.random() * 900);
    const failureRate = Number(process.env.PAYMENT_PROVIDER_FAILURE_RATE || 0.12);

    logger.info('received charge request', {
      requestId,
      orderId: req.body?.orderId || null,
      amountCents: req.body?.amountCents || null,
      simulatedDelayMs: delayMs,
    });

    await sleep(delayMs);

    if (Math.random() < failureRate) {
      logger.error('provider rejected charge', {
        requestId,
        orderId: req.body?.orderId || null,
        reason: 'upstream processor timeout',
      });
      return res.status(502).json({ error: 'provider_timeout' });
    }

    const providerReference = `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info('charge approved', {
      requestId,
      orderId: req.body?.orderId || null,
      providerReference,
    });

    return res.json({
      approved: true,
      providerReference,
    });
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'payment-provider' });
  });

  return app;
}

function startMockPaymentProvider() {
  const port = Number(process.env.PAYMENT_PROVIDER_PORT || 3003);
  const app = buildMockPaymentProvider();

  return app.listen(port, () => {
    createLogger('payment-provider').info('mock payment provider started', { port });
  });
}

module.exports = {
  buildMockPaymentProvider,
  startMockPaymentProvider,
};