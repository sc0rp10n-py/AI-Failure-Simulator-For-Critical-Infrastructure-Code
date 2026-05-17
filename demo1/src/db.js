const { Pool } = require('pg');

const defaultStock = [
  ['tee-black-m', 24],
  ['cap-navy', 18],
  ['hoodie-sand-l', 9],
  ['mug-white', 32],
];

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sentinel_demo1',
  });
}

async function initDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id text PRIMARY KEY,
      order_id text NOT NULL,
      customer_id text NOT NULL,
      amount_cents integer NOT NULL,
      status text NOT NULL,
      provider_reference text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_stock (
      sku text PRIMARY KEY,
      quantity integer NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_reservations (
      id text PRIMARY KEY,
      order_id text NOT NULL,
      sku text NOT NULL,
      quantity integer NOT NULL,
      status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const [sku, quantity] of defaultStock) {
    await pool.query(
      `INSERT INTO inventory_stock (sku, quantity) VALUES ($1, $2)
       ON CONFLICT (sku) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [sku, quantity],
    );
  }
}

async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createPool,
  initDatabase,
  withTransaction,
};