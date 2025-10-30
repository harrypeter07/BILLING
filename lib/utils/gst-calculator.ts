// GST Calculation Utility Functions

export interface GSTCalculationInput {
  amount: number
  gstRate: number
  isSameState: boolean // true = CGST+SGST, false = IGST
  isInclusive?: boolean // true = GST included in amount, false = GST to be added
}

export interface GSTCalculationResult {
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  totalGST: number
  totalAmount: number
}

export function calculateGST({
  amount,
  gstRate,
  isSameState,
  isInclusive = false,
}: GSTCalculationInput): GSTCalculationResult {
  let taxableAmount: number
  let totalGST: number

  if (isInclusive) {
    // Amount includes GST - extract it
    taxableAmount = amount / (1 + gstRate / 100)
    totalGST = amount - taxableAmount
  } else {
    // Amount is exclusive of GST
    taxableAmount = amount
    totalGST = (amount * gstRate) / 100
  }

  let cgst = 0
  let sgst = 0
  let igst = 0

  if (isSameState) {
    // Intra-state: Split GST into CGST and SGST
    cgst = totalGST / 2
    sgst = totalGST / 2
  } else {
    // Inter-state: Use IGST
    igst = totalGST
  }

  const totalAmount = taxableAmount + totalGST

  return {
    taxableAmount: roundToTwo(taxableAmount),
    cgst: roundToTwo(cgst),
    sgst: roundToTwo(sgst),
    igst: roundToTwo(igst),
    totalGST: roundToTwo(totalGST),
    totalAmount: roundToTwo(totalAmount),
  }
}

export function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100
}

// Calculate line item totals
export interface LineItem {
  quantity: number
  unitPrice: number
  discountPercent: number
  gstRate: number
}

export interface LineItemCalculation {
  subtotal: number
  discountAmount: number
  taxableAmount: number
  gstAmount: number
  lineTotal: number
}

export function calculateLineItem(item: LineItem): LineItemCalculation {
  const subtotal = item.quantity * item.unitPrice
  const discountAmount = (subtotal * item.discountPercent) / 100
  const taxableAmount = subtotal - discountAmount
  const gstAmount = (taxableAmount * item.gstRate) / 100
  const lineTotal = taxableAmount + gstAmount

  return {
    subtotal: roundToTwo(subtotal),
    discountAmount: roundToTwo(discountAmount),
    taxableAmount: roundToTwo(taxableAmount),
    gstAmount: roundToTwo(gstAmount),
    lineTotal: roundToTwo(lineTotal),
  }
}
