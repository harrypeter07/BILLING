/**
 * Client-side utility for uploading invoice PDFs to Supabase Storage
 * 
 * Isolated from R2 flow - completely independent implementation
 */

export interface InvoiceSupabaseUploadResult {
  success: boolean
  path?: string
  publicUrl?: string
  error?: string
  errorDetails?: any
}

/**
 * Upload PDF to Supabase Storage via API route
 * 
 * @param pdfBlob - PDF file as Blob
 * @param userId - Admin/User ID
 * @param invoiceId - Invoice ID
 * @param invoiceNumber - Invoice number
 * @returns Upload result with public URL
 */
export async function uploadInvoicePDFToSupabase(
  pdfBlob: Blob,
  userId: string,
  invoiceId: string,
  invoiceNumber: string
): Promise<InvoiceSupabaseUploadResult> {
  try {
    const fileName = `invoice-${invoiceNumber}.pdf`
    
    // Create File from Blob
    let pdfFile: File | Blob = pdfBlob
    if (pdfBlob instanceof Blob && !(pdfBlob instanceof File)) {
      pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
    } else if (!(pdfBlob instanceof File)) {
      pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
    }
    
    const formData = new FormData()
    formData.append('pdfData', pdfFile, fileName)
    formData.append('userId', userId)
    formData.append('invoiceId', invoiceId)
    formData.append('invoiceNumber', invoiceNumber)

    // Call API route with FormData
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const response = await fetch('/api/invoices/upload-supabase', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = 'Unknown error'
        let errorDetails: any = null
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || `Upload failed: ${response.statusText}`
          errorDetails = errorData
        } catch (parseError) {
          errorMessage = `Upload failed: ${response.statusText} (Status: ${response.status})`
        }
        
        console.error('[InvoiceSupabaseClient] Upload failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          details: errorDetails,
        })
        
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (result.success && result.publicUrl) {
        return {
          success: true,
          path: result.path,
          publicUrl: result.publicUrl,
        }
      } else {
        // Include errorDetails if available (for RLS errors)
        const errorResult: InvoiceSupabaseUploadResult = {
          success: false,
          error: result.error || 'Upload failed',
        }
        if (result.errorDetails) {
          errorResult.errorDetails = result.errorDetails
        }
        return errorResult
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        throw new Error('Upload timeout: The upload took too long. Please try again.')
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error('[InvoiceSupabaseClient] Upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload PDF to Supabase',
    }
  }
}
