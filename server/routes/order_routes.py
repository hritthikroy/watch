# -*- coding: utf-8 -*-
import time
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
import threading
from ..catalog import validate_symbol, validate_price, validate_quantity, check_rate_limit
from ..portfolio import PORTFOLIO_FILE, load_portfolio_state, save_portfolio_state, reset_portfolio_state
from ..binance_proxy import get_ticker24h_data, get_watchlist_data
from binance_mt4_institutional_bridge import BinanceMT4InstitutionalBridge, MT4_CONTRACT_SPECS

order_bp = Blueprint("order", __name__)
bridge = BinanceMT4InstitutionalBridge(is_testnet=False)

def evaluate_and_settle_demo_positions(state, live_prices=None):
    """
    Evaluates all active demo positions against live market prices.
    Automatically triggers Stop Loss and Take Profit, banking profits / limiting losses
    and updating the wallet balance, vault, and session statistics.
    """
    if not state:
        return False
    active = state.get("active_positions", [])
    if not active:
        return False

    quotes = {}
    if not live_prices:
        try:
            wl = get_watchlist_data()
            if wl:
                for item in wl:
                    sym = item.get("symbol")
                    p = item.get("lastPrice")
                    if sym and p and float(p) > 0:
                        quotes[sym] = float(p)
        except Exception:
            pass

    remaining = []
    closed_any = False

    for pos in active:
        sym = pos.get("symbol", "BTCUSDT")
        side = pos.get("side", "BUY")
        entry_price = float(pos.get("entry_price", 0.0))
        vol = float(pos.get("volume_lots", 0.01))
        spec = MT4_CONTRACT_SPECS.get(sym, {"lot_size_coins": 1.0, "price_precision": 2})
        contract_size = spec.get("lot_size_coins", 1.0)

        curr_price = None
        if live_prices and sym in live_prices:
            curr_price = float(live_prices[sym])
        elif sym in quotes:
            curr_price = quotes[sym]
        else:
            try:
                t = get_ticker24h_data(sym)
                if t and t.get("lastPrice"):
                    curr_price = float(t.get("lastPrice"))
            except Exception:
                pass

        if not curr_price or curr_price <= 0:
            curr_price = float(pos.get("current_price", entry_price))

        pos["current_price"] = curr_price
        diff = (curr_price - entry_price) if side in ["BUY", "LONG"] else (entry_price - curr_price)
        pos["unrealized_pnl"] = round(diff * vol * contract_size - float(pos.get("fee", 0.015)), 2)

        raw_sl = pos.get("sl_price")
        sl_val = float(raw_sl) if (raw_sl is not None and str(raw_sl).strip() != "" and float(raw_sl) > 0) else None

        raw_tp = pos.get("tp_price") or pos.get("tranches", {}).get("queen", {}).get("tp_price")
        tp_val = float(raw_tp) if (raw_tp is not None and str(raw_tp).strip() != "" and float(raw_tp) > 0) else None

        is_buy = side in ["BUY", "LONG"]
        hit_sl = (sl_val is not None) and (curr_price <= sl_val if is_buy else curr_price >= sl_val)
        hit_tp = (tp_val is not None) and (curr_price >= tp_val if is_buy else curr_price <= tp_val)

        if hit_sl or hit_tp:
            closed_any = True
            close_price = tp_val if hit_tp else sl_val
            exit_diff = (close_price - entry_price) if is_buy else (entry_price - close_price)
            fee = float(pos.get("fee", 0.015))
            final_pnl = round(exit_diff * vol * contract_size - fee, 2)

            vault_sweep = 0.0
            if final_pnl > 0:
                vault_sweep = round(final_pnl * 0.20, 2)
                net_profit = final_pnl - vault_sweep
                state["safe_vault"] = round(state.get("safe_vault", 0.0) + vault_sweep, 2)
                state["wallet_balance"] = round(state.get("wallet_balance", 15.0) + net_profit, 2)
            else:
                state["wallet_balance"] = round(state.get("wallet_balance", 15.0) + final_pnl, 2)

            state["total_equity"] = round(state["wallet_balance"] + state["safe_vault"], 2)
            state["session_pnl"] = round(state.get("session_pnl", 0.0) + final_pnl, 2)

            stats = state.setdefault("stats", {})
            stats["total_trades"] = stats.get("total_trades", 0) + 1
            if final_pnl > 0:
                stats["wins"] = stats.get("wins", 0) + 1
            elif final_pnl < 0:
                stats["losses"] = stats.get("losses", 0) + 1
            else:
                stats["breakevens"] = stats.get("breakevens", 0) + 1

            decided = stats.get("wins", 0) + stats.get("losses", 0)
            stats["decided_win_rate_pct"] = round((stats["wins"] / decided * 100.0), 1) if decided > 0 else 100.0

            exit_reason = f"Take Profit Hit (+${final_pnl:.2f})" if hit_tp else f"Stop Loss Hit (-${abs(final_pnl):.2f})"

            closed_rec = {
                "pos_id": pos.get("pos_id"),
                "symbol": sym,
                "side": side,
                "volume_lots": vol,
                "entry_time": pos.get("entry_time"),
                "closed_time": datetime.now().strftime("%H:%M:%S"),
                "entry_price": entry_price,
                "close_price": close_price,
                "sl_price": sl_val,
                "tp_price": tp_val,
                "total_fee": fee,
                "swap": 0.0,
                "final_net_pnl": final_pnl,
                "exit_reason": exit_reason
            }
            state.setdefault("closed_trades", []).insert(0, closed_rec)
        else:
            remaining.append(pos)

    if closed_any:
        state["active_positions"] = remaining
        save_portfolio_state(state)
        return True
    return False

def _demo_auto_settler_loop():
    while True:
        try:
            state = load_portfolio_state()
            if state and state.get("active_positions"):
                evaluate_and_settle_demo_positions(state)
        except Exception:
            pass
        time.sleep(1.0)

_settler_thread = threading.Thread(target=_demo_auto_settler_loop, daemon=True)
_settler_thread.start()

@order_bp.route("/api/demo/state")
def api_demo_state():
    state = load_portfolio_state()
    if state is not None:
        evaluate_and_settle_demo_positions(state)
        return jsonify(state)
    return jsonify({"error": "Portfolio state initializing"})

@order_bp.route("/api/demo/reset", methods=["POST"])
def api_demo_reset():
    state = reset_portfolio_state()
    return jsonify({"status": "SUCCESS", "message": "Demo portfolio reset to $15.00"})

@order_bp.route("/api/order", methods=["POST"])
def api_order():
    if not check_rate_limit(request.remote_addr):
        return jsonify({"error": "Rate limit exceeded"}), 429
    try:
        req = request.json or {}
        symbol = req.get("symbol", "BTCUSDT")
        cmd = req.get("cmd", "BUY").upper()
        order_type = req.get("order_type", "MARKET").upper()
        volume_lots = float(req.get("volume_lots", 0.01))
        limit_price = req.get("limit_price")
        custom_tp = req.get("tp_price")
        custom_sl = req.get("sl_price")
        
        if not validate_symbol(symbol):
            return jsonify({"error": "Invalid symbol"}), 400
        if cmd not in ["BUY", "SELL"]:
            return jsonify({"error": "Invalid command"}), 400
        if order_type not in ["MARKET", "LIMIT"]:
            return jsonify({"error": "Invalid order type"}), 400
        if not validate_quantity(volume_lots):
            return jsonify({"error": "Invalid volume"}), 400
        if limit_price is not None and not validate_price(limit_price):
            return jsonify({"error": "Invalid limit price"}), 400
        if custom_tp is not None and not validate_price(custom_tp):
            return jsonify({"error": "Invalid TP price"}), 400
        if custom_sl is not None and not validate_price(custom_sl):
            return jsonify({"error": "Invalid SL price"}), 400
        
        raw_sl_pips = req.get("sl_pips")
        sl_pips = int(raw_sl_pips) if (raw_sl_pips is not None and str(raw_sl_pips).strip() != "") else 40
        raw_tp_pips = req.get("tp_pips")
        tp_pips = int(raw_tp_pips) if (raw_tp_pips is not None and str(raw_tp_pips).strip() != "") else 60
        use_3tranches = bool(req.get("use_3tranches", True))
        leverage = int(req.get("leverage", 50))
        
        spec = MT4_CONTRACT_SPECS.get(symbol, MT4_CONTRACT_SPECS.get("BTCUSDT", {"pip_value": 0.1, "price_precision": 1}))
        prec = spec["price_precision"]

        client_price = req.get("current_price") or req.get("client_price") or req.get("price")
        if client_price is not None:
            try:
                client_price = float(client_price)
                if client_price <= 0:
                    client_price = None
            except Exception:
                client_price = None

        if client_price is None:
            try:
                t = get_ticker24h_data(symbol)
                if t and t.get("lastPrice"):
                    client_price = float(t.get("lastPrice"))
            except Exception:
                pass

        if order_type == "LIMIT":
            order_no = f"16123000{int(time.time() * 1000) % 100000}"
            lim_p = float(limit_price) if limit_price is not None else 0.0
            cur_price = client_price or lim_p
            try:
                depth = bridge.get_live_market_depth(symbol)
                cur_price = depth.get("bid", cur_price)
            except Exception:
                pass

            pending_ord = {
                "order_no": order_no,
                "symbol": symbol,
                "type": f"{cmd} LIMIT",
                "place_time": datetime.now().strftime("%H:%M:%S %d/%m/%Y"),
                "volume_lots": volume_lots,
                "order_price": lim_p,
                "current_price": cur_price,
                "sl_price": float(custom_sl) if (custom_sl is not None and str(custom_sl).strip() != "") else None,
                "tp_price": float(custom_tp) if (custom_tp is not None and str(custom_tp).strip() != "") else None,
                "status": "PENDING"
            }
            state = load_portfolio_state()
            if state:
                state.setdefault("pending_orders", []).insert(0, pending_ord)
                save_portfolio_state(state)
            return jsonify({
                "status": "SUCCESS",
                "order_type": "LIMIT",
                "order_no": order_no,
                "symbol": symbol,
                "side": cmd,
                "limit_price": lim_p,
                "message": f"Limit order #{order_no} placed successfully"
            })

        # Market Order
        res = bridge.send_order_mt4_style(
            symbol=symbol,
            cmd=cmd,
            volume_lots=volume_lots,
            sl_pips=sl_pips,
            tp_pips=tp_pips,
            use_3tranches=use_3tranches,
            leverage=leverage,
            market_price=client_price
        )
        state = load_portfolio_state()
        if state:
            entry_price = float(res.get("entry", 0.0))
            if entry_price <= 0.0 or (client_price and abs(entry_price - client_price) / client_price > 0.005):
                entry_price = client_price or entry_price
                if entry_price <= 0.0:
                    depth = bridge.get_live_market_depth(symbol)
                    entry_price = depth.get("ask" if cmd == "BUY" else "bid", 1.0)
            res["entry"] = entry_price

            sl_price = float(custom_sl) if (custom_sl is not None and str(custom_sl).strip() != "") else None
            queen_tp = float(custom_tp) if (custom_tp is not None and str(custom_tp).strip() != "") else None
            pos_id = f"POS-{int(time.time() * 1000) % 100000}"
            
            pawn_tp = queen_tp
            horse_tp = queen_tp
            if queen_tp is not None:
                sl_dist = (sl_pips * spec["pip_value"]) if sl_pips else abs(entry_price - (sl_price or entry_price * 0.995))
                pawn_tp = round(entry_price + (1.5 * sl_dist) if cmd == "BUY" else entry_price - (1.5 * sl_dist), spec["price_precision"])
                horse_tp = round(entry_price + (3.0 * sl_dist) if cmd == "BUY" else entry_price - (3.0 * sl_dist), spec["price_precision"])

            new_pos = {
                "pos_id": pos_id,
                "symbol": symbol,
                "side": cmd,
                "volume_lots": volume_lots,
                "entry_time": datetime.now().strftime("%H:%M:%S"),
                "entry_price": entry_price,
                "current_price": entry_price,
                "sl_price": sl_price,
                "initial_sl": sl_price,
                "is_risk_free": False,
                "unrealized_pnl": 0.0,
                "fee": round(volume_lots * 0.015, 3),
                "swap": 0.0,
                "tranches": {
                    "pawn": {"notional": round(volume_lots * 0.33, 4), "status": "OPEN", "tp_price": pawn_tp, "realized_pnl": 0.0},
                    "horse": {"notional": round(volume_lots * 0.33, 4), "status": "OPEN", "tp_price": horse_tp, "realized_pnl": 0.0},
                    "queen": {"notional": round(volume_lots * 0.34, 4), "status": "OPEN", "tp_price": queen_tp, "realized_pnl": 0.0, "trailing_active": False}
                }
            }
            state.setdefault("active_positions", []).insert(0, new_pos)
            state["session_trades_count"] = state.get("session_trades_count", 0) + 1
            save_portfolio_state(state)
        return jsonify(res)
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 400

@order_bp.route("/api/order/cancel_pending", methods=["POST"])
def api_cancel_pending():
    req = request.json or {}
    order_no = str(req.get("order_no", ""))
    state = load_portfolio_state()
    if not order_no or not state:
        return jsonify({"status": "ERROR", "message": "Invalid order_no or portfolio missing"}), 400
    try:
        pending = state.get("pending_orders", [])
        state["pending_orders"] = [o for o in pending if str(o.get("order_no")) != order_no]
        save_portfolio_state(state)
        return jsonify({"status": "SUCCESS", "message": f"Order #{order_no} cancelled successfully"})
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@order_bp.route("/api/order/close", methods=["POST"])
def api_order_close():
    req = request.json or {}
    pos_id = req.get("pos_id")
    if not pos_id:
        return jsonify({"status": "ERROR", "message": "pos_id required"}), 400

    # Delegate live position closes
    if str(pos_id).startswith("REAL-"):
        try:
            from .live_routes import api_live_close
            return api_live_close()
        except Exception as live_err:
            return jsonify({"status": "ERROR", "message": str(live_err)}), 500

    state = load_portfolio_state()
    if not state:
        return jsonify({"status": "ERROR", "message": "Portfolio state missing"}), 400
    try:
        active = state.get("active_positions", [])
        target_pos = None
        remaining = []
        for p in active:
            if str(p.get("pos_id")) == str(pos_id):
                target_pos = p
            else:
                remaining.append(p)
        if not target_pos:
            return jsonify({"status": "NOT_FOUND", "message": f"Position {pos_id} already closed or not found"}), 200

        sym = target_pos.get("symbol", "BTCUSDT")
        side = target_pos.get("side", "BUY")
        entry_price = float(target_pos.get("entry_price", 0.0))
        vol = float(target_pos.get("volume_lots", 0.01))
        spec = MT4_CONTRACT_SPECS.get(sym, {"lot_size_coins": 1.0})
        contract_size = spec.get("lot_size_coins", 1.0)
        fee = float(target_pos.get("fee", 0.015))

        close_price = float(req.get("trigger_price")) if req.get("trigger_price") else float(target_pos.get("current_price", entry_price))
        diff = (close_price - entry_price) if side in ["BUY", "LONG"] else (entry_price - close_price)
        pnl = round(diff * vol * contract_size - fee, 2)

        vault_sweep = 0.0
        if pnl > 0:
            vault_sweep = round(pnl * 0.20, 2)
            net_profit = pnl - vault_sweep
            state["safe_vault"] = round(state.get("safe_vault", 0.0) + vault_sweep, 2)
            state["wallet_balance"] = round(state.get("wallet_balance", 15.0) + net_profit, 2)
        else:
            state["wallet_balance"] = round(state.get("wallet_balance", 15.0) + pnl, 2)
        state["total_equity"] = round(state["wallet_balance"] + state["safe_vault"], 2)
        state["session_pnl"] = round(state.get("session_pnl", 0.0) + pnl, 2)
        stats = state.setdefault("stats", {})
        stats["total_trades"] = stats.get("total_trades", 0) + 1
        if pnl > 0:
            stats["wins"] = stats.get("wins", 0) + 1
        elif pnl < 0:
            stats["losses"] = stats.get("losses", 0) + 1
        else:
            stats["breakevens"] = stats.get("breakevens", 0) + 1
        decided = stats.get("wins", 0) + stats.get("losses", 0)
        stats["decided_win_rate_pct"] = round((stats["wins"] / decided * 100.0), 1) if decided > 0 else 100.0

        reason = req.get("reason", "")
        if reason == "TP_HIT":
            exit_reason = f"Take Profit Hit (+${pnl:.2f})"
        elif reason == "SL_HIT":
            exit_reason = f"Stop Loss Hit (-${abs(pnl):.2f})"
        elif vault_sweep > 0:
            exit_reason = f"Manual Close (Vault: +${vault_sweep:.2f})"
        else:
            exit_reason = "Manual Close"

        closed_rec = {
            "pos_id": target_pos.get("pos_id"),
            "symbol": sym,
            "side": side,
            "volume_lots": vol,
            "entry_time": target_pos.get("entry_time"),
            "closed_time": datetime.now().strftime("%H:%M:%S"),
            "entry_price": entry_price,
            "close_price": close_price,
            "sl_price": target_pos.get("sl_price"),
            "tp_price": target_pos.get("tp_price") or target_pos.get("tranches", {}).get("queen", {}).get("tp_price"),
            "total_fee": fee,
            "swap": 0.0,
            "final_net_pnl": pnl,
            "exit_reason": exit_reason
        }
        state.setdefault("closed_trades", []).insert(0, closed_rec)
        state["active_positions"] = remaining
        save_portfolio_state(state)
        return jsonify({"status": "SUCCESS", "message": f"Position {pos_id} closed with PnL ${pnl:.2f}"})
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@order_bp.route("/api/order/breakeven", methods=["POST"])
def api_order_breakeven():
    req = request.json or {}
    pos_id = req.get("pos_id")
    state = load_portfolio_state()
    if not pos_id or not state:
        return jsonify({"status": "ERROR", "message": "Invalid request or file missing"}), 400
    try:
        for p in state.get("active_positions", []):
            if p.get("pos_id") == pos_id:
                spec = MT4_CONTRACT_SPECS.get(p.get("symbol"), MT4_CONTRACT_SPECS.get("BTCUSDT", {"pip_value": 0.1, "price_precision": 1}))
                pip_val = spec["pip_value"]
                prec = spec["price_precision"]
                if p.get("side") == "BUY":
                    p["sl_price"] = round(p["entry_price"] + (2 * pip_val), prec)
                else:
                    p["sl_price"] = round(p["entry_price"] - (2 * pip_val), prec)
                p["is_risk_free"] = True
                break
        save_portfolio_state(state)
        return jsonify({"status": "SUCCESS", "message": f"Position {pos_id} locked to Breakeven (+2 pips)"})
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@order_bp.route("/api/order/edit_sltp", methods=["POST", "PUT"])
def api_order_edit_sltp():
    req = request.json or {}
    pos_id = req.get("pos_id")
    edit_type = req.get("type", "SL").upper()
    new_price = req.get("price")
    clear_level = bool(req.get("clear", False))
    if edit_type not in {"SL", "TP"}:
        return jsonify({"status": "ERROR", "message": "type must be SL or TP"}), 400
    if not pos_id or (new_price is None and not clear_level):
        return jsonify({"status": "ERROR", "message": "Invalid parameters"}), 400

    # 1. Real-Money Live Binance Position Support
    if str(pos_id).startswith("REAL-"):
        try:
            from .live_routes import engine as live_engine
            parts = str(pos_id).split("-")
            symbol = parts[1] if len(parts) >= 2 else "BTCUSDT"

            # Cancel existing conditional orders of this type
            try:
                ts_c = int(time.time() * 1000)
                p_c = {"symbol": symbol, "timestamp": ts_c}
                p_c["signature"] = live_engine._sign(p_c)
                r_c = live_engine.session.get(f"{live_engine.base_url}/fapi/v1/openOrders", params=p_c, timeout=5)
                if r_c.status_code == 200:
                    for o in r_c.json():
                        target_type = "STOP_MARKET" if edit_type == "SL" else "TAKE_PROFIT_MARKET"
                        if o.get("type") == target_type:
                            del_p = {"symbol": symbol, "orderId": o.get("orderId"), "timestamp": int(time.time() * 1000)}
                            del_p["signature"] = live_engine._sign(del_p)
                            live_engine.session.delete(f"{live_engine.base_url}/fapi/v1/order", params=del_p, timeout=5)
            except Exception:
                pass

            if clear_level or new_price is None:
                return jsonify({"status": "SUCCESS", "pos_id": pos_id, "type": edit_type, "cleared": True, "mode": "LIVE"})

            # Query live position to determine direction
            ts_pos = int(time.time() * 1000)
            pos_p = {"symbol": symbol, "timestamp": ts_pos}
            pos_p["signature"] = live_engine._sign(pos_p)
            r_pos = live_engine.session.get(f"{live_engine.base_url}/fapi/v2/positionRisk", params=pos_p, timeout=5)
            pos_list = r_pos.json() if r_pos.status_code == 200 and isinstance(r_pos.json(), list) else []
            amt = 0.0
            for p in pos_list:
                if float(p.get("positionAmt", 0)) != 0:
                    amt = float(p.get("positionAmt", 0))
                    break

            if amt == 0:
                return jsonify({"status": "NOT_FOUND", "message": f"No open live position found for {symbol}"}), 200

            order_side = "SELL" if amt > 0 else "BUY"
            ts_ord = int(time.time() * 1000)
            ord_p = {
                "symbol": symbol,
                "side": order_side,
                "type": "STOP_MARKET" if edit_type == "SL" else "TAKE_PROFIT_MARKET",
                "stopPrice": live_engine.format_price(symbol, float(new_price)),
                "closePosition": "true",
                "timestamp": ts_ord
            }
            ord_p["signature"] = live_engine._sign(ord_p)
            res_ord = live_engine.session.post(f"{live_engine.base_url}/fapi/v1/order", params=ord_p, timeout=5)
            ord_data = res_ord.json()
            if res_ord.status_code == 200 and "orderId" in ord_data:
                return jsonify({"status": "SUCCESS", "pos_id": pos_id, "type": edit_type, "new_price": float(new_price), "cleared": False, "mode": "LIVE"})
            else:
                return jsonify({"status": "FAILED", "error": ord_data.get("msg", str(ord_data))}), 400
        except Exception as live_err:
            return jsonify({"status": "ERROR", "message": f"Live SL/TP update error: {str(live_err)}"}), 500

    # 2. Demo Paper Trading Position Support
    state = load_portfolio_state()
    if not state:
        return jsonify({"status": "ERROR", "message": "Portfolio state missing"}), 400
    try:
        new_price = None if clear_level else float(new_price)
        found = False
        for p in state.get("active_positions", []):
            if p.get("pos_id") == pos_id:
                found = True
                if edit_type == "SL":
                    p["sl_price"] = new_price
                else:
                    p["tp_price"] = new_price
                    if "tranches" in p and "queen" in p["tranches"]:
                        p["tranches"]["queen"]["tp_price"] = new_price
                break
        if not found:
            return jsonify({"status": "NOT_FOUND", "message": f"Position {pos_id} not found or no longer active"}), 200
        save_portfolio_state(state)
        return jsonify({"status": "SUCCESS", "pos_id": pos_id, "type": edit_type, "new_price": new_price, "cleared": clear_level, "mode": "DEMO"})
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@order_bp.route("/api/order/batch_close", methods=["POST"])
def api_order_batch_close():
    req = request.json or {}
    filter_type = req.get("filter", "ALL").upper()
    state = load_portfolio_state()
    if not state:
        return jsonify({"status": "ERROR", "message": "Portfolio file missing"}), 400
    try:
        active = state.get("active_positions", [])
        to_close = []
        remaining = []
        for p in active:
            pnl = p.get("unrealized_pnl", 0.0)
            if filter_type == "PROFIT" and pnl > 0:
                to_close.append(p)
            elif filter_type == "LOSS" and pnl < 0:
                to_close.append(p)
            elif filter_type == "ALL":
                to_close.append(p)
            else:
                remaining.append(p)
        for target_pos in to_close:
            pnl = target_pos.get("unrealized_pnl", 0.0)
            vault_sweep = 0.0
            if pnl > 0:
                vault_sweep = round(pnl * 0.20, 2)
                net_profit = pnl - vault_sweep
                state["safe_vault"] = round(state.get("safe_vault", 0.0) + vault_sweep, 2)
                state["wallet_balance"] = round(state.get("wallet_balance", 15.0) + net_profit, 2)
            else:
                state["wallet_balance"] = round(state.get("wallet_balance", 15.0) + pnl, 2)
            state["session_pnl"] = round(state.get("session_pnl", 0.0) + pnl, 2)
            stats = state.setdefault("stats", {})
            stats["total_trades"] = stats.get("total_trades", 0) + 1
            if pnl > 0:
                stats["wins"] = stats.get("wins", 0) + 1
            elif pnl < 0:
                stats["losses"] = stats.get("losses", 0) + 1
            else:
                stats["breakevens"] = stats.get("breakevens", 0) + 1
            closed_rec = {
                "pos_id": target_pos.get("pos_id"),
                "symbol": target_pos.get("symbol"),
                "side": target_pos.get("side"),
                "volume_lots": target_pos.get("volume_lots", 0.01),
                "entry_time": target_pos.get("entry_time"),
                "closed_time": datetime.now().strftime("%H:%M:%S"),
                "entry_price": target_pos.get("entry_price"),
                "close_price": target_pos.get("current_price"),
                "sl_price": target_pos.get("sl_price"),
                "tp_price": target_pos.get("tranches", {}).get("queen", {}).get("tp_price", target_pos.get("sl_price")),
                "total_fee": target_pos.get("fee", 0.015),
                "swap": 0.0,
                "final_net_pnl": pnl,
                "exit_reason": f"Batch Close (Vault: +${vault_sweep:.2f})" if vault_sweep > 0 else "Batch Close"
            }
            state.setdefault("closed_trades", []).insert(0, closed_rec)
        state["total_equity"] = round(state["wallet_balance"] + state["safe_vault"], 2)
        state["active_positions"] = remaining
        decided = state["stats"].get("wins", 0) + state["stats"].get("losses", 0)
        state["stats"]["decided_win_rate_pct"] = round((state["stats"]["wins"] / decided * 100.0), 1) if decided > 0 else 100.0
        save_portfolio_state(state)
        return jsonify({"status": "SUCCESS", "closed_count": len(to_close), "remaining_count": len(remaining)})
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500
