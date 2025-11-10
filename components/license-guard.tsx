"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { checkLicenseOnLaunch } from "@/lib/utils/license-manager";
import { Loader2 } from "lucide-react";

interface LicenseGuardProps {
  children: React.ReactNode;
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const verifyLicense = async () => {
      // Skip license check on license page itself
      if (pathname === "/license") {
        setChecking(false);
        return;
      }

      try {
        const result = await checkLicenseOnLaunch();

        if (!result.valid || result.requiresActivation) {
          // Redirect to license page if license is invalid or requires activation
          router.push("/license");
          return;
        }

        // License is valid, allow access
        setChecking(false);
      } catch (error) {
        console.error("Error verifying license:", error);
        // On error, redirect to license page to be safe
        router.push("/license");
      }
    };

    verifyLicense();
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying license...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


