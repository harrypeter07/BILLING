/**
 * Get the base URL for the application
 * Uses NEXT_PUBLIC_APP_URL if set (for production/Vercel)
 * Falls back to window.location.origin for local development
 */
export function getAppBaseUrl(): string {
  // In server-side rendering, use environment variable
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
  }
  
  // In client-side, prefer environment variable, fallback to current origin
  return process.env.NEXT_PUBLIC_APP_URL || window.location.origin
}

