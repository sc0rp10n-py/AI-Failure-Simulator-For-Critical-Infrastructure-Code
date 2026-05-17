# Demo 4 Fraud Detection Backend

Python Flask backend for a real-time fintech fraud detection system.

## Components

- Transaction ingestion at `POST /transactions/ingest`
- Fraud scoring engine with deliberate serial locking and scoring delay risk
- External verification API client with retry behavior
- Notification service with duplicate-delivery edge cases

## Failure Modes Modeled

- Verification API slowdown
- Burst transaction load
- Duplicate notifications
- Scoring delays
- Retry storms caused by repeated verification failures

## Run

```bash
pip install -r requirements.txt
python app.py
```

The service listens on port `5004` by default.

## Useful Endpoints

- `GET /health`
- `POST /transactions/ingest`
- `POST /transactions/burst`
- `GET /transactions/<transaction_id>`
- `GET /events`
- `GET /telemetry`
- `POST /simulate/failure`

## Example Payload

```json
{
    "merchant_id": "merchant_12",
    "customer_id": "customer_91",
    "amount": 4890.5,
    "currency": "USD",
    "channel": "web",
    "ip_address": "10.0.4.17",
    "device_id": "new-device"
}
```

## Notes

The implementation intentionally keeps a coarse global lock and synchronous dependency chain so the demo can surface bottlenecks, retry storms, and partial failure behavior under load.
