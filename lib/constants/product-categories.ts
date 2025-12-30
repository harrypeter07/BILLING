/**
 * Predefined product categories for the application
 */
export const PRODUCT_CATEGORIES = [
    "Electronics",
    "Clothing & Apparel",
    "Food & Beverages",
    "Home & Kitchen",
    "Beauty & Personal Care",
    "Sports & Fitness",
    "Books & Stationery",
    "Toys & Games",
    "Automotive",
    "Health & Wellness",
    "Furniture",
    "Groceries",
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
