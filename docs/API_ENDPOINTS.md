# API Endpoints Reference

## PDF Generation Endpoints

### 1. HTML Preview Endpoints (Mock Data - No API Calls)

These endpoints show the HTML templates with mock data for real-time editing:

#### Invoice HTML Preview
```
GET /api/invoices/[id]/html
```
- **Purpose**: Preview invoice HTML template with mock data
- **Use Case**: Edit HTML template and see changes immediately
- **Example**: `http://localhost:3000/api/invoices/any-id/html`
- **Response**: HTML page with mock invoice data
- **Features**:
  - ✅ No database calls (uses mock data)
  - ✅ Always shows logo (with placeholder fallback)
  - ✅ Cache-busting headers (changes reflect immediately)

#### Slip HTML Preview
```
GET /api/invoices/[id]/slip-html
```
- **Purpose**: Preview slip HTML template with mock data
- **Use Case**: Edit HTML template and see changes immediately
- **Example**: `http://localhost:3000/api/invoices/any-id/slip-html`
- **Response**: HTML page with mock slip data (pink theme)
- **Features**:
  - ✅ No database calls (uses mock data)
  - ✅ Always shows logo (with placeholder fallback)
  - ✅ Pink color scheme for slip recognition
  - ✅ Cache-busting headers (changes reflect immediately)

---

### 2. PDF Generation Endpoints

#### Generate PDF from Data (Server-Side)
```
POST /api/invoices/generate-pdf-from-data
```
- **Purpose**: Generate PDF using server-side Puppeteer
- **Body**:
  ```json
  {
    "data": InvoicePDFData | InvoiceSlipData,
    "type": "invoice" | "slip"
  }
  ```
- **Response**: PDF blob
- **When Used**: Online mode (automatic)
- **Quality**: High (Puppeteer/Chrome rendering)

#### Generate PDF by Invoice ID
```
GET /api/invoices/[id]/generate-pdf?type=invoice|slip
```
- **Purpose**: Generate PDF from invoice ID
- **Query Params**: `type` (invoice or slip)
- **Response**: PDF blob
- **When Used**: Direct PDF download by invoice ID

---

## License Management Endpoints

### License Seed
```
POST /api/license/seed
```
- **Purpose**: Create a new license for a MAC address
- **Body**:
  ```json
  {
    "macAddress": "XX:XX:XX:XX:XX:XX",
    "clientName": "Optional Client Name",
    "expiresInDays": 365
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "licenseKey": "LICENSE-XXXXXXXX-XXXXXXXX",
    "expiresAt": "2025-12-30T..."
  }
  ```
- **Example**: `http://localhost:3000/api/license/seed`
- **Note**: Does not require authentication (for seeding purposes)

---

## How PDF Generation Works

### Online Mode (Server-Side)
1. Client calls `generateInvoicePDF()` or `generateInvoiceSlipPDF()`
2. Function detects online status (`navigator.onLine`)
3. Makes POST request to `/api/invoices/generate-pdf-from-data`
4. Server uses Puppeteer to render HTML → PDF
5. Returns PDF blob to client

### Offline Mode (Client-Side)
1. Client calls `generateInvoicePDF()` or `generateInvoiceSlipPDF()`
2. Function detects offline status (`!navigator.onLine`)
3. Uses `jsPDF` + `html2canvas` to render HTML → PDF
4. Returns PDF blob directly (no server needed)

### Fallback Behavior
- If server-side fails → automatically falls back to client-side
- Ensures PDF generation always works, even if server is down

---

## HTML Template Files

### Shared HTML Generators (Used by Both Server & Client)

1. **`lib/utils/invoice-html-generator.ts`**
   - `generateInvoiceHTML(data: InvoicePDFData): string`
   - Used by: Server (Puppeteer) and Client (jsPDF/html2canvas)

2. **`lib/utils/invoice-slip-html-generator.ts`**
   - `generateSlipHTML(data: InvoiceSlipData): string`
   - Used by: Server (Puppeteer) and Client (jsPDF/html2canvas)

### Benefits of Shared Generators
- ✅ Single source of truth for HTML templates
- ✅ Changes reflect in both online and offline modes
- ✅ Consistent rendering across all methods

---

## Quick Reference

| Endpoint | Method | Purpose | Online Required |
|----------|--------|---------|----------------|
| `/api/invoices/[id]/html` | GET | Preview invoice HTML | ❌ No |
| `/api/invoices/[id]/slip-html` | GET | Preview slip HTML | ❌ No |
| `/api/invoices/generate-pdf-from-data` | POST | Generate PDF (server) | ✅ Yes |
| `/api/invoices/[id]/generate-pdf` | GET | Generate PDF by ID | ✅ Yes |
| `/api/license/seed` | POST | Create license | ❌ No |

---

## Testing Endpoints

### Test Invoice HTML Preview
```bash
# Open in browser
http://localhost:3000/api/invoices/test-id/html
```

### Test Slip HTML Preview
```bash
# Open in browser
http://localhost:3000/api/invoices/test-id/slip-html
```

### Test License Seed
```bash
curl -X POST http://localhost:3000/api/license/seed \
  -H "Content-Type: application/json" \
  -d '{"macAddress": "AA:BB:CC:DD:EE:FF", "expiresInDays": 365}'
```

