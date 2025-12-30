// Common product units for dropdown
export const PRODUCT_UNITS = [
    "piece",
    "kg",
    "gram",
    "liter",
    "ml",
    "meter",
    "cm",
    "box",
    "pack",
    "dozen",
] as const;

export type ProductUnit = typeof PRODUCT_UNITS[number] | string;
