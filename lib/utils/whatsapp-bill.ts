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

  // Build message
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

📱 View full invoice:
${invoiceLink}

Thank you for your business! 🙏`

  return message
}

/**
 * Share invoice on WhatsApp with PDF (if available)
 * 
 * Flow:
 * 1. Try Web Share API first (best experience - direct file sharing)
 * 2. If not available, copy PDF to clipboard and open WhatsApp
 * 3. User can paste (Ctrl+V) the PDF in WhatsApp
 * 
 * @returns Object with success status and method used
 */
export async function shareOnWhatsApp(
  message: string, 
  pdfBlob?: Blob, 
  pdfFileName?: string
): Promise<{ success: boolean; method: 'web-share' | 'clipboard-and-link' | 'download-and-link' | 'link-only'; error?: string }> {
  const encodedMessage = encodeURIComponent(message)
  const fileName = pdfFileName || 'invoice.pdf'

  // Method 1: Try Web Share API first (BEST - works on mobile/desktop with WhatsApp installed)
  // This allows sharing files directly to WhatsApp if WhatsApp is installed
  if (pdfBlob && 'share' in navigator && navigator.canShare) {
    try {
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })
      
      // Check if we can share this file
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Invoice ${fileName}`,
          text: message,
          files: [file],
        })
        
        return { success: true, method: 'web-share' }
      }
    } catch (shareError: any) {
      // User cancelled or share failed, fall through to alternative method
      if (shareError.name !== 'AbortError') {
        console.warn('[WhatsAppShare] Web Share API failed:', shareError)
      }
      // Continue to fallback method
    }
  }

  // Method 2: Copy PDF to clipboard and open WhatsApp automatically
  // This allows user to paste (Ctrl+V) the PDF directly in WhatsApp
  if (pdfBlob) {
    let clipboardSuccess = false
    
    try {
      // Try to copy PDF to clipboard using ClipboardItem API
      if ('ClipboardItem' in window && 'clipboard' in navigator && 'write' in navigator.clipboard) {
        const clipboardItem = new ClipboardItem({
          'application/pdf': pdfBlob,
        })
        await navigator.clipboard.write([clipboardItem])
        console.log('[WhatsAppShare] PDF copied to clipboard successfully')
        clipboardSuccess = true
      } else {
        throw new Error('ClipboardItem not supported')
      }
    } catch (clipboardError) {
      console.warn('[WhatsAppShare] Failed to copy PDF to clipboard:', clipboardError)
      // Fallback: Download PDF if clipboard copy fails
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const downloadLink = document.createElement('a')
      downloadLink.href = pdfUrl
      downloadLink.download = fileName
      downloadLink.style.display = 'none'
      document.body.appendChild(downloadLink)
      
      // Trigger download
      downloadLink.click()
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(pdfUrl)
      }, 100)
    }
    
    // Open WhatsApp with message (automatically redirect)
    // Small delay to ensure clipboard is ready
    setTimeout(() => {
      const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    }, clipboardSuccess ? 100 : 200)
    
    return { 
      success: true, 
      method: clipboardSuccess ? 'clipboard-and-link' : 'download-and-link'
    }
  }
  
  // No PDF - just open WhatsApp with message
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  
  return { 
    success: true, 
    method: 'link-only' 
  }
}

/**
 * Check if clipboard copy is supported
 */
export function isClipboardCopySupported(): boolean {
  return 'ClipboardItem' in window && 'clipboard' in navigator && 'write' in navigator.clipboard
}
