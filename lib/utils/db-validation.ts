/**
 * Database field validation utilities
 * Validates numeric values against database DECIMAL limits
 */

// Database field limits based on schema (DECIMAL precision)
export const DB_LIMITS = {
    // DECIMAL(10, 2) - 8 digits before decimal, 2 after
    PRODUCT_PRICE: {
        MAX: 99999999.99,
        MIN: 0,
        PRECISION: 10,
        SCALE: 2,
    },
    // DECIMAL(10, 2)
    PRODUCT_COST: {
        MAX: 99999999.99,
        MIN: 0,
        PRECISION: 10,
        SCALE: 2,
    },
    // DECIMAL(10, 2)
    ITEM_QUANTITY: {
        MAX: 99999999.99,
        MIN: 0.01,
        PRECISION: 10,
        SCALE: 2,
    },
    // DECIMAL(10, 2)
    UNIT_PRICE: {
        MAX: 99999999.99,
        MIN: 0,
        PRECISION: 10,
        SCALE: 2,
    },
    // DECIMAL(12, 2) - 10 digits before decimal, 2 after
    INVOICE_AMOUNT: {
        MAX: 9999999999.99,
        MIN: 0,
        PRECISION: 12,
        SCALE: 2,
    },
    // DECIMAL(12, 2)
    LINE_TOTAL: {
        MAX: 9999999999.99,
        MIN: 0,
        PRECISION: 12,
        SCALE: 2,
    },
    // INTEGER
    STOCK_QUANTITY: {
        MAX: 2147483647,
        MIN: 0,
        PRECISION: null,
        SCALE: 0,
    },
    // DECIMAL(5, 2) - 3 digits before decimal, 2 after
    GST_RATE: {
        MAX: 999.99,
        MIN: 0,
        PRECISION: 5,
        SCALE: 2,
    },
    // DECIMAL(5, 2)
    DISCOUNT_PERCENT: {
        MAX: 100,
        MIN: 0,
        PRECISION: 5,
        SCALE: 2,
    },
} as const;

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    formattedValue?: number;
}

/**
 * Validates a numeric value against database limits
 * @param value - The value to validate
 * @param fieldType - The type of field (key from DB_LIMITS)
 * @param fieldName - Human-readable field name for error messages
 * @returns ValidationResult with isValid flag and error message if invalid
 */
export function validateDatabaseLimit(
    value: number | string | null | undefined,
    fieldType: keyof typeof DB_LIMITS,
    fieldName: string = 'Value'
): ValidationResult {
    // Handle null/undefined
    if (value === null || value === undefined || value === '') {
        return { isValid: true, formattedValue: 0 };
    }

    // Convert to number
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Check if valid number
    if (isNaN(numValue)) {
        return {
            isValid: false,
            error: `${fieldName} must be a valid number`,
        };
    }

    const limit = DB_LIMITS[fieldType];

    // Check minimum
    if (numValue < limit.MIN) {
        return {
            isValid: false,
            error: `${fieldName} must be at least ${limit.MIN.toLocaleString('en-IN')}`,
        };
    }

    // Check maximum
    if (numValue > limit.MAX) {
        return {
            isValid: false,
            error: `${fieldName} cannot exceed ₹${limit.MAX.toLocaleString('en-IN')} (database limit)`,
        };
    }

    // Round to appropriate decimal places
    const roundedValue = limit.SCALE !== null
        ? Math.round(numValue * Math.pow(10, limit.SCALE)) / Math.pow(10, limit.SCALE)
        : Math.round(numValue);

    return {
        isValid: true,
        formattedValue: roundedValue,
    };
}

/**
 * Validates product price
 */
export function validateProductPrice(price: number | string): ValidationResult {
    return validateDatabaseLimit(price, 'PRODUCT_PRICE', 'Product price');
}

/**
 * Validates product cost price
 */
export function validateProductCost(cost: number | string): ValidationResult {
    return validateDatabaseLimit(cost, 'PRODUCT_COST', 'Cost price');
}

/**
 * Validates stock quantity
 */
export function validateStockQuantity(quantity: number | string): ValidationResult {
    return validateDatabaseLimit(quantity, 'STOCK_QUANTITY', 'Stock quantity');
}

/**
 * Validates invoice line item quantity
 */
export function validateItemQuantity(quantity: number | string): ValidationResult {
    return validateDatabaseLimit(quantity, 'ITEM_QUANTITY', 'Quantity');
}

/**
 * Validates unit price
 */
export function validateUnitPrice(price: number | string): ValidationResult {
    return validateDatabaseLimit(price, 'UNIT_PRICE', 'Unit price');
}

/**
 * Validates invoice total amount
 */
export function validateInvoiceAmount(amount: number | string): ValidationResult {
    return validateDatabaseLimit(amount, 'INVOICE_AMOUNT', 'Invoice amount');
}

/**
 * Validates line total
 */
export function validateLineTotal(total: number | string): ValidationResult {
    return validateDatabaseLimit(total, 'LINE_TOTAL', 'Line total');
}

/**
 * Validates GST rate
 */
export function validateGstRate(rate: number | string): ValidationResult {
    return validateDatabaseLimit(rate, 'GST_RATE', 'GST rate');
}

/**
 * Validates discount percentage
 */
export function validateDiscountPercent(percent: number | string): ValidationResult {
    return validateDatabaseLimit(percent, 'DISCOUNT_PERCENT', 'Discount percentage');
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format number with appropriate decimal places
 */
export function formatNumber(value: number, decimals: number = 2): string {
    return value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
