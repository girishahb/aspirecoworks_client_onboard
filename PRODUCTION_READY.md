# Production Readiness Checklist

This document outlines the critical requirements for deploying Aspire Coworks Client Onboarding Platform to production.

## 🔒 Security Hardening

### ✅ Completed
- [x] Helmet middleware enabled for secure HTTP headers
- [x] CORS configured with allowed origins
- [x] Rate limiting on authentication and upload endpoints
- [x] Strict DTO validation with Zod
- [x] Stack traces hidden in production errors
- [x] File upload validation (types, size, filenames)

### ⚠️ Required Before Production

#### Environment Variables
```bash
# Required
NODE_ENV=production
DATABASE_URL=postgresql://...
ALLOWED_ORIGINS=https://app.aspirecoworks.com,https://admin.aspirecoworks.com
JWT_SECRET=<strong-random-secret-32-chars-min>
JWT_EXPIRES_IN=24h

# Storage (R2/S3)
R2_ENDPOINT=https://...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=aspirecoworks-prod

# Email
RESEND_API_KEY=...
EMAIL_FROM=Aspire Coworks <noreply@aspirecoworks.com>
FRONTEND_URL=https://app.aspirecoworks.in

# Payment Gateway (if applicable)
PAYMENT_GATEWAY_API_KEY=...
PAYMENT_GATEWAY_SECRET=...
```

#### Security Checklist
- [ ] Change all default passwords
- [ ] Rotate JWT_SECRET from development
- [ ] Enable HTTPS only (TLS 1.2+)
- [ ] Set secure cookie flags (if using cookies)
- [ ] Review and restrict CORS origins
- [ ] Enable database SSL connections
- [ ] Set up firewall rules (only allow necessary ports)
- [ ] Review file upload limits (currently 10MB max)
- [ ] Enable database connection pooling limits

## 📦 Database & Storage

### Database Backup Strategy

#### Option A: Managed Database (Render, AWS RDS, etc.)
- [ ] Enable automated daily backups
- [ ] Test restore procedure
- [ ] Set retention policy (minimum 30 days)
- [ ] Document backup location and access

#### Option B: Manual Backups
- [ ] Schedule weekly backups using `scripts/backup-db.sh` or `scripts/backup-db.ps1`
- [ ] Store backups in secure location (encrypted)
- [ ] Test restore procedure
- [ ] Document backup process

#### Backup Script Usage
```bash
# Linux/Mac
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh

# Windows PowerShell
.\scripts\backup-db.ps1
```

### Storage (R2/S3) Configuration
- [ ] Verify bucket is private (not public)
- [ ] Enable versioning (optional, for recovery)
- [ ] Set lifecycle policies (delete old files after retention period)
- [ ] Verify presigned URLs expire correctly (currently 5 minutes)
- [ ] Test file upload/download flow
- [ ] Verify folder structure:
  - `/company/{companyId}/kyc/`
  - `/company/{companyId}/agreement_draft/`
  - `/company/{companyId}/agreement_signed/`
  - `/company/{companyId}/agreement_final/`

## 📧 Email Configuration

### Email Service (Resend)
- [ ] Verify RESEND_API_KEY is valid
- [ ] Test email delivery (activation, agreements, etc.)
- [ ] Set up email domain verification (SPF, DKIM)
- [ ] Monitor email delivery rates
- [ ] Set up bounce/complaint handling

### Email Retry Logic
- [x] Email service logs errors (does not throw)
- [ ] Consider adding retry queue (future enhancement)
- [ ] Monitor email failures in logs

## 🔐 Authentication & Authorization

### JWT Configuration
- [x] JWT expiry enabled (24h default)
- [x] Role-based guards implemented
- [x] Admin-only routes protected
- [ ] Verify JWT_SECRET is strong (32+ characters)
- [ ] Consider refresh token implementation (future)

### Rate Limiting
- [x] Global: 100 requests/minute
- [x] Auth endpoints: 5 requests/minute
- [x] Upload endpoints: 10 requests/minute
- [ ] Monitor rate limit hits in production
- [ ] Adjust limits based on usage

## 📄 File Upload Security

### Validation Rules
- [x] File types restricted: PDF, JPG, JPEG, PNG only
- [x] File size limit: 10MB max
- [x] Filename sanitization (removes path components, dangerous chars)
- [x] MIME type validation
- [x] Server-side validation (defense in depth)
- [ ] Consider virus scanning (future enhancement)

### Storage Security
- [x] Files stored with unique UUIDs (not original filenames)
- [x] Presigned URLs expire after 5 minutes
- [x] Files are private (not publicly accessible)
- [ ] Verify no public read access to bucket

## 📊 Monitoring & Logging

### Error Monitoring
- [x] Global exception filter logs errors
- [x] Structured error logging
- [ ] Set up error monitoring service (Sentry, DataDog, etc.)
- [ ] Configure alerting for critical errors
- [ ] Set up log aggregation (CloudWatch, Logtail, etc.)

### Audit Logging
- [x] KYC approvals/rejections logged
- [x] Agreement uploads logged
- [x] Activation events logged
- [x] Payment confirmations logged
- [ ] Verify audit logs are retained (minimum 1 year for compliance)
- [ ] Set up audit log backup

## ⚡ Performance & Scaling

### Database Optimization
- [x] Indexes on: companyId, onboardingStage, createdAt
- [x] Pagination on list APIs
- [ ] Review query performance (use EXPLAIN ANALYZE)
- [ ] Set up connection pooling (Prisma default: 10 connections)
- [ ] Monitor slow queries

### Stateless Architecture
- [x] No in-memory session storage
- [x] JWT-only authentication
- [x] External file storage (R2/S3)
- [ ] Verify horizontal scaling readiness (multiple instances)

### Health Endpoint
- [x] GET /health endpoint exists
- [ ] Enhance to check DB connectivity
- [ ] Enhance to check storage connectivity
- [ ] Enhance to check email service status
- [ ] Set up health check monitoring

## ⚖️ Legal Compliance (India)

### Required Pages
- [ ] Privacy Policy page (`/privacy-policy`)
- [ ] Terms of Service page (`/terms-of-service`)
- [ ] Include KYC data handling information
- [ ] Include document retention policy
- [ ] Include data protection measures

### Data Retention
- [ ] Document retention policy defined (suggest: 7 years for KYC)
- [ ] Implement data deletion process for expired data
- [ ] Document data access procedures

### Compliance Considerations
- [ ] Review IT Act 2000 compliance
- [ ] Review data localization requirements (if applicable)
- [ ] Set up data breach notification process
- [ ] Document data processing agreements

## 🛡️ Admin Safety Controls

### Prevent Accidental Deletions
- [x] Company deletion requires ADMIN role
- [x] Document history preserved (replacesId, versioning)
- [x] Activation date cannot be edited after activation
- [ ] Consider soft delete for companies (future)
- [ ] Add confirmation dialogs for destructive actions

### Audit Trail
- [x] All admin actions logged
- [x] User ID, company ID, action, timestamp stored
- [ ] Regular audit log review process

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Run database migrations (`prisma migrate deploy`)
- [ ] Seed initial data (if needed)
- [ ] Verify environment variables are set
- [ ] Test backup/restore procedure
- [ ] Run security scan (npm audit, Snyk, etc.)

### Deployment
- [ ] Deploy to staging environment first
- [ ] Run smoke tests
- [ ] Verify health endpoint
- [ ] Test critical flows (login, upload, payment)
- [ ] Deploy to production
- [ ] Monitor error logs for first 24 hours

### Post-Deployment
- [ ] Verify backups are running
- [ ] Set up monitoring alerts
- [ ] Document deployment process
- [ ] Schedule regular security reviews

## 📋 Regular Maintenance

### Weekly
- [ ] Review error logs
- [ ] Check backup status
- [ ] Monitor disk space (database, storage)
- [ ] Review rate limit metrics

### Monthly
- [ ] Review audit logs
- [ ] Update dependencies (security patches)
- [ ] Review and rotate secrets
- [ ] Performance review

### Quarterly
- [ ] Security audit
- [ ] Compliance review
- [ ] Disaster recovery test
- [ ] Capacity planning review

## 🔗 Useful Commands

```bash
# Database backup
./scripts/backup-db.sh

# Database restore (example)
psql $DATABASE_URL < backups/backup_20240101_120000.sql

# Run migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# Check health
curl https://api.aspirecoworks.com/health

# View logs (example)
tail -f logs/app.log
```

## 📞 Support Contacts

- **Technical Issues**: [Your DevOps Team]
- **Security Issues**: [Your Security Team]
- **Compliance Questions**: [Your Legal Team]

---

**Last Updated**: [Date]
**Version**: 1.0.0
