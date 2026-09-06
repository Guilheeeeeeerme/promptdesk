#!/bin/sh
set -e

echo "Waiting for database..."
npx prisma migrate deploy
npx prisma migrate deploy --schema prisma-chat/schema.prisma
echo "Seeding database..."
npx prisma db seed
echo "Starting API..."
exec node dist/main.js
