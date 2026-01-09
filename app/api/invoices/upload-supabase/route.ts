import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Supabase Storage Upload API Route
 * 
 * Backend-only route for uploading invoice PDFs to Supabase Storage.
 * Uses FormData for efficient binary transfer.
 * 
 * Bucket: invoice-pdfs
 * Path: {userId}/{invoiceId}/invoice-{invoiceNumber}.pdf
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse FormData
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (formDataError: any) {
      const contentType = request.headers.get('content-type') || ''
      console.error('[SupabaseUpload API] FormData parsing error:', formDataError)
      console.error('[SupabaseUpload API] Content-Type:', contentType)
      
      return NextResponse.json(
        {
          success: false,
          error: `Invalid request format. Expected multipart/form-data, got: ${contentType || 'unknown'}.`,
        },
        { status: 400 }
      )
    }

    const pdfFile = formData.get('pdfData') as File | null
    const userId = formData.get('userId') as string | null
    const invoiceId = formData.get('invoiceId') as string | null
    const invoiceNumber = formData.get('invoiceNumber') as string | null

    // Validate required fields
    if (!pdfFile || !userId || !invoiceId || !invoiceNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: pdfData, userId, invoiceId, invoiceNumber',
        },
        { status: 400 }
      )
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)

    // Create Supabase client
    const supabase = await createClient()

    // Construct storage path: {userId}/{invoiceId}/invoice-{invoiceNumber}.pdf
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const sanitizedInvoiceId = invoiceId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const sanitizedInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
    const storagePath = `${sanitizedUserId}/${sanitizedInvoiceId}/invoice-${sanitizedInvoiceNumber}.pdf`

    // Get auth user for diagnostics
    const { data: { user: authUser } } = await supabase.auth.getUser()

    // Check if bucket exists first (with error handling)
    let bucketData = null
    let bucketError = null
    try {
      const bucketResult = await supabase.storage.getBucket('invoice-pdfs')
      bucketData = bucketResult.data
      bucketError = bucketResult.error
    } catch (err: any) {
      bucketError = err
    }

    // Upload to Supabase Storage with timeout handling
    let uploadData, uploadError
    try {
      const uploadPromise = supabase.storage
        .from('invoice-pdfs')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true, // Overwrite if exists
        })

      // Add timeout (60 seconds for large files)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout: The upload took longer than 60 seconds')), 60000)
      })

      const result = await Promise.race([uploadPromise, timeoutPromise]) as any
      uploadData = result.data
      uploadError = result.error
    } catch (timeoutError: any) {
      uploadError = {
        message: timeoutError.message || 'Upload timeout',
        name: 'StorageTimeoutError',
        statusCode: 'TIMEOUT',
      }
      console.error('[SupabaseUpload API] Upload timeout:', {
        error: timeoutError,
        pdfSize: pdfBuffer.length,
        storagePath,
      })
    }

    if (uploadError) {
      // Check if it's an RLS error
      const isRLSError = uploadError.message?.toLowerCase().includes('row-level security') ||
                        uploadError.message?.toLowerCase().includes('policy') ||
                        uploadError.statusCode === '403' ||
                        uploadError.statusCode === 403;

      // Check if it's a network/fetch error
      const isNetworkError = uploadError.message?.toLowerCase().includes('fetch failed') ||
                            uploadError.name === 'StorageUnknownError' ||
                            uploadError.message?.toLowerCase().includes('timeout') ||
                            uploadError.statusCode === 'TIMEOUT';

      // Get detailed diagnostics
      let diagnostics: any = {};
      
      // Use already fetched auth user info
      diagnostics.authUid = authUser?.id || null;
      diagnostics.isAuthenticated = !!authUser;
      
      // Check bucket info
      diagnostics.bucketExists = !!bucketData;
      diagnostics.bucketPublic = bucketData?.public || false;
      diagnostics.bucketName = bucketData?.name || 'invoice-pdfs';
      diagnostics.bucketError = bucketError?.message;
      
      // Check storage path
      diagnostics.storagePath = storagePath;
      diagnostics.pathFolder = storagePath.split('/')[0]; // userId folder
      diagnostics.pathMatchesAuthUid = storagePath.split('/')[0] === (diagnostics.authUid || '');
      diagnostics.pdfSize = pdfBuffer.length;
      diagnostics.pdfSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
      
      // Network error specific diagnostics
      if (isNetworkError) {
        diagnostics.isNetworkError = true;
        diagnostics.errorType = 'Network/Timeout';
        diagnostics.suggestion = pdfBuffer.length > 5000000 
          ? 'PDF is very large (>5MB). Consider compressing or using a different storage solution.'
          : 'Check your internet connection and Supabase service status.';
      }
      
      // If bucket doesn't exist, add specific error
      if (bucketError || !bucketData) {
        diagnostics.bucketMissing = true;
        diagnostics.suggestion = 'Storage bucket "invoice-pdfs" does not exist. Please create it in Supabase Dashboard > Storage.';
      }

      const errorDetails = {
        errorCode: uploadError.statusCode || uploadError.code || 'STORAGE_ERROR',
        errorMessage: uploadError.message || 'Unknown storage error',
        errorName: uploadError.name || 'StorageError',
        isRLSError,
        isNetworkError,
        bucket: 'invoice-pdfs',
        storagePath,
        userId,
        invoiceId,
        invoiceNumber,
        pdfSize: pdfBuffer.length,
        diagnostics,
      };

      console.error('[SupabaseUpload API] Upload error with diagnostics:', errorDetails);
      
      return NextResponse.json(
        {
          success: false,
          error: uploadError.message || 'Failed to upload PDF to Supabase Storage',
          errorDetails: isRLSError ? errorDetails : undefined,
        },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('invoice-pdfs')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    const duration = Date.now() - startTime
    console.log(`[SupabaseUpload] Upload completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      path: storagePath,
      publicUrl: publicUrl,
    })
  } catch (error: any) {
    console.error('[SupabaseUpload API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to upload PDF to Supabase Storage',
      },
      { status: 500 }
    )
  }
}
