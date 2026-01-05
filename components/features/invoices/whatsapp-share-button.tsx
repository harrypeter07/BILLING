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
import { getInvoiceStorage } from "@/lib/utils/save-invoice-storage";
import { executeInvoiceAction } from "@/lib/invoice-document-engine";

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
		// Prevent double-clicks and multiple simultaneous shares
		if (isSharing) {
			console.warn("[WhatsAppShare] Share already in progress, ignoring duplicate click");
			return;
		}

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
			// Prepare source data
			const source = {
				invoice,
				items,
				customer,
				profile,
				storeName,
			};

			// Use unified document engine
			// This handles: PDF generation → R2 upload → WhatsApp message → WhatsApp opening
			// All steps are awaited to ensure R2 URL is available before opening WhatsApp
			// CRITICAL: WhatsApp opens synchronously to preserve user gesture
			const result = await executeInvoiceAction({
				invoiceId: invoice.id,
				action: "whatsapp",
				format: "slip",
				source,
				onProgress: (message) => {
					console.log(`[WhatsAppShare] ${message}`);
					// Show progress messages to user
					toast({
						title: "Processing...",
						description: message,
						duration: 2000,
					});
				},
				onWarning: (title, description) => {
					toast({
						title,
						description,
						variant: "default",
						duration: 6000,
					});
				},
			});

			// Verify WhatsApp opened successfully
			const whatsappOpened = result && typeof result === 'object' && 'success' in result && result.success === true;

			if (!whatsappOpened) {
				toast({
					title: "⚠️ WhatsApp Failed to Open",
					description: "PDF uploaded, but WhatsApp could not be opened. Please check your popup blocker settings.",
					variant: "destructive",
					duration: 5000,
				});
				return;
			}

			// Get R2 URL for UI feedback (after upload completes)
			const storage = await getInvoiceStorage(invoice.id);
			if (storage?.public_url) {
				const expiresAt = new Date(storage.expires_at).getTime();
				const now = Date.now();
				if (expiresAt > now) {
					setUploadedUrl(storage.public_url);
				}
			}

			toast({
				title: "✅ WhatsApp Opened",
				description: "PDF uploaded and WhatsApp opened with PDF link.",
				duration: 3000,
			});
		} catch (error) {
			console.error("[WhatsAppShare] Error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to prepare WhatsApp message. Please try again.";
			
			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				duration: 5000,
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
