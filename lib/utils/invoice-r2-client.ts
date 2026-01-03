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
    // Convert blob to ArrayBuffer (faster than Base64, no encoding overhead)
    const arrayBuffer = await pdfBlob.arrayBuffer()
    
    // Convert ArrayBuffer to Uint8Array for efficient transfer
    const uint8Array = new Uint8Array(arrayBuffer)

    // Use FormData for efficient binary transfer (faster than JSON with Base64)
    const formData = new FormData()
    formData.append('pdfData', new Blob([uint8Array], { type: 'application/pdf' }))
    formData.append('adminId', adminId)
    formData.append('invoiceId', invoiceId)
    formData.append('invoiceNumber', invoiceNumber)

    // Call API route with FormData (no Content-Type header needed, browser sets it)
    const response = await fetch('/api/invoices/upload-r2', {
      method: 'POST',
      body: formData,
    })

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
  } catch (error: any) {
    console.error('[InvoiceR2Client] Upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload PDF to R2',
    }
  }
}

