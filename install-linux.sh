#!/usr/bin/env bash
set -e


echo "=== Aaraya Music Bot - Installer for Linux/Mac ==="


# ตรวจ node
if ! command -v node >/dev/null 2>&1; then
echo "Node.js not found. Install Node.js (v18+) and re-run this script."
exit 1
fi


npm install


# ติดตั้ง yt-dlp
if command -v python3 >/dev/null 2>&1; then
python3 -m pip install -U yt-dlp || true
elif command -v py >/dev/null 2>&1; then
py -3 -m pip install -U yt-dlp || true
else
echo "Python not found — ถ้าไม่มี pip ให้ดาวน์โหลด yt-dlp binary เอง"
fi


echo "Installation done. Check INSTALLATION_STEPS.txt for next steps."