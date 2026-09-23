# -*- coding: utf-8 -*-
"""
Binance REST Proxy with Connection Pooling & Multi-Tier Caching
"""
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .catalog import WATCHLIST_CATALOG, FALLBACK_PRICES

_http = requests.Session()
_retry = Retry(total=2, backoff_factor=0.2,
               status_forcelist=[429, 500, 502, 503, 504],
               allowed_methods=["GET"])
_http.mount("https://", HTTPAdapter(max_retries=_retry, pool_connections=4, pool_maxsize=16))
_http.mount("http://",  HTTPAdapter(max_retries=_retry, pool_connections=2, pool_maxsize=8))

_watchlist_cache = [None, 0]
_ticker_cache = {}
_depth_cache = {}
_kline_cache = {}

def get_watchlist_data():
    global _watchlist_cache
    now = time.time()
    if _watchlist_cache[0] and now - _watchlist_cache[1] < 0.8:
        return _watchlist_cache[0]
    try:
        r = _http.get("https://fapi.binance.com/fapi/v1/ticker/24hr", timeout=3)
        all_tickers = {item["symbol"]: item for item in r.json()} if r.status_code == 200 else {}
        result = []
        for item in WATCHLIST_CATALOG:
            sym = item["symbol"]
            t = all_tickers.get(sym)
            if t:
                result.append({
                    "symbol": sym,
                    "display": item["display"],
                    "name": item["name"],
                    "category": item["category"],
                    "precision": item["precision"],
                    "lastPrice": float(t.get("lastPrice", 0)),
                    "priceChangePercent": float(t.get("priceChangePercent", 0)),
                    "highPrice": float(t.get("highPrice", 0)),
                    "lowPrice": float(t.get("lowPrice", 0)),
                    "quoteVolume": float(t.get("quoteVolume", 0)),
                })
            else:
                fb = FALLBACK_PRICES.get(sym, 1.0)
                result.append({
                    "symbol": sym,
                    "display": item["display"],
                    "name": item["name"],
                    "category": item["category"],
                    "precision": item["precision"],
                    "lastPrice": fb,
                    "priceChangePercent": 0.0,
                    "highPrice": fb * 1.02,
                    "lowPrice": fb * 0.98,
                    "quoteVolume": 0.0,
                })
        _watchlist_cache = [result, now]
        return result
    except Exception:
        if _watchlist_cache[0]:
            return _watchlist_cache[0]
        return []

def get_ticker24h_data(sym):
    now = time.time()
    if sym in _ticker_cache:
        data, ts = _ticker_cache[sym]
        if now - ts < 0.25:
            return data
    try:
        if sym == "LRCUSDT":
            r = _http.get("https://api.bybit.com/v5/market/tickers", params={"category": "linear", "symbol": "LRCUSDT"}, timeout=3).json()
            items = r.get("result", {}).get("list", [])
            if items:
                it = items[0]
                data = {
                    "symbol": "LRCUSDT",
                    "lastPrice": it.get("lastPrice", "0.00917"),
                    "priceChangePercent": str(round(float(it.get("price24hPcnt", "0.0")) * 100.0, 2)),
                    "highPrice": it.get("highPrice24h", "0.0095"),
                    "lowPrice": it.get("lowPrice24h", "0.0089"),
                    "volume": it.get("volume24h", "1000000.00"),
                    "quoteVolume": it.get("turnover24h", "1500000.00")
                }
                _ticker_cache[sym] = (data, now)
                return data
        else:
            r = _http.get("https://fapi.binance.com/fapi/v1/ticker/24hr", params={"symbol": sym}, timeout=3).json()
            if "lastPrice" in r:
                _ticker_cache[sym] = (r, now)
                return r
    except Exception:
        pass
    fallback_p = FALLBACK_PRICES.get(sym, 100.00)
    return {"symbol": sym, "lastPrice": str(fallback_p), "priceChangePercent": "0.00", "highPrice": str(fallback_p * 1.02), "lowPrice": str(fallback_p * 0.98)}

def get_depth_data(sym, limit=100):
    if limit not in [5, 10, 20, 50, 100, 500, 1000]:
        limit = 100
    cache_key = f"{sym}_{limit}"
    now = time.time()
    if cache_key in _depth_cache:
        data, ts = _depth_cache[cache_key]
        if now - ts < 0.20:
            return data
    try:
        if sym == "LRCUSDT":
            r = _http.get("https://api.bybit.com/v5/market/orderbook", params={"category": "linear", "symbol": "LRCUSDT", "limit": limit}, timeout=3).json()
            res = r.get("result", {})
            bids = [[item[0], item[1]] for item in res.get("b", [])]
            asks = [[item[0], item[1]] for item in res.get("a", [])]
            data = {"lastUpdateId": int(now * 1000), "bids": bids, "asks": asks}
            _depth_cache[cache_key] = (data, now)
            return data
        else:
            r = _http.get("https://fapi.binance.com/fapi/v1/depth", params={"symbol": sym, "limit": limit}, timeout=3).json()
            _depth_cache[cache_key] = (r, now)
            return r
    except Exception:
        pass
    if cache_key in _depth_cache:
        return _depth_cache[cache_key][0]
    return {"bids": [], "asks": []}

def get_klines_data(sym, interval, limit=1000):
    limit = max(10, min(1000, limit))
    cache_key = f"{sym}_{interval}_{limit}"
    now = time.time()
    if cache_key in _kline_cache:
        data, ts = _kline_cache[cache_key]
        if now - ts < 0.5:
            return data
    try:
        if sym == "LRCUSDT":
            res = _http.get("https://api.bybit.com/v5/market/kline", params={"category": "linear", "symbol": "LRCUSDT", "interval": "1", "limit": str(limit)}, timeout=4).json()
            raw = res.get("result", {}).get("list", [])
            candles = []
            for b in reversed(raw):
                candles.append({
                    "time": int(b[0]) // 1000,
                    "open": float(b[1]),
                    "high": float(b[2]),
                    "low": float(b[3]),
                    "close": float(b[4]),
                    "volume": float(b[5])
                })
            if candles:
                _kline_cache[cache_key] = (candles, now)
                return candles
        else:
            endpoints = [
                "https://fapi.binance.com",
                "https://fapi1.binance.com",
                "https://fapi2.binance.com",
                "https://fapi3.binance.com",
            ]
            for ep in endpoints:
                try:
                    res = _http.get(f"{ep}/fapi/v1/klines", params={"symbol": sym, "interval": interval, "limit": limit}, timeout=2.5)
                    if res.status_code == 200:
                        raw = res.json()
                        if isinstance(raw, list) and raw and isinstance(raw[0], list):
                            candles = [
                                {
                                    "time": int(b[0]) // 1000,
                                    "open": float(b[1]),
                                    "high": float(b[2]),
                                    "low": float(b[3]),
                                    "close": float(b[4]),
                                    "volume": float(b[5])
                                }
                                for b in raw
                                if len(b) >= 6 and float(b[1]) > 0 and float(b[2]) >= float(b[3])
                            ]
                            if candles:
                                _kline_cache[cache_key] = (candles, now)
                                return candles
                except Exception:
                    continue
    except Exception:
        pass
    if cache_key in _kline_cache:
        return _kline_cache[cache_key][0]
    return []
