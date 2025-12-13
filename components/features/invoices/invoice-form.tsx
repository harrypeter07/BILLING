"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { calculateLineItem, roundToTwo } from "@/lib/utils/gst-calculator"
import { Switch } from "@/components/ui/switch"
import { storageManager } from "@/lib/storage-manager"
import { InlineCustomerForm } from "@/components/features/customers/inline-customer-form"
import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"

// Helper function to update product stock quantities after invoice creation
async function updateProductStock(
  items: Array<{ product_id: string | null; quantity: number }>,
  isIndexedDb: boolean,
  supabase?: ReturnType<typeof createClient>,
  userId?: string,
  originalProducts?: Product[]
) {
  try {
    // Group items by product_id to sum quantities
    const productQuantities = new Map<string, number>()
    
    for (const item of items) {
      if (item.product_id) {
        const currentQty = productQuantities.get(item.product_id) || 0
        productQuantities.set(item.product_id, currentQty + item.quantity)
      }
    }

    if (isIndexedDb) {
      // Update products in IndexedDB
      for (const [productId, quantityToDeduct] of productQuantities.entries()) {
        try {
          // Use original product stock if provided, otherwise fetch from DB
          let currentStock: number | undefined
          if (originalProducts) {
            const originalProduct = originalProducts.find(p => p.id === productId)
            if (originalProduct && originalProduct.stock_quantity !== undefined) {
              currentStock = originalProduct.stock_quantity
            }
          }
          
          if (currentStock === undefined) {
            const product = await db.products.get(productId)
            if (product && product.stock_quantity !== undefined) {
              currentStock = product.stock_quantity
            }
          }
          
          if (currentStock !== undefined) {
            const newStock = Math.max(0, currentStock - quantityToDeduct)
            await db.products.update(productId, {
              stock_quantity: newStock,
              updated_at: new Date().toISOString(),
            })
            console.log(`[InvoiceForm] Updated product ${productId} stock: ${currentStock} -> ${newStock}`)
          }
        } catch (error) {
          console.error(`[InvoiceForm] Error updating product ${productId} stock:`, error)
        }
      }
    } else if (supabase && userId) {
      // Update products in Supabase
      for (const [productId, quantityToDeduct] of productQuantities.entries()) {
        try {
          // Use original product stock if provided, otherwise fetch from DB
          let currentStock: number | undefined
          if (originalProducts) {
            const originalProduct = originalProducts.find(p => p.id === productId)
            if (originalProduct && originalProduct.stock_quantity !== undefined) {
              currentStock = originalProduct.stock_quantity
            }
          }
          
          if (currentStock === undefined) {
            const { data: product, error: fetchError } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', productId)
              .eq('user_id', userId)
              .single()

            if (fetchError) {
              console.error(`[InvoiceForm] Error fetching product ${productId}:`, fetchError)
              continue
            }

            if (product && product.stock_quantity !== undefined) {
              currentStock = product.stock_quantity
            }
          }

          if (currentStock !== undefined) {
            const newStock = Math.max(0, currentStock - quantityToDeduct)
            const { error: updateError } = await supabase
              .from('products')
              .update({
                stock_quantity: newStock,
                updated_at: new Date().toISOString(),
              })
              .eq('id', productId)
              .eq('user_id', userId)

            if (updateError) {
              console.error(`[InvoiceForm] Error updating product ${productId} stock:`, updateError)
            } else {
              console.log(`[InvoiceForm] Updated product ${productId} stock: ${currentStock} -> ${newStock}`)
            }
          }
        } catch (error) {
          console.error(`[InvoiceForm] Error updating product ${productId} stock:`, error)
        }
      }
    }
  } catch (error) {
    console.error('[InvoiceForm] Error updating product stock:', error)
    // Don't throw - stock update failure shouldn't prevent invoice creation
  }
}

interface Customer {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  price: number
  gst_rate: number
  hsn_code: string | null
  unit: string
  stock_quantity?: number
  sku?: string | null
  category?: string | null
}

interface BusinessSettings {
  invoice_prefix: string
  next_invoice_number: number
  default_gst_rate: number
  place_of_supply: string | null
}

interface InvoiceFormProps {
  customers: Customer[]
  products: Product[]
  settings: BusinessSettings | null
  storeId?: string | null
  employeeId?: string
  onCustomersUpdate?: (customers: Customer[]) => void
}

// LineItem interface for form state
interface LineItem {
  id: string;
  invoice_id?: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_rate: number;
  hsn_code?: string;
  line_total?: number;
  gst_amount?: number;
  created_at?: string;
}

export function InvoiceForm({ customers, products: initialProducts, settings, storeId, employeeId, onCustomersUpdate }: InvoiceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers)
  const [products, setProducts] = useState<Product[]>(initialProducts)
  
  // Merge prop customers with local additions without removing new ones
  useEffect(() => {
    setLocalCustomers((prev) => {
      const dedup = new Map<string, Customer>()
      ;[...prev, ...customers].forEach((cust) => dedup.set(cust.id, cust))
      return Array.from(dedup.values())
    })
  }, [customers])

  // Sync products when props change
  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])
  
  useEffect(() => {
    // Generate invoice number on mount if we have store/employee
    if (storeId && employeeId) {
      const isExcel = typeof window !== 'undefined' && localStorage.getItem('databaseType') !== 'supabase'
      if (isExcel) {
        import("@/lib/utils/invoice-number").then(({ generateInvoiceNumber }) => {
          generateInvoiceNumber(storeId, employeeId).then(num => setInvoiceNumber(num))
        })
      } else {
        import("@/lib/utils/invoice-number-supabase").then(({ generateInvoiceNumberSupabase }) => {
          generateInvoiceNumberSupabase(storeId, employeeId).then(num => setInvoiceNumber(num))
        })
      }
    } else {
      // Fallback to old format
      setInvoiceNumber(`${settings?.invoice_prefix || "INV"}-${String(settings?.next_invoice_number || 1).padStart(4, "0")}`)
    }
  }, [storeId, employeeId, settings])
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [isGstInvoice, setIsGstInvoice] = useState(true)
  const [isSameState, setIsSameState] = useState(true)
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("")
  const [productSearchTerm, setProductSearchTerm] = useState("")

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      product_id: null,
      description: "",
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      gst_rate: settings?.default_gst_rate || 18,
      hsn_code: "",
    },
  ])

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        product_id: null,
        description: "",
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        gst_rate: settings?.default_gst_rate || 18,
        hsn_code: "",
      },
    ])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      const itemToRemove = lineItems.find(item => item.id === id)
      // Restore stock when item is removed
      if (itemToRemove?.product_id && itemToRemove.quantity) {
        const product = products.find((p) => p.id === itemToRemove.product_id)
        if (product && product.stock_quantity !== undefined) {
          const newStock = (product.stock_quantity || 0) + itemToRemove.quantity
          setProducts(prevProducts => 
            prevProducts.map(p => 
              p.id === itemToRemove.product_id 
                ? { ...p, stock_quantity: newStock }
                : p
            )
          )
        }
      }
      setLineItems(lineItems.filter((item) => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          // If product is selected, auto-fill details
          if (field === "product_id" && value) {
            const product = products.find((p) => p.id === value)
            if (product) {
              // Decrease stock in real-time when product is added
              if (product.stock_quantity !== undefined) {
                const newStock = Math.max(0, (product.stock_quantity || 0) - (item.quantity || 1))
                setProducts(prevProducts => 
                  prevProducts.map(p => 
                    p.id === value 
                      ? { ...p, stock_quantity: newStock }
                      : p
                  )
                )
              }
              return {
                ...item,
                product_id: value,
                description: product.name,
                unit_price: product.price,
                gst_rate: product.gst_rate,
                hsn_code: product.hsn_code || "",
              }
            }
          }
          // If quantity changes and product is selected, update stock
          if (field === "quantity" && item.product_id) {
            const product = products.find((p) => p.id === item.product_id)
            if (product && product.stock_quantity !== undefined) {
              const oldQty = item.quantity || 0
              const newQty = value || 0
              const diff = oldQty - newQty // negative if increasing, positive if decreasing
              const currentStock = product.stock_quantity
              const newStock = Math.max(0, currentStock + diff)
              setProducts(prevProducts => 
                prevProducts.map(p => 
                  p.id === item.product_id 
                    ? { ...p, stock_quantity: newStock }
                    : p
                )
              )
            }
          }
          return { ...item, [field]: value }
        }
        return item
      }),
    )
  }

  // Calculate frequently bought products (products that appear most in lineItems)
  const frequentlyBoughtProducts = useMemo(() => {
    // For now, we'll show products with stock > 0 (or no stock limit), sorted by name
    // In a real app, you'd track purchase frequency from invoice_items
    return products
      .filter(p => p.stock_quantity === undefined || p.stock_quantity > 0)
      .slice(0, 8)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  const recentProducts = useMemo(() => {
    const ordered = [...lineItems]
      .map((item) => item.product_id)
      .filter((id): id is string => Boolean(id))
      .reverse()
    const uniqueIds = Array.from(new Set(ordered))
    const mapped = uniqueIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p))
    return mapped.slice(0, 8)
  }, [lineItems, products])

  const alphabeticalProducts = useMemo(
    () =>
      [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  )

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    const availableProducts = alphabeticalProducts.filter(
      (p) => p.stock_quantity === undefined || p.stock_quantity > 0,
    )
    if (!productSearchTerm) return availableProducts
    const search = productSearchTerm.toLowerCase()
    return availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.sku?.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search),
    )
  }, [alphabeticalProducts, productSearchTerm])

  // Add product to invoice
  const addProductToInvoice = (product: Product) => {
    const newLineItem: LineItem = {
      id: crypto.randomUUID(),
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: product.price,
      discount_percent: 0,
      gst_rate: product.gst_rate,
      hsn_code: product.hsn_code || "",
    }
    setLineItems([...lineItems, newLineItem])
    
    // Decrease stock in real-time when product is added
    if (product.stock_quantity !== undefined) {
      const newStock = Math.max(0, (product.stock_quantity || 0) - 1)
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === product.id 
            ? { ...p, stock_quantity: newStock }
            : p
        )
      )
    }
    
    setProductSearchTerm("")
    toast({ title: "Product added", description: `${product.name} added to invoice` })
  }

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0
    let totalGst = 0
    let cgst = 0
    let sgst = 0
    let igst = 0

    lineItems.forEach((item) => {
      // Fix: Ensure we pass the correct format to calculateLineItem
      const calc = calculateLineItem({
        unitPrice: item.unit_price,
        discountPercent: item.discount_percent,
        gstRate: item.gst_rate,
        quantity: item.quantity,
      })
      subtotal += calc.taxableAmount

      if (isGstInvoice) {
        totalGst += calc.gstAmount
        if (isSameState) {
          cgst += calc.gstAmount / 2
          sgst += calc.gstAmount / 2
        } else {
          igst += calc.gstAmount
        }
      }
    })

    const total = subtotal + totalGst

    return {
      subtotal: roundToTwo(subtotal),
      cgst: roundToTwo(cgst),
      sgst: roundToTwo(sgst),
      igst: roundToTwo(igst),
      totalGst: roundToTwo(totalGst),
      total: roundToTwo(total),
    }
  }

  const totals = calculateTotals()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const t = calculateTotals();
      const invoiceId = crypto.randomUUID();
      const invoiceData = {
        id: invoiceId,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        status: "draft",
        is_gst_invoice: isGstInvoice,
        subtotal: t.subtotal,
        cgst_amount: t.cgst,
        sgst_amount: t.sgst,
        igst_amount: t.igst,
        total_amount: t.total,
        notes: notes || undefined,
        terms: terms || undefined,
        created_at: new Date().toISOString(),
        store_id: storeId || undefined,
        employee_id: employeeId || undefined,
        created_by_employee_id: employeeId || undefined,
      };
      
      // Calculate line totals and GST for each item
      const items = lineItems.map((li) => {
        const calc = calculateLineItem({
          unitPrice: li.unit_price,
          discountPercent: li.discount_percent,
          gstRate: li.gst_rate,
          quantity: li.quantity,
        });
        return {
          id: li.id,
          invoice_id: invoiceId,
          product_id: li.product_id || null,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent,
          gst_rate: li.gst_rate,
          hsn_code: li.hsn_code || null,
          line_total: calc.taxableAmount + calc.gstAmount,
          gst_amount: calc.gstAmount,
          created_at: new Date().toISOString(),
        };
      });
      
      console.log('[InvoiceForm] Saving invoice', invoiceData, items);
      
      const isIndexedDb = isIndexedDbMode()
      if (isIndexedDb) {
        // Save to Dexie
        await storageManager.addInvoice(invoiceData, items);
        
        // Decrease product stock quantities (use original products, not modified state)
        await updateProductStock(items, isIndexedDb, undefined, undefined, initialProducts);
        
        toast({ title: "Success", description: "Invoice created successfully" });
        router.push("/invoices");
        router.refresh();
      } else {
        // Save to Supabase
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast({ title: "Error", description: "Not authenticated", variant: "destructive" })
          return
        }
        
        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({ ...invoiceData, user_id: user.id })
          .select()
          .single()
        
        if (invoiceError) throw invoiceError
        
        const itemsWithInvoiceId = items.map(item => ({
          ...item,
          invoice_id: newInvoice.id
        }))
        
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsWithInvoiceId)
        if (itemsError) throw itemsError
        
        // Decrease product stock quantities (use original products, not modified state)
        await updateProductStock(items, isIndexedDb, supabase, user.id, initialProducts);
        
        toast({ title: "Success", description: "Invoice created successfully" });
        router.push("/invoices");
        router.refresh();
      }
    } catch (error) {
      console.error('[InvoiceForm] Error saving invoice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save invoice",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="grid gap-2 xl:grid-cols-[280px_minmax(420px,1fr)_400px]">
        {/* Left column: customer + invoice meta */}
        <div className="space-y-2">
          <InlineCustomerForm
            onCustomerCreated={(newCustomer) => {
              setLocalCustomers((prev) => [newCustomer, ...prev.filter((c) => c.id !== newCustomer.id)])
              setCustomerId(newCustomer.id)
              const nextList = [newCustomer, ...localCustomers.filter((c) => c.id !== newCustomer.id)]
              onCustomersUpdate?.(nextList)
            }}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invoice_number" className="text-xs">
                    Invoice Number
                  </Label>
                  <Input
                    id="invoice_number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    required
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invoice_date" className="text-xs">
                      Date
                    </Label>
                    <Input
                      id="invoice_date"
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      required
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="due_date" className="text-xs">
                      Due
                    </Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customer" className="text-xs">
                    Customer
                  </Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {localCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <Switch id="gst_invoice" checked={isGstInvoice} onCheckedChange={setIsGstInvoice} />
                  <Label htmlFor="gst_invoice" className="text-xs">
                    GST Invoice
                  </Label>
                </div>
                {isGstInvoice && (
                  <div className="flex items-center gap-2 text-xs">
                    <Switch id="same_state" checked={isSameState} onCheckedChange={setIsSameState} />
                    <Label htmlFor="same_state" className="text-xs">
                      Same State
                    </Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="terms" className="text-xs">
                  Terms
                </Label>
                <Textarea
                  id="terms"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center column: product browser */}
        <div className="space-y-3">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Select Products</CardTitle>
              <p className="text-xs text-muted-foreground">Search or tap to add items instantly</p>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, SKU, or category"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {recentProducts.length > 0 && !productSearchTerm && (
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Recently added</span>
                    <span>{recentProducts.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {recentProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProductToInvoice(product)}
                        className="rounded-md border px-3 py-2 text-left text-xs hover:bg-primary/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <p className="font-medium truncate">{product.name}</p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>₹{product.price.toLocaleString()}</span>
                          {product.unit && <span>{product.unit}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{productSearchTerm ? "Matching products" : "All products (A-Z)"}</span>
                  <span>{filteredProducts.length} items</span>
                </div>
                <div className="max-h-[520px] overflow-y-auto pr-1">
                  {filteredProducts.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      {productSearchTerm ? "No products found" : "No products available"}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addProductToInvoice(product)}
                          className="rounded-md border px-3 py-2 text-left hover:bg-primary/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <div className="mt-1 text-[11px] text-muted-foreground space-y-1">
                            <div className="flex items-center justify-between">
                              <span>₹{product.price.toLocaleString()}</span>
                              {product.category && <span className="truncate max-w-[80px]">{product.category}</span>}
                            </div>
                            {product.stock_quantity !== undefined && (
                              <Badge
                                variant={
                                  product.stock_quantity > 10
                                    ? "default"
                                    : product.stock_quantity > 0
                                      ? "secondary"
                                      : "destructive"
                                }
                                className="text-[10px] font-normal"
                              >
                                {product.unit === 'piece' 
                                  ? `${Math.round(product.stock_quantity)} ${product.unit}`
                                  : `${Number(product.stock_quantity).toLocaleString("en-IN")} ${product.unit}`}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: line items + totals */}
        <div className="space-y-2">
          <Card className="h-full">
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-sm">Invoice Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              <div className="rounded-md border">
                <div className="max-h-[380px] overflow-y-auto">
                  <Table className="text-[11px]">
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                      <TableRow className="h-7">
                        <TableHead className="w-[140px] px-1 py-1">Product</TableHead>
                        <TableHead className="w-[60px] text-center px-1 py-1">Qty</TableHead>
                        <TableHead className="w-[70px] text-center px-1 py-1">Rate</TableHead>
                        <TableHead className="w-[55px] text-center px-1 py-1">Disc%</TableHead>
                        {isGstInvoice && <TableHead className="w-[50px] text-center px-1 py-1">GST</TableHead>}
                        <TableHead className="w-[75px] text-right px-1 py-1">Amount</TableHead>
                        <TableHead className="w-[30px] px-1 py-1"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item) => {
                        const calc = calculateLineItem({
                          unitPrice: item.unit_price,
                          discountPercent: item.discount_percent,
                          gstRate: item.gst_rate,
                          quantity: item.quantity,
                        })
                        return (
                          <TableRow key={item.id} className="h-8">
                            <TableCell className="px-1 py-1">
                              <Select
                                value={item.product_id || ""}
                                onValueChange={(value) => updateLineItem(item.id, "product_id", value)}
                              >
                                <SelectTrigger className="h-7 text-[11px] px-2">
                                  <SelectValue placeholder="Pick" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                  {products.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateLineItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)
                                }
                                required
                                className="h-8 text-xs text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) =>
                                  updateLineItem(item.id, "unit_price", Number.parseFloat(e.target.value) || 0)
                                }
                                required
                                className="h-8 text-xs text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.discount_percent}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "discount_percent",
                                    Number.parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="h-8 text-xs text-center"
                              />
                            </TableCell>
                            {isGstInvoice && (
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.gst_rate}
                                  onChange={(e) =>
                                    updateLineItem(item.id, "gst_rate", Number.parseFloat(e.target.value) || 0)
                                  }
                                  className="h-8 text-xs text-center"
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-right font-medium">
                              ₹{calc.lineTotal.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLineItem(item.id)}
                                disabled={lineItems.length === 1}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Button type="button" variant="outline" onClick={addLineItem} className="w-full bg-transparent text-xs">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add Line Item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1.5 p-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {isGstInvoice && (
                <>
                  {isSameState ? (
                    <>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>CGST</span>
                        <span>₹{totals.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>SGST</span>
                        <span>₹{totals.sgst.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>IGST</span>
                      <span>₹{totals.igst.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>₹{totals.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Invoice"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
