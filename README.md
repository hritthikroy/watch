# Watch WebTrader

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Watch%20WebTrader-0ECB81.svg)](https://github.com/hritthikroy/watch)

A modular, high-speed institutional WebTrader execution terminal engineered for cryptocurrency perpetual markets. Built by **Watch**, featuring sub-millisecond market visualization, on-chart interactive order placement, and live WebSocket trade stream processing.

---

## Key Features

- **Ultra-Low Latency Market Streaming:** Direct Binance perpetual WebSocket feeds delivering tick-by-tick real-time order matching with sub-millisecond propagation.
- **On-Chart Interactive Order Execution:** Visual, draggable Take-Profit (TP) and Stop-Loss (SL) lines with real-time floating PnL calculation directly on the chart canvas.
- **Multi-Asset Perpetual Watchlist:** Instant switching across 37 major crypto perpetual pairs (BTC, ETH, SOL, BNB, etc.) with zero-lag atomic series reloading.
- **Modular Microservice Backend:** Cleanly structured Python Flask and REST proxy with multi-tier connection pooling and failover gateway resilience.
- **TradingView Integration Ready:** Built-in adapter architecture ready for custom Datafeed integration with the TradingView Advanced Charts library.

---

## Architecture Overview

```
watch/
├── binance_mt4_web_terminal.py   # Main server entry point
├── build_terminal_bundle.py      # Client module bundler
├── requirements.txt              # Core dependencies
├── server/                       # Modular backend microservices
│   ├── app.py                    # Flask application factory
│   ├── binance_proxy.py          # Multi-gateway pooled REST proxy
│   ├── catalog.py                # Asset specifications & tick sizes
│   ├── portfolio.py              # Position ledger & margin accounting
│   ├── rust_client.py            # High-speed IPC bridge
│   └── routes/                   # API blueprints
├── static/                       # Client assets
│   ├── css/                      # Modular styling & dark-mode themes
│   ├── js/                       # Modular JS trading engine
│   └── sound/                    # Execution audio notifications
└── templates/                    # Jinja2 HTML templates
    └── terminal.html             # Main terminal layout
```

---

## Quick Start

### 1. Prerequisites
- Python 3.9 or higher
- Modern web browser (Chrome, Edge, Firefox, Brave)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/hritthikroy/watch.git
cd watch
pip install -r requirements.txt
```

### 3. Run the Terminal
Start the local server:
```bash
python binance_mt4_web_terminal.py
```
Or double-click `run_terminal.bat` on Windows.

Open your browser and navigate to:
```
http://127.0.0.1:5000/demo
```

---

## Company
**Watch** &mdash; Professional Crypto Market Execution & Trading Systems.

## License
MIT License. Open for development and integration.
