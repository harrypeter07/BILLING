/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
    unoptimized: true,
  },
  // Electron runs Next.js server, no static export needed
  // Note: turbo config removed as it's not a valid experimental option
}

export default nextConfig
