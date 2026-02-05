#!/bin/bash
# Database Backup Script for Aspire Coworks
# Usage: ./scripts/backup-db.sh [backup-dir]

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "Starting database backup..."
echo "Backup file: $BACKUP_FILE"

# Perform backup
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

# Get file size
FILE_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)

echo "✓ Backup completed successfully"
echo "  File: $BACKUP_FILE_GZ"
echo "  Size: $FILE_SIZE"

# Optional: Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete 2>/dev/null || true

echo "✓ Old backups cleaned (kept last 7 days)"
