@echo off
start "Luma catalog rankings" /b node scripts\run-videocelebs-rankings.mjs ^> data\staging\videocelebs\rankings-import.log 2^> data\staging\videocelebs\rankings-import-error.log
