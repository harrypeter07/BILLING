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

import { copyPDFToClipboard, downloadPDF, checkClipboardSupportSync } from './clipboard-pdf'

/**
 * Share invoice on WhatsApp with PDF (if available)
 * 
 * Flow:
 * 1. Copy PDF to clipboard (if available)
 * 2. Open WhatsApp directly with message and link
 * 3. User can paste (Ctrl+V) the PDF in WhatsApp
 * 
 * @returns Object with success status and method used
 */
export async function shareOnWhatsApp(
  message: string, 
  pdfBlob?: Blob, 
  pdfFileName?: string
): Promise<{ success: boolean; method: 'web-share' | 'clipboard-and-link' | 'download-and-link' | 'link-only'; error?: string }> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return {
      success: false,
      method: 'link-only',
      error: 'Share functionality requires client-side execution',
    }
  }

  const encodedMessage = encodeURIComponent(message)
  const fileName = pdfFileName || 'invoice.pdf'

  // Method 1: Try Web Share API first (BEST - works on mobile/desktop with WhatsApp installed)
  if (pdfBlob && 'share' in navigator && navigator.canShare) {
    try {
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Invoice ${fileName}`,
          text: message,
          files: [file],
        })
        console.log('[WhatsAppShare] Shared via Web Share API')
        return { success: true, method: 'web-share' }
      }
    } catch (shareError: any) {
      if (shareError.name !== 'AbortError') {
        console.warn('[WhatsAppShare] Web Share API failed:', shareError)
      }
      // Continue to clipboard method
    }
  }

  // Method 2: Copy PDF to clipboard and open WhatsApp
  if (pdfBlob) {
    const clipboardResult = await copyPDFToClipboard(pdfBlob)
    
    if (!clipboardResult.success) {
      // Fallback: Download PDF if clipboard copy fails
      downloadPDF(pdfBlob, fileName)
    }
    
    // Open WhatsApp directly with message (which includes the link)
    // Small delay to ensure clipboard is ready
    setTimeout(() => {
      const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    }, clipboardResult.success ? 100 : 200)
    
    return { 
      success: true, 
      method: clipboardResult.success ? 'clipboard-and-link' : 'download-and-link',
      error: clipboardResult.error,
    }
  }
  
  // No PDF - just open WhatsApp directly with message and link
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  
  return { 
    success: true, 
    method: 'link-only' 
  }
}

/**
 * Check if clipboard copy is supported (with comprehensive detection)
 */
export function isClipboardCopySupported(): boolean {
  const support = checkClipboardSupportSync()
  return support.supportsPDFClipboard
}
