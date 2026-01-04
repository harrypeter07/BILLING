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
  pdfR2Url: string // REQUIRED: Cloudflare R2 URL for PDF (no fallback)
}

export function generateWhatsAppBillMessage(data: MiniBillData): string {
  const { storeName, invoiceNumber, invoiceDate, items, totalAmount, pdfR2Url } = data

  // Validate that pdfR2Url is provided (required)
  if (!pdfR2Url || pdfR2Url.trim() === '') {
    throw new Error('pdfR2Url is required for WhatsApp message generation')
  }

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

  // Build message - ALWAYS use R2 URL (no fallback)
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

📄 Download Invoice PDF:
${pdfR2Url}

Thank you for your business! 🙏`

  return message
}

/**
 * Share invoice on WhatsApp - CRITICAL: Must preserve user gesture even after async operations
 * 
 * ROOT CAUSE: When called after async operations (PDF generation, R2 upload), the user gesture
 * context is lost, causing window.open() to be blocked.
 * 
 * SOLUTION: Use queueMicrotask to ensure window.open() runs in the next microtask,
 * which preserves the user gesture context even after await boundaries.
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

  // CRITICAL FIX: Use queueMicrotask to preserve user gesture context
  // This ensures window.open() runs in the next microtask, which maintains
  // the user gesture chain even after async operations (await boundaries)
  return new Promise((resolve) => {
    queueMicrotask(() => {
      try {
        // Method 1: PRIMARY - window.open (most reliable)
        // queueMicrotask preserves user gesture even after async operations
        const whatsappWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
        
        // Validate immediately: window.open succeeded if win !== null && win.closed === false
        if (whatsappWindow !== null && whatsappWindow.closed === false) {
          console.log('[WhatsAppShare] window.open succeeded - WhatsApp opened')
          resolve({ success: true })
          return
        }
        
        // Method 2: FALLBACK - Create and click link (if popup was blocked)
        console.warn('[WhatsAppShare] window.open was blocked, trying link method...')
        try {
          const link = document.createElement('a')
          link.href = whatsappUrl
          link.target = '_blank'
          link.rel = 'noopener noreferrer'
          link.style.display = 'none'
          document.body.appendChild(link)
          link.click()
          console.log('[WhatsAppShare] Link clicked successfully')
          
          // Clean up after a short delay (non-blocking)
          setTimeout(() => {
            if (document.body.contains(link)) {
              document.body.removeChild(link)
            }
          }, 1000)
          
          resolve({ success: true })
        } catch (linkError) {
          console.error('[WhatsAppShare] Link method failed:', linkError)
          resolve({ success: false })
        }
      } catch (error) {
        console.error('[WhatsAppShare] Failed to open WhatsApp:', error)
        resolve({ success: false })
      }
    })
  })
}
