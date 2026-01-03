/**
 * Client-side utility for uploading invoice PDFs to R2
 * 
 * This is a thin wrapper around the API route.
 */

export interface InvoiceR2UploadResult {
  success: boolean
  objectKey?: string
  publicUrl?: string
  expiresAt?: string
  error?: string
}

/**
 * Upload PDF to R2 via API route
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
    // Convert blob to base64
    const base64 = await blobToBase64(pdfBlob)

    // Call API route
    const response = await fetch('/api/invoices/upload-r2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdfData: base64,
        adminId,
        invoiceId,
        invoiceNumber,
      }),
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

/**
 * Convert Blob to Base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1]
      resolve(base64String)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

