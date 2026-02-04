import MetaTrader5 as mt5
import datetime
import time

if not mt5.initialize():
    print("Failed to initialize MT5")
    quit()

terminal_info = mt5.terminal_info()
print(f"Terminal Info: {terminal_info}")

# Get current time from MT5
tick = mt5.symbol_info_tick("XAUUSDm")
if tick:
    mt5_time = datetime.datetime.fromtimestamp(tick.time)
    local_time = datetime.datetime.now()
    utc_time = datetime.datetime.utcnow()
    
    print(f"MT5 Broker Time: {mt5_time}")
    print(f"Local System Time: {local_time}")
    print(f"UTC Time: {utc_time}")
    
    diff_local = (mt5_time - local_time).total_seconds()
    diff_utc = (mt5_time - utc_time).total_seconds()
    
    print(f"Difference (MT5 - Local): {diff_local} seconds")
    print(f"Difference (MT5 - UTC): {diff_utc} seconds")

# Check rates for M15
rates = mt5.copy_rates_from_pos("XAUUSDm", mt5.TIMEFRAME_M15, 0, 2)
if rates is not None and len(rates) >= 2:
    r1 = rates[0]['time']
    r2 = rates[1]['time']
    print(f"M15 Rate 1 Time: {datetime.datetime.fromtimestamp(r1)}")
    print(f"M15 Rate 2 Time: {datetime.datetime.fromtimestamp(r2)}")
    print(f"M15 Spacing: {r2 - r1} seconds (Expected 900)")

mt5.shutdown()
