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
 * Share invoice on WhatsApp - simple version
 * 
 * Flow:
 * 1. Download PDF automatically
 * 2. Open WhatsApp with message and link
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
    return { success: false }
  }

  const encodedMessage = encodeURIComponent(message)
  const fileName = pdfFileName || 'invoice.pdf'

  // Download PDF if available
  if (pdfBlob) {
    downloadPDF(pdfBlob, fileName)
  }
  
  // Open WhatsApp directly with message (which includes the link)
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  
  return { success: true }
}
