# -*- coding: utf-8 -*-
"""
Titan 6-Brain Institutional Binance Live Web Terminal
======================================================
Modular High-Speed Web Trading Terminal Entry Point.
Core logic is partitioned into clean, professional modules under server/:
- server/catalog.py     : Contract specs, fallback prices, rate limiting
- server/binance_proxy.py: Connection-pooled REST proxy & caching
- server/portfolio.py   : State ledger, margin calculation, PnL accounting
- server/rust_client.py : Nanosecond IPC & Rust daemon telemetry bridge
- server/routes/        : Web, market, and order API blueprints
"""

import sys
import logging
from pathlib import Path

# Silence noisy loggers
logging.basicConfig(level=logging.ERROR)
logging.getLogger("werkzeug").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.ERROR)

from server.catalog import WATCHLIST_CATALOG, WATCHLIST_SYMBOLS, FALLBACK_PRICES
from server.app import create_app, BINANCE_PRO_TEMPLATE, get_full_template
from server.rust_client import start_rust_ipc_thread

# Create Flask application instance
app = create_app()

if __name__ == "__main__":
    if "unittest" not in sys.modules:
        try:
            log_path = Path(r"logs\web_terminal.log")
            log_path.parent.mkdir(parents=True, exist_ok=True)
            _f_log = open(str(log_path), "a", encoding="utf-8", buffering=1)
            sys.stdout = _f_log
            sys.stderr = _f_log
        except Exception:
            pass

    print("================================================================================")
    print("  [BINANCE FUTURES TITAN 6-BRAIN AUTONOMOUS TRADEX PRO TERMINAL ONLINE]")
    print("================================================================================")
    print("  Local PC Access:          http://127.0.0.1:5000")
    print("  Engine Architecture:      Modular Multi-Threaded Flask + Rust IPC Bridge")
    print("  Rust Daemon Port:         http://127.0.0.1:19899/status")
    print("================================================================================")

    # Start Rust IPC thread
    start_rust_ipc_thread()

    # Start web server
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True, use_reloader=False)
