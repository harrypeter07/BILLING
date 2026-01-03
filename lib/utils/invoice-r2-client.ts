/**
 * Client-side utility for uploading invoice PDFs to R2
 * 
 * Optimized for speed: Uses ArrayBuffer instead of Base64 for faster transfer
 */

export interface InvoiceR2UploadResult {
  success: boolean
  objectKey?: string
  publicUrl?: string
  expiresAt?: string
  error?: string
}

/**
 * Upload PDF to R2 via API route (OPTIMIZED - uses ArrayBuffer for speed)
 * 
 * @param pdfBlob - PDF file as Blob
 * @param adminId - Admin/User ID
 * @param invoiceId - Invoice ID
 * @param invoiceNumber - Invoice number
 * @returns Upload result with public URL
 */
export async function uploadInvoicePDFToR2Client(
  pdfBlob: Blob,
  adminId: string,
  invoiceId: string,
  invoiceNumber: string
): Promise<InvoiceR2UploadResult> {
  try {
    // Use FormData for efficient binary transfer (faster than JSON with Base64)
    // Create a File object with a filename so it's properly recognized as a file upload
    const fileName = `invoice-${invoiceNumber}.pdf`
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
    
    const formData = new FormData()
    formData.append('pdfData', pdfFile)
    formData.append('adminId', adminId)
    formData.append('invoiceId', invoiceId)
    formData.append('invoiceNumber', invoiceNumber)

    // Call API route with FormData (no Content-Type header needed, browser sets it)
    // Add timeout to prevent hanging (30 seconds should be enough for most uploads)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const response = await fetch('/api/invoices/upload-r2', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = 'Unknown error'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || `Upload failed: ${response.statusText}`
        } catch (parseError) {
          errorMessage = `Upload failed: ${response.statusText} (Status: ${response.status})`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (result.success && result.publicUrl) {
        return {
          success: true,
          objectKey: result.objectKey,
          publicUrl: result.publicUrl,
          expiresAt: result.expiresAt,
        }
      } else {
        return {
          success: false,
          error: result.error || 'Upload failed',
        }
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        throw new Error('Upload timeout: The upload took too long. Please try again.')
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error('[InvoiceR2Client] Upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload PDF to R2',
    }
  }
}

