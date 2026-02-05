# Migration Guide: Remove CLIENT Role

## Important: Pre-Migration Steps

Before running the Prisma migration, you **MUST** update existing users in the database:

### Step 1: Update Existing CLIENT Users

Run this SQL command to convert all CLIENT users to COMPANY_ADMIN:

```sql
-- Update all CLIENT users to COMPANY_ADMIN
UPDATE users SET role = 'COMPANY_ADMIN' WHERE role = 'CLIENT';

-- Verify the update
SELECT email, role FROM users WHERE role = 'CLIENT';
-- Should return 0 rows

-- Verify COMPANY_ADMIN users
SELECT email, role, "companyId" FROM users WHERE role = 'COMPANY_ADMIN';
```

**Important**: After converting CLIENT to COMPANY_ADMIN, ensure these users have a `companyId` set. If they don't have a company linked, you'll need to either:
1. Link them to an existing company, or
2. Create a company profile for them

### Step 2: Run Prisma Migration

After updating the database, run:

```bash
npx prisma migrate dev --name remove_client_role
```

This will:
- Remove `CLIENT` from the `UserRole` enum in PostgreSQL
- Update the Prisma schema

### Step 3: Verify Migration

After migration, verify:

```sql
-- Check enum values (should not include CLIENT)
SELECT unnest(enum_range(NULL::"UserRole"));
```

## Rollback (if needed)

If you need to rollback:

1. Add CLIENT back to Prisma schema enum
2. Run migration to add it back
3. Update any converted users back to CLIENT if needed

## Testing After Migration

1. Verify COMPANY_ADMIN users can:
   - Access client dashboard (`/dashboard`)
   - Upload documents (`/documents/upload-url`)
   - View invoices (`/client/invoices`)
   - Download documents

2. Verify no CLIENT role references remain in code:
   ```bash
   grep -r "UserRole.CLIENT" src/
   grep -r "CLIENT" prisma/schema.prisma | grep -v "DocumentOwner"
   ```

3. Test with company-admin@example.com account
