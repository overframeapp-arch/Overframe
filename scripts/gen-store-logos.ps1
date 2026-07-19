# Generates the 3 square 1:1 logo images the Microsoft Store listing page
# accepts as an optional replacement for the package's own tile assets:
#   - 300x300 (app tile icon shown in the Store)
#   - 150x150
#   - 71x71
# Source: public/icons/icon-transparent.png (512x512, transparent background).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'public\icons\icon-transparent.png'
$outDir = Join-Path $root 'public\store-assets'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$source = [System.Drawing.Image]::FromFile($src)

function Resize-Icon {
  param([int]$Size, [string]$Path)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $bmp.SetResolution($source.HorizontalResolution, $source.VerticalResolution)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
  $g.DrawImage($source, $rect, 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Resize-Icon -Size 300 -Path (Join-Path $outDir 'StoreLogo-300x300.png')
Resize-Icon -Size 150 -Path (Join-Path $outDir 'StoreLogo-150x150.png')
Resize-Icon -Size 71  -Path (Join-Path $outDir 'StoreLogo-71x71.png')
# Square "area image" (1:1) — recommended for optimal display even without
# Xbox targeting. Upscaled 2.1x from the 512px source; acceptable here since
# the mark is a simple flat geometric icon with no fine detail to lose.
Resize-Icon -Size 1080 -Path (Join-Path $outDir 'AreaImage-1080x1080.png')

$source.Dispose()
Get-ChildItem $outDir | Select-Object Name, Length
