const express = require('express');
const { createLogger, createRequestContext } = require('./logger');
const { fetchJson } = require('./http');

function normalizeCheckoutBody(body) {
  const orderId = body?.orderId;
  const customerId = body?.customerId;
  const amountCents = Number(body?.amountCents);
  const items = Array.isArray(body?.items) ? body.items : null;

  if (!orderId || !customerId || !Number.isInteger(amountCents) || !items || items.length === 0) {
    return null;
  }

  return {
    orderId,
    customerId,
    amountCents,
    items,
  };
}

function buildGateway() {
  const app = express();
  const logger = createLogger('api-gateway');

  app.use(express.json({ limit: '64kb' }));
  app.use(createRequestContext);

  app.post('/checkout', async (req, res) => {
    const requestId = req.requestId;
    const payload = normalizeCheckoutBody(req.body);

    if (!payload) {
      return res.status(400).json({ error: 'invalid_checkout_payload' });
    }

    const paymentUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001/payment';
    const inventoryUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002/inventory';

    logger.info('checkout received', {
      requestId,
      orderId: payload.orderId,
      customerId: payload.customerId,
      amountCents: payload.amountCents,
      itemCount: payload.items.length,
      paymentUrl,
      inventoryUrl,
    });

    const startedAt = Date.now();

    try {
      const payment = await fetchJson(paymentUrl, {
        method: 'POST',
        headers: {
          'x-request-id': requestId,
        },
        body: payload,
        timeoutMs: Number(process.env.GATEWAY_PAYMENT_TIMEOUT_MS || 750),
      });

      const inventory = await fetchJson(inventoryUrl, {
        method: 'POST',
        headers: {
          'x-request-id': requestId,
        },
        body: {
          orderId: payload.orderId,
          items: payload.items,
        },
        timeoutMs: Number(process.env.GATEWAY_INVENTORY_TIMEOUT_MS || 750),
      });

      logger.info('checkout completed', {
        requestId,
        orderId: payload.orderId,
        elapsedMs: Date.now() - startedAt,
        transactionId: payment.transactionId,
        reservationId: inventory.reservationId,
      });

      return res.json({
        orderId: payload.orderId,
        status: 'completed',
        payment,
        inventory,
      });
    } catch (error) {
      logger.error('checkout failed', {
        requestId,
        orderId: payload.orderId,
        elapsedMs: Date.now() - startedAt,
        upstreamStatus: error.statusCode || null,
        upstreamMessage: error.message,
      });

      return res.status(502).json({
        error: 'checkout_failed',
        orderId: payload.orderId,
      });
    }
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'api-gateway' });
  });

  return app;
}

function startGateway() {
  const port = Number(process.env.GATEWAY_PORT || 3000);
  const app = buildGateway();

  return app.listen(port, '0.0.0.0', () => {
    createLogger('api-gateway').info('gateway started', { port });
  });
}

module.exports = {
  buildGateway,
  startGateway,
};