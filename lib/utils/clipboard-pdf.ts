/**
 * Comprehensive clipboard PDF copy utility with proper feature detection
 * and debugging support
 */

interface ClipboardSupportInfo {
  isSecureContext: boolean
  hasNavigatorClipboard: boolean
  hasClipboardWrite: boolean
  hasClipboardItem: boolean
  browserName: string
  userAgent: string
  supportsPDFClipboard: boolean
}

/**
 * Detect browser name from user agent
 */
function detectBrowser(): string {
  if (typeof window === 'undefined') return 'Unknown (SSR)'
  
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
  if (ua.includes('edg')) return 'Edge'
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera'
  return 'Unknown'
}

/**
 * Check clipboard support comprehensively
 */
export function checkClipboardSupport(): ClipboardSupportInfo {
  // Only run on client side
  if (typeof window === 'undefined') {
    return {
      isSecureContext: false,
      hasNavigatorClipboard: false,
      hasClipboardWrite: false,
      hasClipboardItem: false,
      browserName: 'Unknown (SSR)',
      userAgent: 'N/A',
      supportsPDFClipboard: false,
    }
  }

  const isSecureContext = window.isSecureContext || false
  const hasNavigatorClipboard = 'clipboard' in navigator
  const hasClipboardWrite = hasNavigatorClipboard && 'write' in navigator.clipboard
  const hasClipboardItem = 'ClipboardItem' in window
  const browserName = detectBrowser()
  const userAgent = navigator.userAgent

  // PDF clipboard support requires:
  // 1. Secure context (HTTPS or localhost)
  // 2. navigator.clipboard.write exists
  // 3. ClipboardItem constructor exists
  const supportsPDFClipboard =
    isSecureContext &&
    hasNavigatorClipboard &&
    hasClipboardWrite &&
    hasClipboardItem

  return {
    isSecureContext,
    hasNavigatorClipboard,
    hasClipboardWrite,
    hasClipboardItem,
    browserName,
    userAgent,
    supportsPDFClipboard,
  }
}

/**
 * Log clipboard support information for debugging
 */
export function logClipboardSupport(): ClipboardSupportInfo {
  const support = checkClipboardSupport()
  
  console.group('[ClipboardPDF] Feature Detection')
  console.log('Browser:', support.browserName)
  console.log('User Agent:', support.userAgent)
  console.log('Secure Context:', support.isSecureContext ? '✅' : '❌')
  console.log('navigator.clipboard exists:', support.hasNavigatorClipboard ? '✅' : '❌')
  console.log('navigator.clipboard.write exists:', support.hasClipboardWrite ? '✅' : '❌')
  console.log('ClipboardItem exists:', support.hasClipboardItem ? '✅' : '❌')
  console.log('PDF Clipboard Supported:', support.supportsPDFClipboard ? '✅' : '❌')
  console.groupEnd()

  return support
}

/**
 * Ensure PDF blob has correct MIME type
 */
function ensurePDFBlob(blob: Blob): Blob {
  // If blob already has correct type, return as-is
  if (blob.type === 'application/pdf') {
    return blob
  }

  // Create new blob with explicit MIME type
  return new Blob([blob], { type: 'application/pdf' })
}

/**
 * Copy PDF to clipboard with comprehensive error handling and debugging
 * 
 * @param pdfBlob - The PDF blob to copy (will be normalized to application/pdf)
 * @returns Promise resolving to success status and error message if failed
 */
export async function copyPDFToClipboard(
  pdfBlob: Blob
): Promise<{ success: boolean; error?: string; errorDetails?: any }> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: 'Clipboard operations can only run on the client side',
    }
  }

  // Log support information
  const support = logClipboardSupport()

  // Check if clipboard is supported
  if (!support.supportsPDFClipboard) {
    const reasons: string[] = []
    if (!support.isSecureContext) reasons.push('not in secure context (HTTPS/localhost required)')
    if (!support.hasNavigatorClipboard) reasons.push('navigator.clipboard not available')
    if (!support.hasClipboardWrite) reasons.push('navigator.clipboard.write not available')
    if (!support.hasClipboardItem) reasons.push('ClipboardItem not available')

    const errorMsg = `PDF clipboard copy not supported: ${reasons.join(', ')}`
    console.warn('[ClipboardPDF]', errorMsg)
    
    return {
      success: false,
      error: errorMsg,
    }
  }

  try {
    // Ensure PDF blob has correct MIME type
    const normalizedBlob = ensurePDFBlob(pdfBlob)
    
    console.log('[ClipboardPDF] Attempting to copy PDF to clipboard...')
    console.log('[ClipboardPDF] Blob size:', normalizedBlob.size, 'bytes')
    console.log('[ClipboardPDF] Blob type:', normalizedBlob.type)

    // Request clipboard permission (if needed)
    // Note: Most browsers don't require explicit permission for clipboard.write
    // but we'll handle permission errors gracefully
    
    // Create ClipboardItem with PDF blob
    const clipboardItem = new ClipboardItem({
      'application/pdf': normalizedBlob,
    })

    // Write to clipboard
    await navigator.clipboard.write([clipboardItem])

    console.log('[ClipboardPDF] ✅ PDF copied to clipboard successfully!')
    
    return {
      success: true,
    }
  } catch (error: any) {
    // Log detailed error information
    console.error('[ClipboardPDF] ❌ Failed to copy PDF to clipboard')
    console.error('[ClipboardPDF] Error name:', error?.name)
    console.error('[ClipboardPDF] Error message:', error?.message)
    console.error('[ClipboardPDF] Error stack:', error?.stack)
    console.error('[ClipboardPDF] Full error:', error)

    // Provide user-friendly error messages
    let errorMessage = 'Failed to copy PDF to clipboard'
    
    if (error?.name === 'NotAllowedError') {
      errorMessage = 'Clipboard permission denied. Please allow clipboard access and try again.'
    } else if (error?.name === 'SecurityError') {
      errorMessage = 'Clipboard access blocked for security reasons. Please use HTTPS or localhost.'
    } else if (error?.name === 'DataError') {
      errorMessage = 'Invalid PDF data. Please try generating the PDF again.'
    } else if (error?.message) {
      errorMessage = `Clipboard error: ${error.message}`
    }

    return {
      success: false,
      error: errorMessage,
      errorDetails: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
    }
  }
}

/**
 * Download PDF as fallback when clipboard copy fails
 */
export function downloadPDF(pdfBlob: Blob, fileName: string = 'invoice.pdf'): void {
  if (typeof window === 'undefined') return

  try {
    const pdfUrl = URL.createObjectURL(pdfBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = pdfUrl
    downloadLink.download = fileName
    downloadLink.style.display = 'none'
    document.body.appendChild(downloadLink)
    
    downloadLink.click()
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(downloadLink)
      URL.revokeObjectURL(pdfUrl)
    }, 100)
    
    console.log('[ClipboardPDF] PDF downloaded as fallback:', fileName)
  } catch (error) {
    console.error('[ClipboardPDF] Failed to download PDF:', error)
  }
}

