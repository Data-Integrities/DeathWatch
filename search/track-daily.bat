@echo off
cd /d C:\dev\obit-projects\obit-person\search
echo [%date% %time%] Starting daily track run >> search_test_data\track-log.txt
call npm run track:run >> search_test_data\track-log.txt 2>&1
call npm run track:report >> search_test_data\track-log.txt 2>&1
echo [%date% %time%] Finished >> search_test_data\track-log.txt
