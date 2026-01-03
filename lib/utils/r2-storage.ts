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

  // Create and cache client instance
  r2ClientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Optimize for speed
    requestHandler: {
      requestTimeout: 30000, // 30s timeout
    },
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
  invoiceNumber: string
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

    // Generate deterministic object key: invoices/{adminId}/{invoiceId}.pdf
    // Example: invoices/admin_23/INV_2026_0042.pdf
    const sanitizedAdminId = adminId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const sanitizedInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
    const objectKey = `invoices/${sanitizedAdminId}/${sanitizedInvoiceNumber}.pdf`

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      // Metadata for tracking
      Metadata: {
        invoiceId,
        adminId,
        uploadedAt: new Date().toISOString(),
      },
    })

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

