#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/apps/fixbroken
git fetch --all
git reset --hard origin/main
npm ci --omit=dev || npm install --omit=dev
sudo /usr/bin/systemctl restart fixbroken
