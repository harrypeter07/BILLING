"use client"

import { useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

interface LogoConfigModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onLogoConfigured: (logoUrl: string) => void
}

export function LogoConfigModal({
	open,
	onOpenChange,
	onLogoConfigured,
}: LogoConfigModalProps) {
	const [uploading, setUploading] = useState(false)
	const [logoPreview, setLogoPreview] = useState<string | null>(null)
	const { toast } = useToast()
	const supabase = createClient()

	const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		// Validate file type
		if (!file.type.startsWith("image/")) {
			toast({
				title: "Error",
				description: "Please upload an image file",
				variant: "destructive",
			})
			return
		}

		// Validate file size (max 2MB)
		if (file.size > 2 * 1024 * 1024) {
			toast({
				title: "Error",
				description: "Image size should be less than 2MB",
				variant: "destructive",
			})
			return
		}

		setUploading(true)
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser()
			if (!user) {
				toast({
					title: "Error",
					description: "Not authenticated",
					variant: "destructive",
				})
				return
			}

			// Convert to base64 for storage (works offline too)
			const reader = new FileReader()
			reader.onloadend = async () => {
				const base64String = reader.result as string

				// Try to upload to Supabase storage if online
				let logoUrl = base64String // Default to base64

				try {
					// Upload to Supabase storage
					const fileExt = file.name.split(".").pop()
					const fileName = `${user.id}/${Date.now()}.${fileExt}`

					const { error: uploadError } = await supabase.storage
						.from("logos")
						.upload(fileName, file, { upsert: true })

					if (!uploadError) {
						const { data: { publicUrl } } = supabase.storage
							.from("logos")
							.getPublicUrl(fileName)
						logoUrl = publicUrl
					}
				} catch (storageError) {
					console.warn(
						"[LogoConfigModal] Supabase storage unavailable, using base64:",
						storageError
					)
					// Continue with base64
				}

				setLogoPreview(logoUrl)

				// Save to database
				const { error } = await supabase
					.from("user_profiles")
					.update({ logo_url: logoUrl })
					.eq("id", user.id)

				if (error) throw error

				// Cache logo URL in localStorage
				localStorage.setItem("business_logo_url", logoUrl)

				// Notify parent
				onLogoConfigured(logoUrl)

				toast({
					title: "Success",
					description: "Logo configured successfully",
				})

				// Close modal after short delay
				setTimeout(() => {
					onOpenChange(false)
				}, 500)
			}
			reader.onerror = () => {
				toast({
					title: "Error",
					description: "Failed to read image file",
					variant: "destructive",
				})
			}
			reader.readAsDataURL(file)
		} catch (error: any) {
			toast({
				title: "Error",
				description: error.message || "Failed to upload logo",
				variant: "destructive",
			})
		} finally {
			setUploading(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Logo Not Configured</DialogTitle>
					<DialogDescription>
						Please upload your business logo to include it on invoices and slips.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					{logoPreview && (
						<div className="relative inline-block mx-auto">
							<img
								src={logoPreview}
								alt="Logo Preview"
								className="h-32 w-32 object-contain border rounded-lg p-2 bg-gray-50"
							/>
						</div>
					)}
					<div>
						<Label htmlFor="logo_upload">Upload Logo</Label>
						<Input
							id="logo_upload"
							type="file"
							accept="image/*"
							onChange={handleLogoUpload}
							disabled={uploading}
							className="mt-2"
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Upload your business logo (max 2MB). PNG, JPG, or SVG formats are
							supported.
						</p>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={uploading}
						>
							Cancel
						</Button>
						{logoPreview && (
							<Button onClick={() => onOpenChange(false)} disabled={uploading}>
								Continue
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}



