#!/bin/sh
set -eu

echo "Waiting for Postgres and ensuring database exists..."
until bun run db:create; do
  sleep 2
done

echo "Applying Drizzle schema..."
bun run db:push --force

echo "Starting ReelLink API in watch mode..."
exec bun run dev:local
