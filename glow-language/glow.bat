@echo off
:: glow.bat — run a .glow file on Windows
:: Usage: glow myfile.glow
node "%~dp0dist\glow.js" %*
