/**
 * Comprehensive clipboard PDF copy utility with proper feature detection
 * and debugging support
 */

interface ClipboardSupportInfo {
  isSecureContext: boolean
  hasNavigatorClipboard: boolean
  hasClipboardWrite: boolean
  hasClipboardItem: boolean
  hasPermissionsAPI: boolean
  browserName: string
  userAgent: string
  supportsPDFClipboard: boolean
  permissionStatus?: PermissionState
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
 * Check clipboard permission status using Permissions API
 */
async function checkClipboardPermission(): Promise<PermissionState | undefined> {
  if (typeof window === 'undefined' || !('permissions' in navigator)) {
    return undefined
  }

  try {
    // Query clipboard-write permission
    const result = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName })
    return result.state
  } catch (error) {
    // Some browsers don't support clipboard-write permission query
    // This is okay - clipboard.write usually works without explicit permission in secure contexts
    console.log('[ClipboardPDF] Permissions API query not supported or failed:', error)
    return undefined
  }
}

/**
 * Check clipboard support comprehensively
 */
export async function checkClipboardSupport(): Promise<ClipboardSupportInfo> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return {
      isSecureContext: false,
      hasNavigatorClipboard: false,
      hasClipboardWrite: false,
      hasClipboardItem: false,
      hasPermissionsAPI: false,
      browserName: 'Unknown (SSR)',
      userAgent: 'N/A',
      supportsPDFClipboard: false,
    }
  }

  const isSecureContext = window.isSecureContext || false
  const hasNavigatorClipboard = 'clipboard' in navigator
  const hasClipboardWrite = hasNavigatorClipboard && 'write' in navigator.clipboard
  const hasClipboardItem = 'ClipboardItem' in window
  const hasPermissionsAPI = 'permissions' in navigator
  const browserName = detectBrowser()
  const userAgent = navigator.userAgent

  // Check permission status
  const permissionStatus = await checkClipboardPermission()

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
    hasPermissionsAPI,
    browserName,
    userAgent,
    supportsPDFClipboard,
    permissionStatus,
  }
}

/**
 * Synchronous version for quick checks (without permission status)
 */
export function checkClipboardSupportSync(): Omit<ClipboardSupportInfo, 'permissionStatus'> {
  if (typeof window === 'undefined') {
    return {
      isSecureContext: false,
      hasNavigatorClipboard: false,
      hasClipboardWrite: false,
      hasClipboardItem: false,
      hasPermissionsAPI: false,
      browserName: 'Unknown (SSR)',
      userAgent: 'N/A',
      supportsPDFClipboard: false,
    }
  }

  const isSecureContext = window.isSecureContext || false
  const hasNavigatorClipboard = 'clipboard' in navigator
  const hasClipboardWrite = hasNavigatorClipboard && 'write' in navigator.clipboard
  const hasClipboardItem = 'ClipboardItem' in window
  const hasPermissionsAPI = 'permissions' in navigator
  const browserName = detectBrowser()
  const userAgent = navigator.userAgent

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
    hasPermissionsAPI,
    browserName,
    userAgent,
    supportsPDFClipboard,
  }
}

/**
 * Request clipboard permission in advance
 * This function attempts to request permission before actual clipboard operations
 */
export async function requestClipboardPermission(): Promise<{ granted: boolean; error?: string }> {
  if (typeof window === 'undefined') {
    return { granted: false, error: 'Client-side only operation' }
  }

  try {
    // Check if Permissions API is available
    if (!('permissions' in navigator)) {
      // Permissions API not available - clipboard.write usually works without explicit permission
      console.log('[ClipboardPDF] Permissions API not available, but clipboard.write may still work')
      return { granted: true } // Assume granted if we can't check
    }

    // Query current permission status
    const result = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName })
    
    console.log('[ClipboardPDF] Clipboard permission status:', result.state)
    
    if (result.state === 'granted') {
      return { granted: true }
    } else if (result.state === 'prompt') {
      // Permission is prompt - we'll request it when user clicks
      // Note: clipboard.write() itself will trigger the permission prompt
      return { granted: true } // We'll get the prompt on actual write
    } else if (result.state === 'denied') {
      return { granted: false, error: 'Clipboard permission denied. Please enable it in browser settings.' }
    }

    return { granted: true }
  } catch (error: any) {
    // Some browsers don't support clipboard-write permission query
    // This is okay - clipboard.write usually works without explicit permission
    console.log('[ClipboardPDF] Permission check failed (may still work):', error?.message)
    return { granted: true } // Assume granted if we can't check
  }
}

/**
 * Log clipboard support information for debugging
 */
export async function logClipboardSupport(): Promise<ClipboardSupportInfo> {
  const support = await checkClipboardSupport()
  
  console.group('[ClipboardPDF] Feature Detection')
  console.log('Browser:', support.browserName)
  console.log('User Agent:', support.userAgent)
  console.log('Secure Context:', support.isSecureContext ? '✅' : '❌')
  console.log('navigator.clipboard exists:', support.hasNavigatorClipboard ? '✅' : '❌')
  console.log('navigator.clipboard.write exists:', support.hasClipboardWrite ? '✅' : '❌')
  console.log('ClipboardItem exists:', support.hasClipboardItem ? '✅' : '❌')
  console.log('Permissions API available:', support.hasPermissionsAPI ? '✅' : '❌')
  if (support.permissionStatus) {
    console.log('Permission Status:', support.permissionStatus)
  } else {
    console.log('Permission Status: Not available or not queryable')
  }
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
  const support = await logClipboardSupport()

  // Request permission in advance
  const permissionResult = await requestClipboardPermission()
  if (!permissionResult.granted) {
    console.warn('[ClipboardPDF] Permission not granted:', permissionResult.error)
    return {
      success: false,
      error: permissionResult.error || 'Clipboard permission not granted',
    }
  }

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

