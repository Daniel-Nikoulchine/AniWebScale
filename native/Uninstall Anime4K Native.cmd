@echo off
setlocal
title AniWebScale Native Uninstaller

set "UNINSTALLER=%~dp0scripts\uninstall-native-host.ps1"
if not exist "%UNINSTALLER%" (
  echo ERROR: scripts\uninstall-native-host.ps1 is missing.
  pause
  exit /b 2
)

echo Uninstalling AniWebScale Native for the current Windows user...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UNINSTALLER%"
if errorlevel 1 (
  echo.
  echo Uninstallation failed. See the error above.
  pause
  exit /b 1
)

echo.
echo AniWebScale Native was removed.
pause
