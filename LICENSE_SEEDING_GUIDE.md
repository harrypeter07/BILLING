# License Seeding Guide

This guide explains how to seed licenses for devices using the web-based interface or command-line script.

## Web-Based License Seeding (Recommended)

### Access
1. Log in as an admin user
2. Navigate to **Admin → License Seed** in the sidebar (or go to `/admin/license-seed`)
3. Enter the MAC address of the device
4. Optionally specify:
   - Client Name (defaults to "Default Client")
   - Expiration Days (defaults to 365 days)
5. Click "Generate License"
6. Copy the generated license key

### Features
- ✅ Automatic license key generation
- ✅ MAC address formatting (auto-adds colons)
- ✅ Real-time validation
- ✅ Copy-to-clipboard for license key
- ✅ Admin-only access (protected route)

## Command-Line License Seeding

### Usage
```bash
npm run seed:license -- <LICENSE_KEY> <MAC_ADDRESS> "<CLIENT_NAME>" [expiresInDays]
```

### Example
```bash
npm run seed:license -- LICENSE-D6EA5E55EF27 D6:EA:5E:55:EF:27 "My Client" 730
```

## Firebase Admin Credentials Setup

### For Local Development

**Option 1: Place JSON file** (easiest)
- Place your Firebase service account JSON file at `app/firebase/*.json`
- The system will automatically detect it
- ⚠️ This file is gitignored for security

**Option 2: Environment variable**
```bash
GOOGLE_APPLICATION_CREDENTIALS=./app/firebase/your-service-account.json
```

### For Production (Vercel, etc.)

**Step-by-Step: Adding Firebase Credentials to Vercel**

1. **Run the helper script** to convert your JSON file:
   ```bash
   node scripts/prepare-firebase-env.js app/firebase/billingsolution-firebase-adminsdk-*.json
   ```
   (Or if your JSON is already at `app/firebase/*.json`, just run: `node scripts/prepare-firebase-env.js`)

2. **Copy the base64 string** from "OPTION 2: Base64 Encoded" output
   - It will look like: `eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6...`

3. **Go to Vercel Dashboard**:
   - Navigate to your project → **Settings** → **Environment Variables**

4. **Add the environment variable**:
   - Click **Add New**
   - **Key**: `FIREBASE_ADMIN_CREDENTIALS`
   - **Value**: Paste the base64 string (the entire long string from Option 2)
   - **Environment**: Select all three ✅ Production ✅ Preview ✅ Development
   - Click **Save**

5. **Redeploy your app**:
   - Go to **Deployments** tab
   - Click **Redeploy** on the latest deployment
   - Or push a new commit to trigger deployment

**Important Notes:**
- ✅ Use **Option 2 (Base64 Encoded)** for Vercel - it's the most reliable format
- ✅ Don't add quotes around the base64 string in Vercel
- ✅ Make sure to select all environments (Production, Preview, Development)
- ✅ The API route will automatically detect and decode the base64 credentials

**Alternative Options:**
- **Option 1 (JSON String)**: Can work but may have issues with special characters
- **Option 3**: Only works for Google Cloud Run deployments

## API Endpoint

### POST `/api/license/seed`

**Authentication**: Admin only (Supabase auth required)

**Request Body**:
```json
{
  "macAddress": "D6:EA:5E:55:EF:27",
  "clientName": "My Client",  // optional
  "expiresInDays": 365        // optional, defaults to 365
}
```

**Response**:
```json
{
  "success": true,
  "message": "License created successfully",
  "license": {
    "licenseKey": "LICENSE-D6EA5E55EF27-ABC12345",
    "macAddress": "D6:EA:5E:55:EF:27",
    "clientName": "My Client",
    "expiresInDays": 365,
    "status": "active",
    "documentId": "firestore-doc-id"
  }
}
```

## License Key Format

Generated license keys follow this format:
```
LICENSE-<MAC_PREFIX>-<UUID_SUFFIX>
```

Example: `LICENSE-D6EA5E55EF27-ABC12345`

## MAC Address Format

- Accepts formats: `XX:XX:XX:XX:XX:XX` or `XXXXXXXXXXXX`
- Automatically formats to `XX:XX:XX:XX:XX:XX` for storage
- Case-insensitive (converted to uppercase)

## Troubleshooting

### "Firebase Admin credentials not found"
- Ensure `FIREBASE_ADMIN_CREDENTIALS` is set in production
- Or place JSON file at `app/firebase/*.json` for local development
- Run `node scripts/prepare-firebase-env.js` to generate env var format

### "Unauthorized" error
- Ensure you're logged in as an admin user
- Check that your Supabase session is valid

### "Invalid MAC address format"
- MAC address must be 12 hexadecimal characters
- Can include colons or be without separators
- Example: `D6:EA:5E:55:EF:27` or `D6EA5E55EF27`

## Security Notes

- ⚠️ Firebase service account JSON files are gitignored
- ⚠️ Never commit credentials to version control
- ⚠️ Use environment variables for production deployments
- ✅ License seeding requires admin authentication
- ✅ All API routes validate user permissions

