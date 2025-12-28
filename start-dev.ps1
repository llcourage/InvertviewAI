# PowerShell script to start both API server and Electron

Write-Host "Starting Interview AI Development Environment..." -ForegroundColor Green

# Check if website dependencies are installed
if (-not (Test-Path "website/node_modules")) {
    Write-Host "Installing website dependencies..." -ForegroundColor Yellow
    Set-Location website
    npm install
    Set-Location ..
}

# Check if electron dependencies are installed
if (-not (Test-Path "electron/node_modules")) {
    Write-Host "Installing electron dependencies..." -ForegroundColor Yellow
    Set-Location electron
    npm install
    Set-Location ..
}

# Build Electron
Write-Host "Building Electron..." -ForegroundColor Yellow
Set-Location electron
npm run build
Set-Location ..

# Start API server in background
Write-Host "Starting API server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd website; npm run dev"

# Wait a bit for server to start
Start-Sleep -Seconds 5

# Start Electron
Write-Host "Starting Electron..." -ForegroundColor Green
Set-Location electron
npm start










