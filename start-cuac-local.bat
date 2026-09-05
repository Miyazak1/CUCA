@echo off
setlocal EnableExtensions
title CUAC Local Platform - 127.0.0.1:52118
set "CUAC_LAUNCH_MODE=start"
if /I "%~1"=="--check" set "CUAC_LAUNCH_MODE=check"

cd /d "%~dp0"
if errorlevel 1 goto project_missing

echo.
echo CUAC Local Platform
echo App:      http://127.0.0.1:52118/home-v3.html
echo Postgres: 127.0.0.1:62251
echo.

where node >nul 2>&1
if errorlevel 1 goto node_missing

where npm >nul 2>&1
if errorlevel 1 goto npm_missing

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)"
if errorlevel 1 goto node_version

where docker >nul 2>&1
if errorlevel 1 goto docker_missing

docker version --format "{{.Server.Version}}" >nul 2>&1
if errorlevel 1 goto docker_stopped

if not exist "node_modules\vinext\dist\cli.js" goto dependencies_missing

set "CUAC_LOCAL_APP_PORT=52118"
set "CUAC_LOCAL_PG_PORT=62251"

if exist ".cuac-local\runtime.json" (
  node -e "const fs=require('node:fs'); const s=JSON.parse(fs.readFileSync('.cuac-local/runtime.json','utf8')); if(s.applicationPort!==52118||s.postgresPort!==62251){console.error('Existing CUAC local state uses app port '+s.applicationPort+' and PostgreSQL port '+s.postgresPort+'.'); process.exit(1)}"
  if errorlevel 1 goto port_mismatch
)

if /I "%CUAC_LAUNCH_MODE%"=="check" goto check_ok

echo Starting the owned local PostgreSQL container, migrations, seed, and CUAC server...
echo Keep this window open while using CUAC.
echo Press Ctrl+C once to stop the application server.
echo.

call npm run dev:local
set "CUAC_EXIT_CODE=%ERRORLEVEL%"
echo.
if "%CUAC_EXIT_CODE%"=="0" (
  echo CUAC application server stopped. Local PostgreSQL data was retained.
) else (
  echo CUAC local startup failed with exit code %CUAC_EXIT_CODE%.
  echo Read the error above; no remote database was selected and no local data was deleted.
)
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

:node_version
echo CUAC requires Node.js 22.13 or newer. Current version:
node --version
goto failed

:docker_missing
echo Docker was not found. Install and start Docker Desktop, then run this file again.
goto failed

:docker_stopped
echo Docker Desktop is installed but its Linux engine is not ready.
echo Start Docker Desktop, wait until it reports ready, then run this file again.
goto failed

:dependencies_missing
echo Project dependencies are missing.
echo Open a terminal in "%~dp0" and run: npm install
goto failed

:port_mismatch
echo CUAC refused to start on a different port.
echo Expected app port 52118 and PostgreSQL port 62251.
goto failed

:check_ok
echo Local startup prerequisites and pinned ports are ready.
exit /b 0

:failed
echo.
if /I "%CUAC_LAUNCH_MODE%"=="check" exit /b 1
pause
exit /b 1
