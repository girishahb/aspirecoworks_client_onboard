# Database Backup Script for Aspire Coworks (PowerShell)
# Usage: .\scripts\backup-db.ps1 [backup-dir]

param(
    [string]$BackupDir = ".\backups"
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "backup_$Timestamp.sql"

# Create backup directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "Error: DATABASE_URL environment variable is not set" -ForegroundColor Red
    exit 1
}

Write-Host "Starting database backup..."
Write-Host "Backup file: $BackupFile"

# Perform backup using pg_dump
& pg_dump $env:DATABASE_URL | Out-File -FilePath $BackupFile -Encoding UTF8

# Compress backup (requires 7-Zip or similar)
$BackupFileGz = "$BackupFile.gz"
if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
    Compress-Archive -Path $BackupFile -DestinationPath $BackupFileGz -Force
    Remove-Item $BackupFile
    $BackupFile = $BackupFileGz
}

# Get file size
$FileSize = (Get-Item $BackupFile).Length / 1MB
$FileSizeFormatted = "{0:N2} MB" -f $FileSize

Write-Host "✓ Backup completed successfully" -ForegroundColor Green
Write-Host "  File: $BackupFile"
Write-Host "  Size: $FileSizeFormatted"

# Optional: Keep only last 7 days of backups
$CutoffDate = (Get-Date).AddDays(-7)
Get-ChildItem -Path $BackupDir -Filter "backup_*.sql*" | 
    Where-Object { $_.LastWriteTime -lt $CutoffDate } | 
    Remove-Item -Force

Write-Host "✓ Old backups cleaned (kept last 7 days)" -ForegroundColor Green
