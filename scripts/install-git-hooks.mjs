// Installs the repo's git pre-commit hook on every `pnpm install`.
// Cross-platform and non-fatal: a no-op when there is no real .git directory
// (CI shallow checkouts work, but tarball installs / worktrees are skipped safely),
// so a fresh clone always gets the typecheck+lint pre-commit without a manual step.
import { existsSync, statSync, copyFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

try {
  const gitDir = join(root, '.git')
  // Skip when .git is absent or a file (linked worktree) rather than a real dir.
  if (!existsSync(gitDir) || !statSync(gitDir).isDirectory()) process.exit(0)

  const src = join(root, 'scripts', 'pre-commit')
  if (!existsSync(src)) process.exit(0)

  const hooksDir = join(gitDir, 'hooks')
  mkdirSync(hooksDir, { recursive: true })
  copyFileSync(src, join(hooksDir, 'pre-commit'))
  console.log('[hooks] git pre-commit installed (typecheck + lint on commit)')
} catch (err) {
  console.warn('[hooks] could not install pre-commit:', err.message)
}
process.exit(0)
