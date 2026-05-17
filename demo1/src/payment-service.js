const express = require('express');
const { randomUUID } = require('crypto');
const { createLogger, createRequestContext } = require('./logger');
const { fetchJson } = require('./http');
const { withTransaction } = require('./db');

function buildPaymentService(pool) {
  const app = express();
  const logger = createLogger('payment-service');

  app.use(express.json({ limit: '64kb' }));
  app.use(createRequestContext);

  app.post('/payment', async (req, res) => {
    const requestId = req.requestId;
    const orderId = req.body?.orderId;
    const customerId = req.body?.customerId;
    const amountCents = Number(req.body?.amountCents);

    if (!orderId || !customerId || !Number.isInteger(amountCents)) {
      return res.status(400).json({ error: 'invalid_payment_payload' });
    }

    const transactionId = randomUUID();
    const providerUrl = process.env.PAYMENT_API_URL || 'http://localhost:3003/charge';

    logger.info('payment requested', {
      requestId,
      transactionId,
      orderId,
      customerId,
      amountCents,
      providerUrl,
    });

    await withTransaction(pool, async (client) => {
      await client.query(
        `INSERT INTO transactions (id, order_id, customer_id, amount_cents, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [transactionId, orderId, customerId, amountCents, 'initiated'],
      );
    });

    const startedAt = Date.now();

    try {
      const providerResponse = await fetchJson(providerUrl, {
        method: 'POST',
        headers: {
          'x-request-id': requestId,
        },
        body: { orderId, amountCents, transactionId },
        timeoutMs: Number(process.env.PAYMENT_API_TIMEOUT_MS || 700),
      });

      await withTransaction(pool, async (client) => {
        await client.query(
          `UPDATE transactions
           SET status = $2, provider_reference = $3, updated_at = now()
           WHERE id = $1`,
          [transactionId, 'authorized', providerResponse.providerReference],
        );
      });

      logger.info('payment authorized', {
        requestId,
        transactionId,
        orderId,
        elapsedMs: Date.now() - startedAt,
        providerReference: providerResponse.providerReference,
      });

      return res.json({
        transactionId,
        status: 'authorized',
        providerReference: providerResponse.providerReference,
      });
    } catch (error) {
      await withTransaction(pool, async (client) => {
        await client.query(
          `UPDATE transactions
           SET status = $2, updated_at = now()
           WHERE id = $1`,
          [transactionId, 'failed'],
        );
      });

      logger.error('payment failed', {
        requestId,
        transactionId,
        orderId,
        elapsedMs: Date.now() - startedAt,
        upstreamStatus: error.statusCode || null,
        upstreamMessage: error.message,
      });

      return res.status(502).json({
        error: 'payment_failed',
        transactionId,
      });
    }
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'payment-service' });
  });

  return app;
}

function startPaymentService(pool) {
  const port = Number(process.env.PAYMENT_PORT || 3001);
  const app = buildPaymentService(pool);

  return app.listen(port, () => {
    createLogger('payment-service').info('payment service started', { port });
  });
}

module.exports = {
  buildPaymentService,
  startPaymentService,
};