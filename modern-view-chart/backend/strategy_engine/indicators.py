import pandas as pd
import numpy as np
import math

def calculate_hull(df, period=25):
    # HMA = WMA(2*WMA(n/2) - WMA(n)), sqrt(n))
    
    def wma(series, length):
        weights = np.arange(1, length + 1)
        return series.rolling(length).apply(lambda x: np.dot(x, weights) / weights.sum(), raw=True)

    half_length = int(period / 2)
    sqrt_length = int(math.sqrt(period))
    
    wma_half = wma(df['close'], half_length)
    wma_full = wma(df['close'], period)
    
    raw_hma = 2 * wma_half - wma_full
    hma = wma(raw_hma, sqrt_length)
    
    return hma

def calculate_all(df):
    """
    Calculates RSI(14) and Hull(25) for the dataframe.
    """
    # Create a copy to avoid SettingWithCopy warnings
    df = df.copy()
    
    # RSI 14
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    
    # Hull 25
    df['hull25'] = calculate_hull(df, 25)
    
    return df
