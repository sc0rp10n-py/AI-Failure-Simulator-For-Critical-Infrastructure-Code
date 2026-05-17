const express = require('express');
const { randomUUID } = require('crypto');
const { createLogger, createRequestContext } = require('./logger');
const { sleep } = require('./http');
const { withTransaction } = require('./db');

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return null;
  }

  const normalized = [];
  for (const item of items) {
    const sku = item?.sku;
    const quantity = Number(item?.quantity);
    if (!sku || !Number.isInteger(quantity) || quantity <= 0) {
      return null;
    }
    normalized.push({ sku, quantity });
  }

  return normalized;
}

function buildInventoryService(pool) {
  const app = express();
  const logger = createLogger('inventory-service');

  app.use(express.json({ limit: '64kb' }));
  app.use(createRequestContext);

  app.post('/inventory', async (req, res) => {
    const requestId = req.requestId;
    const orderId = req.body?.orderId;
    const items = normalizeItems(req.body?.items);

    if (!orderId || !items) {
      return res.status(400).json({ error: 'invalid_inventory_payload' });
    }

    const reservationId = randomUUID();
    const holdMs = Number(process.env.INVENTORY_LOCK_HOLD_MS || 180);

    logger.info('inventory reservation requested', {
      requestId,
      reservationId,
      orderId,
      itemCount: items.length,
    });

    try {
      await withTransaction(pool, async (client) => {
        for (const item of items) {
          const stockResult = await client.query(
            'SELECT quantity FROM inventory_stock WHERE sku = $1 FOR UPDATE',
            [item.sku],
          );

          if (stockResult.rowCount === 0) {
            throw new Error(`unknown sku ${item.sku}`);
          }

          const currentQuantity = stockResult.rows[0].quantity;
          if (currentQuantity < item.quantity) {
            const error = new Error(`insufficient stock for ${item.sku}`);
            error.code = 'INSUFFICIENT_STOCK';
            throw error;
          }

          await sleep(holdMs);

          await client.query(
            'UPDATE inventory_stock SET quantity = quantity - $2 WHERE sku = $1',
            [item.sku, item.quantity],
          );

          await client.query(
            `INSERT INTO inventory_reservations (id, order_id, sku, quantity, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [randomUUID(), orderId, item.sku, item.quantity, 'reserved'],
          );
        }
      });

      logger.info('inventory reserved', {
        requestId,
        reservationId,
        orderId,
        itemCount: items.length,
      });

      return res.json({
        reservationId,
        status: 'reserved',
      });
    } catch (error) {
      logger.error('inventory reservation failed', {
        requestId,
        reservationId,
        orderId,
        upstreamMessage: error.message,
        errorCode: error.code || null,
      });

      return res.status(409).json({
        error: 'inventory_unavailable',
        reservationId,
      });
    }
  });

  app.get('/inventory/:sku', async (req, res) => {
    const result = await pool.query('SELECT sku, quantity FROM inventory_stock WHERE sku = $1', [req.params.sku]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'sku_not_found' });
    }

    return res.json(result.rows[0]);
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'inventory-service' });
  });

  return app;
}

function startInventoryService(pool) {
  const port = Number(process.env.INVENTORY_PORT || 3002);
  const app = buildInventoryService(pool);

  return app.listen(port, () => {
    createLogger('inventory-service').info('inventory service started', { port });
  });
}

module.exports = {
  buildInventoryService,
  startInventoryService,
};