# PreToolUse hook (Bash) — enforces the non-negotiables from WORKFLOW.md §9.
# Blocks dangerous commands BEFORE they run. Exit 2 + stderr cancels the tool call
# and feeds the reason back to Claude, so it can choose a safe alternative.
#
# Receives JSON on stdin: { tool_name, tool_input: { command, ... } }

param()

$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try {
    $data = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$cmd = $data.tool_input.command
if (-not $cmd) { exit 0 }

function Deny($reason) {
    [Console]::Error.WriteLine("BLOCKED by pre-bash-guard: $reason")
    [Console]::Error.WriteLine("See WORKFLOW.md, section 9 (regles non negociables). Needs explicit human approval.")
    exit 2
}

# Normalise whitespace for matching
$c = ($cmd -replace '\s+', ' ').Trim()

# 1. No push to main
if ($c -match 'git\s+push\b' -and $c -match '[:/ ]main(\s|$)') {
    Deny "push direct sur 'main' interdit -- passer par une PR depuis dev."
}

# 2. No force push (force-with-lease is allowed — it is the safe variant)
if ($c -match 'git\s+push\b' -and $c -match '(--force(?!-with-lease)\b|\s-f\b)') {
    Deny "force-push interdit."
}

# 3. No hard reset (risks losing uncommitted work — e.g. the .claude setup)
if ($c -match 'git\s+reset\b' -and $c -match '--hard') {
    Deny "'git reset --hard' interdit -- risque de perte de travail non commite."
}

# 4. No force-clean (would wipe untracked files, including an uncommitted setup)
if ($c -match 'git\s+clean\b' -and $c -match '-[a-zA-Z]*f') {
    Deny "'git clean -f' interdit -- effacerait des fichiers non suivis."
}

# 5. No bypassing the pre-commit hook
if ($c -match '--no-verify') {
    Deny "'--no-verify' interdit -- ne pas contourner le pre-commit."
}

# 6. No new npm dependency without approval (bare install / lockfile restore is fine)
if ($c -match '\b(pnpm|yarn)\s+add\b' -or $c -match '\bnpm\s+(install|i)\s+[^-\s]\S*') {
    Deny "ajout de dependance npm interdit sans accord explicite (TASKS.md). Auditer avec 'pnpm check:deps'."
}

exit 0
