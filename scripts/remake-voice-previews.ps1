# Régénère les extraits voix avec les mêmes boucles que generate-session-audio.
# Prérequis : imageio_ffmpeg (Python) + boucles WAV à jour dans beds/.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ff = python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
$beds = Join-Path $root 'supabase\functions\generate-session-audio\beds'
$voices = Join-Path $root 'public\voices'

function MixPreview([string]$voiceIn, [string]$bedIn, [double]$bedGainDb, [string]$outFile) {
  if (-not (Test-Path $voiceIn)) { throw "Voix manquante: $voiceIn" }
  if (-not (Test-Path $bedIn)) { throw "Fond manquant: $bedIn" }
  Write-Host "Mix $(Split-Path $outFile -Leaf) (bed $bedGainDb dB)"
  & $ff -y -hide_banner -i $voiceIn -stream_loop -1 -i $bedIn -filter_complex `
    "[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,volume=0.88[v];[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,afade=t=in:st=0:d=0.8,volume=${bedGainDb}dB[b];[v][b]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]" `
    -map "[out]" -ar 44100 -ac 1 -b:a 128k $outFile
  if ($LASTEXITCODE -ne 0) { throw "Echec mix $outFile" }
}

# Gains = −32 dBFS (smoothBed) − max_volume mesuré sur la boucle brute.
MixPreview (Join-Path $voices 'rituel-source.mp3') (Join-Path $beds 'rituel-loop.wav') -22.4 (Join-Path $voices 'rituel-preview.mp3')
MixPreview (Join-Path $voices 'onde-clone-sample.mp3') (Join-Path $beds 'onde-loop.wav') -18.9 (Join-Path $voices 'onde-preview.mp3')
$tmp = Join-Path $voices '_damien-mixed.tmp.mp3'
MixPreview (Join-Path $voices 'antoni.mp3') (Join-Path $beds 'antoni-loop.wav') -22.5 $tmp
Copy-Item $tmp (Join-Path $voices 'damien-preview.mp3') -Force
Remove-Item $tmp -Force

MixPreview (Join-Path $voices 'louis-dry.mp3') (Join-Path $beds 'rituel-loop.wav') -22.4 (Join-Path $voices 'louis-preview.mp3')
MixPreview (Join-Path $voices 'aurore-dry.mp3') (Join-Path $beds 'antoni-loop.wav') -22.5 (Join-Path $voices 'aurore-preview.mp3')
MixPreview (Join-Path $voices 'maelis-dry.mp3') (Join-Path $beds 'onde-loop.wav') -18.9 (Join-Path $voices 'maelis-preview.mp3')
Write-Host 'OK — extraits alignés sur les fonds de prod. Pense à bumper ?v= dans wizard.ts'
