' ============================================
'  BARATELLI — Arranque automático silencioso
'  Este script arranca Node y ngrok sin mostrar
'  ventanas molestas al iniciar Windows.
'
'  INSTALACIÓN:
'  1. Editá la variable BACKEND_PATH abajo
'  2. Copiá este archivo .vbs a:
'     C:\Users\TU_USUARIO\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
'  3. Reiniciá la PC — arranca solo.
' ============================================

Dim BACKEND_PATH
' ← CAMBIÁ ESTA RUTA por donde tenés el proyecto
BACKEND_PATH = "C:\Users\TU_USUARIO\Desktop\BaratelliMayorista-main\backend"

Dim oShell
Set oShell = CreateObject("WScript.Shell")

' Arrancar Node.js (minimizado, sin robar foco)
oShell.Run "cmd /c cd /d """ & BACKEND_PATH & """ && node src/server.js >> """ & BACKEND_PATH & "\server.log"" 2>&1", 7, False

' Esperar 4 segundos a que Node levante
WScript.Sleep 4000

' Arrancar ngrok (minimizado)
oShell.Run "cmd /c ngrok http 3001 >> """ & BACKEND_PATH & "\ngrok.log"" 2>&1", 7, False

Set oShell = Nothing
