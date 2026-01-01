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

📄 Invoice PDF has been downloaded. Please attach it manually.

Thank you for your business! 🙏`

  return message
}

/**
 * Open WhatsApp with pre-filled message
 */
export function shareOnWhatsApp(message: string, pdfBlob?: Blob, pdfFileName?: string): void {
  const encodedMessage = encodeURIComponent(message)
  
  // If PDF is provided, we need to handle it differently
  // WhatsApp Web API doesn't support file attachments directly
  // So we'll share the message and provide download option
  if (pdfBlob) {
    // Create download link for PDF
    const pdfUrl = URL.createObjectURL(pdfBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = pdfUrl
    downloadLink.download = pdfFileName || 'invoice.pdf'
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
  
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
  
  // Open in new window/tab
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
}

