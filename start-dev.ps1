Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "              Starting AcadTrack System" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Start backend in a new PowerShell window
Write-Host "Starting Backend API on http://localhost:5000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; Write-Host '--- AcadTrack Backend API (Port 5000) ---' -ForegroundColor Green; npm run dev"

# Start frontend in a new PowerShell window
Write-Host "Starting Frontend on http://localhost:3000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; Write-Host '--- AcadTrack Next.js Frontend (Port 3000) ---' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "Waiting 5 seconds for servers to start up..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "Launching web browser at http://localhost:3000 ..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "AcadTrack is up and running!" -ForegroundColor Green
Write-Host "Press any key to exit this launcher window (servers will stay open in their own windows)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
