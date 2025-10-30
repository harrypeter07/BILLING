"use client"

import { excelSheetManager } from "@/lib/utils/excel-sync-controller"

export function getDatabaseType(): 'excel' | 'supabase' {
  if (typeof window === 'undefined') return 'excel'
  const v = window.localStorage.getItem('databaseType')
  return v === 'supabase' ? 'supabase' : 'excel'
}

export function ensureExcelModeFromSetting() {
  const type = getDatabaseType()
  if (type === 'excel' && (!excelSheetManager.isExcelModeActive || !excelSheetManager.isExcelModeActive())) {
    try { excelSheetManager.setExcelMode(true) } catch {}
  }
}

export function isExcelMode() {
  const type = getDatabaseType()
  return type === 'excel'
}


