"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle2, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SignupSuccessPage() {
  const router = useRouter()
  
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
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                <CardDescription>We've sent you a confirmation link to verify your account</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Please check your email and click the confirmation link to activate your account. Once confirmed, you can
              sign in and start using Billing Solutions.
            </p>
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
