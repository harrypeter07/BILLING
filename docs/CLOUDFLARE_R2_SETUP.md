# Cloudflare R2 Invoice Storage Setup

This guide explains how to configure Cloudflare R2 for storing invoice PDFs and generating public shareable links.

## Overview

The system automatically:
1. Generates invoice PDF as a buffer (no disk writes)
2. Uploads PDF to Cloudflare R2 with deterministic naming: `invoices/{adminId}/{invoiceId}.pdf`
3. Stores metadata in database (not binary data)
4. Generates public URLs for sharing
5. Auto-deletes files after 14 days (via R2 lifecycle rules)

## Prerequisites

- Cloudflare account
- R2 bucket created
- AWS SDK v3 installed (`@aws-sdk/client-s3` - already in package.json)

## Step 1: Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** > **Create bucket**
3. Enter bucket name (e.g., `invoice-pdfs`)
4. Click **Create bucket**

## Step 2: Configure Public Access

1. Go to your R2 bucket
2. Click **Settings**
3. Under **Public Access**, enable **Allow Access**
4. Copy the **Public R2.dev subdomain** (e.g., `pub-xxxxx.r2.dev`)
5. This will be your `R2_PUBLIC_BASE_URL`

## Step 3: Set Up Lifecycle Rules (14-day retention)

1. In your R2 bucket, go to **Settings**
2. Scroll to **Lifecycle Rules**
3. Click **Create Rule**
4. Configure:
   - **Rule name**: `Delete after 14 days`
   - **Action**: Delete objects
   - **After**: 14 days
5. Click **Create**

This automatically deletes old invoices - no code needed!

## Step 4: Create R2 API Token

1. Go to **R2** > **Manage R2 API Tokens**
2. Click **Create API token**
3. Fill in:
   - **Token name**: `Invoice Upload Token`
   - **Permissions**: Object Read & Write
   - **TTL**: (optional, or leave blank for no expiry)
4. Click **Create API Token**
5. **IMPORTANT**: Copy the credentials immediately:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (shown at the top)

## Step 5: Set Environment Variables

Add these to your `.env.local` (local) or hosting platform (production):

```env
R2_ACCOUNT_ID=your-account-id-here
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=invoice-pdfs
R2_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
```

**For Vercel:**
1. Go to project settings
2. Navigate to **Environment Variables**
3. Add all 5 variables
4. Redeploy

## Step 6: Run Database Migration

Run the SQL migration to create the `invoice_storage` table:

```sql
-- See scripts/create_invoice_storage_table.sql
```

Or execute it in your Supabase SQL editor.

## Step 7: Test the Implementation

1. Create a test invoice
2. Click "Share on WhatsApp" or "Save & Share on WhatsApp"
3. The system should:
   - Upload PDF to R2
   - Generate public URL
   - Include URL in WhatsApp message
   - Save metadata to database

## Object Naming Strategy

Files are stored with deterministic, collision-free keys:

```
invoices/{adminId}/{invoiceNumber}.pdf
```

Example:
```
invoices/admin_23/INV_2026_0042.pdf
```

This helps with:
- ✅ Cleanup jobs
- ✅ Admin separation
- ✅ Debugging
- ✅ Audits

## Database Schema

The `invoice_storage` table stores only metadata:

```sql
CREATE TABLE invoice_storage (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id),
  r2_object_key TEXT UNIQUE,
  public_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Never stores binary PDF data** - only references.

## Retention Policy

- **Preferred**: R2 lifecycle rules (automatic, zero-code)
- **Fallback**: Database `expires_at` field + cron job

The implementation uses R2 lifecycle rules for automatic cleanup.

## Public Access Model

The system uses **Option 1** (Simplest):
- Public R2 bucket
- Public `r2.dev` URLs
- Example: `https://pub-xxxxx.r2.dev/invoices/admin_23/INV_0042.pdf`

Files are automatically deleted after 14 days via lifecycle rules.

## Troubleshooting

### Error: "R2 is not configured"

- Check all 5 environment variables are set
- Verify variable names are exact (case-sensitive)
- Restart application after adding variables

### Error: "Failed to upload PDF to R2"

- Verify R2 API token has correct permissions
- Check bucket name is correct
- Ensure bucket exists and is accessible
- Verify Account ID is correct

### Error: "Invalid credentials"

- Regenerate R2 API token
- Ensure Access Key ID and Secret Access Key are correct
- Check token hasn't expired

### Files not accessible via public URL

- Verify public access is enabled on bucket
- Check `R2_PUBLIC_BASE_URL` matches your bucket's public subdomain
- Ensure object key format is correct

## Security Best Practices

1. **Never commit credentials**: Keep all R2 credentials in environment variables
2. **Use lifecycle rules**: Automatic cleanup prevents storage bloat
3. **Monitor usage**: Check R2 dashboard for unusual activity
4. **Rotate tokens**: Periodically regenerate API tokens
5. **Limit permissions**: R2 token should only have Object Read & Write (not admin)

## Cost Considerations

- R2 storage: $0.015 per GB/month
- Class A operations (writes): $4.50 per million
- Class B operations (reads): $0.36 per million
- Egress: Free (within Cloudflare network)

For typical usage (thousands of invoices/month), costs are minimal.

## Support

If you encounter issues:
1. Check Cloudflare R2 dashboard for errors
2. Verify environment variables are set correctly
3. Check browser console for client-side errors
4. Review server logs for API route errors


