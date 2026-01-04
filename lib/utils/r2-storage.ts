/**
 * Cloudflare R2 Storage Utility
 * 
 * Handles uploading invoice PDFs to Cloudflare R2 and generating public URLs.
 * 
 * Object naming: invoices/{adminId}/{invoiceId}.pdf
 * Content-Type: application/pdf
 * Retention: 14 days (handled by R2 lifecycle rules)
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export interface R2UploadResult {
  success: boolean
  objectKey?: string
  publicUrl?: string
  error?: string
}

// Reuse S3 client instance for better performance (singleton pattern)
let r2ClientInstance: S3Client | null = null

/**
 * Initialize S3 client for Cloudflare R2 (singleton for performance)
 */
function getR2Client(): S3Client | null {
  // Return cached client if already initialized
  if (r2ClientInstance) {
    return r2ClientInstance
  }

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null
  }

  // Create and cache client instance with optimized settings for speed
  r2ClientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Optimize for speed - reduce timeout and add retry settings
    requestHandler: {
      requestTimeout: 15000, // 15s timeout (reduced from 30s)
    },
    // Disable request compression for faster uploads (PDFs are already compressed)
    disableRequestCompression: true,
    // Use HTTP/2 if available for better performance
    forcePathStyle: false,
  })

  return r2ClientInstance
}

/**
 * Upload PDF buffer to Cloudflare R2
 * 
 * @param pdfBuffer - PDF file as Buffer
 * @param adminId - Admin/User ID (for folder structure)
 * @param invoiceId - Invoice ID
 * @param invoiceNumber - Invoice number (for filename)
 * @returns Upload result with public URL
 */
export async function uploadInvoicePDFToR2(
  pdfBuffer: Buffer,
  adminId: string,
  invoiceId: string,
  invoiceNumber: string,
  storeId?: string
): Promise<R2UploadResult> {
  try {
    const client = getR2Client()
    if (!client) {
      return {
        success: false,
        error: 'R2 is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.',
      }
    }

    const bucketName = process.env.R2_BUCKET_NAME
    if (!bucketName) {
      return {
        success: false,
        error: 'R2_BUCKET_NAME environment variable is not set.',
      }
    }

    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL
    if (!publicBaseUrl) {
      return {
        success: false,
        error: 'R2_PUBLIC_BASE_URL environment variable is not set.',
      }
    }

    // Generate object key per requirements: includes store_id, invoice_id, and version
    // Structure: invoices/{adminId}/{storeId}/{invoiceId}-{timestamp}.pdf
    // This ensures proper isolation and includes all required fields
    let sanitizedAdminId: string
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId)) {
      sanitizedAdminId = adminId.toLowerCase()
    } else {
      sanitizedAdminId = adminId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    }
    
    // Sanitize store_id (use 'default' if not provided for backward compatibility)
    const sanitizedStoreId = storeId 
      ? storeId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
      : 'default'
    
    // Sanitize invoice_id
    const sanitizedInvoiceId = invoiceId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    
    // Include timestamp for versioning (ensures unique keys even for same invoice)
    const timestamp = Date.now()
    
    // Final object key: invoices/{adminId}/{storeId}/{invoiceId}-{timestamp}.pdf
    const objectKey = `invoices/${sanitizedAdminId}/${sanitizedStoreId}/${sanitizedInvoiceId}-${timestamp}.pdf`

    // Upload to R2 with optimized settings
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      // Cache control for faster access
      CacheControl: 'public, max-age=31536000', // 1 year cache
      // Metadata for tracking (minimal to reduce overhead)
      Metadata: {
        invoiceId: invoiceId.substring(0, 100), // Limit metadata size
        adminId: adminId.substring(0, 100),
        uploadedAt: new Date().toISOString(),
      },
    })

    // Send command (timeout is handled by requestHandler config)
    await client.send(command)

    // Generate public URL
    // Remove trailing slash from base URL if present
    const baseUrl = publicBaseUrl.replace(/\/$/, '')
    const publicUrl = `${baseUrl}/${objectKey}`

    return {
      success: true,
      objectKey,
      publicUrl,
    }
  } catch (error: any) {
    console.error('[R2Storage] Upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload PDF to R2',
    }
  }
}

/**
 * Convert Blob to Buffer (for client-side usage)
 */
export async function blobToBuffer(blob: Blob): Promise<Buffer> {
  if (typeof window === 'undefined') {
    throw new Error('blobToBuffer can only be used on the client side')
  }

  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

