#!/bin/bash

set -e

echo "=== Building frontend ==="

cd frontend

npm install
npm run build

pm2 restart sentinel-frontend --update-env

cd ..

echo "=== Restarting backend ==="

cd backend

# Activate venv
. env/bin/activate

# Kill old backend if PID exists
if [ -f logs/backend.pid ]; then
    PID=$(cat logs/backend.pid)

    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Killing old backend process $PID"
        kill "$PID"
        sleep 2
    fi
fi

# Start backend
nohup python3 run.py > logs/backend.log 2>&1 &

echo $! > logs/backend.pid

echo "Backend started with PID $(cat logs/backend.pid)"

sleep 5

echo "=== Health Check ==="

curl -i https://sentinel.sc0rp10n.space/api/health

echo ""
echo "=== Deployment Complete ==="