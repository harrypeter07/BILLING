export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateGSTIN(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  return gstinRegex.test(gstin)
}

export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^[0-9]{10}$/
  return phoneRegex.test(phone.replace(/\D/g, ""))
}

export function validateProductForm(data: any): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!data.name || data.name.trim() === "") {
    errors.name = "Product name is required"
  }

  if (!data.price || Number.parseFloat(data.price) <= 0) {
    errors.price = "Price must be greater than 0"
  }

  if (data.stock_quantity < 0) {
    errors.stock_quantity = "Stock quantity cannot be negative"
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

export function validateInvoiceForm(data: any): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!data.customer_id) {
    errors.customer_id = "Customer is required"
  }

  if (!data.items || data.items.length === 0) {
    errors.items = "At least one line item is required"
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
