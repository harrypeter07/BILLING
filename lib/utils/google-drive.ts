/**
 * Google Drive API utility
 * Handles uploading PDFs to Google Drive and getting shareable links
 */

export interface GoogleDriveUploadResult {
  success: boolean
  fileId?: string
  shareableLink?: string
  error?: string
}

/**
 * Upload PDF to Google Drive via API route
 * @param pdfBlob - The PDF file as a Blob
 * @param fileName - Name for the file in Google Drive
 * @returns Upload result with shareable link
 */
export async function uploadPDFToGoogleDrive(
  pdfBlob: Blob,
  fileName: string
): Promise<GoogleDriveUploadResult> {
  try {
    // Convert blob to base64 for API transmission
    const base64 = await blobToBase64(pdfBlob)
    
    // Call our API route to handle the upload
    const response = await fetch('/api/google-drive/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileData: base64,
        mimeType: 'application/pdf',
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `Upload failed: ${response.statusText}`)
    }

    const result = await response.json()
    
    if (result.success && result.shareableLink) {
      return {
        success: true,
        fileId: result.fileId,
        shareableLink: result.shareableLink,
      }
    } else {
      return {
        success: false,
        error: result.error || 'Upload failed',
      }
    }
  } catch (error: any) {
    console.error('[GoogleDrive] Upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload to Google Drive',
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

