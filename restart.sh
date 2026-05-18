#!/bin/sh

cd frontend
npm run build
pm2 restart sentinel-frontend --update-env

cd ..

cd backend
source env/bin/activate
kill "$(cat logs/backend.pid)"
nohup python3 run.py > logs/backend.log 2>&1 &
echo $! > logs/backend.pid

curl https://sentinel.sc0rp10n.space/api/health