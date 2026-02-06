import MetaTrader5 as mt5
import sys

if not mt5.initialize():
    print("MT5 Init failed")
    sys.exit(1)

symbols = ["BTCUSDm", "XAUUSDm", "EURUSDm"]
for s in symbols:
    info = mt5.symbol_info(s)
    if info:
        print(f"Symbol {s}: filling_mode={info.filling_mode}")
    else:
        print(f"Symbol {s} not found")

mt5.shutdown()
