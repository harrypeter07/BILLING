"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { storageManager } from "@/lib/storage-manager"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Customer {
  id?: string
  name: string
  email?: string | null
  phone?: string | null
  billing_address?: string | null
  shipping_address?: string | null
  notes?: string | null
}

interface CustomerFormProps {
  customer?: Customer
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [formData, setFormData] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    billing_address: customer?.billing_address || "",
    shipping_address: customer?.shipping_address || "",
    notes: customer?.notes || "",
  })

  // Load existing customers for autocomplete
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const customers = await storageManager.getCustomers()
        setExistingCustomers(customers)
      } catch (error) {
        console.error('Failed to load customers:', error)
      }
    }
    loadCustomers()
  }, [])

  // Filter customers based on name input
  const filteredCustomers = existingCustomers.filter(c =>
    c.id !== customer?.id && // Exclude current customer when editing
    c.name.toLowerCase().includes(formData.name.toLowerCase())
  ).slice(0, 5) // Show max 5 suggestions

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone?.trim()) {
      toast({
        title: "Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const id = customer?.id || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()))
      await storageManager.updateCustomer({ id, ...formData })
      toast({ title: "Success", description: customer?.id ? "Customer updated" : "Customer created" })
      router.push(customer?.id ? `/customers/${customer.id}` : "/customers")
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save customer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Popover open={showSuggestions && filteredCustomers.length > 0} onOpenChange={setShowSuggestions}>
                <PopoverTrigger asChild>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value })
                      setShowSuggestions(true)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="e.g., John Doe"
                    autoComplete="off"
                  />
                </PopoverTrigger>
                {filteredCustomers.length > 0 && (
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandGroup heading="Existing Customers">
                        {filteredCustomers.map((c) => (
                          <CommandItem
                            key={c.id}
                            onSelect={() => {
                              setFormData({
                                name: c.name,
                                email: c.email || "",
                                phone: c.phone || "",
                                billing_address: c.billing_address || "",
                                shipping_address: c.shipping_address || "",
                                notes: c.notes || "",
                              })
                              setShowSuggestions(false)
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{c.name}</span>
                              {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                )}
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_address">Billing Address</Label>
            <Textarea
              id="billing_address"
              value={formData.billing_address}
              onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              placeholder="Street, City, State, PIN"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipping_address">Shipping Address</Label>
            <Textarea
              id="shipping_address"
              value={formData.shipping_address}
              onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
              placeholder="Street, City, State, PIN (leave blank if same as billing)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this customer..."
              rows={3}
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : customer ? "Update Customer" : "Create Customer"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
