@echo off
setlocal EnableExtensions
title CUAC Local Accounts

cd /d "%~dp0"
if errorlevel 1 goto project_missing

where node >nul 2>&1
if errorlevel 1 goto node_missing

where npm >nul 2>&1
if errorlevel 1 goto npm_missing

if not exist ".cuac-local\runtime.json" goto state_missing

call npm run local:credentials
set "CUAC_EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %CUAC_EXIT_CODE%

:project_missing
echo The CUAC frontend directory could not be opened from %~dp0.
goto failed

:node_missing
echo Node.js was not found. Install Node.js 22.13 or newer, then run this file again.
goto failed

:npm_missing
echo npm was not found. Repair the Node.js installation, then run this file again.
goto failed

:state_missing
echo Local accounts do not exist yet.
echo Run start-cuac-local.bat once to provision PostgreSQL and the synthetic accounts.
goto failed

:failed
echo.
pause
exit /b 1
