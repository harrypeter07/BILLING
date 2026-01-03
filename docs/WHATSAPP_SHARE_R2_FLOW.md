# WhatsApp Share with Cloudflare R2 Integration - Implementation Flow

## Overview
When a user clicks "Share on WhatsApp", the system automatically:
1. Generates an invoice slip PDF
2. Uploads the PDF to Cloudflare R2 bucket
3. Gets a public shareable link
4. Includes the R2 link in the WhatsApp message
5. Opens WhatsApp with the message containing the PDF link

## Complete Flow Diagram

```
User clicks "Share on WhatsApp"
         ↓
[WhatsApp Share Button / Invoice Form]
         ↓
1. Generate Invoice Slip PDF (with logo & "Served by")
         ↓
2. Get Admin/User ID
         ↓
3. Upload PDF to R2 via API
   └─> [Client] Convert PDF Blob → Base64
   └─> [API Route] Convert Base64 → Buffer
   └─> [R2 Storage] Upload Buffer to R2
   └─> Returns: publicUrl, objectKey, expiresAt
         ↓
4. Save Metadata to Database
   └─> invoice_id, r2_object_key, public_url, expires_at
         ↓
5. Generate WhatsApp Message
   └─> Includes R2 public URL as "Download Invoice PDF" link
         ↓
6. Open WhatsApp with Message
   └─> Message contains formatted invoice + R2 PDF link
```

## Detailed Component Flow

### 1. Entry Points

#### A. WhatsApp Share Button (`components/features/invoices/whatsapp-share-button.tsx`)
- **Location**: Invoice detail/view page
- **Trigger**: User clicks "Share on WhatsApp" button
- **Function**: `handleShare()`

#### B. Invoice Form (`components/features/invoices/invoice-form.tsx`)
- **Location**: Create invoice page
- **Trigger**: User clicks "Save & Share on WhatsApp" button
- **Function**: `handleSaveAndShare()`

### 2. PDF Generation

**File**: `lib/utils/invoice-slip-pdf.ts`
- Generates invoice slip PDF using `jspdf` and `jspdf-autotable`
- Includes:
  - Logo (centered)
  - Store name, email, contact (from admin settings)
  - "Served by" field (admin or employee name)
  - Invoice items table
  - GST breakdown (if applicable)
  - Total amount
- Returns: `Blob` object

### 3. R2 Upload Process

#### Step 3.1: Client-Side Upload Initiation
**File**: `lib/utils/invoice-r2-client.ts`
- **Function**: `uploadInvoicePDFToR2Client()`
- **Input**: PDF Blob, adminId, invoiceId, invoiceNumber
- **Process**:
  1. Convert PDF Blob to Base64 string
  2. Send POST request to `/api/invoices/upload-r2`
  3. Request body:
     ```json
     {
       "pdfData": "base64_string",
       "adminId": "user_123",
       "invoiceId": "inv_456",
       "invoiceNumber": "INV-2026-001"
     }
     ```
- **Output**: `{ success, objectKey, publicUrl, expiresAt }`

#### Step 3.2: API Route Handler
**File**: `app/api/invoices/upload-r2/route.ts`
- **Function**: `POST()`
- **Process**:
  1. Validate request body (pdfData, adminId, invoiceId, invoiceNumber)
  2. Convert Base64 to Buffer
  3. Call `uploadInvoicePDFToR2()` from `r2-storage.ts`
  4. Calculate expiration date (14 days from now)
  5. Return response:
     ```json
     {
       "success": true,
       "objectKey": "invoices/user_123/INV-2026-001.pdf",
       "publicUrl": "https://pub-xxx.r2.dev/invoices/user_123/INV-2026-001.pdf",
       "expiresAt": "2026-01-17T09:34:23.856Z"
     }
     ```

#### Step 3.3: R2 Storage Upload
**File**: `lib/utils/r2-storage.ts`
- **Function**: `uploadInvoicePDFToR2()`
- **Process**:
  1. Initialize S3 client for Cloudflare R2
  2. Generate object key: `invoices/{adminId}/{invoiceNumber}.pdf`
  3. Upload PDF buffer to R2 using AWS SDK v3
  4. Set Content-Type: `application/pdf`
  5. Add metadata (invoiceId, adminId, uploadedAt)
  6. Generate public URL: `{R2_PUBLIC_BASE_URL}/{objectKey}`
- **Returns**: `{ success, objectKey, publicUrl }`

### 4. Database Storage

**File**: `lib/utils/save-invoice-storage.ts`
- **Function**: `saveInvoiceStorage()`
- **Process**:
  1. Check if using IndexedDB or Supabase
  2. Save metadata to `invoice_storage` table:
     - `invoice_id`: Invoice UUID
     - `r2_object_key`: Object key in R2
     - `public_url`: Public R2 URL
     - `expires_at`: Expiration date (14 days)
     - `created_at`: Timestamp
- **Table Schema**:
  ```sql
  CREATE TABLE invoice_storage (
    id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL,
    r2_object_key TEXT NOT NULL,
    public_url TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

### 5. WhatsApp Message Generation

**File**: `lib/utils/whatsapp-bill.ts`
- **Function**: `generateWhatsAppBillMessage()`
- **Input**: `MiniBillData` (includes optional `pdfR2Url`)
- **Process**:
  1. Format invoice data (date, items, totals)
  2. Build formatted message with:
     - Invoice header
     - Items list
     - Total amount
     - **Link section**:
       - If `pdfR2Url` exists: "📄 Download Invoice PDF" + R2 URL
       - Otherwise: "📱 View full invoice" + invoice link
  3. Return formatted message string

**Example Message**:
```
📋 *Invoice Receipt*

🏪 *My Store*

━━━━━━━━━━━━━━━━━━━━
📄 Invoice #INV-2026-001
📅 Date: 02/01/2026
━━━━━━━━━━━━━━━━━━━━

*Items:*
1. Product A
   Qty: 2 × ₹100.00 = ₹200.00

2. Product B
   Qty: 1 × ₹50.00 = ₹50.00

━━━━━━━━━━━━━━━━━━━━
💰 *Total: ₹250.00*
━━━━━━━━━━━━━━━━━━━━

📄 Download Invoice PDF:
https://pub-xxx.r2.dev/invoices/user_123/INV-2026-001.pdf

Thank you for your business! 🙏
```

### 6. WhatsApp Sharing

**File**: `lib/utils/whatsapp-bill.ts`
- **Function**: `shareOnWhatsApp()`
- **Process**:
  1. Encode message for URL
  2. Download PDF locally (as backup)
  3. Open WhatsApp Web/App with pre-filled message:
     ```
     https://wa.me/?text={encoded_message}
     ```
  4. User can then send the message with the PDF link

## Error Handling & Fallbacks

### Scenario 1: R2 Upload Fails
- **Behavior**: Falls back to local PDF download
- **Message**: Still includes invoice link (not R2 link)
- **User Experience**: PDF downloaded, WhatsApp opens with message

### Scenario 2: No Admin ID Available
- **Behavior**: Skips R2 upload
- **Message**: Uses invoice link instead of R2 link
- **User Experience**: Normal WhatsApp share with invoice link

### Scenario 3: PDF Generation Fails
- **Behavior**: Shares text-only message
- **Message**: Includes invoice link (no PDF)
- **User Experience**: WhatsApp opens with text message only

### Scenario 4: Offline/No Internet
- **Behavior**: Shows error toast
- **Message**: "Internet required to share invoice on WhatsApp"
- **User Experience**: Button disabled, no action taken

## Environment Variables Required

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev
```

## R2 Bucket Configuration

1. **Public Access**: Enabled via R2 public bucket settings
2. **Lifecycle Rules**: Configured to delete objects after 14 days
3. **Object Naming**: `invoices/{adminId}/{invoiceNumber}.pdf`
4. **Content-Type**: `application/pdf`
5. **Metadata**: Includes invoiceId, adminId, uploadedAt

## Database Schema

### Supabase Table: `invoice_storage`
```sql
CREATE TABLE invoice_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  r2_object_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoice_storage_invoice_id ON invoice_storage(invoice_id);
```

### IndexedDB Table: `invoice_storage`
- Same structure as Supabase
- Stored in Dexie database

## Key Features

✅ **Automatic Upload**: PDF uploaded to R2 automatically when sharing
✅ **Public Links**: R2 provides publicly accessible URLs
✅ **14-Day Retention**: Files auto-delete after 14 days via lifecycle rules
✅ **Metadata Storage**: R2 object key and URL stored in database
✅ **Fallback Support**: Gracefully handles failures
✅ **Deterministic Naming**: Predictable object keys for easy management
✅ **Service Account**: No OAuth, backend-only authentication

## Testing

Run the test script to verify R2 upload:
```bash
node scripts/test-r2-upload.js
```

This will:
1. Check environment variables
2. Generate a test PDF
3. Upload to R2
4. Verify public URL accessibility
5. Display results

## Summary

The implementation is **complete and working**. When users click "Share on WhatsApp":

1. ✅ PDF is generated (slip format with logo and "Served by")
2. ✅ PDF is uploaded to Cloudflare R2
3. ✅ Public URL is generated
4. ✅ Metadata is saved to database
5. ✅ WhatsApp message includes R2 PDF link
6. ✅ WhatsApp opens with pre-filled message

The R2 link in the WhatsApp message allows recipients to directly download the invoice PDF without needing access to the billing system.

