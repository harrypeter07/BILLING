"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { checkLicenseOnLaunch } from "@/lib/utils/license-manager";
import { Loader2 } from "lucide-react";

interface LicenseGuardProps {
  children: React.ReactNode;
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [isValid, setIsValid] = useState(false);
  
  console.log('[LicenseGuard] Rendered - pathname:', pathname);

  useEffect(() => {
    // Skip check on license page
    if (pathname === "/license" || pathname?.includes("/license")) {
      console.log('[LicenseGuard] On license page, skipping check');
      setChecking(false);
      setIsValid(true); // Allow license page to render
      return;
    }

    let isMounted = true;

    const verifyLicense = async () => {
      console.log('[LicenseGuard] Starting license verification...');
      
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<{ valid: boolean; requiresActivation: boolean }>((resolve) => {
          setTimeout(() => {
            console.warn("[LicenseGuard] License check timed out");
            resolve({ valid: false, requiresActivation: true });
          }, 3000); // 3 second timeout
        });

        const result = await Promise.race([
          checkLicenseOnLaunch(),
          timeoutPromise,
        ]);

        console.log('[LicenseGuard] License check result:', result);

        if (!isMounted) return;

        if (!result.valid || result.requiresActivation) {
          console.log('[LicenseGuard] License invalid, redirecting to /license');
          setChecking(false);
          setIsValid(false);
          router.push("/license");
          return;
        }

        // License is valid - allow access
        console.log('[LicenseGuard] License valid, allowing access');
        setChecking(false);
        setIsValid(true);
        
      } catch (error) {
        console.error("[LicenseGuard] Error verifying license:", error);
        if (isMounted) {
          setChecking(false);
          setIsValid(false);
          router.push("/license");
        }
      }
    };

    verifyLicense();

    return () => {
      isMounted = false;
    };
  }, [router, pathname]);

  // Show loading state while checking
  if (checking) {
    console.log('[LicenseGuard] Rendering loading state');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-transparent">
        <div className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">Billing Solutions</h2>
            <p className="text-sm text-muted-foreground">Verifying license...</p>
          </div>
        </div>
      </div>
    );
  }

  // Only render children if license is valid
  if (!isValid) {
    console.log('[LicenseGuard] License invalid, not rendering children');
    return null;
  }

  console.log('[LicenseGuard] Rendering children');
  return <>{children}</>;
}
