"use client"

const FEATURE_FLAG_KEY = "offlineLoginEnabled"
const CREDENTIAL_KEY = "offlineLoginCredential"
const SESSION_KEY = "offlineAdminSession"
const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

interface OfflineCredential {
  email: string
  hash: string
  role?: string
  storeId?: string | null
  updatedAt: string
}

export interface OfflineSession {
  email: string
  role: string
  storeId?: string | null
  createdAt: string
  expiresAt: string
}

const hasWindow = () => typeof window !== "undefined"

async function hashSecret(secret: string) {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(secret)
    const digest = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  } catch (error) {
    console.warn("[OfflineAuth] Falling back to btoa hash:", error)
    return typeof btoa === "function" ? btoa(secret) : secret
  }
}

function safeGetItem(key: string) {
  if (!hasWindow()) return null
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    console.warn(`[OfflineAuth] Failed to read ${key}:`, error)
    return null
  }
}

function safeSetItem(key: string, value: string) {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    console.warn(`[OfflineAuth] Failed to persist ${key}:`, error)
  }
}

function safeRemoveItem(key: string) {
  if (!hasWindow()) return
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.warn(`[OfflineAuth] Failed to remove ${key}:`, error)
  }
}

export function isOfflineLoginEnabled() {
  return safeGetItem(FEATURE_FLAG_KEY) === "true"
}

export function setOfflineLoginEnabled(enabled: boolean) {
  safeSetItem(FEATURE_FLAG_KEY, enabled ? "true" : "false")
  if (!enabled) {
    safeRemoveItem(CREDENTIAL_KEY)
    safeRemoveItem(SESSION_KEY)
  }
  console.log(`[OfflineAuth] Offline login ${enabled ? "enabled" : "disabled"}`)
}

export async function persistOfflineCredential(email: string, password: string, meta?: { role?: string; storeId?: string | null }) {
  if (!isOfflineLoginEnabled()) return
  const normalizedEmail = email.toLowerCase().trim()
  const hash = await hashSecret(`${normalizedEmail}::${password}`)
  const payload: OfflineCredential = {
    email: normalizedEmail,
    hash,
    role: meta?.role,
    storeId: meta?.storeId ?? null,
    updatedAt: new Date().toISOString(),
  }
  safeSetItem(CREDENTIAL_KEY, JSON.stringify(payload))
  console.log("[OfflineAuth] Stored offline credential")
}

export function getOfflineCredential(): OfflineCredential | null {
  const raw = safeGetItem(CREDENTIAL_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OfflineCredential
  } catch {
    safeRemoveItem(CREDENTIAL_KEY)
    return null
  }
}

export function saveOfflineSession(session: { email: string; role: string; storeId?: string | null }) {
  if (!isOfflineLoginEnabled()) return
  const payload: OfflineSession = {
    email: session.email.toLowerCase(),
    role: session.role,
    storeId: session.storeId ?? null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + DEFAULT_SESSION_TTL_MS).toISOString(),
  }
  safeSetItem(SESSION_KEY, JSON.stringify(payload))
  console.log("[OfflineAuth] Offline session saved")
}

export function getOfflineSession(): OfflineSession | null {
  const raw = safeGetItem(SESSION_KEY)
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as OfflineSession
    if (new Date(payload.expiresAt).getTime() < Date.now()) {
      safeRemoveItem(SESSION_KEY)
      return null
    }
    return payload
  } catch {
    safeRemoveItem(SESSION_KEY)
    return null
  }
}

export function clearOfflineSession() {
  safeRemoveItem(SESSION_KEY)
}

export async function attemptOfflineLogin(email: string, password: string) {
  if (!isOfflineLoginEnabled()) {
    return { success: false, reason: "feature_disabled" as const }
  }
  const credential = getOfflineCredential()
  if (!credential) {
    return { success: false, reason: "missing_credential" as const }
  }
  const normalizedEmail = email.toLowerCase().trim()
  if (credential.email !== normalizedEmail) {
    return { success: false, reason: "email_mismatch" as const }
  }
  const hash = await hashSecret(`${normalizedEmail}::${password}`)
  if (credential.hash !== hash) {
    return { success: false, reason: "invalid_password" as const }
  }
  const storeId = credential.storeId ?? safeGetItem("currentStoreId")
  saveOfflineSession({
    email: normalizedEmail,
    role: credential.role || "admin",
    storeId: storeId,
  })
  if (storeId) {
    safeSetItem("currentStoreId", storeId)
  }
  return { success: true as const }
}


