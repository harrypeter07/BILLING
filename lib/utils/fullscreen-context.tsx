"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

interface FullscreenContextType {
  isFullscreen: boolean
  setIsFullscreen: (value: boolean) => void
  toggleFullscreen: () => void
}

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined)

export function FullscreenProvider({ children }: { children: React.ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev)
  }

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isFullscreen])

  return (
    <FullscreenContext.Provider value={{ isFullscreen, setIsFullscreen, toggleFullscreen }}>
      {children}
    </FullscreenContext.Provider>
  )
}

export function useFullscreen() {
  const context = useContext(FullscreenContext)
  if (context === undefined) {
    throw new Error("useFullscreen must be used within a FullscreenProvider")
  }
  return context
}

