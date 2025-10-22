#!/bin/sh
set -e

# Default location for Docker deployment
LOCATION_DIR="${LOCATION_DIR:-/app/.margin}"
DATABASE_FILE="${DATABASE_FILE:-margin.sqlite3}"

# Check if margin is initialized
if [ ! -f "${LOCATION_DIR}/${DATABASE_FILE}" ]; then
    echo "🔧 First run detected - initializing margin..."
    node dist/index.js initialise --location "${LOCATION_DIR}" --workspace /app/data
fi

# Execute the CMD (starts the UI server)
exec "$@"
