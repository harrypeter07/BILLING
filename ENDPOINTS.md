# 📋 API Endpoints Reference

## 🎨 HTML Preview Endpoints (Mock Data - No Database Calls)

These endpoints show the HTML templates with mock data for real-time editing. **No API calls to database** - perfect for template development.

### 📄 Invoice HTML Preview
```
GET /api/invoices/[any-id]/html
```
**Example:** 
- `http://localhost:3000/api/invoices/test/html`
- `http://localhost:3000/api/invoices/any-id/html` (any ID works)

**Features:**
- ✅ Shows invoice HTML template with mock data
- ✅ No database calls - uses static mock data
- ✅ Perfect for real-time template editing
- ✅ Always shows logo (placeholder if not provided)
- ✅ Cache-busting headers (changes reflect immediately)

### 🧾 Slip HTML Preview  
```
GET /api/invoices/[any-id]/slip-html
```
**Example:**
- `http://localhost:3000/api/invoices/test/slip-html`
- `http://localhost:3000/api/invoices/any-id/slip-html` (any ID works)

**Features:**
- ✅ Shows slip HTML template with mock data (pink theme)
- ✅ No database calls - uses static mock data
- ✅ Perfect for real-time template editing
- ✅ Always shows logo (placeholder if not provided)
- ✅ Cache-busting headers (changes reflect immediately)

---

## 📄 PDF Generation Endpoints

### Generate PDF from Data (Server-Side)
```
POST /api/invoices/generate-pdf-from-data
```
**Body:**
```json
{
  "data": InvoicePDFData | InvoiceSlipData,
  "type": "invoice" | "slip"
}
```
**Response:** PDF blob

- Uses Puppeteer for high-quality PDF generation
- Automatically falls back to client-side if server fails

---

## 🔑 License Seed Endpoint

### Create License
```
POST /api/license/seed
```
**Full URL:** `http://localhost:3000/api/license/seed`

**Request Body:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "clientName": "Optional Client Name",
  "expiresInDays": 365
}
```

**Success Response:**
```json
{
  "success": true,
  "licenseKey": "LICENSE-XXXXXXXX-XXXXXXXX",
  "expiresAt": "2025-12-30T..."
}
```

**Error Response:**
```json
{
  "error": "Invalid MAC address format"
}
```

**Notes:**
- ✅ Does not require authentication (for seeding purposes)
- ✅ MAC address can be with or without colons: `AA:BB:CC:DD:EE:FF` or `AABBCCDDEEFF`
- ✅ Default expiration: 365 days if not specified

---

## 🧪 Quick Test Commands

### Test Invoice HTML Preview
Open in browser: `http://localhost:3000/api/invoices/test/html`

### Test Slip HTML Preview
Open in browser: `http://localhost:3000/api/invoices/test/slip-html`

### Test License Seed (using curl)
```bash
curl -X POST http://localhost:3000/api/license/seed \
  -H "Content-Type: application/json" \
  -d '{"macAddress": "AA:BB:CC:DD:EE:FF", "expiresInDays": 365}'
```

---

## 📝 Notes

- HTML preview endpoints use **mock data** - no API calls to database
- All endpoints support both online and offline modes
- PDF generation automatically falls back to client-side if server fails

