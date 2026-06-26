# server 폴더를 배포용 zip으로 묶습니다 (node_modules, local.db, 기존 업로드 제외).
# 결과: build_release\server_dist.zip
$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $MyInvocation.MyCommand.Path
$src   = Join-Path $root 'server'
$stage = Join-Path $env:TEMP 'fa_srvpkg\server'
$out   = Join-Path $root 'build_release\server_dist.zip'

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

# 1) 단일 파일 명시 복사
$files = @(
  'index.js','db.js','package.json','package-lock.json',
  'start-server.cmd','reset-accounts.cmd','reset-accounts.js'
)
foreach ($f in $files) {
  $p = Join-Path $src $f
  if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination $stage -Force }
  else { Write-Host "  (skip, not found: $f)" }
}

# 2) 폴더 명시 복사 (routes, middleware)
foreach ($d in @('routes','middleware')) {
  $p = Join-Path $src $d
  if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination $stage -Recurse -Force }
}

# 3) uploads\documents 빈 폴더 유지용 placeholder (Compress-Archive 는 빈 폴더를 건너뜀)
$updocs = Join-Path $stage 'uploads\documents'
New-Item -ItemType Directory -Force -Path $updocs | Out-Null
Set-Content -LiteralPath (Join-Path $updocs '.keep') -Value 'placeholder' -Encoding ascii

# 4) 압축
if (-not (Test-Path (Split-Path $out))) { New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null }
Compress-Archive -Path $stage -DestinationPath $out -Force

Write-Host ""
Write-Host ("[OK] Created: " + $out)
Write-Host ("[OK] Size   : {0:N2} MB" -f ((Get-Item $out).Length / 1MB))
Write-Host ""
Write-Host "ZIP contents:"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($out)
$zip.Entries | Select-Object -ExpandProperty FullName | Sort-Object | ForEach-Object { Write-Host ("  " + $_) }
$zip.Dispose()
