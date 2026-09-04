#!/bin/sh
set -e

echo "Waiting for database..."
npx prisma migrate deploy
echo "Seeding database..."
npx prisma db seed
echo "Starting API..."
exec node dist/main.js
