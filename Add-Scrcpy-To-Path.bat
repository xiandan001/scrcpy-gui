@echo off
chcp 65001 >nul 2>&1
title Add scrcpy to System PATH

net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

set "DIR_NAME=scrcpy-win64"
set "TARGET_DIR=%~dp0%DIR_NAME%"

if not exist "%TARGET_DIR%\scrcpy.exe" (
    echo [ERROR] Cannot find %DIR_NAME% in current directory.
    echo Please make sure this script is placed in the same folder as %DIR_NAME%.
    pause
    exit /b 1
)

set "TARGET_DIR_CLEAN=%TARGET_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$dir = '%TARGET_DIR_CLEAN%';" ^
    "$current = [System.Environment]::GetEnvironmentVariable('Path', 'Machine');" ^
    "$dirs = $current -split ';' | Where-Object { $_ -ne '' };" ^
    "if ($dirs -contains $dir) {" ^
    "    Write-Host '';" ^
    "    Write-Host '[INFO] scrcpy path is already in system PATH.';" ^
    "    Write-Host '  Path:' $dir;" ^
    "    Write-Host '';" ^
    "    Write-Host 'No changes needed.';" ^
    "} else {" ^
    "    $newPath = $current.TrimEnd(';') + ';' + $dir;" ^
    "    [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine');" ^
    "    Write-Host '';" ^
    "    Write-Host '============================================';" ^
    "    Write-Host '  SUCCESS';" ^
    "    Write-Host '============================================';" ^
    "    Write-Host '';" ^
    "    Write-Host 'Added to system PATH:';" ^
    "    Write-Host '  ' $dir;" ^
    "    Write-Host '';" ^
    "    Write-Host 'The system PATH has been updated.';" ^
    "    Write-Host 'Newly opened terminal windows will take effect.';" ^
    "    Write-Host '============================================';" ^
    "}"

echo.
pause
