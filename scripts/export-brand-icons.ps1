Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
[xml]$symbol = Get-Content -LiteralPath (Join-Path $projectRoot 'assets/images/tamaku-symbol.svg') -Raw
foreach ($size in @(192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#090b0d'))
    $graphics.ScaleTransform($size / 512.0, $size / 512.0)
    $graphics.TranslateTransform(-180, -20)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#cb9c3a'))
    foreach ($shape in $symbol.svg.g.path) {
        $tokens = [regex]::Matches($shape.d, '[MLCZ]|-?\d+(?:\.\d+)?')
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $cursor = 0
        $currentX = 0.0
        $currentY = 0.0
        while ($cursor -lt $tokens.Count) {
            $command = $tokens[$cursor++].Value
            switch ($command) {
                'M' {
                    $path.StartFigure()
                    $currentX = [single]::Parse($tokens[$cursor++].Value, [cultureinfo]::InvariantCulture)
                    $currentY = [single]::Parse($tokens[$cursor++].Value, [cultureinfo]::InvariantCulture)
                }
                'L' {
                    $nextX = [single]::Parse($tokens[$cursor++].Value, [cultureinfo]::InvariantCulture)
                    $nextY = [single]::Parse($tokens[$cursor++].Value, [cultureinfo]::InvariantCulture)
                    $path.AddLine($currentX, $currentY, $nextX, $nextY)
                    $currentX = $nextX
                    $currentY = $nextY
                }
                'C' {
                    $coordinates = @()
                    for ($coordinate = 0; $coordinate -lt 6; $coordinate++) {
                        $coordinates += [single]::Parse($tokens[$cursor++].Value, [cultureinfo]::InvariantCulture)
                    }
                    $path.AddBezier($currentX, $currentY, $coordinates[0], $coordinates[1], $coordinates[2], $coordinates[3], $coordinates[4], $coordinates[5])
                    $currentX = $coordinates[4]
                    $currentY = $coordinates[5]
                }
                'Z' { $path.CloseFigure() }
            }
        }
        $graphics.FillPath($brush, $path)
        $path.Dispose()
    }
    $bitmap.Save((Join-Path $projectRoot "assets/images/tamaku-icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $brush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
