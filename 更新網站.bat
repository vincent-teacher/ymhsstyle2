@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   楊梅高中梅岡風 網站更新工具
echo   會處理「梅岡風」資料夾中新增或變更的版面
echo ==========================================
set PYTHONIOENCODING=utf-8
python toolsuild.py
if errorlevel 1 (
  echo.
  echo 發生錯誤！請確認已安裝 Python 3 與 Pillow（pip install pillow）
)
echo.
echo 完成後請在瀏覽器重新整理網頁。
pause
