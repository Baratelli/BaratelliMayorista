@echo off
title Baratelli - Servidor

echo.
echo  ==========================================
echo   BARATELLI MAYORISTA - Iniciando servidor
echo  ==========================================
echo.

REM ── Verificar que Node esté instalado ──
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js no está instalado o no está en el PATH.
    pause
    exit
)

REM ── Ruta al backend ──
REM  Cambiá esta ruta si tu proyecto está en otro lugar
set BACKEND_PATH=%~dp0backend

REM ── Arrancar Node.js en una ventana nueva ──
echo  [1/2] Iniciando servidor Node.js...
start "Baratelli - Node" cmd /k "cd /d %BACKEND_PATH% && node src/server.js"

REM ── Esperar 3 segundos a que Node levante ──
timeout /t 3 /nobreak >nul

REM ── Arrancar ngrok en una ventana nueva ──
echo  [2/2] Iniciando ngrok...
start "Baratelli - ngrok" cmd /k "ngrok http 3001"

echo.
echo  ✓ Listo. Se abrieron dos ventanas:
echo    - "Baratelli - Node"  → el servidor de la tienda
echo    - "Baratelli - ngrok" → el tunel a internet
echo.
echo  Cuando ngrok termine de cargar, copiá la URL
echo  que dice "Forwarding" (ej: https://xxxx.ngrok-free.app)
echo  y pegala en admin.html e index.html donde dice API_URL.
echo.
echo  Podés cerrar ESTA ventana. Las otras deben quedar abiertas.
echo.
pause
