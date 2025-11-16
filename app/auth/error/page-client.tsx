"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle, ArrowLeft } from "lucide-react"

export default function AuthErrorPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState("An unknown error occurred")

  useEffect(() => {
    const error = searchParams.get("error")
    if (error) {
      setErrorMessage(error)
    }
  }, [searchParams])

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/")}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <CardTitle className="text-2xl font-bold">Authentication Error</CardTitle>
                <CardDescription>Something went wrong during authentication</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Error: {errorMessage}</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/auth/login">Back to login</Link>
            </Button>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-center gap-4 pt-2">
                <Link href="/" className="text-xs text-muted-foreground hover:text-primary">
                  Home
                </Link>
                <span className="text-xs text-muted-foreground">•</span>
                <Link href="/auth/employee-login" className="text-xs text-muted-foreground hover:text-primary">
                  Employee Login
                </Link>
                <span className="text-xs text-muted-foreground">•</span>
                <Link href="/auth/customer-login" className="text-xs text-muted-foreground hover:text-primary">
                  Customer Login
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

