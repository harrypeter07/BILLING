import { NextRequest, NextResponse } from 'next/server'
import { uploadInvoicePDFToR2 } from '@/lib/utils/r2-storage'

/**
 * R2 Upload API Route
 * 
 * Backend-only route for uploading invoice PDFs to Cloudflare R2.
 * 
 * Required Environment Variables:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 * - R2_PUBLIC_BASE_URL
 */

interface UploadRequest {
  pdfData: string // Base64 encoded PDF
  adminId: string
  invoiceId: string
  invoiceNumber: string
}

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json()
    const { pdfData, adminId, invoiceId, invoiceNumber } = body

    // Validate required fields
    if (!pdfData || !adminId || !invoiceId || !invoiceNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: pdfData, adminId, invoiceId, invoiceNumber',
        },
        { status: 400 }
      )
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfData, 'base64')

    // Upload to R2
    const result = await uploadInvoicePDFToR2(
      pdfBuffer,
      adminId,
      invoiceId,
      invoiceNumber
    )

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to upload PDF to R2',
        },
        { status: 500 }
      )
    }

    // Calculate expiration date (14 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14)

    return NextResponse.json({
      success: true,
      objectKey: result.objectKey,
      publicUrl: result.publicUrl,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error: any) {
    console.error('[R2Upload API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to upload PDF to R2',
      },
      { status: 500 }
    )
  }
}

