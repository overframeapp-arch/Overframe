# SessionStart hook — boots Claude with live project state.
#
# Unlike Stop/PostToolUse, SessionStart stdout IS injected into Claude's context.
# This guarantees every session starts knowing the branch, the current task and the
# last DEVLOG entry — instead of hoping Claude remembers to read TASKS.md / DEVLOG.md.

param()

# .claude/hooks/session-start.ps1 -> project root is two levels up
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Get-Section {
  param([string]$Path, [string]$Start, [string]$Stop, [int]$Max = 10)
  if (-not (Test-Path $Path)) { return @() }
  $out = @()
  $cap = $false
  foreach ($line in (Get-Content $Path -Encoding UTF8)) {
    if (-not $cap) {
      if ($line -match $Start) { $cap = $true; $out += $line }
      continue
    }
    if ($line -match $Stop) { break }
    $out += $line
    if ($out.Count -ge $Max) { break }
  }
  return $out
}

Write-Output "=== Overframe - etat de session (auto / SessionStart) ==="

$branch = (git -C $root rev-parse --abbrev-ref HEAD 2>$null)
if ($branch) { Write-Output "Branche : $branch" }

# Current task ("En cours" block of TASKS.md)
$enCours = Get-Section -Path (Join-Path $root 'TASKS.md') -Start '^##\s+En cours' -Stop '^(##\s|---)' -Max 8
if ($enCours.Count -gt 1) {
  Write-Output ""
  Write-Output "TASKS - En cours :"
  Write-Output (($enCours | Select-Object -Skip 1) -join "`n").Trim()
}

# Latest DEVLOG entry (title + its "Prochaine etape")
$devlog = Join-Path $root '.claude/DEVLOG.md'
if (Test-Path $devlog) {
  $lines = Get-Content $devlog -Encoding UTF8
  # First real dated entry (skip the '## [YYYY-MM-DD]' template in the format block)
  $titleIdx = ($lines | Select-String -Pattern '^##\s+\[\d' | Select-Object -First 1).LineNumber
  if ($titleIdx) {
    Write-Output ""
    Write-Output "DEVLOG - derniere entree :"
    Write-Output $lines[$titleIdx - 1].Trim()
    for ($i = $titleIdx; $i -lt [Math]::Min($titleIdx + 60, $lines.Count); $i++) {
      if ($lines[$i] -match '^##\s+\[\d') { break }
      if ($lines[$i] -match 'Prochaine .tape') {
        Write-Output $lines[$i].Trim()
        # include following non-empty bullet lines
        for ($j = $i + 1; $j -lt [Math]::Min($i + 5, $lines.Count); $j++) {
          if ($lines[$j].Trim() -eq '' -or $lines[$j] -match '^##|^---') { break }
          Write-Output $lines[$j].Trim()
        }
        break
      }
    }
  }
}

Write-Output ""
Write-Output ">> Lis TASKS.md + DEVLOG.md si tu dois reprendre le contexte complet."
exit 0
