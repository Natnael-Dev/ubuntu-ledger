# scripts/assemble-demo.ps1
# Full assembly pipeline for Ubuntu Ledger hackathon demo video
$ErrorActionPreference = "Stop"

Write-Host "=== Ubuntu Ledger Demo Video Assembly ==="

$mediaDir = Resolve-Path "media"
$clipsDir = Join-Path $mediaDir "clips"

# 1. Render intro card (3s, 1920x1080, 30fps)
Write-Host "Rendering intro.mp4 (3s)..."
ffmpeg -y -loop 1 -i (Join-Path $mediaDir "intro.png") -c:v libx264 -t 3 -r 30 -pix_fmt yuv420p (Join-Path $mediaDir "intro.mp4")

# 2. Render outro card (4s, 1920x1080, 30fps)
Write-Host "Rendering outro.mp4 (4s)..."
ffmpeg -y -loop 1 -i (Join-Path $mediaDir "outro.png") -c:v libx264 -t 4 -r 30 -pix_fmt yuv420p (Join-Path $mediaDir "outro.mp4")

# 3. Normalize all 9 scene webm clips to standard 1080p30 H.264
$scenes = @(
    "scene-01-home.webm",
    "scene-02-receipt.webm",
    "scene-03-simulator-amina.webm",
    "scene-04-simulator-girma.webm",
    "scene-05-simulator-kalinda.webm",
    "scene-06-console.webm",
    "scene-07-divergence.webm",
    "scene-08-pwa.webm",
    "scene-09-ai-oversight.webm"
)

for ($i = 0; $i -lt $scenes.Length; $i++) {
    $idx = ($i + 1).ToString("D2")
    $src = Join-Path $clipsDir $scenes[$i]
    $dst = Join-Path $clipsDir "norm-$idx.mp4"
    Write-Host "Normalizing $($scenes[$i]) -> norm-$idx.mp4..."
    ffmpeg -y -i $src -c:v libx264 -r 30 -pix_fmt yuv420p $dst
}

# 4. Generate concat.txt
$concatFile = Join-Path $mediaDir "concat.txt"
$concatContent = @"
file 'intro.mp4'
file 'clips/norm-01.mp4'
file 'clips/norm-02.mp4'
file 'clips/norm-03.mp4'
file 'clips/norm-04.mp4'
file 'clips/norm-05.mp4'
file 'clips/norm-06.mp4'
file 'clips/norm-07.mp4'
file 'clips/norm-08.mp4'
file 'clips/norm-09.mp4'
file 'outro.mp4'
"@
Set-Content -Path $concatFile -Value $concatContent -Encoding ASCII
Write-Host "Generated concat.txt"

# 5. Concatenate normalized clips
$mergedFile = Join-Path $mediaDir "merged.mp4"
Write-Host "Concatenating all 11 clips into merged.mp4..."
ffmpeg -y -f concat -safe 0 -i $concatFile -c copy $mergedFile

# 6. Burn captions and final encode
$finalMp4 = Join-Path $mediaDir "ubuntu-ledger-demo.mp4"

Write-Host "Burning captions and performing final 1080p H.264 encode..."
ffmpeg -y -i $mergedFile -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -vf "subtitles=filename='media/ubuntu-ledger-demo.srt':force_style='FontSize=24,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2,Alignment=2,MarginV=30'" -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest -movflags +faststart $finalMp4

Write-Host "`n=== Assembly Complete! ==="
Write-Host "Final video output: $finalMp4"
