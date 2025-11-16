"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { checkLicenseOnLaunch } from "@/lib/utils/license-manager";
import { Loader2 } from "lucide-react";

interface LicenseGuardProps {
  children: React.ReactNode;
}

// Check Electron at MODULE LEVEL (before React renders) - this is critical!
// This runs immediately when the module loads, not waiting for useEffect
const isElectron =
  typeof window !== "undefined" &&
  (
    // preload-injected API (most reliable)
    !!(window as any).electronAPI ||
    // classic Electron flags
    ((window as any).process?.type === "renderer") ||
    // userAgent check (always present in Electron)
    (navigator?.userAgent || "").includes("Electron")
  );

// Debug log at module level
if (typeof window !== "undefined") {
  const win = window as any;
  console.log("[LicenseGuard MODULE] Checking Electron detection...");
  console.log("[LicenseGuard MODULE] has electronAPI:", !!win.electronAPI);
  console.log("[LicenseGuard MODULE] userAgent:", navigator?.userAgent || "");
  console.log("[LicenseGuard MODULE] process.type:", win.process?.type);
  console.log("[LicenseGuard MODULE] isElectron (module level):", isElectron);
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  // EARLY RETURN - if Electron detected at module level, bypass immediately
  // This runs BEFORE any React state or effects, preventing license check
  if (isElectron) {
    console.log("[LicenseGuard] ✅ Electron detected at module level - BYPASSING license check immediately");
    return <>{children}</>;
  }

  // Additional runtime check as backup (in case module-level check missed it)
  const [isDesktop, setIsDesktop] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const win = window as any;
    const ua = navigator?.userAgent || "";

    const runtimeElectron =
      !!win.electronAPI ||
      ua.includes("Electron") ||
      (win.process && win.process.type === "renderer");

    console.log("[LicenseGuard RUNTIME] userAgent:", ua);
    console.log("[LicenseGuard RUNTIME] has electronAPI:", !!win.electronAPI);
    console.log("[LicenseGuard RUNTIME] isElectron (runtime):", runtimeElectron);

    if (runtimeElectron) {
      console.log("[LicenseGuard RUNTIME] Electron detected - BYPASSING license check");
      setIsDesktop(true);
    }
  }, []);

  // If runtime check detected desktop, bypass
  if (isDesktop) {
    return <>{children}</>;
  }

  // --------------------
  // WEB-ONLY LICENSE LOGIC BELOW (unchanged)
  // --------------------
  const [checking, setChecking] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  
  console.log('[LicenseGuard] Component rendered (web mode)');
  console.log('[LicenseGuard] Initial state - checking:', checking, 'showWelcome:', showWelcome);

  // Get current path - use window.location in Electron, pathname in web
  const getCurrentPath = () => {
    return pathname || '/';
  };

  // Redirect function that works in both web and Electron
  const redirectToLicense = () => {
    console.log('[LicenseGuard] redirectToLicense called');
    router.push("/license");
  };

  useEffect(() => {
    const currentPath = getCurrentPath();
    console.log('[LicenseGuard] Effect started (web mode)');
    console.log('[LicenseGuard] pathname:', pathname);
    console.log('[LicenseGuard] currentPath (computed):', currentPath);
    
    // Skip license check on license page itself
    const isLicensePage = currentPath === "/license" || currentPath === "/license/" || 
                          pathname === "/license" || 
                          (typeof window !== 'undefined' && window.location.pathname.includes('license'));
    
    if (isLicensePage) {
      console.log('[LicenseGuard] On license page, skipping check and allowing immediate render');
      console.log('[LicenseGuard] currentPath:', currentPath);
      console.log('[LicenseGuard] pathname:', pathname);
      console.log('[LicenseGuard] window.location.pathname:', typeof window !== 'undefined' ? window.location.pathname : 'N/A');
      // Immediately allow rendering - no delay
      setChecking(false);
      setShowWelcome(false);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let welcomeTimeoutId: NodeJS.Timeout;
    let isMounted = true;

    // Show welcome message for 1.5 seconds
    console.log('[LicenseGuard] Setting welcome timeout (1.5s)');
    welcomeTimeoutId = setTimeout(() => {
      if (isMounted) {
        console.log('[LicenseGuard] Welcome timeout fired, hiding welcome');
        setShowWelcome(false);
      }
    }, 1500);

      const verifyLicense = async () => {
      console.log('[LicenseGuard] Starting license verification...');
      // Set a hard timeout that will always redirect after 2 seconds (more aggressive)
      console.log('[LicenseGuard] Setting hard timeout (2s)');
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn("[LicenseGuard] Hard timeout fired after 2 seconds, redirecting to license page");
          setChecking(false);
          setShowWelcome(false);
          redirectToLicense();
        }
      }, 2000);

      try {
        // Add timeout to prevent hanging (1.5 seconds max for the actual check)
        const timeoutPromise = new Promise<{ valid: boolean; requiresActivation: boolean }>((resolve) => {
          setTimeout(() => {
            console.warn("License check timed out, redirecting to license page");
            resolve({ valid: false, requiresActivation: true });
          }, 1500); // 1.5 second timeout (less than hard timeout)
        });

        console.log('[LicenseGuard] Starting Promise.race for license check');
        const result = await Promise.race([
          checkLicenseOnLaunch(),
          timeoutPromise,
        ]);

        console.log('[LicenseGuard] License check result:', result);

        // Clear the hard timeout since we got a result
        clearTimeout(timeoutId);
        clearTimeout(welcomeTimeoutId);

        if (!isMounted) {
          console.log('[LicenseGuard] Component unmounted, returning');
          return;
        }

        if (!result.valid || result.requiresActivation) {
          console.log('[LicenseGuard] License invalid or requires activation, redirecting...');
          // Redirect to license page if license is invalid or requires activation
          setChecking(false);
          setShowWelcome(false);
          redirectToLicense();
          return;
        }

        // License is valid, allow access
        console.log('[LicenseGuard] License valid, allowing access');
        setChecking(false);
        setShowWelcome(false);
      } catch (error) {
        console.error("Error verifying license:", error);
        // Clear timeouts
        clearTimeout(timeoutId);
        clearTimeout(welcomeTimeoutId);
        if (isMounted) {
          // On error, redirect to license page to be safe
          setChecking(false);
          setShowWelcome(false);
          redirectToLicense();
        }
      }
    };

    // Start verification immediately (no delay needed)
    verifyLicense();

    // Cleanup
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (welcomeTimeoutId) {
        clearTimeout(welcomeTimeoutId);
      }
    };
  }, [router, pathname]);

  if (checking || showWelcome) {
    console.log('[LicenseGuard] Rendering loading state - checking:', checking, 'showWelcome:', showWelcome);
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(to bottom right, rgba(0,0,0,0.05), transparent)'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '24px',
          padding: '32px',
          textAlign: 'center'
        }}>
          {showWelcome ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{
                height: '80px',
                width: '80px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Welcome to</h1>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '600', color: 'var(--primary)', margin: 0 }}>Billing Solutions</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '8px', margin: 0 }}>
                  Smart Billing for Small Businesses
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p style={{ color: 'var(--muted-foreground)', margin: 0 }}>Verifying license...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  console.log('[LicenseGuard] Rendering children (normal flow)');
  return <>{children}</>;
}


