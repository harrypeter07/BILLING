"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface RLSErrorDetails {
	errorCode?: string;
	errorMessage?: string;
	errorHint?: string;
	errorDetails?: string;
	policyName?: string;
	userId?: string | null;
	storeId?: string | null;
	authType?: string | null;
	bucket?: string;
	storagePath?: string;
	attemptedValues?: {
		user_id?: string;
		store_id?: string | null;
		name?: string;
		storage_path?: string;
	};
	diagnostics?: {
		authUid?: string | null;
		storeExists?: boolean;
		storeAdminUserId?: string | null;
		employeeExists?: boolean;
		employeeStoreId?: string | null;
		bucketExists?: boolean;
		bucketPublic?: boolean;
		isAuthenticated?: boolean;
		pathFolder?: string;
		pathMatchesAuthUid?: boolean;
	};
}

interface RLSErrorModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	errorDetails: RLSErrorDetails;
	onRetry?: () => void;
}

export function RLSErrorModal({
	open,
	onOpenChange,
	errorDetails,
	onRetry,
}: RLSErrorModalProps) {
	const { toast } = useToast();
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const diagnosticText = `
RLS Policy Error Diagnostic Report
==================================

Error Code: ${errorDetails.errorCode || "Unknown"}
Error Message: ${errorDetails.errorMessage || "No message"}
Error Hint: ${errorDetails.errorHint || "No hint"}

Policy Information:
- Policy Name: ${errorDetails.policyName || "Store members insert customers"}
- Table: customers
- Operation: INSERT

User Context:
- Auth Type: ${errorDetails.authType || "Unknown"}
- User ID (auth.uid()): ${errorDetails.diagnostics?.authUid || "NULL"}
- Target User ID: ${errorDetails.attemptedValues?.user_id || "Not set"}
- Store ID: ${errorDetails.attemptedValues?.store_id || "NULL"}

Store Diagnostics:
- Store Exists: ${errorDetails.diagnostics?.storeExists ? "Yes" : "No"}
- Store Admin User ID: ${errorDetails.diagnostics?.storeAdminUserId || "N/A"}
- Store ID Match: ${errorDetails.attemptedValues?.store_id === errorDetails.diagnostics?.employeeStoreId ? "Yes" : "No"}

Employee Diagnostics:
- Employee Exists: ${errorDetails.diagnostics?.employeeExists ? "Yes" : "No"}
- Employee Store ID: ${errorDetails.diagnostics?.employeeStoreId || "N/A"}

Attempted Values:
- Customer Name: ${errorDetails.attemptedValues?.name || "N/A"}
- User ID: ${errorDetails.attemptedValues?.user_id || "Not set"}
- Store ID: ${errorDetails.attemptedValues?.store_id || "NULL"}

RLS Policy Check:
For Admin:
  auth.uid() = user_id
  ${errorDetails.diagnostics?.authUid || "NULL"} = ${errorDetails.attemptedValues?.user_id || "Not set"}
  Result: ${errorDetails.diagnostics?.authUid === errorDetails.attemptedValues?.user_id ? "✅ PASS" : "❌ FAIL"}

For Employee:
  EXISTS (
    SELECT 1
    FROM employees e
    JOIN stores s ON s.id = e.store_id
    WHERE s.admin_user_id = customers.user_id
      AND (customers.store_id = e.store_id OR customers.store_id IS NULL)
  )
  Result: ${errorDetails.diagnostics?.employeeExists && 
    errorDetails.diagnostics?.storeAdminUserId === errorDetails.attemptedValues?.user_id &&
    (errorDetails.attemptedValues?.store_id === errorDetails.diagnostics?.employeeStoreId || 
     errorDetails.attemptedValues?.store_id === null)
    ? "✅ PASS" : "❌ FAIL"}

Recommendations:
${errorDetails.authType === "admin" 
	? `- Ensure you are logged in as the admin user
- Verify auth.uid() matches the user_id you're trying to insert
- Check if your session has expired`
	: `- Verify you are assigned to a store
- Check that the store's admin_user_id matches the target user_id
- Ensure the store_id matches your employee's store_id (or is NULL)
- Verify you exist in the employees table`}
		`.trim();

		try {
			await navigator.clipboard.writeText(diagnosticText);
			setCopied(true);
			toast({
				title: "Copied!",
				description: "Diagnostic information copied to clipboard",
				duration: 2000,
			});
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			toast({
				title: "Copy Failed",
				description: "Failed to copy diagnostic information",
				variant: "destructive",
			});
		}
	};

	const handleRetry = () => {
		onOpenChange(false);
		if (onRetry) {
			onRetry();
		}
	};

	const isRLSError = errorDetails.errorCode === "42501" || 
		errorDetails.errorMessage?.toLowerCase().includes("row-level security") ||
		errorDetails.errorMessage?.toLowerCase().includes("policy");
	
	const isNetworkError = errorDetails.errorCode === "TIMEOUT" ||
		errorDetails.errorMessage?.toLowerCase().includes("fetch failed") ||
		errorDetails.errorMessage?.toLowerCase().includes("timeout") ||
		errorDetails.errorName === "StorageUnknownError" ||
		errorDetails.diagnostics?.isNetworkError;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
							<AlertCircle className="h-5 w-5 text-destructive" />
						</div>
						<DialogTitle className="text-xl">
							{isRLSError ? "RLS Policy Error" : "Customer Creation Failed"}
						</DialogTitle>
					</div>
					<DialogDescription className="pt-2 text-base">
						{isNetworkError
							? "Network error or timeout occurred during storage upload. See details below."
							: isRLSError
							? errorDetails.bucket
								? "Row Level Security policy is blocking storage upload. See details below."
								: "Row Level Security policy is blocking the operation. See details below."
							: "Unable to complete operation. See error details below."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Error Message */}
					<div className="rounded-lg bg-muted p-4">
						<p className="text-sm font-medium text-muted-foreground mb-2">
							Error Message:
						</p>
						<p className="text-sm text-foreground break-words">
							{errorDetails.errorMessage || "Unknown error"}
						</p>
						{errorDetails.errorHint && (
							<p className="text-xs text-muted-foreground mt-2">
								Hint: {errorDetails.errorHint}
							</p>
						)}
					</div>

					{/* Policy Information */}
					{isRLSError && (
						<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
							<p className="text-sm font-medium text-destructive mb-3">
								Blocking Policy: {errorDetails.policyName || (errorDetails.bucket ? "Storage bucket RLS policy" : "Store members insert customers")}
							</p>
							{errorDetails.bucket && (
								<div className="mb-3 pb-3 border-b border-destructive/20">
									<div className="grid grid-cols-2 gap-2 text-xs">
										<span className="text-muted-foreground">Bucket:</span>
										<span className="font-mono">{errorDetails.bucket}</span>
									</div>
									{errorDetails.storagePath && (
										<div className="grid grid-cols-2 gap-2 text-xs mt-2">
											<span className="text-muted-foreground">Storage Path:</span>
											<span className="font-mono break-all">{errorDetails.storagePath}</span>
										</div>
									)}
								</div>
							)}
							<div className="space-y-2 text-xs">
								<div className="grid grid-cols-2 gap-2">
									<span className="text-muted-foreground">Auth Type:</span>
									<span className="font-mono">{errorDetails.authType || "Unknown"}</span>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<span className="text-muted-foreground">auth.uid():</span>
									<span className="font-mono">{errorDetails.diagnostics?.authUid || "NULL"}</span>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<span className="text-muted-foreground">Target user_id:</span>
									<span className="font-mono">{errorDetails.attemptedValues?.user_id || errorDetails.userId || "Not set"}</span>
								</div>
								{errorDetails.attemptedValues?.store_id !== undefined && (
									<div className="grid grid-cols-2 gap-2">
										<span className="text-muted-foreground">Store ID:</span>
										<span className="font-mono">{errorDetails.attemptedValues?.store_id || "NULL"}</span>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Diagnostics */}
					{errorDetails.diagnostics && (
						<div className="rounded-lg bg-muted p-4">
							<p className="text-sm font-medium text-muted-foreground mb-3">
								Diagnostics:
							</p>
							<div className="space-y-2 text-xs">
								{isNetworkError ? (
									<>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Error Type:</span>
											<span className="text-destructive">
												{errorDetails.diagnostics.errorType || "Network/Timeout"}
											</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">PDF Size:</span>
											<span className="text-muted-foreground">
												{errorDetails.diagnostics.pdfSizeMB || "N/A"} MB ({errorDetails.diagnostics.pdfSize?.toLocaleString() || "N/A"} bytes)
											</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Bucket Exists:</span>
											<span className={errorDetails.diagnostics.bucketExists ? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.bucketExists ? "✅ Yes" : "❌ No"}
											</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Authenticated:</span>
											<span className={errorDetails.diagnostics.isAuthenticated ? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.isAuthenticated ? "✅ Yes" : "❌ No"}
											</span>
										</div>
										{errorDetails.diagnostics.suggestion && (
											<div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-muted-foreground">
												{errorDetails.diagnostics.suggestion}
											</div>
										)}
									</>
								) : errorDetails.bucket ? (
									<>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Bucket Exists:</span>
											<span className={errorDetails.diagnostics.bucketExists ? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.bucketExists ? "✅ Yes" : "❌ No"}
											</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Bucket Public:</span>
											<span className={errorDetails.diagnostics.bucketPublic ? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.bucketPublic ? "✅ Yes" : "❌ No"}
											</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Authenticated:</span>
											<span className={errorDetails.diagnostics.isAuthenticated ? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.isAuthenticated ? "✅ Yes" : "❌ No"}
											</span>
										</div>
										{errorDetails.diagnostics.pathFolder && (
											<div className="flex items-center justify-between mt-2">
												<span className="text-muted-foreground">Path Folder Match:</span>
												<span className={errorDetails.diagnostics.pathMatchesAuthUid ? "text-green-600" : "text-destructive"}>
													{errorDetails.diagnostics.pathMatchesAuthUid ? "✅ Match" : "❌ Mismatch"}
												</span>
											</div>
										)}
										<div className="pl-4 text-muted-foreground mt-2">
											Path folder: {errorDetails.diagnostics.pathFolder || "N/A"}
										</div>
										<div className="pl-4 text-muted-foreground">
											auth.uid(): {errorDetails.diagnostics.authUid || "NULL"}
										</div>
									</>
								) : errorDetails.authType === "admin" ? (
									<>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Admin Check:</span>
											<span className={errorDetails.diagnostics.authUid === errorDetails.attemptedValues?.user_id 
												? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.authUid === errorDetails.attemptedValues?.user_id 
													? "✅ PASS" : "❌ FAIL"}
											</span>
										</div>
										<div className="pl-4 text-muted-foreground">
											auth.uid() ({errorDetails.diagnostics.authUid || "NULL"}) = user_id ({errorDetails.attemptedValues?.user_id || "Not set"})
										</div>
									</>
								) : (
									<>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Store Exists:</span>
											<span className={errorDetails.diagnostics.storeExists ? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.storeExists ? "✅ Yes" : "❌ No"}
											</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Employee Exists:</span>
											<span className={errorDetails.diagnostics.employeeExists ? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.employeeExists ? "✅ Yes" : "❌ No"}
											</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">Store Admin Match:</span>
											<span className={errorDetails.diagnostics.storeAdminUserId === errorDetails.attemptedValues?.user_id 
												? "text-green-600" : "text-destructive"}>
												{errorDetails.diagnostics.storeAdminUserId === errorDetails.attemptedValues?.user_id 
													? "✅ Match" : "❌ Mismatch"}
											</span>
										</div>
										<div className="pl-4 text-muted-foreground">
											Store admin_user_id: {errorDetails.diagnostics.storeAdminUserId || "N/A"}
										</div>
										<div className="flex items-center justify-between mt-2">
											<span className="text-muted-foreground">Store ID Match:</span>
											<span className={(errorDetails.attemptedValues?.store_id === errorDetails.diagnostics.employeeStoreId || 
												errorDetails.attemptedValues?.store_id === null) 
												? "text-green-600" : "text-destructive"}>
												{(errorDetails.attemptedValues?.store_id === errorDetails.diagnostics.employeeStoreId || 
													errorDetails.attemptedValues?.store_id === null) 
													? "✅ Match" : "❌ Mismatch"}
											</span>
										</div>
										<div className="pl-4 text-muted-foreground">
											Employee store_id: {errorDetails.diagnostics.employeeStoreId || "N/A"}
										</div>
									</>
								)}
							</div>
						</div>
					)}

					{/* Recommendations */}
					<div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
						<p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
							Recommendations:
						</p>
						<ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
							{isNetworkError ? (
								<>
									<li>Check your internet connection and try again</li>
									<li>Verify Supabase service is accessible and not experiencing downtime</li>
									<li>If PDF is very large (&gt;5MB), consider compressing it or using R2 storage instead</li>
									<li>Check if there are firewall or network restrictions blocking Supabase API calls</li>
									<li>Try again after a few moments - this might be a temporary network issue</li>
									<li>If the issue persists, check Supabase status page for service alerts</li>
								</>
							) : errorDetails.bucket ? (
								<>
									<li>Ensure the storage bucket "{errorDetails.bucket}" exists in Supabase</li>
									<li>Check that the bucket is configured as public (for read access)</li>
									<li>Verify RLS policies are set up for the storage bucket (run setup-supabase-storage-rls.sql)</li>
									<li>Ensure you are authenticated (auth.uid() is not NULL)</li>
									<li>Check that the storage path folder matches your user ID</li>
									<li>If using service role, ensure storage policies allow authenticated users</li>
								</>
							) : errorDetails.authType === "admin" ? (
								<>
									<li>Ensure you are logged in as the admin user</li>
									<li>Verify your session hasn't expired - try refreshing the page</li>
									<li>Check that auth.uid() matches the user_id you're trying to insert</li>
									<li>If the issue persists, contact your administrator</li>
								</>
							) : (
								<>
									<li>Verify you are assigned to a store in the employees table</li>
									<li>Check that the store's admin_user_id matches the target user_id</li>
									<li>Ensure the store_id matches your employee's store_id (or is NULL)</li>
									<li>Contact your admin to verify your employee account setup</li>
								</>
							)}
						</ul>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={handleCopy} className="gap-2">
						{copied ? (
							<>
								<Check className="h-4 w-4" />
								Copied!
							</>
						) : (
							<>
								<Copy className="h-4 w-4" />
								Copy Diagnostics
							</>
						)}
					</Button>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
					{onRetry && (
						<Button onClick={handleRetry} className="gap-2">
							Try Again
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
