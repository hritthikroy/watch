# -*- coding: utf-8 -*-
"""
Paper Trading Portfolio Manager, Margin Ledger & Execution Engine
"""
import os
import json
import time
from pathlib import Path
from datetime import datetime

PORTFOLIO_FILE = Path(r"c:\tradebot\BINANCE_SYSTEM\logs\binance_demo_portfolio.json")

def load_portfolio_state():
    if PORTFOLIO_FILE.exists():
        try:
            with open(PORTFOLIO_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # If file doesn't exist, initialize and return state
    return reset_portfolio_state()

def save_portfolio_state(state):
    PORTFOLIO_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PORTFOLIO_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def reset_portfolio_state():
    initial_state = {
        "wallet_balance": 15.00,
        "safe_vault": 0.0,
        "total_equity": 15.00,
        "peak_equity": 15.00,
        "max_drawdown_usd": 0.0,
        "max_drawdown_pct": 0.0,
        "current_session_id": -1,
        "current_session_name": "Reset Initialized",
        "session_pnl": 0.0,
        "session_trades_count": 0,
        "session_locked": False,
        "stats": {
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "breakevens": 0,
            "decided_win_rate_pct": 0.0,
            "non_losing_rate_pct": 0.0,
            "profit_factor": 0.0,
            "total_fees_paid": 0.0,
            "total_net_profit": 0.0
        },
        "active_positions": [],
        "closed_trades": [],
        "equity_history": [{"timestamp": datetime.now().strftime("%H:%M:%S"), "equity": 15.00}]
    }
    save_portfolio_state(initial_state)
    return initial_state
