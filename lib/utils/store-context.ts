"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from "react"
import { db, type Store } from "@/lib/dexie-client"
import { createClient } from "@/lib/supabase/client"
import { getDatabaseType } from "@/lib/utils/db-mode"

interface StoreContextType {
  currentStore: Store | null
  setCurrentStore: (store: Store | null) => void
  loading: boolean
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentStore, setCurrentStoreState] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    const loadStore = async () => {
      // Check for employee session first (employees already have store in session)
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        const employeeSession = localStorage.getItem("employeeSession")
        if (employeeSession) {
          try {
            const session = JSON.parse(employeeSession)
            const storedStoreId = session.storeId || localStorage.getItem("currentStoreId")
            if (storedStoreId) {
              if (isExcel) {
                const store = await db.stores.get(storedStoreId)
                if (store) {
                  setCurrentStoreState(store)
                  setLoading(false)
                  return
                }
              } else {
                const supabase = createClient()
                const { data } = await supabase.from("stores").select("*").eq("id", storedStoreId).single()
                if (data) {
                  setCurrentStoreState(data as any)
                  setLoading(false)
                  return
                }
              }
            }
          } catch (e) {
            // Fall through
          }
        }
      }

      // For admin users, load store from database
      if (isExcel) {
        // Excel mode - load from Dexie
        const storedStoreId = localStorage.getItem("currentStoreId")
        if (storedStoreId) {
          try {
            const store = await db.stores.get(storedStoreId)
            if (store) {
              setCurrentStoreState(store)
            }
          } catch (e) {
            // Store not found
          }
        }
        setLoading(false)
      } else {
        // Supabase mode - load from Supabase
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Try to load from localStorage first
          const storedStoreId = localStorage.getItem("currentStoreId")
          if (storedStoreId) {
            const { data } = await supabase.from("stores").select("*").eq("id", storedStoreId).eq("admin_user_id", user.id).single()
            if (data) {
              setCurrentStoreState(data as any)
              setLoading(false)
              return
            }
          }
          
          // If no store in localStorage, try to find admin's store
          const { data: stores } = await supabase.from("stores").select("*").eq("admin_user_id", user.id).limit(1)
          if (stores && stores.length > 0) {
            const store = stores[0]
            setCurrentStoreState(store as any)
            localStorage.setItem("currentStoreId", store.id)
          }
        }
        setLoading(false)
      }
    }

    loadStore()
  }, [isExcel])

  const setCurrentStore = (store: Store | null) => {
    setCurrentStoreState(store)
    if (store) {
      localStorage.setItem("currentStoreId", store.id)
    } else {
      localStorage.removeItem("currentStoreId")
    }
  }

  return React.createElement(
    StoreContext.Provider,
    { value: { currentStore, setCurrentStore, loading } },
    children
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider")
  }
  return context
}

