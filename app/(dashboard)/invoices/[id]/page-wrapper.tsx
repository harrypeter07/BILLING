// Server component wrapper for static export
export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

import InvoiceDetailPageClient from './page-client'

export default function InvoiceDetailPage() {
  return <InvoiceDetailPageClient />
}

