// Server component wrapper for static export
export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

import CustomerDetailPageClient from './page-client'

export default function CustomerDetailPage() {
  return <CustomerDetailPageClient />
}
