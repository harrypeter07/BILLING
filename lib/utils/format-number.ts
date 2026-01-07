/**
 * Number formatting utilities for Indian numbering system
 * Uses 'k' for thousands and 'cr' for crores
 */

/**
 * Formats a number with Indian numbering system (k for thousands, cr for crores)
 * @param value - The number to format
 * @param options - Formatting options
 * @returns Formatted string (e.g., "1.2k", "5.5cr")
 */
export function formatNumber(value: number | null | undefined, options?: {
  showDecimals?: boolean
  decimals?: number
  showCurrency?: boolean
  currencySymbol?: string
}): string {
  if (value === null || value === undefined || isNaN(value)) {
    return options?.showCurrency ? (options.currencySymbol || '₹') + '0' : '0'
  }

  const num = Number(value)
  const showDecimals = options?.showDecimals ?? true
  const decimals = options?.decimals ?? 1
  const showCurrency = options?.showCurrency ?? false
  const currencySymbol = options?.currencySymbol || '₹'

  // Handle negative numbers
  const isNegative = num < 0
  const absNum = Math.abs(num)

  let formatted: string

  // Crores (1,00,00,000 = 1 crore)
  if (absNum >= 10000000) {
    const crores = absNum / 10000000
    formatted = showDecimals 
      ? crores.toFixed(decimals) + 'cr'
      : Math.round(crores) + 'cr'
  }
  // Lakhs (1,00,000 = 1 lakh) - convert to crores if > 100 lakhs
  else if (absNum >= 100000) {
    const crores = absNum / 10000000
    if (crores >= 1) {
      formatted = showDecimals 
        ? crores.toFixed(decimals) + 'cr'
        : Math.round(crores) + 'cr'
    } else {
      const lakhs = absNum / 100000
      formatted = showDecimals 
        ? lakhs.toFixed(decimals) + 'L'
        : Math.round(lakhs) + 'L'
    }
  }
  // Thousands
  else if (absNum >= 1000) {
    const thousands = absNum / 1000
    formatted = showDecimals 
      ? thousands.toFixed(decimals) + 'k'
      : Math.round(thousands) + 'k'
  }
  // Less than 1000 - show as is
  else {
    formatted = showDecimals 
      ? absNum.toFixed(decimals)
      : Math.round(absNum).toString()
  }

  // Add currency symbol if needed
  if (showCurrency) {
    formatted = currencySymbol + formatted
  }

  // Add negative sign if needed
  if (isNegative) {
    formatted = '-' + formatted
  }

  return formatted
}

/**
 * Formats a currency value with Indian numbering system
 * @param value - The amount to format
 * @param options - Formatting options
 * @returns Formatted string with currency symbol (e.g., "₹1.2k", "₹5.5cr")
 */
export function formatCurrency(value: number | null | undefined, options?: {
  showDecimals?: boolean
  decimals?: number
  currencySymbol?: string
}): string {
  return formatNumber(value, {
    ...options,
    showCurrency: true,
    currencySymbol: options?.currencySymbol || '₹'
  })
}

/**
 * Formats a number for chart Y-axis labels
 * @param value - The number to format
 * @returns Formatted string for chart labels
 */
export function formatChartLabel(value: number): string {
  return formatNumber(value, {
    showDecimals: true,
    decimals: 1,
    showCurrency: false
  })
}

/**
 * Formats a currency value for chart tooltips
 * @param value - The amount to format
 * @returns Formatted string with currency symbol for tooltips
 */
export function formatChartTooltip(value: number): string {
  return formatCurrency(value, {
    showDecimals: true,
    decimals: 2
  })
}

