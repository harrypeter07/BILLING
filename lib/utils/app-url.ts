/**
 * Get the base URL for the application
 * Automatically detects production URL on Vercel
 */
export function getAppBaseUrl(): string {
  // Server-side: Use environment variable or Vercel's automatic URL
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || 
           (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
           'https://billing-tawny.vercel.app'
  }
  
  // Client-side: Check if we're on Vercel by hostname
  const hostname = window.location.hostname
  
  // If on Vercel domain, use production URL
  if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) {
    return `https://${hostname}`
  }
  
  // If environment variable is set, use it
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  
  // Fallback to current origin (localhost in dev)
  return window.location.origin
}
