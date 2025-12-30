/**
 * Format large numbers with abbreviations (K, L, CR)
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string with abbreviation
 */
export function formatLargeNumber(value: number, decimals: number = 1): string {
    if (value === 0) return "0";

    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    // Crore (10,000,000)
    if (absValue >= 10000000) {
        return `${sign}${(absValue / 10000000).toFixed(decimals)}CR`;
    }

    // Lakh (100,000)
    if (absValue >= 100000) {
        return `${sign}${(absValue / 100000).toFixed(decimals)}L`;
    }

    // Thousand (1,000)
    if (absValue >= 1000) {
        return `${sign}${(absValue / 1000).toFixed(decimals)}K`;
    }

    return value.toString();
}

/**
 * Get the full number formatted with Indian locale
 * @param value - The number to format
 * @returns Formatted string with commas
 */
export function formatFullNumber(value: number): string {
    return value.toLocaleString("en-IN");
}
