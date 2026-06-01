# PostToolUse hook — runs after every Edit/Write/MultiEdit on a TypeScript file.
# Feeds ESLint results back to Claude immediately so errors are fixed inline.
#
# IMPORTANT: for PostToolUse, plain stdout is NOT shown to Claude (only written to
# the debug log). The ONLY way to get text into Claude's context is the JSON field
# hookSpecificOutput.additionalContext — which is what this hook emits when lint fails.
#
# Receives JSON on stdin:
#   { tool_name, tool_input: { file_path, ... }, tool_response }

param()

$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try {
    $data = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$file = $data.tool_input.file_path
if (-not $file) { exit 0 }

# Only check TypeScript/TSX files
if ($file -notmatch '\.(ts|tsx)$') { exit 0 }

# Skip declaration files and generated output
if ($file -match '(\.d\.ts$|/out/|/dist/|/node_modules/)') { exit 0 }

$eslint = "node_modules\eslint\bin\eslint.js"
if (-not (Test-Path $eslint)) { exit 0 }

# Run ESLint on the single changed file — fast (<1s), targeted feedback.
# --max-warnings=0 makes warnings (no-explicit-any, no-unused-vars, exhaustive-deps)
# fail too: the project standard is "zero warnings" (WORKFLOW.md §5), and ESLint
# would otherwise exit 0 on warnings and the hook would stay silent.
#
# Capture stdout only (the stylish problem report). We do NOT merge stderr with 2>&1:
# PowerShell would wrap ESLint's "too many warnings" stderr line in a NativeCommandError
# and pollute the feedback. stderr (the summary line) is noise here.
$output = node $eslint $file --no-warn-ignored --max-warnings 0
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0 -and $output) {
    $filename = [System.IO.Path]::GetFileName($file)
    $body = "[ESLint] $filename`n" + ($output | Out-String).Trim()

    # Emit additionalContext so Claude actually sees the lint errors on its next turn.
    # (Plain stdout would only land in the debug log — invisible to Claude.)
    $payload = @{
        hookSpecificOutput = @{
            hookEventName     = 'PostToolUse'
            additionalContext = $body
        }
    } | ConvertTo-Json -Compress -Depth 5

    Write-Output $payload
}

exit 0
