"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	MessageCircle,
	WifiOff,
	Copy,
	Check,
	ExternalLink,
	Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
	generateWhatsAppBillMessage,
	shareOnWhatsApp,
	type MiniBillData,
} from "@/lib/utils/whatsapp-bill";
import { getInvoiceStorage } from "@/lib/utils/save-invoice-storage";
import { createClient } from "@/lib/supabase/client";

interface WhatsAppShareButtonProps {
	invoice: {
		id: string;
		invoice_number: string;
		invoice_date: string;
		total_amount: number;
		created_by_employee_id?: string;
		employee_id?: string;
		user_id?: string;
		is_gst_invoice?: boolean;
		subtotal?: number;
		cgst_amount?: number;
		sgst_amount?: number;
		igst_amount?: number;
	};
	items: Array<{
		description: string;
		quantity: number;
		unit_price: number;
		discount_percent?: number;
		gst_rate?: number;
		line_total?: number;
		gst_amount?: number;
	}>;
	storeName: string;
	invoiceLink: string;
	customer?: {
		name?: string;
		email?: string;
		phone?: string;
		gstin?: string;
	};
	profile?: {
		business_name?: string;
		business_gstin?: string;
		business_address?: string;
		business_phone?: string;
		business_email?: string;
		logo_url?: string;
	};
}

export function WhatsAppShareButton({
	invoice,
	items,
	storeName,
	invoiceLink,
	customer,
	profile,
}: WhatsAppShareButtonProps) {
	const { toast } = useToast();
	const [isOnline, setIsOnline] = useState(true);
	const [isSharing, setIsSharing] = useState(false);
	const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
	const [showLinkModal, setShowLinkModal] = useState(false);
	const [linkCopied, setLinkCopied] = useState(false);
	const [useServerSide, setUseServerSide] = useState(() => {
		// Default to server-side for faster WhatsApp sharing
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("whatsapp-pdf-use-server-side");
			return saved !== null ? saved === "true" : true;
		}
		return true;
	});
	const [showSettings, setShowSettings] = useState(false);

	useEffect(() => {
		// Check initial online status
		setIsOnline(navigator.onLine);

		// Listen for online/offline events
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	const handleShare = async () => {
		if (!isOnline) {
			toast({
				title: "Internet Required",
				description:
					"Internet connection is required to share invoice on WhatsApp",
				variant: "destructive",
			});
			return;
		}

		setIsSharing(true);

		try {
			// Prepare mini bill data
			const miniBillData: MiniBillData = {
				storeName: storeName || "Business",
				invoiceNumber: invoice.invoice_number,
				invoiceDate: invoice.invoice_date,
				items: items.map((item) => ({
					name: item.description,
					quantity: item.quantity,
					unitPrice: item.unit_price,
				})),
				totalAmount: invoice.total_amount,
				invoiceLink: invoiceLink,
			};

			// Quick check for existing R2 URL (non-blocking, fire-and-forget)
			// We check but don't wait - WhatsApp opens immediately
			let existingR2Url: string | undefined;
			getInvoiceStorage(invoice.id)
				.then((storage) => {
					if (storage?.public_url) {
						const expiresAt = new Date(storage.expires_at).getTime();
						const now = Date.now();
						if (expiresAt > now) {
							existingR2Url = storage.public_url;
							setUploadedUrl(storage.public_url);
							console.log(
								"[WhatsAppShare] Found existing R2 URL:",
								existingR2Url
							);
						}
					}
				})
				.catch((err) => {
					console.warn("[WhatsAppShare] Failed to check existing R2 URL:", err);
				});

			// Generate WhatsApp message immediately (with invoice link or existing R2 URL)
			// PDF link will be updated later if background job completes
			const whatsappMessage = generateWhatsAppBillMessage({
				...miniBillData,
				pdfR2Url: existingR2Url, // Use existing URL if found, otherwise invoice link
			});

			// Open WhatsApp immediately (non-blocking)
			console.log(
				"[WhatsAppShare] Opening WhatsApp immediately with invoice link..."
			);
			shareOnWhatsApp(whatsappMessage).catch((err) => {
				console.error("[WhatsAppShare] Failed to open WhatsApp:", err);
				toast({
					title: "Failed to Open WhatsApp",
					description:
						"Please try opening WhatsApp manually or check your browser settings.",
					variant: "destructive",
					duration: 5000,
				});
			});

			// Show success toast immediately
			toast({
				title: existingR2Url
					? "✅ WhatsApp Opened with PDF Link!"
					: "✅ WhatsApp Opened",
				description: existingR2Url
					? "PDF link found! WhatsApp opened. PDF is being refreshed in the background..."
					: "WhatsApp opened. PDF is being prepared in the background...",
				duration: 3000,
			});

			// Trigger background PDF generation and R2 upload (fire-and-forget)
			// This happens asynchronously and does NOT block the UI
			// Only trigger if we don't have a valid existing URL
			if (!existingR2Url) {
				fetch("/api/invoices/generate-pdf-and-upload", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ invoiceId: invoice.id }),
				})
					.then((response) => {
						if (!response.ok) {
							console.warn(
								"[WhatsAppShare] Background PDF generation failed:",
								response.statusText
							);
						} else {
							console.log(
								"[WhatsAppShare] Background PDF generation started successfully"
							);
							// Optionally poll for the new URL after a delay
							setTimeout(() => {
								getInvoiceStorage(invoice.id)
									.then((storage) => {
										if (storage?.public_url) {
											setUploadedUrl(storage.public_url);
										}
									})
									.catch(() => {
										// Ignore errors
									});
							}, 5000); // Check after 5 seconds
						}
					})
					.catch((err) => {
						console.error(
							"[WhatsAppShare] Failed to trigger background PDF generation:",
							err
						);
						// Don't show error to user - this is background processing
					});
			}
		} catch (error) {
			console.error("[WhatsAppShare] Error:", error);
			toast({
				title: "Error",
				description: "Failed to prepare WhatsApp message. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsSharing(false);
		}
	};

	const handleCopyLink = async () => {
		if (uploadedUrl) {
			try {
				await navigator.clipboard.writeText(uploadedUrl);
				setLinkCopied(true);
				toast({
					title: "Link Copied!",
					description: "PDF link has been copied to clipboard.",
					duration: 2000,
				});
				setTimeout(() => setLinkCopied(false), 2000);
			} catch (err) {
				toast({
					title: "Copy Failed",
					description: "Failed to copy link. Please copy manually.",
					variant: "destructive",
				});
			}
		}
	};

	const handleOpenLink = () => {
		if (uploadedUrl) {
			window.open(uploadedUrl, "_blank", "noopener,noreferrer");
		}
	};

	return (
		<>
			<div className="flex items-center gap-2">
				<Button
					onClick={handleShare}
					disabled={!isOnline || isSharing}
					variant="outline"
					className="gap-2"
					title={
						!isOnline
							? "Internet required to share invoice"
							: "Share invoice on WhatsApp"
					}
				>
					{!isOnline ? (
						<>
							<WifiOff className="h-4 w-4" />
							<span className="hidden sm:inline">Offline</span>
						</>
					) : (
						<>
							<MessageCircle className="h-4 w-4" />
							<span className="hidden sm:inline">
								{isSharing ? "Opening..." : "Share on WhatsApp"}
							</span>
						</>
					)}
				</Button>
				<Button
					onClick={() => setShowSettings(true)}
					variant="ghost"
					size="icon"
					className="h-9 w-9"
					title="PDF Generation Settings"
				>
					<Settings className="h-4 w-4" />
				</Button>
			</div>

			<Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>PDF Uploaded Successfully!</DialogTitle>
						<DialogDescription>
							Your invoice PDF has been uploaded to cloud storage. The link has
							been copied to your clipboard.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
							<code className="flex-1 text-xs break-all">{uploadedUrl}</code>
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							{linkCopied && (
								<span className="flex items-center gap-1 text-green-600">
									<Check className="h-4 w-4" />
									Copied!
								</span>
							)}
						</div>
					</div>
					<DialogFooter className="flex-col sm:flex-row gap-2">
						<Button
							variant="outline"
							onClick={handleCopyLink}
							className="w-full sm:w-auto"
						>
							<Copy className="h-4 w-4 mr-2" />
							{linkCopied ? "Copied!" : "Copy Link"}
						</Button>
						<Button onClick={handleOpenLink} className="w-full sm:w-auto">
							<ExternalLink className="h-4 w-4 mr-2" />
							Open PDF
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showSettings} onOpenChange={setShowSettings}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>PDF Generation Settings</DialogTitle>
						<DialogDescription>
							Choose how PDFs are generated for WhatsApp sharing
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label htmlFor="server-side-toggle">
									Server-Side Generation (Recommended)
								</Label>
								<p className="text-sm text-muted-foreground">
									Faster, higher quality. Requires internet connection.
								</p>
							</div>
							<Switch
								id="server-side-toggle"
								checked={useServerSide}
								onCheckedChange={setUseServerSide}
							/>
						</div>
						{!useServerSide && (
							<div className="rounded-lg bg-muted p-3">
								<p className="text-sm text-muted-foreground">
									Client-side generation is slower but works offline. Use
									server-side for better performance.
								</p>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button onClick={() => setShowSettings(false)}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
