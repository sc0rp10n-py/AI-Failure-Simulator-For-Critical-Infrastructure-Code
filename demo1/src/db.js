const { Pool, Client } = require('pg');

function defaultDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@127.0.0.1:5433/sentinel_demo1'
  );
}

const defaultStock = [
  ['tee-black-m', 24],
  ['cap-navy', 18],
  ['hoodie-sand-l', 9],
  ['mug-white', 32],
];

function createPool() {
  const pool = new Pool({
    connectionString: defaultDatabaseUrl(),
  });
  pool.on('error', () => {
    // Ignore idle client errors during sandbox teardown / compose restarts.
  });
  return pool;
}

function adminConnectionString() {
  const url = new URL(defaultDatabaseUrl().replace(/^postgres:\/\//, 'postgresql://'));
  url.pathname = '/postgres';
  return url.toString();
}

async function waitForPostgres({ attempts = 30, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const client = new Client({ connectionString: adminConnectionString() });
    try {
      await client.connect();
      await client.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } finally {
      await client.end().catch(() => {});
    }
  }
}

async function ensureDatabaseExists() {
  const target = new URL(defaultDatabaseUrl().replace(/^postgres:\/\//, 'postgresql://'));
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`unsupported database name: ${dbName}`);
  }
  const client = new Client({ connectionString: adminConnectionString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE ${dbName}`);
    }
  } finally {
    await client.end();
  }
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
  ensureDatabaseExists,
  waitForPostgres,
  initDatabase,
  withTransaction,
};