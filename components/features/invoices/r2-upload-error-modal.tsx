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
import { AlertCircle, RefreshCw } from "lucide-react";

interface R2UploadErrorModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	error: string;
	onRetry: () => void;
}

export function R2UploadErrorModal({
	open,
	onOpenChange,
	error,
	onRetry,
}: R2UploadErrorModalProps) {
	const handleRetry = () => {
		onOpenChange(false);
		onRetry();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
							<AlertCircle className="h-5 w-5 text-destructive" />
						</div>
						<DialogTitle className="text-xl">
							PDF Upload Failed
						</DialogTitle>
					</div>
					<DialogDescription className="pt-2 text-base">
						Unable to upload PDF to cloud storage. WhatsApp cannot be opened
						without a valid PDF link.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="rounded-lg bg-muted p-4">
						<p className="text-sm font-medium text-muted-foreground mb-2">
							Error Details:
						</p>
						<p className="text-sm text-foreground break-words">{error}</p>
					</div>

					<div className="text-sm text-muted-foreground">
						<p>
							Please check your internet connection and try again. If the
							problem persists, check your Vercel environment variables for R2
							configuration.
						</p>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleRetry} className="gap-2">
						<RefreshCw className="h-4 w-4" />
						Try Again
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

