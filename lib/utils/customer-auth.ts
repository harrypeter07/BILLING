"use client"

export interface CustomerSession {
  customerId: string
  email: string
  name: string
  token: string
}

const STORAGE_KEY = "customerAuth"

export function getCustomerSession(): CustomerSession | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as CustomerSession
  } catch {
    return null
  }
}

export function setCustomerSession(session: CustomerSession | null): void {
  if (typeof window === "undefined") return
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function clearCustomerSession(): void {
  setCustomerSession(null)
}

export function isCustomerAuthenticated(): boolean {
  return getCustomerSession() !== null
}

