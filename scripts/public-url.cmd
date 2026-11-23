@echo off
rem Reconfigura la URL publica sin depender de la politica de ejecucion de PowerShell.
rem Uso:  scripts\public-url.cmd          (o doble clic)
rem       scripts\public-url.cmd -Telegram
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0public-url.ps1" %*
set CODIGO=%ERRORLEVEL%
endlocal & exit /b %CODIGO%
