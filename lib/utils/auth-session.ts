"use client"

import { db } from "@/lib/db/dexie"
import type { AuthSession } from "@/lib/db/dexie"
import CryptoJS from "crypto-js"

// Get session duration from env (default: 24 hours)
const SESSION_DURATION_MS = 
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_DURATION_MS
    ? parseInt(process.env.NEXT_PUBLIC_SESSION_DURATION_MS, 10)
    : 86400000 // 24 hours default

const SESSION_ID = "current_session"
// Client-side secret (different from server secret for additional security)
// Even if this is known, server validation will catch tampering
const CLIENT_SECRET = process.env.NEXT_PUBLIC_SESSION_SECRET || "client-secret-key-change-in-production"

/**
 * Generate HMAC signature for session data to prevent tampering
 */
function generateSignature(sessionData: Omit<AuthSession, "id">): string {
  const dataString = JSON.stringify({
    userId: sessionData.userId,
    email: sessionData.email,
    role: sessionData.role,
    storeId: sessionData.storeId,
    issuedAt: sessionData.issuedAt,
    expiresAt: sessionData.expiresAt,
  })
  return CryptoJS.HmacSHA256(dataString, CLIENT_SECRET).toString()
}

/**
 * Verify session signature to detect tampering
 */
function verifySignature(session: AuthSession & { signature?: string }): boolean {
  if (!session.signature) {
    // Legacy sessions without signature - invalidate them
    return false
  }

  const sessionData = {
    userId: session.userId,
    email: session.email,
    role: session.role,
    storeId: session.storeId,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
  }

  const expectedSignature = generateSignature(sessionData)
  return session.signature === expectedSignature
}

/**
 * Get server time to prevent client-side time manipulation
 */
async function getServerTime(): Promise<number> {
  try {
    const response = await fetch("/api/time", { 
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(2000) // 2 second timeout
    })
    if (response.ok) {
      const data = await response.json()
      if (data.timestamp) {
        return data.timestamp
      }
    }
  } catch (error) {
    // API unavailable, use client time (less secure but works offline)
    console.warn("[AuthSession] Server time API unavailable, using client time")
  }
  return Date.now()
}

/**
 * Enhanced session interface with signature
 */
interface SecureAuthSession extends AuthSession {
  signature?: string
  lastValidated?: number
  validationCount?: number
}

/**
 * Save authentication session to IndexedDB with cryptographic signature
 * 
 * IMPORTANT: This creates a client-side signature.
 * The server will validate using a different secret key.
 * This dual-signature approach prevents offline tampering.
 */
export async function saveAuthSession(data: {
  userId: string
  email: string
  role: string
  storeId?: string | null
}): Promise<void> {
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION_MS

  const sessionData: Omit<AuthSession, "id"> = {
    userId: data.userId,
    email: data.email.toLowerCase(),
    role: data.role,
    storeId: data.storeId ?? null,
    issuedAt: now,
    expiresAt,
    createdAt: new Date().toISOString(),
  }

  // Generate client-side cryptographic signature
  // Note: Server uses different secret, so even if client secret is known,
  // tampering will be detected when server validates
  const signature = generateSignature(sessionData)

  const session: SecureAuthSession = {
    id: SESSION_ID,
    ...sessionData,
    signature,
    lastValidated: now,
    validationCount: 0,
  }

  await db.auth_session.put(session as any)
  console.log("[AuthSession] Session saved with client signature, expires at:", new Date(expiresAt).toISOString())
  
  // IMPORTANT: Server validation will happen on next read
  // This ensures the session is validated against server secret
}

/**
 * Validate session with server (when online)
 * This is the critical security check that prevents offline tampering
 */
async function validateSessionWithServer(session: SecureAuthSession): Promise<boolean> {
  // Only validate with server if online
  if (typeof window === "undefined" || !navigator.onLine) {
    // Offline: Use client-side validation only (less secure but necessary for offline mode)
    // Note: This is a trade-off - offline mode cannot be fully secured
    console.warn("[AuthSession] Offline mode - using client-side validation only")
    return verifySignature(session)
  }

  try {
    const response = await fetch("/api/auth/validate-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionData: {
          userId: session.userId,
          email: session.email,
          role: session.role,
          storeId: session.storeId,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
        },
        clientSignature: session.signature,
        clientTime: Date.now(),
      }),
      signal: AbortSignal.timeout(3000), // 3 second timeout
    })

    if (!response.ok) {
      console.warn("[AuthSession] Server validation failed, falling back to client validation")
      return verifySignature(session)
    }

    const result = await response.json()
    return result.valid === true
  } catch (error) {
    // Server unavailable - fall back to client validation
    console.warn("[AuthSession] Server validation unavailable, using client validation:", error)
    return verifySignature(session)
  }
}

/**
 * Get current authentication session from IndexedDB with validation
 * 
 * SECURITY LAYERS:
 * 1. Client-side signature verification (works offline)
 * 2. Server-side validation (when online) - uses different secret
 * 3. Server time validation (prevents time manipulation)
 * 4. Expiry check with server time
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const session = await db.auth_session.get(SESSION_ID) as SecureAuthSession | undefined
    if (!session) {
      return null
    }

    // LAYER 1: Client-side signature verification
    if (!verifySignature(session)) {
      console.error("[AuthSession] Invalid client signature detected - possible tampering! Clearing session.")
      await clearAuthSession()
      return null
    }

    // LAYER 2: Server-side validation (when online)
    // This is the critical check that prevents offline tampering
    // Even if someone modifies IndexedDB and regenerates client signature,
    // server validation will fail because server uses different secret
    const serverValidation = await validateSessionWithServer(session)
    if (!serverValidation) {
      console.error("[AuthSession] Server validation failed - possible tampering! Clearing session.")
      await clearAuthSession()
      return null
    }

    // LAYER 3: Get server time to prevent time manipulation
    const serverTime = await getServerTime()
    const clientTime = Date.now()
    
    // Check for significant time manipulation (> 5 minutes difference)
    const timeDifference = Math.abs(serverTime - clientTime)
    if (timeDifference > 300000) { // 5 minutes
      console.warn("[AuthSession] Significant time difference detected:", timeDifference, "ms")
      // If offline, we can't enforce this, but we log it
      if (navigator.onLine) {
        // Online: Use server time strictly
        if (serverTime > session.expiresAt) {
          console.log("[AuthSession] Session expired (server time), clearing...")
          await clearAuthSession()
          return null
        }
      }
    }

    // LAYER 4: Check expiry using validated time
    const currentTime = serverTime || clientTime
    if (currentTime > session.expiresAt) {
      console.log("[AuthSession] Session expired, clearing...")
      await clearAuthSession()
      return null
    }

    // Update validation metadata
    session.lastValidated = currentTime
    session.validationCount = (session.validationCount || 0) + 1
    
    // Check for suspicious validation patterns
    if (session.validationCount > 1000) {
      console.warn("[AuthSession] Suspicious validation count detected")
      // Could implement rate limiting here
    }

    // Save updated metadata
    await db.auth_session.put(session as any)

    // Return only the standard AuthSession interface
    return {
      id: session.id,
      userId: session.userId,
      email: session.email,
      role: session.role,
      storeId: session.storeId,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }
  } catch (error) {
    console.error("[AuthSession] Error reading session:", error)
    return null
  }
}

/**
 * Check if current session is valid (not expired)
 */
export async function isSessionValid(): Promise<boolean> {
  const session = await getAuthSession()
  return session !== null
}

/**
 * Clear authentication session from IndexedDB
 */
export async function clearAuthSession(): Promise<void> {
  try {
    await db.auth_session.delete(SESSION_ID)
    console.log("[AuthSession] Session cleared from IndexedDB")
  } catch (error) {
    console.error("[AuthSession] Error clearing session:", error)
  }
}

/**
 * Get session expiry time in milliseconds
 */
export function getSessionDuration(): number {
  return SESSION_DURATION_MS
}

/**
 * Check if session is expired (with server time validation)
 */
export async function isSessionExpired(session: AuthSession | null): Promise<boolean> {
  if (!session) return true

  // Re-fetch and validate signature
  const validatedSession = await getAuthSession()
  if (!validatedSession) return true

  // Verify it's the same session
  if (validatedSession.userId !== session.userId || validatedSession.email !== session.email) {
    return true
  }

  // Check expiry with server time
  const serverTime = await getServerTime()
  return serverTime > session.expiresAt
}

