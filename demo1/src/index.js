const { createPool, initDatabase } = require('./db');
const { startGateway } = require('./gateway');
const { startPaymentService } = require('./payment-service');
const { startInventoryService } = require('./inventory-service');
const { startMockPaymentProvider } = require('./mock-payment-provider');
const { createLogger } = require('./logger');

async function main() {
  const logger = createLogger('bootstrap');
  const pool = createPool();

  await initDatabase(pool);

  startMockPaymentProvider();
  startPaymentService(pool);
  startInventoryService(pool);
  startGateway();

  logger.info('demo1 stack booted', {
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sentinel_demo1',
    gatewayPort: Number(process.env.GATEWAY_PORT || 3000),
    paymentPort: Number(process.env.PAYMENT_PORT || 3001),
    inventoryPort: Number(process.env.INVENTORY_PORT || 3002),
    providerPort: Number(process.env.PAYMENT_PROVIDER_PORT || 3003),
  });
}

main().catch((error) => {
  const logger = createLogger('bootstrap');
  logger.error('failed to boot demo1 stack', {
    upstreamMessage: error.message,
    stack: error.stack,
  });
  process.exitCode = 1;
});