@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org
  pause
  exit /b 1
)

for /f %%p in ('node -p "require('./data/config.json').port"') do set PORT=%%p

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo Porta %PORT% ja esta em uso. Troque "port" em data\config.json.
  pause
  exit /b 1
)

start "" http://localhost:%PORT%
node server.js
pause
