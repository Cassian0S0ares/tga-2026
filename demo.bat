@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org
  pause
  exit /b 1
)

for /f %%p in ('node -p "require('./data/config.json').port + 1"') do set PORT=%%p

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo Porta %PORT% ja esta em uso. Feche o outro modo demo ou troque "port" em data\config.json.
  pause
  exit /b 1
)

echo Modo demo: palpites aleatorios em data\db.demo.json. O bolao real nao e alterado.
start "" http://localhost:%PORT%
node server.js --demo
pause
