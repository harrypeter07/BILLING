"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, AlertCircle, Copy, Loader2, LogOut } from "lucide-react"

interface LicenseResponse {
  success: boolean
  message: string
  license: {
    licenseKey: string
    macAddress: string
    clientName: string
    expiresInDays: number
    status: string
    documentId: string
  }
}

export default function LicenseSeedPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [macAddress, setMacAddress] = useState("")
  const [clientName, setClientName] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("365")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<LicenseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Check for license seed admin authentication
  useEffect(() => {
    const isAuthenticated = localStorage.getItem("licenseSeedAdminAuth") === "true"
    if (!isAuthenticated) {
      router.push("/admin/license-seed/login")
      return
    }
    setIsCheckingAuth(false)
  }, [router])

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("licenseSeedAdminAuth")
    router.push("/admin/license-seed/login")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    setIsSubmitting(true)

    try {
      let response: Response
      try {
        response = await fetch("/api/license/seed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            macAddress: macAddress.trim(),
            clientName: clientName.trim() || undefined,
            expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
          }),
        })
      } catch (fetchError: any) {
        // Network error - fetch failed completely
        console.error("[License Seed] Network error:", fetchError)
        const networkError = "Network error: Unable to connect to the server. Please check your internet connection and try again."
        setError(networkError)
        toast({
          title: "Network Error",
          description: networkError,
          variant: "destructive",
        })
        return
      }

      // Check if response is ok before trying to parse JSON
      let data: any
      try {
        data = await response.json()
      } catch (jsonError) {
        // Response is not valid JSON
        const text = await response.text()
        console.error("[License Seed] Invalid JSON response:", text)
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`)
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Server error: ${response.status} ${response.statusText}`)
      }

      setResult(data)
      toast({
        title: "Success",
        description: data.message || "License seeded successfully",
      })

      // Reset form
      setMacAddress("")
      setClientName("")
      setExpiresInDays("365")
    } catch (err: any) {
      const errorMessage = err.message || "An error occurred while seeding the license"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyLicenseKey = () => {
    if (result?.license?.licenseKey) {
      navigator.clipboard.writeText(result.license.licenseKey)
      toast({
        title: "Copied",
        description: "License key copied to clipboard",
      })
    }
  }

  const formatMacAddress = (value: string) => {
    // Remove all non-hex characters
    const cleaned = value.replace(/[^0-9A-Fa-f]/g, "")
    // Add colons every 2 characters
    const formatted = cleaned.match(/.{1,2}/g)?.join(":") || cleaned
    return formatted.substring(0, 17) // Max length: XX:XX:XX:XX:XX:XX
  }

  const handleMacAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMacAddress(e.target.value)
    setMacAddress(formatted)
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">License Seed Admin</h1>
            <p className="text-muted-foreground">
              Generate and seed a license for a device by entering its MAC address
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        <Card>
        <CardHeader>
          <CardTitle>License Information</CardTitle>
          <CardDescription>
            Enter the MAC address of the device to generate a license key
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="macAddress">
                MAC Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="macAddress"
                required
                value={macAddress}
                onChange={handleMacAddressChange}
                placeholder="D6:EA:5E:55:EF:27"
                pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                maxLength={17}
              />
              <p className="text-sm text-muted-foreground">
                Format: XX:XX:XX:XX:XX:XX (colons will be added automatically)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Default Client"
              />
              <p className="text-sm text-muted-foreground">
                Optional. Defaults to &quot;Default Client&quot; if not provided
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresInDays">Expires In (Days)</Label>
              <Input
                id="expiresInDays"
                type="number"
                min="1"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="365"
              />
              <p className="text-sm text-muted-foreground">
                Optional. Defaults to 365 days if not provided
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Seeding License...
                </>
              ) : (
                "Generate License"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              License Generated Successfully
            </CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>License Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={result.license.licenseKey}
                  readOnly
                  className="font-mono font-semibold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyLicenseKey}
                  title="Copy license key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">MAC Address</Label>
                <p className="font-mono text-sm">{result.license.macAddress}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Client Name</Label>
                <p className="text-sm">{result.license.clientName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p className="text-sm capitalize">{result.license.status}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Expires In</Label>
                <p className="text-sm">{result.license.expiresInDays} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  )
}

