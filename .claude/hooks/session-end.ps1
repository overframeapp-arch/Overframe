# Stop hook — runs when Claude finishes a response.
# Prints a working-tree summary + DEVLOG reminder.
#
# NOTE: Stop-hook stdout is human/debug-facing only (visible via Ctrl-R), it is NOT
# fed into Claude's context. We deliberately do NOT block the stop to force a DEVLOG
# update — auto-blocking Stop creates response loops and is user-hostile. The DEVLOG
# discipline is a workflow rule (WORKFLOW.md §9), enforced socially, not by this hook.

param()

$status = git status --short 2>&1
$changed = git diff --name-only HEAD 2>&1

if (-not $status -and -not $changed) { exit 0 }

Write-Output "=== Working tree ==="
if ($status) {
    Write-Output ($status | Out-String).Trim()
} else {
    Write-Output "(clean)"
}

# Count meaningful changes
$tsFiles = ($changed | Where-Object { $_ -match '\.(ts|tsx)$' } | Measure-Object).Count
$total   = ($changed | Where-Object { $_ } | Measure-Object).Count

if ($total -gt 0) {
    Write-Output ""
    Write-Output "Changed: $total file(s) ($tsFiles TypeScript)"

    # Remind to update DEVLOG only when there are real code changes
    if ($tsFiles -gt 0) {
        Write-Output ""
        Write-Output ">> Update .claude/DEVLOG.md if this session made significant changes."
    }
}

exit 0
