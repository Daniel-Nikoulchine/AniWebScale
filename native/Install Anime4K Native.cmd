@echo off
setlocal
title AniWebScale Native Installer

set "NATIVE_ROOT=%~dp0"
set "INSTALLER=%NATIVE_ROOT%scripts\install-native-host.ps1"
set "BINARIES=%NATIVE_ROOT%."

if not exist "%INSTALLER%" (
  echo ERROR: scripts\install-native-host.ps1 is missing.
  echo Extract the complete native ZIP before running this installer.
  pause
  exit /b 2
)

if not exist "%BINARIES%\Anime4K.NativeHost.exe" set "BINARIES=%NATIVE_ROOT%build\bin\Release"
if not exist "%BINARIES%\Anime4K.NativeHost.exe" (
  echo ERROR: The native binaries are missing.
  echo Build the Release configuration or extract the complete native ZIP.
  pause
  exit /b 3
)

echo Installing AniWebScale Native for the current Windows user...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER%" -BinaryDirectory "%BINARIES%"
if errorlevel 1 (
  echo.
  echo Installation failed. See the error above.
  pause
  exit /b 1
)

echo.
echo Installation complete. Restart Chrome or Firefox now.
pause
