"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { activateLicense, getStoredLicense, isLicenseValid } from "@/lib/utils/license-manager";
import { getMacAddress } from "@/lib/utils/mac-address";
import { Loader2, CheckCircle2, XCircle, Shield } from "lucide-react";

export default function LicensePage() {
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [macAddress, setMacAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Check if license already exists on mount
  useEffect(() => {
    const checkExistingLicense = async () => {
      try {
        const stored = await getStoredLicense();
        if (stored && isLicenseValid(stored)) {
          // License is valid, redirect to dashboard
          router.push("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Error checking existing license:", error);
      } finally {
        setChecking(false);
      }
    };

    checkExistingLicense();
  }, [router]);

  // Get MAC address on mount
  useEffect(() => {
    const fetchMacAddress = async () => {
      try {
        const mac = await getMacAddress();
        setMacAddress(mac);
      } catch (error) {
        console.error("Error getting MAC address:", error);
      }
    };
    fetchMacAddress();
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setLoading(true);

    try {
      const result = await activateLicense(licenseKey.trim(), email.trim() || undefined);

      if (result.success) {
        setSuccess(true);
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        setError(result.error || "Failed to activate license");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking license...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">License Activation</CardTitle>
          <CardDescription>
            Enter your license key to activate the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="licenseKey">
                License Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="licenseKey"
                type="text"
                placeholder="ABC-123-XYZ"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={loading || success}
                required
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || success}
              />
            </div>

            {macAddress && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-muted-foreground mb-1">Device ID:</p>
                <p className="font-mono text-xs break-all">{macAddress}</p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  License activated successfully! Redirecting...
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Activated
                </>
              ) : (
                "Activate License"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Need a license? Contact support for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


