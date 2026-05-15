import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root to silence the multi-lockfile warning when this
  // package is built in isolation from inside a monorepo.
  outputFileTracingRoot: __dirname,
  // Set in deployment environment to point at the latest installer URL.
  env: {
    NEXT_PUBLIC_DOWNLOAD_URL:
      process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? 'https://github.com/overframe/overframe/releases/latest',
  },
}

export default nextConfig
