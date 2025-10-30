export const INVOICE_STATUSES = ["draft", "sent", "paid", "cancelled"] as const

export const STOCK_STATUS = {
  IN_STOCK: "in_stock",
  LOW_STOCK: "low_stock",
  OUT_OF_STOCK: "out_of_stock",
} as const

export const GST_RATES = [0, 5, 12, 18, 28] as const

export const UNITS = ["piece", "kg", "liter", "meter", "box", "pack", "dozen"] as const

export const INVOICE_PREFIX_DEFAULT = "INV"
export const DEFAULT_DUE_DAYS = 30
export const DEFAULT_GST_RATE = 18
export const LOW_STOCK_THRESHOLD = 10

export const BUSINESS_CATEGORIES = [
  "Mobile Shop",
  "Gym",
  "Jewellery Store",
  "Hardware Shop",
  "Retail Store",
  "Restaurant",
  "Salon",
  "Clinic",
  "Other",
] as const
