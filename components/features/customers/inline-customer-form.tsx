"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { storageManager } from "@/lib/storage-manager"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface InlineCustomerFormProps {
  onCustomerCreated: (customer: { id: string; name: string }) => void
}

export function InlineCustomerForm({ onCustomerCreated }: InlineCustomerFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [gstin, setGstin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const isExcel = getDatabaseType() === 'excel'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Customer name is required",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    
    try {
      const customerData = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        gstin: gstin.trim() || null,
        billing_address: null,
        shipping_address: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (isExcel) {
        // Excel mode - add to Dexie
        await storageManager.addCustomer(customerData as any)
        toast({
          title: "Success",
          description: `Customer "${customerData.name}" added successfully`,
        })
        onCustomerCreated({ id: customerData.id, name: customerData.name })
      } else {
        // Supabase mode - use API
        const supabase = createClient()
        const authType = localStorage.getItem("authType")
        
        let userId: string | null = null
        
        // For employees, get admin_user_id from store
        if (authType === "employee") {
          const empSession = localStorage.getItem("employeeSession")
          if (empSession) {
            try {
              const session = JSON.parse(empSession)
              const storeId = session.storeId
              
              if (storeId) {
                // Get store to find admin_user_id
                const { data: store } = await supabase
                  .from('stores')
                  .select('admin_user_id')
                  .eq('id', storeId)
                  .single()
                
                if (store?.admin_user_id) {
                  userId = store.admin_user_id
                } else {
                  throw new Error("Store not found or invalid")
                }
              }
            } catch (e: any) {
              throw new Error("Failed to get employee store: " + (e.message || "Unknown error"))
            }
          } else {
            throw new Error("Employee session not found")
          }
        } else {
          // For admin users
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            throw new Error("Not authenticated")
          }
          userId = user.id
        }

        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            gstin: customerData.gstin,
            user_id: userId,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create customer")
        }

        const { customer } = await response.json()
        
        toast({
          title: "Success",
          description: `Customer "${customer.name}" added successfully`,
        })
        onCustomerCreated({ id: customer.id, name: customer.name })
      }

      // Reset form
      setName("")
      setEmail("")
      setPhone("")
      setGstin("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add New Customer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="quick-name" className="text-xs">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
                className="h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) {
                    e.preventDefault()
                    handleSubmit(e as any)
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-email" className="text-xs">Email</Label>
              <Input
                id="quick-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-phone" className="text-xs">Phone</Label>
              <Input
                id="quick-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-gstin" className="text-xs">GSTIN</Label>
              <Input
                id="quick-gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="29XXXXXXXXXX"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              type="button" 
              size="sm" 
              disabled={isLoading || !name.trim()}
              onClick={handleSubmit}
            >
              {isLoading ? "Adding..." : "Add Customer"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

