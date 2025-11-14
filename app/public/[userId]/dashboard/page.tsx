// Server component wrapper for static export
export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

import PublicCustomerDashboardClient from './page-client'

export default function PublicCustomerDashboard() {
  return <PublicCustomerDashboardClient />
}
