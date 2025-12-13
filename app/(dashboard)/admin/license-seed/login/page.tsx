"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Key, Loader2 } from "lucide-react"

// Simple key for license seed admin access
const LICENSE_SEED_ADMIN_KEY = "1234" // You can change this to any 3-4 digit key

export default function LicenseSeedLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [key, setKey] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if already authenticated
  useEffect(() => {
    const isAuthenticated = localStorage.getItem("licenseSeedAdminAuth") === "true"
    if (isAuthenticated) {
      router.push("/admin/license-seed")
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // Simple key validation
    if (key.trim() === LICENSE_SEED_ADMIN_KEY) {
      // Store authentication in localStorage
      localStorage.setItem("licenseSeedAdminAuth", "true")
      toast({
        title: "Success",
        description: "Access granted",
      })
      router.push("/admin/license-seed")
    } else {
      setError("Invalid access key")
      toast({
        title: "Error",
        description: "Invalid access key",
        variant: "destructive",
      })
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">License Seed Admin</CardTitle>
          <CardDescription>
            Enter your access key to manage license seeding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key">Access Key</Label>
              <PasswordInput
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter 3-4 digit key"
                maxLength={4}
                required
                autoFocus
                className="text-center text-2xl tracking-widest"
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter your admin access key
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Access License Seed"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

