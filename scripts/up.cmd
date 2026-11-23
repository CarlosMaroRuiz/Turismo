@echo off
rem Levanta todo el proyecto sin depender de la politica de ejecucion de PowerShell.
rem Uso:  scripts\up.cmd          (o doble clic)
rem       scripts\up.cmd -NoTelegram
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0up.ps1" %*
set CODIGO=%ERRORLEVEL%
endlocal & exit /b %CODIGO%
