"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { isIndexedDbMode } from "@/lib/utils/db-mode"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getB2BModeStatus } from "@/lib/utils/b2b-mode"

interface InlineCustomerFormProps {
  onCustomerCreated?: (customer: { id: string; name: string }) => void
  onCustomerDataChange?: (data: { 
    name: string
    phone: string
    email: string
    gstin?: string
    billing_address?: string
    city?: string
    state?: string
    pincode?: string
    isNewCustomer: boolean 
  }) => void
  invoiceNumber?: string
  invoiceDate?: string
  dueDate?: string
  onInvoiceNumberChange?: (value: string) => void
  onInvoiceDateChange?: (value: string) => void
  onDueDateChange?: (value: string) => void
}

interface CustomerMatch {
  id: string
  name: string
  phone: string | null
  email: string | null
}

export function InlineCustomerForm({ onCustomerCreated, onCustomerDataChange }: InlineCustomerFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [gstin, setGstin] = useState("")
  const [billingAddress, setBillingAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [pincode, setPincode] = useState("")
  const [isB2BEnabled, setIsB2BEnabled] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<CustomerMatch[]>([])
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false)
  const [nameMatches, setNameMatches] = useState<CustomerMatch[]>([])
  const [showNameDropdown, setShowNameDropdown] = useState(false)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Load B2B mode status
  useEffect(() => {
    const loadB2BStatus = async () => {
      try {
        const b2bEnabled = await getB2BModeStatus()
        setIsB2BEnabled(b2bEnabled)
      } catch (error) {
        console.error('Failed to load B2B status:', error)
      }
    }
    loadB2BStatus()
  }, [])

  // Listen for customer selection from main dropdown
  useEffect(() => {
    const handleCustomerSelected = (event: CustomEvent) => {
      const customer = event.detail
      if (customer) {
        setName(customer.name || "")
        setEmail(customer.email || "")
        setPhone(customer.phone || "")
        // Also call onCustomerCreated to ensure customer is selected
        onCustomerCreated?.({ id: customer.id, name: customer.name })
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
  const handleSelectCustomer = async (customer: CustomerMatch) => {
    // Auto-fill all form fields with customer data
    setName(customer.name)
    setPhone(customer.phone || "")
    setEmail(customer.email || "")
    
    // Fetch full customer data to get B2B fields
    try {
      const isIndexedDb = isIndexedDbMode()
      if (isIndexedDb) {
        const fullCustomer = await db.customers.get(customer.id)
        if (fullCustomer) {
          setGstin(fullCustomer.gstin || "")
          setBillingAddress(fullCustomer.billing_address || "")
          setCity(fullCustomer.city || "")
          setState(fullCustomer.state || "")
          setPincode(fullCustomer.pincode || "")
        }
      } else {
        const supabase = createClient()
        const { data: fullCustomer } = await supabase
          .from('customers')
          .select('gstin, billing_address, city, state, pincode')
          .eq('id', customer.id)
          .single()
        if (fullCustomer) {
          setGstin(fullCustomer.gstin || "")
          setBillingAddress(fullCustomer.billing_address || "")
          setCity(fullCustomer.city || "")
          setState(fullCustomer.state || "")
          setPincode(fullCustomer.pincode || "")
        }
      }
    } catch (error) {
      console.error('Error fetching full customer data:', error)
    }
    
    setPhoneMatches([])
    setShowPhoneDropdown(false)
    setNameMatches([])
    setShowNameDropdown(false)
    // Auto-select this customer in the invoice form
    onCustomerCreated?.({ id: customer.id, name: customer.name })
    toast({
      title: "Customer selected",
      description: `Customer details filled: ${customer.name}`,
    })
  }

  // Notify parent component about customer data changes
  const prevCustomerDataRef = useRef({ 
    name: "", 
    phone: "", 
    email: "", 
    gstin: "",
    billing_address: "",
    city: "",
    state: "",
    pincode: "",
    isNewCustomer: false 
  })
  
  useEffect(() => {
    const hasValidName = name.trim().length > 0
    const hasValidPhone = phone.trim().length === 10
    const isNewCustomer = hasValidName && hasValidPhone && 
                        !nameMatches.some(match => match.name.toLowerCase() === name.trim().toLowerCase()) &&
                        !phoneMatches.some(match => match.phone === phone.trim())
    
    const currentCustomerData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gstin: gstin.trim(),
      billing_address: billingAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isNewCustomer
    }
    
    // Only notify if data actually changed
    const prevData = prevCustomerDataRef.current
    if (JSON.stringify(prevData) !== JSON.stringify(currentCustomerData)) {
      onCustomerDataChange?.(currentCustomerData)
      prevCustomerDataRef.current = currentCustomerData
    }
  }, [name, phone, email, gstin, billingAddress, city, state, pincode, nameMatches, phoneMatches, onCustomerDataChange])

  return (
    <Card className="border-dashed ">
      <CardHeader className="pb-0.5 pt-0 px-4">
        <CardTitle className="text-sm">Customer & Invoice Details</CardTitle>
      </CardHeader>
      <CardContent className="p-2 mt-[-2vh] space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-0.5 relative">
            <Label htmlFor="quick-name" className="text-xs">
              Customer Name <span className="text-destructive">*</span>
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
                placeholder="Type to search customers..."
                className="h-8 text-xs"
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
          <div className="space-y-0.5 relative">
            <Label htmlFor="quick-phone" className="text-xs">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                ref={phoneInputRef}
                id="quick-phone"
                type="tel"
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
                className="h-8 text-xs"
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
          <div className="space-y-0.5">
            <Label htmlFor="quick-email" className="text-xs">Email</Label>
            <Input
              id="quick-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address (optional)"
              className="h-8 text-xs"
            />
          </div>
        </div>
        
        {/* B2B Fields - Show when B2B mode is enabled */}
        {isB2BEnabled && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label htmlFor="quick-gstin" className="text-xs">
                  GSTIN <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quick-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="15-digit GSTIN"
                  maxLength={15}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="quick-pincode" className="text-xs">Pincode</Label>
                <Input
                  id="quick-pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit pincode"
                  maxLength={6}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="quick-billing-address" className="text-xs">
                Billing Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-billing-address"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Street address"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label htmlFor="quick-city" className="text-xs">City</Label>
                <Input
                  id="quick-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="quick-state" className="text-xs">State</Label>
                <Input
                  id="quick-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

