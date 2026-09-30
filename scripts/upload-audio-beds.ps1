# Envoie les boucles WAV dans le bucket Supabase `beds` (après beds_storage.sql).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$beds = Join-Path $root 'supabase\functions\generate-session-audio\beds'
if (-not (Test-Path $beds)) { throw "Dossier introuvable: $beds" }
Push-Location $beds
try {
  foreach ($name in @('rituel-loop.wav', 'onde-loop.wav', 'antoni-loop.wav')) {
    if (-not (Test-Path $name)) { throw "Fichier manquant: $name" }
    Write-Host "Upload $name ..."
    npx supabase storage rm "ss:///beds/$name" --linked --experimental 2>$null | Out-Null
    npx supabase storage cp $name "ss:///beds/$name" --linked --experimental --content-type audio/wav
    if ($LASTEXITCODE -ne 0) { throw "Echec upload $name" }
  }
  Write-Host 'OK — fonds sur Supabase.'
} finally {
  Pop-Location
}
