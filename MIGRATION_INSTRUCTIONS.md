# Invoice System Migration Instructions

## Prisma Migration

Run the following command to create and apply the database migration:

```bash
npx prisma migrate dev --name add_invoice_model
```

This will:
1. Add the `Invoice` model to the database
2. Add billing fields (`gstNumber`, `billingName`, `billingAddress`) to `ClientProfile` model
3. Create necessary indexes

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# GST Configuration
COMPANY_GST_NUMBER=29ABCDE1234F1Z5
COMPANY_NAME=Aspire Coworks
COMPANY_ADDRESS=123 Business Park, Sector 5, Gurgaon, Haryana 122001, India
GST_RATE=18
```

**Note**: Update these values with your actual company details before production.

## Post-Migration Steps

1. **Update existing companies** (optional): If you have existing companies, you may want to populate their billing details:
   ```sql
   UPDATE client_profiles 
   SET billing_name = company_name,
       billing_address = CONCAT_WS(', ', address, city, state, zip_code, country)
   WHERE billing_name IS NULL;
   ```

2. **Test invoice generation**: After a payment is marked as PAID, verify that:
   - Invoice record is created
   - PDF is generated and stored
   - Email is sent to client

3. **Verify invoice number generation**: Check that invoice numbers follow the format `AC-YYYY-0001` and increment correctly.

## Testing

1. Create a test payment and mark it as PAID
2. Verify invoice is created automatically
3. Download invoice PDF from admin and client pages
4. Verify email is sent with invoice link

## Rollback (if needed)

If you need to rollback the migration:

```bash
npx prisma migrate resolve --rolled-back add_invoice_model
```

Then manually remove the invoice-related code from the application.
