# Install git hooks. Run once after cloning: pnpm setup-hooks
param()

$root = git rev-parse --show-toplevel
$dest = Join-Path $root '.git/hooks/pre-commit'
$src  = Join-Path $root 'scripts/pre-commit'

if (-not (Test-Path $src)) {
    Write-Error "scripts/pre-commit not found"
    exit 1
}

Copy-Item $src $dest -Force
Write-Output 'Git hooks installed. Every commit will now run typecheck + lint.'
