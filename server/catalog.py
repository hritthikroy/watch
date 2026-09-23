# -*- coding: utf-8 -*-
"""
Market Catalog, Contract Specifications and Input Validation
"""
import re
from collections import defaultdict
from datetime import datetime, timedelta

WATCHLIST_CATALOG = [
    {"symbol": "BTCUSDT",    "display": "BTC/USDT",    "name": "Bitcoin",       "category": "major",  "precision": 1},
    {"symbol": "ETHUSDT",    "display": "ETH/USDT",    "name": "Ethereum",      "category": "major",  "precision": 2},
    {"symbol": "SOLUSDT",    "display": "SOL/USDT",    "name": "Solana",        "category": "major",  "precision": 2},
    {"symbol": "BNBUSDT",    "display": "BNB/USDT",    "name": "BNB",           "category": "major",  "precision": 2},
    {"symbol": "XRPUSDT",    "display": "XRP/USDT",    "name": "Ripple",        "category": "major",  "precision": 4},
    {"symbol": "AVAXUSDT",   "display": "AVAX/USDT",   "name": "Avalanche",     "category": "major",  "precision": 2},
    {"symbol": "LINKUSDT",   "display": "LINK/USDT",   "name": "Chainlink",     "category": "major",  "precision": 3},
    {"symbol": "NEARUSDT",   "display": "NEAR/USDT",   "name": "NEAR Protocol", "category": "layer1", "precision": 3},
    {"symbol": "ADAUSDT",    "display": "ADA/USDT",    "name": "Cardano",       "category": "layer1", "precision": 4},
    {"symbol": "SUIUSDT",    "display": "SUI/USDT",    "name": "Sui",           "category": "layer1", "precision": 4},
    {"symbol": "DOGEUSDT",   "display": "DOGE/USDT",   "name": "Dogecoin",      "category": "major",  "precision": 5},
    {"symbol": "DOTUSDT",    "display": "DOT/USDT",    "name": "Polkadot",      "category": "layer1", "precision": 3},
    {"symbol": "LTCUSDT",    "display": "LTC/USDT",    "name": "Litecoin",      "category": "major",  "precision": 2},
    {"symbol": "ARBUSDT",    "display": "ARB/USDT",    "name": "Arbitrum",      "category": "alts",   "precision": 4},
    {"symbol": "OPUSDT",     "display": "OP/USDT",     "name": "Optimism",      "category": "alts",   "precision": 4},
    {"symbol": "SEIUSDT",    "display": "SEI/USDT",    "name": "Sei",           "category": "layer1", "precision": 4},
    {"symbol": "INJUSDT",    "display": "INJ/USDT",    "name": "Injective",     "category": "layer1", "precision": 3},
    {"symbol": "WIFUSDT",    "display": "WIF/USDT",    "name": "dogwifhat",     "category": "alts",   "precision": 4},
    {"symbol": "PENDLEUSDT", "display": "PENDLE/USDT", "name": "Pendle",        "category": "defi",   "precision": 3},
    {"symbol": "JUPUSDT",    "display": "JUP/USDT",    "name": "Jupiter",       "category": "defi",   "precision": 4},
    {"symbol": "RENDERUSDT", "display": "RENDER/USDT", "name": "Render",        "category": "alts",   "precision": 3},
    {"symbol": "AAVEUSDT",   "display": "AAVE/USDT",   "name": "Aave",          "category": "defi",   "precision": 2},
    {"symbol": "UNIUSDT",    "display": "UNI/USDT",    "name": "Uniswap",       "category": "defi",   "precision": 3},
    {"symbol": "CRVUSDT",    "display": "CRV/USDT",    "name": "Curve DAO",     "category": "defi",   "precision": 4},
    {"symbol": "DYDXUSDT",   "display": "DYDX/USDT",   "name": "dYdX",          "category": "defi",   "precision": 3},
    {"symbol": "ENAUSDT",    "display": "ENA/USDT",    "name": "Ethena",        "category": "defi",   "precision": 4},
    {"symbol": "WLDUSDT",    "display": "WLD/USDT",    "name": "Worldcoin",     "category": "alts",   "precision": 3},
    {"symbol": "PYTHUSDT",   "display": "PYTH/USDT",   "name": "Pyth Network",  "category": "alts",   "precision": 4},
    {"symbol": "GMXUSDT",    "display": "GMX/USDT",    "name": "GMX",           "category": "defi",   "precision": 2},
    {"symbol": "TIAUSDT",    "display": "TIA/USDT",    "name": "Celestia",      "category": "layer1", "precision": 3},
    {"symbol": "ZROUSDT",    "display": "ZRO/USDT",    "name": "LayerZero",     "category": "alts",   "precision": 3},
    {"symbol": "APEUSDT",    "display": "APE/USDT",    "name": "ApeCoin",       "category": "alts",   "precision": 4},
    {"symbol": "GALAUSDT",   "display": "GALA/USDT",   "name": "Gala",          "category": "alts",   "precision": 5},
    {"symbol": "SANDUSDT",   "display": "SAND/USDT",   "name": "The Sandbox",   "category": "alts",   "precision": 4},
    {"symbol": "MANAUSDT",   "display": "MANA/USDT",   "name": "Decentraland",  "category": "alts",   "precision": 4},
    {"symbol": "LRCUSDT",    "display": "LRC/USDT",    "name": "Loopring",      "category": "defi",   "precision": 4},
    {"symbol": "STXUSDT",    "display": "STX/USDT",    "name": "Stacks",        "category": "layer1", "precision": 4}
]

WATCHLIST_SYMBOLS = [item["symbol"] for item in WATCHLIST_CATALOG]

FALLBACK_PRICES = {
    "BTCUSDT": 67500.00, "ETHUSDT": 2650.00, "SOLUSDT": 155.00, "BNBUSDT": 580.00,
    "XRPUSDT": 0.5850, "AVAXUSDT": 28.50, "LINKUSDT": 11.20, "NEARUSDT": 4.80,
    "ADAUSDT": 0.3550, "SUIUSDT": 1.7500, "DOGEUSDT": 0.10500, "DOTUSDT": 4.25,
    "LTCUSDT": 65.00, "ARBUSDT": 0.5400, "OPUSDT": 1.5200, "SEIUSDT": 0.4200,
    "INJUSDT": 21.50, "WIFUSDT": 2.3500, "PENDLEUSDT": 4.150, "JUPUSDT": 0.8200,
    "RENDERUSDT": 5.60, "AAVEUSDT": 155.00, "UNIUSDT": 7.80, "CRVUSDT": 0.2850,
    "DYDXUSDT": 1.15, "ENAUSDT": 0.3850, "WLDUSDT": 1.95, "PYTHUSDT": 0.3250,
    "GMXUSDT": 24.50, "TIAUSDT": 5.80, "ZROUSDT": 3.95, "APEUSDT": 0.7500,
    "GALAUSDT": 0.02250, "SANDUSDT": 0.2750, "MANAUSDT": 0.2950, "LRCUSDT": 0.00917,
    "STXUSDT": 1.6500,
}

rate_limits = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 100  # requests per window

def check_rate_limit(client_ip):
    now = datetime.now()
    rate_limits[client_ip] = [
        req_time for req_time in rate_limits[client_ip]
        if now - req_time < timedelta(seconds=RATE_LIMIT_WINDOW)
    ]
    if len(rate_limits[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    rate_limits[client_ip].append(now)
    return True

def validate_symbol(symbol):
    if not symbol or not isinstance(symbol, str):
        return False
    return bool(re.match(r'^[A-Z]{6,10}$', symbol))

def validate_price(price):
    try:
        p = float(price)
        return p > 0
    except (ValueError, TypeError):
        return False

def validate_quantity(quantity):
    try:
        q = float(quantity)
        return q > 0
    except (ValueError, TypeError):
        return False
