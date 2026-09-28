@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 網站已啟動： http://localhost:8792/楊梅高中梅岡風/
start "" "http://localhost:8792/%E6%A5%8A%E6%A2%85%E9%AB%98%E4%B8%AD%E6%A2%85%E5%B2%A1%E9%A2%A8/"
python -m http.server 8792
