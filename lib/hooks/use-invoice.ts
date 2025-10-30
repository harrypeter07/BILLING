"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface InvoiceLineItem {
  id?: string
  product_id?: string
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  gst_rate: number
  hsn_code?: string
  line_total: number
  gst_amount: number
}

export function useInvoice() {
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([])
  const [isGST, setIsGST] = useState(true)
  const supabase = createClient()

  const addLineItem = (item: InvoiceLineItem) => {
    setLineItems([...lineItems, { ...item, id: Math.random().toString() }])
  }

  const updateLineItem = (index: number, item: InvoiceLineItem) => {
    const updated = [...lineItems]
    updated[index] = item
    setLineItems(updated)
  }

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    let subtotal = 0
    let totalGST = 0

    lineItems.forEach((item) => {
      subtotal += item.line_total - item.gst_amount
      totalGST += item.gst_amount
    })

    return { subtotal, totalGST, total: subtotal + totalGST }
  }

  return {
    lineItems,
    isGST,
    setIsGST,
    addLineItem,
    updateLineItem,
    removeLineItem,
    calculateTotals,
  }
}
