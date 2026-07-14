@echo off
REM Self-elevating launcher: registers the daily 07:45 scheduled task.
REM Double-click this file (or run it), then click "Yes" on the UAC prompt.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-File','%~dp0setup.ps1'"
