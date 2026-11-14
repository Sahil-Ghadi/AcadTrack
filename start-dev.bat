@echo off
title AcadTrack - Starting App...
echo ========================================================
echo               Starting AcadTrack System
echo ========================================================
echo.
echo Starting Backend API on http://localhost:5000 ...
start "AcadTrack - Backend API (Port 5000)" cmd /k "cd backend && npm run dev"

echo Starting Frontend on http://localhost:3000 ...
start "AcadTrack - Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"

echo.
echo Waiting 5 seconds for servers to initialize...
timeout /t 5 /nobreak >nul

echo Opening browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo ========================================================
echo Both servers are running!
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000/health
echo ========================================================
pause
