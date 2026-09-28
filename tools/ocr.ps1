param([string]$InDir, [string]$OutDir, [string]$Keys)
# Windows built-in OCR (zh-Hant-TW) -> JSON {lines:[{t, b:[x0,y0,x1,y1]}]}
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Globalization.Language, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) {
    $task = $asTaskGeneric.MakeGenericMethod($t).Invoke($null, @($op))
    $task.Wait() | Out-Null
    $task.Result
}

$lang = New-Object Windows.Globalization.Language 'zh-Hant-TW'
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
$utf8 = New-Object System.Text.UTF8Encoding $false

foreach ($k in $Keys.Split(',')) {
    try {
        $path = Join-Path $InDir ($k + '.png')
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
        $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.Append('{"lines":[')
        $first = $true
        foreach ($ln in $res.Lines) {
            $x0 = 1e9; $y0 = 1e9; $x1 = 0; $y1 = 0; $txt = ''
            foreach ($w in $ln.Words) {
                $r = $w.BoundingRect
                if ($r.X -lt $x0) { $x0 = $r.X }; if ($r.Y -lt $y0) { $y0 = $r.Y }
                if ($r.X + $r.Width -gt $x1) { $x1 = $r.X + $r.Width }; if ($r.Y + $r.Height -gt $y1) { $y1 = $r.Y + $r.Height }
                $txt += $w.Text
            }
            if ($txt.Length -eq 0) { continue }
            $esc = $txt.Replace('\', '\\').Replace('"', '\"')
            if (-not $first) { [void]$sb.Append(',') }
            $first = $false
            [void]$sb.Append('{"t":"' + $esc + '","b":[' + [int]$x0 + ',' + [int]$y0 + ',' + [int]$x1 + ',' + [int]$y1 + ']}')
        }
        [void]$sb.Append(']}')
        [System.IO.File]::WriteAllText((Join-Path $OutDir ($k + '.json')), $sb.ToString(), $utf8)
        $stream.Dispose()
    } catch {
        Write-Host ('OCR failed: ' + $k + ' ' + $_.Exception.Message)
    }
}
