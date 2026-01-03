/**
 * Generate WhatsApp-friendly mini bill message
 */
export interface MiniBillData {
  storeName: string
  invoiceNumber: string
  invoiceDate: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
  }>
  totalAmount: number
  invoiceLink: string
  pdfR2Url?: string // Optional Cloudflare R2 URL for PDF
}

export function generateWhatsAppBillMessage(data: MiniBillData): string {
  const { storeName, invoiceNumber, invoiceDate, items, totalAmount, invoiceLink } = data

  // Format date
  const date = new Date(invoiceDate)
  const formattedDate = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  // Build items list
  const itemsList = items
    .map((item, index) => {
      const lineTotal = item.quantity * item.unitPrice
      return `${index + 1}. ${item.name}\n   Qty: ${item.quantity} × ₹${item.unitPrice.toFixed(2)} = ₹${lineTotal.toFixed(2)}`
    })
    .join('\n\n')

  // Build message - use R2 link if available, otherwise use invoice link
  const viewLink = data.pdfR2Url || invoiceLink
  const linkLabel = data.pdfR2Url ? '📄 Download Invoice PDF' : '📱 View full invoice'

  const message = `📋 *Invoice Receipt*

🏪 *${storeName}*

━━━━━━━━━━━━━━━━━━━━
📄 Invoice #${invoiceNumber}
📅 Date: ${formattedDate}
━━━━━━━━━━━━━━━━━━━━

*Items:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💰 *Total: ₹${totalAmount.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━

${linkLabel}:
${viewLink}

Thank you for your business! 🙏`

  return message
}

/**
 * Download PDF file
 */
function downloadPDF(pdfBlob: Blob, fileName: string = 'invoice.pdf'): void {
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
    
    console.log('[WhatsAppShare] PDF downloaded:', fileName)
  } catch (error) {
    console.error('[WhatsAppShare] Failed to download PDF:', error)
  }
}

/**
 * Share invoice on WhatsApp - optimized version
 * 
 * Flow:
 * 1. Download PDF automatically (if provided)
 * 2. Open WhatsApp with message and link (reliable method)
 * 
 * @returns Object with success status
 */
export async function shareOnWhatsApp(
  message: string, 
  pdfBlob?: Blob, 
  pdfFileName?: string
): Promise<{ success: boolean }> {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.error('[WhatsAppShare] Cannot run on server side')
    return { success: false }
  }

  const encodedMessage = encodeURIComponent(message)
  const fileName = pdfFileName || 'invoice.pdf'
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`

  console.log('[WhatsAppShare] Attempting to open WhatsApp:', whatsappUrl.substring(0, 100) + '...')

  // Download PDF if available (non-blocking)
  if (pdfBlob) {
    // Use setTimeout to make it non-blocking
    setTimeout(() => {
      downloadPDF(pdfBlob, fileName)
    }, 100)
  }
  
  // Open WhatsApp using multiple methods for maximum reliability
  try {
    // Method 1: Try window.open first (most reliable for new tabs)
    console.log('[WhatsAppShare] Trying window.open...')
    const whatsappWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    
    // Check if popup was blocked
    if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed === 'undefined') {
      console.warn('[WhatsAppShare] window.open was blocked, trying link method...')
      // Method 2: Create and click a link
      try {
        const link = document.createElement('a')
        link.href = whatsappUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        console.log('[WhatsAppShare] Link clicked successfully')
        
        // Clean up after a short delay
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link)
          }
        }, 1000)
      } catch (linkError) {
        console.warn('[WhatsAppShare] Link method failed, trying location:', linkError)
        // Method 3: Fallback to window.location (will navigate current page)
        window.location.href = whatsappUrl
        console.log('[WhatsAppShare] Using window.location.href')
      }
    } else {
      console.log('[WhatsAppShare] window.open succeeded')
    }
    
    return { success: true }
  } catch (error) {
    console.error('[WhatsAppShare] Failed to open WhatsApp:', error)
    // Final fallback: try window.location
    try {
      window.location.href = whatsappUrl
      console.log('[WhatsAppShare] Using window.location.href as fallback')
      return { success: true }
    } catch (fallbackError) {
      console.error('[WhatsAppShare] All methods failed:', fallbackError)
      return { success: false }
    }
  }
}
