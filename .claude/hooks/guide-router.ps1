# PostToolUse hook — routes the right domain guide to Claude based on the edited path.
# Emits hookSpecificOutput.additionalContext so the relevant guide is impossible to miss
# (turns the passive guides/ docs into an active "read this before you go further" signal).

param()

$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $data = $raw | ConvertFrom-Json } catch { exit 0 }

$file = $data.tool_input.file_path
if (-not $file) { exit 0 }
$f = ($file -replace '\\', '/')

# Skip test files — guides are about production code.
if ($f -match '\.(test|spec)\.(ts|tsx)$') { exit 0 }

$guide = $null
$why = $null
if ($f -match '/src/main/ipc/' -or $f -match '/src/preload/' -or $f -match '/src/main/lifecycle/csp') {
  $guide = '.claude/guides/SECURITY.md'; $why = 'IPC / preload / CSP'
} elseif ($f -match '/src/main/managers/TabManager' -or $f -match '/src/main/managers/ProfileManager' -or $f -match '/src/main/utils/devServer') {
  $guide = '.claude/guides/PERFORMANCE.md'; $why = 'onglets / polling / memoire'
} elseif ($f -match '/src/renderer/components/') {
  $guide = '.claude/guides/ACCESSIBILITY.md'; $why = 'composant React (UI / a11y)'
}

if (-not $guide) { exit 0 }

$ctx = "Domaine << $why >> : applique la checklist de $guide avant d'aller plus loin (lis-la si pas deja fait dans cette session). Un subagent dedie existe aussi (voir .claude/agents/)."
$payload = @{
  hookSpecificOutput = @{
    hookEventName     = 'PostToolUse'
    additionalContext = $ctx
  }
} | ConvertTo-Json -Compress -Depth 5

Write-Output $payload
exit 0
