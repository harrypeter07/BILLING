# Customer Login & Email Setup Guide

## How Customer Login Currently Works

### 1. Customer Login Flow

**Step 1: Request Magic Link**
- Customer visits `/auth/customer-login`
- Enters their email address
- System finds customer by email in database
- Generates a unique token (valid for 1 hour)
- Stores token in `customer_auth` table

**Step 2: Receive Email (NEW)**
- System sends magic link to customer's email using nodemailer
- Email contains a styled HTML email with login button
- Link format: `{origin}/auth/customer-verify/{token}`

**Step 3: Verify Token**
- Customer clicks link in email (or copies it manually)
- System validates token and expiration
- Creates customer session in localStorage
- Redirects to `/purchases` page

### 2. Customer Dashboard

Once logged in, customers can:
- View their purchase history at `/purchases`
- View individual invoices
- Download PDF invoices

## Email Configuration (Nodemailer)

### Setup Steps

1. **Add Environment Variables** to `.env.local`:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

2. **For Gmail:**
   - Enable 2-Factor Authentication
   - Generate an App Password (not your regular password)
   - Use the App Password in `EMAIL_PASSWORD`

3. **For Other Providers:**
   - Update `EMAIL_HOST` and `EMAIL_PORT` as needed
   - Outlook: `smtp-mail.outlook.com:587`
   - Yahoo: `smtp.mail.yahoo.com:587`

### Email Service Behavior

- **If email is configured**: Sends HTML email with magic link
- **If email is NOT configured**: Returns magic link in API response (for development)
- **If email sending fails**: Falls back to showing link on screen

## Real-Time Customer Creation

### During Invoice Creation

1. **Open Invoice Form**: `/invoices/new`
2. **Click "Add New"** button next to Customer field
3. **Modal opens** with quick customer form
4. **Fill required fields**:
   - Name (required)
   - Email (optional, but needed for login)
   - Phone (optional)
   - GSTIN (optional)
5. **Customer is created** instantly
6. **Automatically selected** in invoice form
7. **Reflects in customer list** immediately

### Features

- ✅ Works with both Excel and Supabase modes
- ✅ Updates customer list in real-time
- ✅ No page refresh needed
- ✅ Validates required fields
- ✅ Provides user feedback

## API Endpoints

### POST `/api/email/send-magic-link`

Sends magic link email to customer.

**Request:**
```json
{
  "email": "customer@example.com",
  "magicLink": "https://yourapp.com/auth/customer-verify/token123",
  "customerName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Magic link email sent successfully"
}
```

### POST `/api/customers`

Creates a new customer (used by quick customer form).

**Request:**
```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+91 9876543210",
  "gstin": "29XXXXXXXXXX"
}
```

## Testing

1. **Test Customer Login:**
   - Go to `/auth/customer-login`
   - Enter customer email
   - Check email inbox for magic link
   - Click link to verify login

2. **Test Customer Creation:**
   - Go to `/invoices/new`
   - Click "Add New" next to Customer field
   - Fill form and submit
   - Verify customer appears in dropdown

3. **Test Email (Development):**
   - Without email config: Link shows on screen
   - With email config: Check email inbox

## Troubleshooting

### Email Not Sending

1. Check environment variables are set correctly
2. Verify email credentials (Gmail App Password for Gmail)
3. Check server logs for email errors
4. For Gmail: Make sure "Less secure app access" is enabled OR use App Password

### Customer Not Found

- Ensure customer exists in database
- Check email spelling matches exactly
- Verify customer has email address in database

### Magic Link Expired

- Tokens expire after 1 hour
- Request a new magic link
- Check system clock is correct

