// Server component wrapper for static export
export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

import CustomerVerifyPageClient from './page-client'

export default function CustomerVerifyPage() {
  return <CustomerVerifyPageClient />
}
