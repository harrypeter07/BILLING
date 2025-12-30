"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { storageManager } from "@/lib/storage-manager"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface InlineCustomerFormProps {
  onCustomerCreated: (customer: { id: string; name: string }) => void
}

interface CustomerMatch {
  id: string
  name: string
  phone: string | null
  email: string | null
}

export function InlineCustomerForm({ onCustomerCreated }: InlineCustomerFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<CustomerMatch[]>([])
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false)
  const [nameMatches, setNameMatches] = useState<CustomerMatch[]>([])
  const [showNameDropdown, setShowNameDropdown] = useState(false)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Listen for customer selection from main dropdown
  useEffect(() => {
    const handleCustomerSelected = (event: CustomEvent) => {
      const customer = event.detail
      if (customer) {
        setName(customer.name || "")
        setEmail(customer.email || "")
        setPhone(customer.phone || "")
        // Also call onCustomerCreated to ensure customer is selected
        onCustomerCreated({ id: customer.id, name: customer.name })
      }
    }

    window.addEventListener('customer:selected', handleCustomerSelected as EventListener)
    return () => {
      window.removeEventListener('customer:selected', handleCustomerSelected as EventListener)
    }
  }, [onCustomerCreated])

  // Search customers by phone number - search from first digit
  const searchCustomersByPhone = async (phoneNumber: string) => {
    // Remove any non-digit characters for searching
    const cleanPhone = phoneNumber.replace(/\D/g, '')

    if (!cleanPhone || cleanPhone.length === 0) {
      setPhoneMatches([])
      setShowPhoneDropdown(false)
      return
    }

    try {
      const isIndexedDb = isIndexedDbMode()
      let matches: CustomerMatch[] = []

      if (isIndexedDb) {
        // Search in IndexedDB
        const allCustomers = await db.customers.toArray()
        matches = allCustomers
          .filter(c => {
            if (!c.phone) return false
            // Remove non-digits from stored phone for comparison
            const storedPhone = c.phone.replace(/\D/g, '')
            return storedPhone.includes(cleanPhone)
          })
          .map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
          }))
          .slice(0, 5) // Limit to 5 results
      } else {
        // Search in Supabase
        const supabase = createClient()
        const authType = localStorage.getItem("authType")
        let userId: string | null = null

        if (authType === "employee") {
          const empSession = localStorage.getItem("employeeSession")
          if (empSession) {
            const session = JSON.parse(empSession)
            const storeId = session.storeId
            if (storeId) {
              const { data: store } = await supabase
                .from('stores')
                .select('admin_user_id')
                .eq('id', storeId)
                .single()
              if (store?.admin_user_id) {
                userId = store.admin_user_id
              }
            }
          }
        } else {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) userId = user.id
        }

        if (userId) {
          const { data } = await supabase
            .from('customers')
            .select('id, name, phone, email')
            .eq('user_id', userId)
            .ilike('phone', `%${cleanPhone}%`)
            .limit(5)

          if (data) {
            matches = data.map(c => ({
              id: c.id,
              name: c.name,
              phone: c.phone || null,
              email: c.email || null,
            }))
          }
        }
      }

      setPhoneMatches(matches)
      setShowPhoneDropdown(matches.length > 0 && cleanPhone.length > 0)
    } catch (error) {
      console.error('Error searching customers:', error)
      setPhoneMatches([])
      setShowPhoneDropdown(false)
    }
  }

  // Handle phone number change - only allow digits and max 10 characters
  const handlePhoneChange = (value: string) => {
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '')
    // Limit to 10 digits
    const limitedValue = digitsOnly.slice(0, 10)
    setPhone(limitedValue)
    // Search immediately as user types
    searchCustomersByPhone(limitedValue)
  }

  // Search customers by name
  const searchCustomersByName = async (customerName: string) => {
    const cleanName = customerName.trim()

    if (!cleanName || cleanName.length < 2) {
      setNameMatches([])
      setShowNameDropdown(false)
      return
    }

    try {
      const isIndexedDb = isIndexedDbMode()
      let matches: CustomerMatch[] = []

      if (isIndexedDb) {
        // Search in IndexedDB
        const allCustomers = await db.customers.toArray()
        matches = allCustomers
          .filter(c => {
            if (!c.name) return false
            return c.name.toLowerCase().includes(cleanName.toLowerCase())
          })
          .map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
          }))
          .slice(0, 5) // Limit to 5 results
      } else {
        // Search in Supabase
        const supabase = createClient()
        const authType = localStorage.getItem("authType")
        let userId: string | null = null

        if (authType === "employee") {
          const empSession = localStorage.getItem("employeeSession")
          if (empSession) {
            const session = JSON.parse(empSession)
            const storeId = session.storeId
            if (storeId) {
              const { data: store } = await supabase
                .from('stores')
                .select('admin_user_id')
                .eq('id', storeId)
                .single()
              if (store?.admin_user_id) {
                userId = store.admin_user_id
              }
            }
          }
        } else {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) userId = user.id
        }

        if (userId) {
          const { data } = await supabase
            .from('customers')
            .select('id, name, phone, email')
            .eq('user_id', userId)
            .ilike('name', `%${cleanName}%`)
            .limit(5)

          if (data) {
            matches = data.map(c => ({
              id: c.id,
              name: c.name,
              phone: c.phone || null,
              email: c.email || null,
            }))
          }
        }
      }

      setNameMatches(matches)
      setShowNameDropdown(matches.length > 0 && cleanName.length >= 2)
    } catch (error) {
      console.error('Error searching customers by name:', error)
      setNameMatches([])
      setShowNameDropdown(false)
    }
  }

  // Handle name change - search on every keystroke
  const handleNameChange = (value: string) => {
    setName(value)
    // Search immediately as user types (after 2 characters)
    if (value.trim().length >= 2) {
      searchCustomersByName(value)
    } else {
      setNameMatches([])
      setShowNameDropdown(false)
    }
  }

  // Handle customer selection from dropdown
  const handleSelectCustomer = (customer: CustomerMatch) => {
    // Auto-fill all form fields with customer data
    setName(customer.name)
    setPhone(customer.phone || "")
    setEmail(customer.email || "")
    setPhoneMatches([])
    setShowPhoneDropdown(false)
    setNameMatches([])
    setShowNameDropdown(false)
    // Auto-select this customer in the invoice form
    onCustomerCreated({ id: customer.id, name: customer.name })
    toast({
      title: "Customer selected",
      description: `Customer details filled: ${customer.name}`,
    })
  }

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

    if (!phone.trim()) {
      toast({
        title: "Error",
        description: "Phone number is required",
        variant: "destructive",
      })
      return
    }

    // Validate phone number - exactly 10 digits
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be exactly 10 digits",
        variant: "destructive",
      })
      return
    }

    // Validate email format if provided
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address",
          variant: "destructive",
        })
        return
      }
    }

    // Check for duplicate email if email is provided
    if (email.trim()) {
      try {
        const isIndexedDb = isIndexedDbMode()
        let existingCustomer = null

        if (isIndexedDb) {
          // Check in IndexedDB
          const allCustomers = await db.customers.toArray()
          existingCustomer = allCustomers.find(
            c => c.email && c.email.toLowerCase() === email.trim().toLowerCase()
          )
        } else {
          // Check in Supabase
          const supabase = createClient()
          const authType = localStorage.getItem("authType")
          let userId: string | null = null

          if (authType === "employee") {
            const empSession = localStorage.getItem("employeeSession")
            if (empSession) {
              const session = JSON.parse(empSession)
              const storeId = session.storeId
              if (storeId) {
                const { data: store } = await supabase
                  .from('stores')
                  .select('admin_user_id')
                  .eq('id', storeId)
                  .single()
                if (store?.admin_user_id) {
                  userId = store.admin_user_id
                }
              }
            }
          } else {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) userId = user.id
          }

          if (userId) {
            const { data } = await supabase
              .from('customers')
              .select('id, name, email')
              .eq('user_id', userId)
              .ilike('email', email.trim())
              .limit(1)

            if (data && data.length > 0) {
              existingCustomer = data[0]
            }
          }
        }

        if (existingCustomer) {
          toast({
            title: "Duplicate Customer",
            description: `A customer with email "${email.trim()}" already exists: ${existingCustomer.name}`,
            variant: "destructive",
          })
          return
        }
      } catch (error) {
        console.error('Error checking for duplicate email:', error)
        // Continue with creation even if check fails
      }
    }

    setIsLoading(true)
    setShowPhoneDropdown(false)

    try {
      const customerData = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        billing_address: null,
        shipping_address: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const isIndexedDb = isIndexedDbMode()
      if (isIndexedDb) {
        // IndexedDB mode - add to Dexie
        await storageManager.addCustomer(customerData as any)
        toast({
          title: "Success",
          description: `Customer "${customerData.name}" added successfully`,
        })
        onCustomerCreated({ id: customerData.id, name: customerData.name })
        // Dispatch event to notify customer list to refresh
        window.dispatchEvent(new CustomEvent('customer:created'))
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
        // Dispatch event to notify customer list to refresh
        window.dispatchEvent(new CustomEvent('customer:created'))
      }

      // Reset form
      setName("")
      setEmail("")
      setPhone("")
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
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Add New Customer</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="space-y-1.5 relative">
              <Label htmlFor="quick-name" className="text-xs">
                Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  ref={nameInputRef}
                  id="quick-name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => {
                    // Show dropdown if there are matches when focusing
                    if (nameMatches.length > 0 && name.trim().length >= 2) {
                      setShowNameDropdown(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setShowNameDropdown(false), 200)
                  }}
                  placeholder="Customer name"
                  className="h-9 text-sm w-full"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) {
                      e.preventDefault()
                      handleSubmit(e as any)
                    }
                  }}
                />
                {showNameDropdown && nameMatches.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                    {nameMatches.map((customer) => (
                      <div
                        key={customer.id}
                        onMouseDown={(e) => {
                          // Use onMouseDown to prevent blur from firing first
                          e.preventDefault()
                          handleSelectCustomer(customer)
                        }}
                        className="px-3 py-2 cursor-pointer hover:bg-accent border-b last:border-b-0 transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{customer.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {customer.phone} {customer.email && `• ${customer.email}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5 relative">
              <Label htmlFor="quick-phone" className="text-xs">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  ref={phoneInputRef}
                  id="quick-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onFocus={() => {
                    // Show dropdown if there are matches when focusing
                    if (phoneMatches.length > 0 && phone.trim().length > 0) {
                      setShowPhoneDropdown(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setShowPhoneDropdown(false), 200)
                  }}
                  placeholder="9876543210 (10 digits)"
                  maxLength={10}
                  className="h-9 text-sm w-full"
                />
                {showPhoneDropdown && phoneMatches.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                    {phoneMatches.map((customer) => (
                      <div
                        key={customer.id}
                        onMouseDown={(e) => {
                          // Use onMouseDown to prevent blur from firing first
                          e.preventDefault()
                          handleSelectCustomer(customer)
                        }}
                        className="px-3 py-2 cursor-pointer hover:bg-accent border-b last:border-b-0 transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{customer.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {customer.phone} {customer.email && `• ${customer.email}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-email" className="text-xs">Email</Label>
              <Input
                id="quick-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="h-8 text-sm w-full"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              disabled={isLoading || !name.trim() || !phone.trim()}
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

