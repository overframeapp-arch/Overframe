import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// With node-linker=hoisted, pnpm places next in the workspace root node_modules,
// so we point Turbopack's root there so it can resolve the next package.
const workspaceRoot = path.resolve(__dirname, '..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  // Both outputFileTracingRoot and turbopack.root must be the same value.
  // Point both at the workspace root so Turbopack can resolve the `next` package
  // that pnpm (node-linker=hoisted) placed in the workspace root node_modules.
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  // Set in deployment environment to point at the latest installer URL.
  // GitHub /releases/latest/download/{asset} always redirects to the newest release asset.
  env: {
    NEXT_PUBLIC_DOWNLOAD_URL:
      process.env.NEXT_PUBLIC_DOWNLOAD_URL ??
      'https://github.com/overframeApp-arch/Overframe/releases/latest/download/Overframe-Setup.exe',
  },
}

export default nextConfig
