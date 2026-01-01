"use client"

import { db } from "@/lib/db/dexie"
import type { AuthSession } from "@/lib/db/dexie"

// Get session duration from env (default: 24 hours)
const SESSION_DURATION_MS = 
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_DURATION_MS
    ? parseInt(process.env.NEXT_PUBLIC_SESSION_DURATION_MS, 10)
    : 86400000 // 24 hours default

const SESSION_ID = "current_session"

/**
 * Save authentication session to IndexedDB
 */
export async function saveAuthSession(data: {
  userId: string
  email: string
  role: string
  storeId?: string | null
}): Promise<void> {
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION_MS

  const session: AuthSession = {
    id: SESSION_ID,
    userId: data.userId,
    email: data.email.toLowerCase(),
    role: data.role,
    storeId: data.storeId ?? null,
    issuedAt: now,
    expiresAt,
    createdAt: new Date().toISOString(),
  }

  await db.auth_session.put(session)
  console.log("[AuthSession] Session saved to IndexedDB, expires at:", new Date(expiresAt).toISOString())
}

/**
 * Get current authentication session from IndexedDB
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const session = await db.auth_session.get(SESSION_ID)
    if (!session) {
      return null
    }

    // Check if session is expired
    const now = Date.now()
    if (now > session.expiresAt) {
      console.log("[AuthSession] Session expired, clearing...")
      await clearAuthSession()
      return null
    }

    return session
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
 * Check if session is expired (without fetching from DB)
 */
export function isSessionExpired(session: AuthSession | null): boolean {
  if (!session) return true
  return Date.now() > session.expiresAt
}

