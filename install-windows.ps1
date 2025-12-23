#การทำงานระบบการทำงาน window  

Write-Host "=== Aaraya Music Bot - Windows Installer ==="



if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
Write-Host "Node.js ไม่ถูกติดตั้ง — กรุณาติดตั้ง Node.js จาก https://nodejs.org/ แล้วรันสคริปต์นี้อีกครั้ง"
ื
exit 1
}



Write-Host "กำลังรัน npm install..."
npm install



if (Get-Command py -ErrorAction SilentlyContinue) {
Write-Host "พบ Python -> ติดตั้ง yt-dlp ด้วย pip"
py -3 -m pip install -U yt-dlp
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
Write-Host "พบ python -> ติดตั้ง yt-dlp ด้วย pip"
python -m pip install -U yt-dlp
} else {
Write-Host "Python ไม่ถูกพบบนเครื่อง — จะดาวน์โหลด yt-dlp.exe เป็นตัวเลือก"
$out = Join-Path (Get-Location) 'yt-dlp.exe'
Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile $out
Write-Host "ดาวน์โหลด yt-dlp.exe ไปที่: $out"
}


Write-Host "เสร็จสิ้นขั้นตอนติดตั้งเบื้องต้น — ตรวจสอบ ffmpeg และ .env ตาม INSTALLATION_STEPS.txt"