// Server component wrapper for static export
export async function generateStaticParams() {
  return []
}

import CustomerVerifyPageClient from './page-client'

export default function CustomerVerifyPage() {
  return <CustomerVerifyPageClient />
}
