"use client"

import { useEffect, useState } from 'react'
import { requestClipboardPermission, checkClipboardSupportSync } from '@/lib/utils/clipboard-pdf'

interface ClipboardPermissionState {
  isRequesting: boolean
  isGranted: boolean | null
  error: string | null
  isSupported: boolean
}

/**
 * Hook to request clipboard permission in advance
 * Call this on component mount to pre-request permission
 */
export function useClipboardPermission(autoRequest: boolean = true): ClipboardPermissionState {
  const [state, setState] = useState<ClipboardPermissionState>({
    isRequesting: false,
    isGranted: null,
    error: null,
    isSupported: checkClipboardSupportSync().supportsPDFClipboard,
  })

  useEffect(() => {
    if (!autoRequest || typeof window === 'undefined') {
      return
    }

    // Only request if clipboard is supported
    if (!state.isSupported) {
      return
    }

    // Request permission on mount
    const requestPermission = async () => {
      setState((prev) => ({ ...prev, isRequesting: true, error: null }))

      try {
        const result = await requestClipboardPermission()
        setState({
          isRequesting: false,
          isGranted: result.granted,
          error: result.error || null,
          isSupported: true,
        })

        if (result.granted) {
          console.log('[useClipboardPermission] ✅ Clipboard permission granted')
        } else {
          console.warn('[useClipboardPermission] ❌ Clipboard permission denied:', result.error)
        }
      } catch (error: any) {
        console.error('[useClipboardPermission] Error requesting permission:', error)
        setState({
          isRequesting: false,
          isGranted: false,
          error: error?.message || 'Failed to request clipboard permission',
          isSupported: true,
        })
      }
    }

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(requestPermission, 500)

    return () => clearTimeout(timeoutId)
  }, [autoRequest, state.isSupported])

  return state
}

