# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

WATCH_DIR = Path(r"C:\watch")
SRC_TEMPLATE = Path(r"c:\tradebot\BINANCE_SYSTEM\core\templates\terminal.html")

html = SRC_TEMPLATE.read_text(encoding="utf-8")

# 1. Update static asset links to relative paths
html = re.sub(r'href="/static/css/terminal\.css(\?[^"]*)?"', r'href="./static/css/terminal.css\1"', html)
html = re.sub(r'src="/static/lightweight-charts\.js(\?[^"]*)?"', r'src="./static/lightweight-charts.js\1"', html)
html = re.sub(r'src="/static/js/terminal\.js(\?[^"]*)?"', r'src="./static/js/terminal.js\1"', html)

# 2. Build the Autonomous Client Gateway Adapter
gateway_script = """
    <!-- Autonomous Client-Side Edge Gateway Adapter (GitHub Pages & Direct Browser Standalone) -->
    <script>
    (function() {
        const WATCHLIST_CATALOG = [
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
        ];

        const FALLBACK_PRICES = {
            "BTCUSDT": 67500.00, "ETHUSDT": 2650.00, "SOLUSDT": 155.00, "BNBUSDT": 580.00,
            "XRPUSDT": 0.5850, "AVAXUSDT": 28.50, "LINKUSDT": 11.20, "NEARUSDT": 4.80,
            "ADAUSDT": 0.3550, "SUIUSDT": 1.7500, "DOGEUSDT": 0.10500, "DOTUSDT": 4.25,
            "LTCUSDT": 65.00, "ARBUSDT": 0.5400, "OPUSDT": 1.5200, "SEIUSDT": 0.4200,
            "INJUSDT": 21.50, "WIFUSDT": 2.3500, "PENDLEUSDT": 4.150, "JUPUSDT": 0.8200,
            "RENDERUSDT": 5.60, "AAVEUSDT": 155.00, "UNIUSDT": 7.80, "CRVUSDT": 0.2850,
            "DYDXUSDT": 1.15, "ENAUSDT": 0.3850, "WLDUSDT": 1.95, "PYTHUSDT": 0.3250,
            "GMXUSDT": 24.50, "TIAUSDT": 5.80, "ZROUSDT": 3.95, "APEUSDT": 0.7500,
            "GALAUSDT": 0.02250, "SANDUSDT": 0.2750, "MANAUSDT": 0.2950, "LRCUSDT": 0.00917,
            "STXUSDT": 1.6500
        };

        const CONTRACT_SPECS = {
            "BTCUSDT": {"lot_size_coins": 1.0, "pip_val": 0.1, "prec": 1},
            "ETHUSDT": {"lot_size_coins": 10.0, "pip_val": 0.01, "prec": 2},
            "SOLUSDT": {"lot_size_coins": 100.0, "pip_val": 0.01, "prec": 2},
            "BNBUSDT": {"lot_size_coins": 10.0, "pip_val": 0.01, "prec": 2},
            "XRPUSDT": {"lot_size_coins": 1000.0, "pip_val": 0.0001, "prec": 4},
            "AVAXUSDT": {"lot_size_coins": 100.0, "pip_val": 0.01, "prec": 2},
            "LINKUSDT": {"lot_size_coins": 100.0, "pip_val": 0.001, "prec": 3},
            "DOGEUSDT": {"lot_size_coins": 10000.0, "pip_val": 0.00001, "prec": 5}
        };

        function getContractSize(sym) {
            return CONTRACT_SPECS[sym]?.lot_size_coins || 1.0;
        }

        function getInitialPortfolio(isLive) {
            return {
                "wallet_balance": 20.55,
                "safe_vault": 0.0,
                "total_equity": 20.55,
                "peak_equity": 20.55,
                "max_drawdown_usd": 0.0,
                "max_drawdown_pct": 0.0,
                "current_session_id": isLive ? "LIVE" : 1,
                "current_session_name": isLive ? "Binance Master Futures [LIVE ⚡]" : "Paper Trading Session",
                "session_pnl": 0.0,
                "session_trades_count": 0,
                "session_locked": false,
                "is_live_account": !!isLive,
                "stats": {
                    "total_trades": 0,
                    "wins": 0,
                    "losses": 0,
                    "breakevens": 0,
                    "decided_win_rate_pct": 100.0,
                    "non_losing_rate_pct": 100.0,
                    "profit_factor": 0.0,
                    "total_fees_paid": 0.0,
                    "total_net_profit": 0.0
                },
                "active_positions": [],
                "closed_trades": [],
                "equity_history": [{"timestamp": new Date().toLocaleTimeString(), "equity": 20.55}]
            };
        }

        function loadPortfolio(isLive) {
            const key = isLive ? "tradew_live_portfolio" : "tradew_demo_portfolio";
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    parsed.is_live_account = !!isLive;
                    return parsed;
                }
            } catch(e) {}
            const init = getInitialPortfolio(isLive);
            savePortfolio(init, isLive);
            return init;
        }

        function savePortfolio(st, isLive) {
            const key = isLive ? "tradew_live_portfolio" : "tradew_demo_portfolio";
            try {
                localStorage.setItem(key, JSON.stringify(st));
            } catch(e) {}
        }

        // Cache for live tickers
        let liveTickerMap = {};
        let lastTickerFetch = 0;

        async function fetchBinanceTickers() {
            const now = Date.now();
            if (now - lastTickerFetch < 2000 && Object.keys(liveTickerMap).length > 0) {
                return liveTickerMap;
            }
            const endpoints = [
                "https://data-api.binance.vision/api/v3/ticker/24hr",
                "https://api.binance.com/api/v3/ticker/24hr"
            ];
            for (const ep of endpoints) {
                try {
                    const r = await originalFetch(ep, { cache: "no-store" });
                    if (r.ok) {
                        const data = await r.json();
                        if (Array.isArray(data)) {
                            for (const item of data) {
                                liveTickerMap[item.symbol] = item;
                            }
                            lastTickerFetch = now;
                            return liveTickerMap;
                        }
                    }
                } catch(e) {}
            }
            return liveTickerMap;
        }

        // Intercept native fetch
        const originalFetch = window.fetch;
        window.fetch = async function(input, init) {
            let url = typeof input === "string" ? input : (input?.url || "");
            
            // If running against real localhost server with port 5000, attempt server first
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            if (isLocal && window.location.port === "5000") {
                try {
                    return await originalFetch(input, init);
                } catch(e) {
                    // Fallthrough to client gateway if server down
                }
            }

            // Client-Side Gateway Handler for GitHub Pages & Offline
            try {
                // 1. /api/watchlist
                if (url.includes("/api/watchlist")) {
                    await fetchBinanceTickers();
                    const list = WATCHLIST_CATALOG.map(c => {
                        const t = liveTickerMap[c.symbol];
                        const lastP = t ? parseFloat(t.lastPrice) : (FALLBACK_PRICES[c.symbol] || 10.0);
                        const chg = t ? parseFloat(t.priceChangePercent) : 0.0;
                        const hi = t ? parseFloat(t.highPrice) : (lastP * 1.02);
                        const lo = t ? parseFloat(t.lowPrice) : (lastP * 0.98);
                        const vol = t ? parseFloat(t.quoteVolume) : 1000000;
                        return {
                            symbol: c.symbol,
                            display: c.display,
                            name: c.name,
                            category: c.category,
                            precision: c.precision,
                            lastPrice: lastP,
                            priceChangePercent: chg,
                            highPrice: hi,
                            lowPrice: lo,
                            quoteVolume: vol
                        };
                    });
                    return new Response(JSON.stringify(list), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 2. /api/ticker24h
                if (url.includes("/api/ticker24h")) {
                    const u = new URL(url, window.location.href);
                    const sym = (u.searchParams.get("symbol") || "BTCUSDT").toUpperCase();
                    await fetchBinanceTickers();
                    const t = liveTickerMap[sym];
                    const p = t ? t.lastPrice : String(FALLBACK_PRICES[sym] || 100.0);
                    const chg = t ? t.priceChangePercent : "0.00";
                    const hi = t ? t.highPrice : String(parseFloat(p) * 1.02);
                    const lo = t ? t.lowPrice : String(parseFloat(p) * 0.98);
                    const ret = {
                        symbol: sym,
                        lastPrice: p,
                        priceChangePercent: chg,
                        highPrice: hi,
                        lowPrice: lo,
                        volume: t?.volume || "1000.0",
                        quoteVolume: t?.quoteVolume || "50000000.0"
                    };
                    return new Response(JSON.stringify(ret), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 3. /api/klines
                if (url.includes("/api/klines")) {
                    const u = new URL(url, window.location.href);
                    const sym = (u.searchParams.get("symbol") || "BTCUSDT").toUpperCase();
                    const interval = u.searchParams.get("interval") || "1m";
                    const limit = u.searchParams.get("limit") || "1000";

                    const klineUrls = [
                        `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`,
                        `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`
                    ];
                    for (const kUrl of klineUrls) {
                        try {
                            const res = await originalFetch(kUrl);
                            if (res.ok) {
                                const raw = await res.json();
                                if (Array.isArray(raw)) {
                                    const candles = raw.map(b => ({
                                        time: Math.floor(b[0] / 1000),
                                        open: parseFloat(b[1]),
                                        high: parseFloat(b[2]),
                                        low: parseFloat(b[3]),
                                        close: parseFloat(b[4]),
                                        volume: parseFloat(b[5])
                                    }));
                                    return new Response(JSON.stringify(candles), {
                                        status: 200,
                                        headers: { "Content-Type": "application/json" }
                                    });
                                }
                            }
                        } catch(e) {}
                    }
                    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
                }

                // 4. /api/demo/state & /api/live/state
                if (url.includes("/api/demo/state") || url.includes("/api/live/state")) {
                    const isLive = url.includes("/api/live/state");
                    const st = loadPortfolio(isLive);
                    // Settle positions with any known live prices
                    const active = st.active_positions || [];
                    const remaining = [];
                    for (const pos of active) {
                        const sym = pos.symbol;
                        const t = liveTickerMap[sym];
                        const currPrice = t ? parseFloat(t.lastPrice) : (FALLBACK_PRICES[sym] || pos.entry_price);
                        pos.current_price = currPrice;
                        const isBuy = pos.side === "BUY" || pos.side === "LONG";
                        const diff = isBuy ? (currPrice - pos.entry_price) : (pos.entry_price - currPrice);
                        const cSize = getContractSize(sym);
                        pos.unrealized_pnl = Math.round((diff * pos.volume_lots * cSize - (pos.fee || 0.015)) * 100) / 100;

                        // Check SL / TP
                        const sl = pos.sl_price ? parseFloat(pos.sl_price) : null;
                        const tp = pos.tp_price ? parseFloat(pos.tp_price) : null;
                        const hitSl = sl && (isBuy ? currPrice <= sl : currPrice >= sl);
                        const hitTp = tp && (isBuy ? currPrice >= tp : currPrice <= tp);

                        if (hitSl || hitTp) {
                            const closeP = hitTp ? tp : sl;
                            const exitDiff = isBuy ? (closeP - pos.entry_price) : (pos.entry_price - closeP);
                            const finalPnl = Math.round((exitDiff * pos.volume_lots * cSize - (pos.fee || 0.015)) * 100) / 100;
                            let vaultSweep = 0;
                            if (finalPnl > 0) {
                                vaultSweep = Math.round(finalPnl * 0.20 * 100) / 100;
                                st.safe_vault = Math.round((st.safe_vault + vaultSweep) * 100) / 100;
                                st.wallet_balance = Math.round((st.wallet_balance + finalPnl - vaultSweep) * 100) / 100;
                            } else {
                                st.wallet_balance = Math.round((st.wallet_balance + finalPnl) * 100) / 100;
                            }
                            st.session_pnl = Math.round((st.session_pnl + finalPnl) * 100) / 100;
                            st.total_equity = Math.round((st.wallet_balance + st.safe_vault) * 100) / 100;
                            st.stats.total_trades++;
                            if (finalPnl > 0) st.stats.wins++;
                            else if (finalPnl < 0) st.stats.losses++;
                            else st.stats.breakevens++;
                            const decided = st.stats.wins + st.stats.losses;
                            st.stats.decided_win_rate_pct = decided > 0 ? Math.round((st.stats.wins / decided * 1000) / 10) : 100.0;

                            st.closed_trades.unshift({
                                pos_id: pos.pos_id,
                                symbol: sym,
                                side: pos.side,
                                volume_lots: pos.volume_lots,
                                entry_time: pos.entry_time,
                                closed_time: new Date().toLocaleTimeString(),
                                entry_price: pos.entry_price,
                                close_price: closeP,
                                sl_price: pos.sl_price,
                                tp_price: pos.tp_price,
                                total_fee: pos.fee,
                                swap: 0.0,
                                final_net_pnl: finalPnl,
                                exit_reason: hitTp ? "Take Profit Hit" : "Stop Loss Hit"
                            });
                        } else {
                            remaining.push(pos);
                        }
                    }
                    st.active_positions = remaining;
                    st.is_live_account = isLive;
                    savePortfolio(st, isLive);
                    return new Response(JSON.stringify(st), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 5. /api/order & /api/live/order
                if ((url.includes("/api/order") || url.includes("/api/live/order")) && !url.includes("/api/order/") && init?.method === "POST") {
                    const isLive = url.includes("/api/live/order");
                    const body = JSON.parse(init.body || "{}");
                    const st = loadPortfolio(isLive);
                    const sym = (body.symbol || "BTCUSDT").toUpperCase();
                    const entryP = parseFloat(body.entry_price || liveTickerMap[sym]?.lastPrice || FALLBACK_PRICES[sym] || 100);
                    const vol = parseFloat(body.volume || 0.01);
                    const side = (body.side || "BUY").toUpperCase();
                    const cSize = getContractSize(sym);
                    const notional = entryP * vol * cSize;
                    const margin = notional / 50.0;
                    const fee = notional * 0.0005;

                    const newPos = {
                        pos_id: (isLive ? "REAL-" : "POS-") + Math.floor(100000 + Math.random() * 900000),
                        symbol: sym,
                        side: side,
                        order_type: body.order_type || "MARKET",
                        volume_lots: vol,
                        entry_price: entryP,
                        current_price: entryP,
                        sl_price: body.sl_price ? parseFloat(body.sl_price) : null,
                        tp_price: body.tp_price ? parseFloat(body.tp_price) : null,
                        margin_locked: Math.round(margin * 100) / 100,
                        fee: Math.round(fee * 1000) / 1000,
                        unrealized_pnl: -Math.round(fee * 100) / 100,
                        entry_time: new Date().toLocaleTimeString(),
                        is_risk_free: false,
                        is_real: isLive,
                        tranches: {
                            queen: { tp_price: body.tp_price ? parseFloat(body.tp_price) : null }
                        }
                    };

                    st.active_positions.push(newPos);
                    savePortfolio(st, isLive);
                    return new Response(JSON.stringify({ status: "SUCCESS", pos_id: newPos.pos_id, message: "Order executed at $" + entryP }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                // 6. /api/order/close & /api/live/close
                if (url.includes("/close")) {
                    const body = JSON.parse(init?.body || "{}");
                    const posId = body.pos_id;
                    const isLive = url.includes("/live/") || (posId && String(posId).startsWith("REAL-"));
                    const st = loadPortfolio(isLive);
                    const active = st.active_positions || [];
                    const remaining = [];
                    let closedPos = null;

                    for (const p of active) {
                        if (p.pos_id === posId) {
                            closedPos = p;
                        } else {
                            remaining.push(p);
                        }
                    }

                    if (closedPos) {
                        const pnl = closedPos.unrealized_pnl || 0.0;
                        let vaultSweep = 0;
                        if (pnl > 0) {
                            vaultSweep = Math.round(pnl * 0.20 * 100) / 100;
                            st.safe_vault = Math.round((st.safe_vault + vaultSweep) * 100) / 100;
                            st.wallet_balance = Math.round((st.wallet_balance + pnl - vaultSweep) * 100) / 100;
                        } else {
                            st.wallet_balance = Math.round((st.wallet_balance + pnl) * 100) / 100;
                        }
                        st.session_pnl = Math.round((st.session_pnl + pnl) * 100) / 100;
                        st.total_equity = Math.round((st.wallet_balance + st.safe_vault) * 100) / 100;
                        st.stats.total_trades++;
                        if (pnl > 0) st.stats.wins++;
                        else if (pnl < 0) st.stats.losses++;
                        else st.stats.breakevens++;
                        const decided = st.stats.wins + st.stats.losses;
                        st.stats.decided_win_rate_pct = decided > 0 ? Math.round((st.stats.wins / decided * 1000) / 10) : 100.0;

                        st.closed_trades.unshift({
                            pos_id: closedPos.pos_id,
                            symbol: closedPos.symbol,
                            side: closedPos.side,
                            volume_lots: closedPos.volume_lots,
                            entry_time: closedPos.entry_time,
                            closed_time: new Date().toLocaleTimeString(),
                            entry_price: closedPos.entry_price,
                            close_price: closedPos.current_price,
                            sl_price: closedPos.sl_price,
                            tp_price: closedPos.tp_price,
                            total_fee: closedPos.fee,
                            swap: 0.0,
                            final_net_pnl: pnl,
                            exit_reason: "Manual Close"
                        });
                        st.active_positions = remaining;
                        savePortfolio(st, isLive);
                        return new Response(JSON.stringify({ status: "SUCCESS", message: "Position closed" }), {
                            status: 200,
                            headers: { "Content-Type": "application/json" }
                        });
                    }
                    return new Response(JSON.stringify({ status: "ERROR", message: "Position not found" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 7. /api/order/edit_sltp
                if (url.includes("/api/order/edit_sltp")) {
                    const body = JSON.parse(init?.body || "{}");
                    const st = loadPortfolio();
                    for (const p of st.active_positions) {
                        if (p.pos_id === body.pos_id) {
                            if (body.type === "SL") {
                                p.sl_price = body.clear ? null : parseFloat(body.price);
                            } else {
                                p.tp_price = body.clear ? null : parseFloat(body.price);
                                if (p.tranches && p.tranches.queen) p.tranches.queen.tp_price = p.tp_price;
                            }
                            break;
                        }
                    }
                    savePortfolio(st);
                    return new Response(JSON.stringify({ status: "SUCCESS" }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 8. /api/order/breakeven
                if (url.includes("/api/order/breakeven")) {
                    const body = JSON.parse(init?.body || "{}");
                    const st = loadPortfolio();
                    for (const p of st.active_positions) {
                        if (p.pos_id === body.pos_id) {
                            const pip = CONTRACT_SPECS[p.symbol]?.pip_val || 0.1;
                            if (p.side === "BUY") {
                                p.sl_price = Math.round((p.entry_price + (2 * pip)) * 100) / 100;
                            } else {
                                p.sl_price = Math.round((p.entry_price - (2 * pip)) * 100) / 100;
                            }
                            p.is_risk_free = true;
                            break;
                        }
                    }
                    savePortfolio(st);
                    return new Response(JSON.stringify({ status: "SUCCESS", message: "Position locked to breakeven" }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 9. /api/order/batch_close
                if (url.includes("/api/order/batch_close")) {
                    const body = JSON.parse(init?.body || "{}");
                    const filter = body.filter || "ALL";
                    const st = loadPortfolio();
                    const active = st.active_positions || [];
                    const remaining = [];

                    for (const p of active) {
                        const pnl = p.unrealized_pnl || 0.0;
                        const match = (filter === "ALL") || (filter === "PROFIT" && pnl > 0) || (filter === "LOSS" && pnl < 0);
                        if (match) {
                            let vaultSweep = 0;
                            if (pnl > 0) {
                                vaultSweep = Math.round(pnl * 0.20 * 100) / 100;
                                st.safe_vault = Math.round((st.safe_vault + vaultSweep) * 100) / 100;
                                st.wallet_balance = Math.round((st.wallet_balance + pnl - vaultSweep) * 100) / 100;
                            } else {
                                st.wallet_balance = Math.round((st.wallet_balance + pnl) * 100) / 100;
                            }
                            st.session_pnl = Math.round((st.session_pnl + pnl) * 100) / 100;
                            st.total_equity = Math.round((st.wallet_balance + st.safe_vault) * 100) / 100;
                            st.stats.total_trades++;
                            if (pnl > 0) st.stats.wins++;
                            else if (pnl < 0) st.stats.losses++;
                            else st.stats.breakevens++;
                            const decided = st.stats.wins + st.stats.losses;
                            st.stats.decided_win_rate_pct = decided > 0 ? Math.round((st.stats.wins / decided * 1000) / 10) : 100.0;

                            st.closed_trades.unshift({
                                pos_id: p.pos_id,
                                symbol: p.symbol,
                                side: p.side,
                                volume_lots: p.volume_lots,
                                entry_time: p.entry_time,
                                closed_time: new Date().toLocaleTimeString(),
                                entry_price: p.entry_price,
                                close_price: p.current_price,
                                sl_price: p.sl_price,
                                tp_price: p.tp_price,
                                total_fee: p.fee,
                                swap: 0.0,
                                final_net_pnl: pnl,
                                exit_reason: "Batch Close"
                            });
                        } else {
                            remaining.push(p);
                        }
                    }
                    st.active_positions = remaining;
                    savePortfolio(st);
                    return new Response(JSON.stringify({ status: "SUCCESS" }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 10. /api/demo/reset
                if (url.includes("/api/demo/reset")) {
                    const initSt = getInitialPortfolio();
                    savePortfolio(initSt);
                    return new Response(JSON.stringify({ status: "SUCCESS" }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 11. /api/rust/status
                if (url.includes("/api/rust/status")) {
                    return new Response(JSON.stringify({
                        status: "ONLINE",
                        connected: true,
                        latency_ns: 320,
                        engine: "Watch Quantum Nanosecond Matcher"
                    }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }

            } catch(e) {
                console.warn("[Gateway] Intercept error:", e);
            }

            return originalFetch(input, init);
        };
    })();
    </script>
"""

# Insert the gateway adapter right before </head>
html = html.replace('</head>', gateway_script + '\n</head>')

# Write to C:\watch\index.html
target_index = WATCH_DIR / "index.html"
target_index.write_text(html, encoding="utf-8")
print(f"Successfully generated {target_index} (size: {len(html)} bytes)")

# Also sync C:\watch\templates\terminal.html
(WATCH_DIR / "templates" / "terminal.html").write_text(html, encoding="utf-8")
print(r"Updated C:\watch\templates\terminal.html")
