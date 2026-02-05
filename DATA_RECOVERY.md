# Data Recovery Guide

This document outlines the procedures for restoring database backups in case of data loss or corruption.

## Backup Location

Backups are stored in the `./backups` directory (or custom location specified when running the backup script).

## Backup File Format

Backups are named: `backup_YYYYMMDD_HHMMSS.sql.gz` (compressed) or `backup_YYYYMMDD_HHMMSS.sql` (uncompressed)

Example: `backup_20240130_143022.sql.gz`

## Restore Procedure

### Prerequisites

1. Ensure PostgreSQL client (`psql`) is installed
2. Have access to the target database
3. Have the backup file available

### Step 1: Stop the Application

Stop the application to prevent new writes during restore:

```bash
# If running as a service
systemctl stop aspirecoworks-api

# Or if running via PM2
pm2 stop aspirecoworks-api
```

### Step 2: Decompress Backup (if compressed)

```bash
# Linux/Mac
gunzip backup_20240130_143022.sql.gz

# Windows PowerShell
Expand-Archive -Path backup_20240130_143022.sql.gz -DestinationPath .
```

### Step 3: Restore Database

**⚠️ WARNING: This will overwrite existing data in the target database.**

```bash
# Using psql directly
psql $DATABASE_URL < backup_20240130_143022.sql

# Or with explicit connection
psql -h localhost -U postgres -d aspirecoworks < backup_20240130_143022.sql
```

### Step 4: Verify Restore

1. Check record counts:
```sql
SELECT COUNT(*) FROM client_profiles;
SELECT COUNT(*) FROM documents;
SELECT COUNT(*) FROM payments;
```

2. Test critical queries:
```sql
SELECT * FROM client_profiles LIMIT 5;
SELECT * FROM documents LIMIT 5;
```

### Step 5: Restart Application

```bash
# If running as a service
systemctl start aspirecoworks-api

# Or if running via PM2
pm2 start aspirecoworks-api
```

## Partial Restore (Specific Tables)

If you need to restore only specific tables:

```bash
# Extract specific table from backup
pg_restore -t client_profiles backup_20240130_143022.sql > client_profiles_only.sql

# Restore specific table
psql $DATABASE_URL < client_profiles_only.sql
```

## Point-in-Time Recovery

For point-in-time recovery using WAL (Write-Ahead Logging), you need:

1. Continuous archiving enabled
2. Base backup + WAL files
3. Recovery configuration

**Note**: This requires advanced PostgreSQL setup and is beyond the scope of this basic backup script.

## Backup Retention

- **Automated backups**: Last 7 days (configured in backup script)
- **Manual backups**: Keep indefinitely or per your retention policy
- **Compliance**: KYC documents must be retained for 7 years (as per Indian regulations)

## Testing Backups

**Regularly test your backups!** A backup is only useful if it can be restored.

### Monthly Test Procedure

1. Create a test database
2. Restore latest backup to test database
3. Verify data integrity
4. Document test results

## Emergency Contacts

- **Database Issues**: [Your DBA/DevOps Team]
- **Data Loss**: [Your Incident Response Team]
- **Compliance**: [Your Legal Team]

---

**Last Updated**: [Date]
