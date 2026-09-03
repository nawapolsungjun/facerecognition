@echo off
chcp 65001 > nul
title ติดตั้งสภาพแวดล้อมระบบ - Setup Environment
color 0B

echo ===================================================
echo     เริ่มต้นติดตั้ง Dependencies สำหรับเครื่องใหม่
echo ===================================================
echo.

:: 1. ติดตั้งฝั่ง Python (ที่ Root Directory)
echo [1/3] กำลังสร้างและติดตั้ง Virtual Environment ฝั่ง Python (Root Folder)...
cd /d %~dp0
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate
if exist requirements.txt (
    pip install -r requirements.txt
) else (
    echo ไม่พบไฟล์ requirements.txt กำลังติดตั้ง packages สำหรับ api.py...
    pip install fastapi uvicorn face-recognition opencv-python numpy pydantic python-multipart
)

echo.
:: 2. ติดตั้งฝั่ง Next.js (เข้าไปใน attendance-web)
echo [2/3] กำลังติดตั้ง Node Modules ในโฟลเดอร์ attendance-web...
cd /d %~dp0attendance-web
call npm install

echo.
:: 3. Generate Prisma Client
echo [3/3] กำลังเตรียมฐานข้อมูล Prisma Client...
call npx prisma generate

echo.
echo ===================================================
echo     ติดตั้งสภาพแวดล้อมเรียบร้อยแล้ว!
echo     สามารถดับเบิลคลิกไฟล์ start_system.bat เพื่อเริ่มใช้งานได้เลย
echo ===================================================
pause