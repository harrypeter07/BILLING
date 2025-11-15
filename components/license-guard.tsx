"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { checkLicenseOnLaunch } from "@/lib/utils/license-manager";
import { Loader2 } from "lucide-react";

interface LicenseGuardProps {
  children: React.ReactNode;
}

// Check if we're in Electron environment
const isElectron = typeof window !== "undefined" && (window as any).electronAPI;

export function LicenseGuard({ children }: LicenseGuardProps) {
  const [checking, setChecking] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false); // Disable welcome screen
  const router = useRouter();
  const pathname = usePathname();
  
  console.log('[LicenseGuard] Component rendered');
  console.log('[LicenseGuard] Initial state - checking:', checking, 'showWelcome:', showWelcome);
  console.log('[LicenseGuard] isElectron:', isElectron);

  // Get current path - use window.location in Electron, pathname in web
  const getCurrentPath = () => {
    if (isElectron && typeof window !== 'undefined') {
      // In Electron, use window.location.pathname
      const path = window.location.pathname;
      // Remove leading slash and handle index
      return path === '/' || path === '' ? '/' : path.replace(/\/$/, '') || '/';
    }
    return pathname || '/';
  };

  // Redirect function that works in both web and Electron
  const redirectToLicense = () => {
    console.log('[LicenseGuard] redirectToLicense called');
    if (isElectron) {
      // In Electron, use HTTP URL (server handles routing)
      console.log('[LicenseGuard] Redirecting via window.location to http://localhost:3000/license');
      window.location.href = "http://localhost:3000/license";
    } else {
      // In web, use Next.js router
      console.log('[LicenseGuard] Redirecting via router.push to /license');
      router.push("/license");
    }
  };

  useEffect(() => {
    const currentPath = getCurrentPath();
    console.log('[LicenseGuard] Effect started');
    console.log('[LicenseGuard] isElectron:', isElectron);
    console.log('[LicenseGuard] pathname (hook):', pathname);
    console.log('[LicenseGuard] window.location.pathname:', typeof window !== 'undefined' ? window.location.pathname : 'N/A');
    console.log('[LicenseGuard] currentPath (computed):', currentPath);
    
    // BYPASS LICENSE CHECK IN ELECTRON FOR NOW
    if (isElectron) {
      console.log('[LicenseGuard] ⚠ BYPASSING LICENSE CHECK IN ELECTRON - allowing immediate access');
      console.log('[LicenseGuard] Setting checking=false and showWelcome=false immediately');
      // Use setTimeout to ensure state updates happen
      setTimeout(() => {
        console.log('[LicenseGuard] State update timeout - ensuring checking is false');
        setChecking(false);
        setShowWelcome(false);
      }, 0);
      setChecking(false);
      setShowWelcome(false);
      return;
    }
    
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

  // In Electron, always show children immediately (bypass is active)
  if (isElectron) {
    console.log('[LicenseGuard] Electron detected - rendering children immediately (bypass active)');
    console.log('[LicenseGuard] checking:', checking, 'showWelcome:', showWelcome);
    return <>{children}</>;
  }

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


