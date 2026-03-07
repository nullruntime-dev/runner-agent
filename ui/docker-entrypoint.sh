#!/bin/sh
set -e

DB_PATH="/app/data/runner.db"
MIGRATION_SQL="/app/prisma/migrations/20260228064205_init/migration.sql"

# Initialize database if it doesn't exist
if [ ! -f "$DB_PATH" ]; then
    echo "Initializing database..."
    sqlite3 "$DB_PATH" < "$MIGRATION_SQL"
    echo "Database initialized."
else
    echo "Database already exists."
fi

# Start the application
echo "Starting application..."
exec node server.js
