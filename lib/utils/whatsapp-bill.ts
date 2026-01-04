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
 * Share invoice on WhatsApp - optimized version
 * 
 * Flow:
 * 1. Open WhatsApp with message and link immediately (non-blocking)
 * 
 * Note: PDF is NOT sent directly - only the link is included in the message.
 * PDF generation and R2 upload happen in background.
 * 
 * @returns Object with success status
 */
export async function shareOnWhatsApp(
  message: string
): Promise<{ success: boolean }> {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.error('[WhatsAppShare] Cannot run on server side')
    return { success: false }
  }

  const encodedMessage = encodeURIComponent(message)
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`

  // Open WhatsApp immediately (non-blocking)
  // Use requestAnimationFrame to ensure it happens in next event loop cycle
  // This prevents page navigation from blocking the WhatsApp opening
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
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
            resolve({ success: true })
          } catch (linkError) {
            console.warn('[WhatsAppShare] Link method failed, trying location:', linkError)
            // Method 3: Fallback - store in sessionStorage and open after navigation
            // This ensures WhatsApp opens even if page redirects
            try {
              sessionStorage.setItem('pendingWhatsAppUrl', whatsappUrl)
              // Try to open immediately
              window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
              console.log('[WhatsAppShare] Stored URL and attempted open')
              resolve({ success: true })
            } catch (storageError) {
              console.error('[WhatsAppShare] All methods failed:', storageError)
              resolve({ success: false })
            }
          }
        } else {
          console.log('[WhatsAppShare] window.open succeeded')
          resolve({ success: true })
        }
      } catch (error) {
        console.error('[WhatsAppShare] Failed to open WhatsApp:', error)
        resolve({ success: false })
      }
    })
  })
}
