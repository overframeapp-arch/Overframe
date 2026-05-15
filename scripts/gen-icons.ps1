New-Item -ItemType Directory -Force -Path public\icons | Out-Null
Add-Type -AssemblyName System.Drawing

function New-IconPng {
  param([int]$Size, [string]$Path)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,124,58,237))
  $g.FillEllipse($bgBrush, 0, 0, $Size, $Size)
  $fontSize = [int]($Size * 0.55)
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textBrush = [System.Drawing.Brushes]::White
  $rect = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
  $g.DrawString('A', $font, $textBrush, $rect, $sf)
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-IconPng -Size 32 -Path "public\icons\tray.png"
New-IconPng -Size 256 -Path "public\icons\icon.png"

$png = [System.IO.File]::ReadAllBytes("public\icons\icon.png")
$pngLen = $png.Length
$ico = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ico
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]1)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]32)
$bw.Write([UInt32]$pngLen)
$bw.Write([UInt32]22)
$bw.Write($png)
[System.IO.File]::WriteAllBytes("public\icons\icon.ico", $ico.ToArray())
$bw.Close()

Get-ChildItem public\icons | Select-Object Name, Length
