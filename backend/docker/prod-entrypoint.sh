#!/bin/sh
set -eu

echo "Ensuring database exists..."
bun run db:create

echo "Running Drizzle migrations..."
bun run db:migrate

echo "Starting ReelLink API..."
exec bun run start
