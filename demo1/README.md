# Demo 1 Backend System

Theme: e-commerce payment microservice.

## Services

- API Gateway on `:3000`
- Payment Service on `:3001`
- Inventory Service on `:3002`
- Mock payment provider on `:3003`
- PostgreSQL at `DATABASE_URL` (default host port `5433` via `docker-compose.yml` to avoid clashing with a local Postgres on `5432`)

## Intentional Weaknesses

- No retry logic anywhere in the checkout path.
- The Payment Service depends on a payment API and times out aggressively.
- Inventory uses row locks and keeps transactions open long enough to create contention.
- Idempotency is missing, so duplicate checkout submissions can create duplicate transactions.

## Failure Scenarios

- Payment API latency causes checkout failures or partial completion.
- Concurrent orders for the same SKU can queue behind the same PostgreSQL row lock.
- Replayed requests can charge twice because the Payment Service does not deduplicate by order ID.

## Run It

1. Start PostgreSQL with `docker compose up -d` (maps host `5433` → container `5432`).
2. Set `DATABASE_URL` if needed (default `postgres://postgres:postgres@127.0.0.1:5433/sentinel_demo1`).
3. Install dependencies with `npm install`.
4. Start the stack with `npm start`.

## Example Requests

```bash
curl -X POST http://localhost:3000/checkout \
  -H 'content-type: application/json' \
  -d '{
    "orderId": "ord_1001",
    "customerId": "cus_42",
    "amountCents": 2599,
    "items": [
      {"sku": "tee-black-m", "quantity": 1},
      {"sku": "cap-navy", "quantity": 2}
    ]
  }'
```

```bash
curl http://localhost:3000/healthz
curl http://localhost:3001/healthz
curl http://localhost:3002/healthz
```

## Realistic Behavior

The services emit structured JSON logs with request IDs, upstream URLs, DB operation details, and timing information. The checkout flow is intentionally linear:

`API Gateway -> Payment Service -> Mock Payment API`

`API Gateway -> Inventory Service -> PostgreSQL`

That dependency chain is fragile by design and exposes latency amplification, lock contention, and duplicate transaction risk.