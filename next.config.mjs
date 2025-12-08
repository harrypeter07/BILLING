/** @type {import('next').NextConfig} */
const isElectronBuild = process.env.ELECTRON_BUILD === "true"

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
  // For Vercel/web deploys ship a standalone server bundle; keep electron builds unchanged.
  output: isElectronBuild ? undefined : "standalone",
  // Electron runs Next.js server, no static export needed
  // Note: turbo config removed as it's not a valid experimental option
}

export default nextConfig
