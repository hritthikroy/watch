# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
from ..catalog import validate_symbol, check_rate_limit
from ..binance_proxy import get_watchlist_data, get_ticker24h_data, get_depth_data, get_klines_data
from ..rust_client import get_rust_daemon_status
from binance_mt4_institutional_bridge import BinanceMT4InstitutionalBridge

market_bp = Blueprint("market", __name__)
bridge = BinanceMT4InstitutionalBridge(is_testnet=True)

@market_bp.route("/api/watchlist")
def api_watchlist():
    return jsonify(get_watchlist_data())

@market_bp.route("/api/ticker24h")
def api_ticker24h():
    sym = request.args.get("symbol", "BTCUSDT")
    return jsonify(get_ticker24h_data(sym))

@market_bp.route("/api/depth")
def api_depth():
    sym = request.args.get("symbol", "BTCUSDT")
    limit = int(request.args.get("limit", 100))
    return jsonify(get_depth_data(sym, limit))

@market_bp.route("/api/ticker")
def api_ticker():
    if not check_rate_limit(request.remote_addr):
        return jsonify({"error": "Rate limit exceeded"}), 429
    sym = request.args.get("symbol", "BTCUSDT")
    if not validate_symbol(sym):
        return jsonify({"error": "Invalid symbol"}), 400
    data = bridge.get_live_market_depth(sym)
    return jsonify(data)

@market_bp.route("/api/klines")
def api_klines():
    sym = request.args.get("symbol", "BTCUSDT")
    interval = request.args.get("interval", "1m")
    limit = int(request.args.get("limit", 1000))
    return jsonify(get_klines_data(sym, interval, limit))

@market_bp.route("/api/rust/status")
def api_rust_status():
    data, code = get_rust_daemon_status()
    return jsonify(data), code
