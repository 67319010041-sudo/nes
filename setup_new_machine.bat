@echo off
title Nestle Bot - One Click Installer
color 0b

echo ===================================================
echo      🚀 NESTLE BOT INSTALLER (สำหรบเครื่องใหม่)
echo ===================================================
echo.

echo [1/4] Checking Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] ไม่พบ Node.js ในเครื่องนี้!
    echo กรุณาไปโหลด Node.js (LTS Version) ที่ https://nodejs.org/ ก่อนครับ
    pause
    exit
)
echo ✅ Node.js Installed.

echo.
echo [2/4] Installing Dependencies (ลงโปรแกรมที่จำเป็น)...
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] บางอย่างอาจติดตั้งไม่สมบูรณ์ แต่จะพยายามต่อ...
)

echo.
echo [3/4] Installing PM2 (ระบบรันบอท 24 ชม.)...
call npm install -g pm2

echo.
echo [4/4] Checking Config Files...
if not exist .env (
    color 0e
    echo [WARNING] ไม่พบไฟล์ .env!
    echo ⚠️  อย่าลืมก๊อปไฟล์ .env จากเครื่องเก่ามาใส่ในโฟลเดอร์นี้ด้วยนะครับ!
    echo ⚠️  ไม่งั้นบอทจะเปิดไม่ติด (หา Token ไม่เจอ)
) else (
    echo ✅ พบไฟล์ .env แล้ว
)

if not exist cookies.json (
    echo [INFO] ไม่พบ cookies.json (อาจฟังเพลง Age-restricted ไม่ได้)
    echo แนะนำให้ก๊อป cookies.json มาด้วยถ้ามีครับ
)

echo.
echo ===================================================
echo      ✅ ติดตั้งเสร็จสมบูรณ์! พร้อมใช้งาน
echo ===================================================
echo.
echo วิธีเปิดบอท:
echo 1. ดับเบิ้ลคลิกไฟล์ 'start.bat' (เพื่อเทส)
echo 2. หรือพิมพ์ 'pm2 start index.js' (เพื่อรัน 24 ชม.)
echo.
pause
