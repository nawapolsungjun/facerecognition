@echo off
chcp 65001 > nul
title ระบบเช็คชื่อนักเรียน - Face Recognition Attendance System
color 0A

echo ===================================================
echo     กำลังเริ่มเปิดระบบเช็คชื่อสแกนใบหน้า...
echo ===================================================
echo.

:: 1. เปิด FastAPI Backend (Python api.py อยู่ที่โฟลเดอร์นอกสุด)
echo [1/2] กำลังเริ่มรัน Python AI Backend (api.py บน Port 8000)...
start "Python Face-API Backend" cmd /k "cd /d %~dp0 && (if exist venv\Scripts\activate (call venv\Scripts\activate)) && uvicorn api:app --reload --host 0.0.0.0 --port 8000"

:: หน่วงเวลา 3 วินาทีเพื่อให้ Backend เริ่มทำงานก่อน
timeout /t 3 /nobreak > nul

:: 2. เปิด Next.js Frontend (อยู่ในโฟลเดอร์ attendance-web)
echo [2/2] กำลังเริ่มรัน Next.js Web Frontend (Port 3000)...
start "Next.js Web Frontend" cmd /k "cd /d %~dp0attendance-web && npm run dev"

:: หน่วงเวลา 3 วินาทีแล้วเปิด Browser อัตโนมัติ
timeout /t 3 /nobreak > nul
echo.
echo กำลังเปิดเบราว์เซอร์ที่ http://localhost:3000 ...
start http://localhost:3000

echo.
echo ===================================================
echo   ระบบเริ่มทำงานครบแล้ว (อย่าเพิ่งปิดหน้าต่างดำทั้งสอง)
echo ===================================================
pause