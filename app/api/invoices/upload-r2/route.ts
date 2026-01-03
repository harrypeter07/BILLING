import { NextRequest, NextResponse } from 'next/server'
import { uploadInvoicePDFToR2 } from '@/lib/utils/r2-storage'

/**
 * R2 Upload API Route (OPTIMIZED)
 * 
 * Backend-only route for uploading invoice PDFs to Cloudflare R2.
 * Uses FormData for efficient binary transfer (no Base64 overhead).
 * 
 * Required Environment Variables:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 * - R2_PUBLIC_BASE_URL
 */

// Disable body parsing - Next.js will handle FormData automatically
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse FormData (faster than JSON with Base64)
    // Next.js automatically handles FormData when body is FormData
    // The browser sets Content-Type: multipart/form-data with boundary automatically
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (formDataError: any) {
      // If FormData parsing fails, check if it's a Content-Type issue
      const contentType = request.headers.get('content-type') || ''
      console.error('[R2Upload API] FormData parsing error:', formDataError)
      console.error('[R2Upload API] Content-Type:', contentType)
      
      return NextResponse.json(
        {
          success: false,
          error: `Invalid request format. Expected multipart/form-data, got: ${contentType || 'unknown'}. Please ensure the request is sent as FormData.`,
        },
        { status: 400 }
      )
    }
    const pdfFile = formData.get('pdfData') as File | null
    const adminId = formData.get('adminId') as string | null
    const invoiceId = formData.get('invoiceId') as string | null
    const invoiceNumber = formData.get('invoiceNumber') as string | null

    // Validate required fields
    if (!pdfFile || !adminId || !invoiceId || !invoiceNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: pdfData, adminId, invoiceId, invoiceNumber',
        },
        { status: 400 }
      )
    }

    // Convert File to Buffer directly (no Base64 decoding needed)
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)

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

    const duration = Date.now() - startTime
    console.log(`[R2Upload] Upload completed in ${duration}ms`)

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

