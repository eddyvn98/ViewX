@echo off
echo Starting Strategy Engine...
python -m pip install -r backend\strategy_engine\requirements.txt
python backend\strategy_engine\main.py
pause
