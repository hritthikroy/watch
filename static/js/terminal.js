/**
 * Titan 6-Brain TradeW High-Speed Web Trading Terminal
 * Modular Master Bundle - Generated from static/js/modules/
 */

// ============================================================================
// Module: 01_shield.js
// ============================================================================

// AGGRESSIVE network error suppression - completely hide all connection errors
window.addEventListener('unhandledrejection', function(e) {
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_IO_SUSPENDED|net::/i.test(String(e.reason))) {
        e.preventDefault(); // stops it appearing in console
    }
});

// Completely suppress all console errors and warnings
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = function(...args) {
    const message = args.join(' ');
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_IO_SUSPENDED|net::|apiFetch|fetchTicker|fetchWatchlist|fetchPortfolio|fetchRustTelemetry|loadChartCandles/i.test(message)) {
        return; // suppress all connection and API errors
    }
    originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
    const message = args.join(' ');
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_IO_SUSPENDED|net::|apiFetch|fetchTicker|fetchWatchlist|fetchPortfolio|fetchRustTelemetry|loadChartCandles/i.test(message)) {
        return; // suppress all connection and API warnings
    }
    originalConsoleWarn.apply(console, args);
};

console.log = function(...args) {
    const message = args.join(' ');
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_IO_SUSPENDED|net::|apiFetch|fetchTicker|fetchWatchlist|fetchPortfolio|fetchRustTelemetry|loadChartCandles/i.test(message)) {
        return; // suppress all connection and API logs
    }
    originalConsoleLog.apply(console, args);
};



// ============================================================================
// Module: 02_state.js
// ============================================================================

let currentSymbol = "BTCUSDT";
        let currentInterval = "1m";
        let currentChartMode = "native"; // 'native' | 'tv' | 'binance'
        let isTvIframeMode = false;
        let userManuallySelectedSymbol = false;
        let _hasInitialPositionBootSynced = false;
        let currentCandle = null;
        let audioEnabled = true;
        let lastKnownPrice = 0;
        let chart = null;
        let candleSeries = null;
        let chartResizeObserver = null;
        let crosshairPriceLabelVisible = true;
        let activePriceLines = [];
        let lastOrderLinePnlRenderAt = 0;
        let cachedPortfolioState = null;
        let cachedCandles = [];
        let cachedWatchlistData = [];
        // Quotes are independent from the persisted demo portfolio. Keeping
        // them here prevents a portfolio refresh from putting an old saved
        // current_price back into the live position table.
        const livePricesBySymbol = new Map();
        const _lastTickTimes = new Map();
        let currentSelectedSide = "BUY";
        let currentLotSize = 0.01;
        let isBwCandleMode = false;
        // Smart position table diff — tracks which pos_ids are currently rendered
        // so we can skip innerHTML rebuild when only prices change (not structure).
        let _lastRenderedPosIds = "";

        // ── Circuit Breaker: tracks server health, shows reconnecting UI ─────────
        let _cbFailures = 0;          // consecutive fetch failures
        let _cbOpen = false;          // true = server considered DOWN, requests paused
        const CB_THRESHOLD = 3;       // failures before circuit opens
        const CB_RESET_MS  = 8000;    // ms to wait before probing again after open



// ============================================================================
// Module: 03_config.js
// ============================================================================

function _showReconnectBanner(show) {
            let el = document.getElementById('_cb_reconnect_banner');
            if (!el && show) {
                el = document.createElement('div');
                el.id = '_cb_reconnect_banner';
                el.style.cssText = [
                    'position:fixed','top:0','left:0','right:0','z-index:99999',
                    'background:#F0B90B','color:#181A20','text-align:center',
                    'padding:6px 12px','font-size:13px','font-weight:700',
                    'letter-spacing:0.5px','pointer-events:none'
                ].join(';');
                el.textContent = '⚡ Server reconnecting… please wait';
                document.body.appendChild(el);
            } else if (el && !show) {
                el.remove();
            }
        }

        // apiFetch — drop-in for fetch() with circuit-breaker logic.
        // Use this for ALL /api/... calls so the breaker works globally.
        async function apiFetch(url, opts) {
            if (_cbOpen) return null;   // circuit open — skip request silently
            try {
                const res = await fetch(url, opts);
                // Success — reset failure counter, close circuit
                if (_cbFailures > 0 || _cbOpen) {
                    _cbFailures = 0;
                    _cbOpen = false;
                    _showReconnectBanner(false);
                }
                return res;
            } catch(e) {
                _cbFailures++;
                if (_cbFailures >= CB_THRESHOLD && !_cbOpen) {
                    _cbOpen = true;
                    _showReconnectBanner(true);
                    // Probe again after CB_RESET_MS
                    setTimeout(() => {
                        _cbOpen = false;          // allow one probe
                        _cbFailures = CB_THRESHOLD - 1;  // one more fail reopens
                    }, CB_RESET_MS);
                }
                return null;
            }
        }

        function toggleVolumeVisibility(e) {
            if (e) e.stopPropagation();
            isVolumeVisible = !isVolumeVisible;
            localStorage.setItem('tradew_volume_visible', isVolumeVisible ? 'true' : 'false');
            applyVolumeVisibilityUI();
        }

        function applyVolumeVisibilityUI() {
            if (volumeSeries) {
                volumeSeries.applyOptions({ visible: isVolumeVisible });
            }
            const pill = document.getElementById('vol-indicator-pill');
            const eyeSvg = document.getElementById('vol-eye-svg');
            const eyeBtn = document.getElementById('btn-toggle-vol');

            if (pill) {
                if (isVolumeVisible) {
                    pill.classList.remove('hidden-state');
                } else {
                    pill.classList.add('hidden-state');
                }
            }

            if (eyeSvg) {
                if (isVolumeVisible) {
                    // Open eye
                    eyeSvg.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
                    if (eyeBtn) eyeBtn.setAttribute('title', 'Hide Volume');
                } else {
                    // Slashed eye (hidden state)
                    eyeSvg.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
                    if (eyeBtn) eyeBtn.setAttribute('title', 'Show Volume');
                }
            }
        }

        function updateLegendVolume(vol) {
            const el = document.getElementById('disp-legend-vol');
            if (!el) return;
            if (vol === undefined || vol === null || isNaN(vol)) {
                el.innerText = '--';
                return;
            }
            const num = Number(vol);
            if (num >= 1_000_000_000) {
                el.innerText = (num / 1_000_000_000).toFixed(2) + 'B';
            } else if (num >= 1_000_000) {
                el.innerText = (num / 1_000_000).toFixed(2) + 'M';
            } else if (num >= 1_000) {
                el.innerText = (num / 1_000).toFixed(1) + 'K';
            } else {
                el.innerText = num.toFixed(1);
            }
        }

        // &#9472;&#9472; Institutional Multi-Asset Universe Specs &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        // &#9472;&#9472; Institutional 37 Backtested Symbols Specs &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        const SYMBOL_SPECS = {
            "BTCUSDT":    { display: "BTC/USDT",    name: "Bitcoin",       cat: "major",  prec: 1, minMove: 0.1,    pip: 0.10,    tvSym: "BINANCE:BTCUSDT.P" },
            "ETHUSDT":    { display: "ETH/USDT",    name: "Ethereum",      cat: "major",  prec: 2, minMove: 0.01,   pip: 0.01,    tvSym: "BINANCE:ETHUSDT.P" },
            "SOLUSDT":    { display: "SOL/USDT",    name: "Solana",        cat: "major",  prec: 2, minMove: 0.01,   pip: 0.01,    tvSym: "BINANCE:SOLUSDT.P" },
            "BNBUSDT":    { display: "BNB/USDT",    name: "BNB",           cat: "major",  prec: 2, minMove: 0.01,   pip: 0.01,    tvSym: "BINANCE:BNBUSDT.P" },
            "XRPUSDT":    { display: "XRP/USDT",    name: "XRP",           cat: "major",  prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:XRPUSDT.P" },
            "AVAXUSDT":   { display: "AVAX/USDT",   name: "Avalanche",     cat: "major",  prec: 2, minMove: 0.01,   pip: 0.01,    tvSym: "BINANCE:AVAXUSDT.P" },
            "LINKUSDT":   { display: "LINK/USDT",   name: "Chainlink",     cat: "major",  prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:LINKUSDT.P" },
            "NEARUSDT":   { display: "NEAR/USDT",   name: "NEAR Protocol", cat: "layer1", prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:NEARUSDT.P" },
            "ADAUSDT":    { display: "ADA/USDT",    name: "Cardano",       cat: "layer1", prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:ADAUSDT.P" },
            "SUIUSDT":    { display: "SUI/USDT",    name: "Sui",           cat: "layer1", prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:SUIUSDT.P" },
            "DOGEUSDT":   { display: "DOGE/USDT",   name: "Dogecoin",      cat: "major",  prec: 5, minMove: 0.00001,pip: 0.00001, tvSym: "BINANCE:DOGEUSDT.P" },
            "DOTUSDT":    { display: "DOT/USDT",    name: "Polkadot",      cat: "layer1", prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:DOTUSDT.P" },
            "LTCUSDT":    { display: "LTC/USDT",    name: "Litecoin",      cat: "major",  prec: 2, minMove: 0.01,   pip: 0.01,    tvSym: "BINANCE:LTCUSDT.P" },
            "ARBUSDT":    { display: "ARB/USDT",    name: "Arbitrum",      cat: "alts",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:ARBUSDT.P" },
            "OPUSDT":     { display: "OP/USDT",     name: "Optimism",      cat: "alts",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:OPUSDT.P" },
            "SEIUSDT":    { display: "SEI/USDT",    name: "Sei",           cat: "layer1", prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:SEIUSDT.P" },
            "INJUSDT":    { display: "INJ/USDT",    name: "Injective",     cat: "layer1", prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:INJUSDT.P" },
            "WIFUSDT":    { display: "WIF/USDT",    name: "dogwifhat",     cat: "alts",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:WIFUSDT.P" },
            "PENDLEUSDT": { display: "PENDLE/USDT", name: "Pendle",        cat: "defi",   prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:PENDLEUSDT.P" },
            "JUPUSDT":    { display: "JUP/USDT",    name: "Jupiter",       cat: "defi",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:JUPUSDT.P" },
            "RENDERUSDT": { display: "RENDER/USDT", name: "Render",        cat: "alts",   prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:RENDERUSDT.P" },
            "AAVEUSDT":   { display: "AAVE/USDT",   name: "Aave",          cat: "defi",   prec: 2, minMove: 0.01,   pip: 0.01,    tvSym: "BINANCE:AAVEUSDT.P" },
            "UNIUSDT":    { display: "UNI/USDT",    name: "Uniswap",       cat: "defi",   prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:UNIUSDT.P" },
            "CRVUSDT":    { display: "CRV/USDT",    name: "Curve DAO",     cat: "defi",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:CRVUSDT.P" },
            "DYDXUSDT":   { display: "DYDX/USDT",   name: "dYdX",          cat: "defi",   prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:DYDXUSDT.P" },
            "ENAUSDT":    { display: "ENA/USDT",    name: "Ethena",        cat: "defi",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:ENAUSDT.P" },
            "WLDUSDT":    { display: "WLD/USDT",    name: "Worldcoin",     cat: "alts",   prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:WLDUSDT.P" },
            "PYTHUSDT":   { display: "PYTH/USDT",   name: "Pyth Network",  cat: "alts",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:PYTHUSDT.P" },
            "GMXUSDT":    { display: "GMX/USDT",    name: "GMX",           cat: "defi",   prec: 2, minMove: 0.01,   pip: 0.01,    tvSym: "BINANCE:GMXUSDT.P" },
            "TIAUSDT":    { display: "TIA/USDT",    name: "Celestia",      cat: "layer1", prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:TIAUSDT.P" },
            "ZROUSDT":    { display: "ZRO/USDT",    name: "LayerZero",     cat: "alts",   prec: 3, minMove: 0.001,  pip: 0.001,   tvSym: "BINANCE:ZROUSDT.P" },
            "APEUSDT":    { display: "APE/USDT",    name: "ApeCoin",       cat: "alts",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:APEUSDT.P" },
            "GALAUSDT":   { display: "GALA/USDT",   name: "Gala",          cat: "alts",   prec: 5, minMove: 0.00001,pip: 0.00001, tvSym: "BINANCE:GALAUSDT.P" },
            "SANDUSDT":   { display: "SAND/USDT",   name: "The Sandbox",   cat: "alts",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:SANDUSDT.P" },
            "MANAUSDT":   { display: "MANA/USDT",   name: "Decentraland",  cat: "alts",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:MANAUSDT.P" },
            "LRCUSDT":    { display: "LRC/USDT",    name: "Loopring",      cat: "defi",   prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:LRCUSDT" },
            "STXUSDT":    { display: "STX/USDT",    name: "Stacks",        cat: "layer1", prec: 4, minMove: 0.0001, pip: 0.0001,  tvSym: "BINANCE:STXUSDT.P" }
        };

        // Last-resort fallback reference prices matching backend
        const FALLBACK_PRICES = {
            "BTCUSDT": 86500.00, "ETHUSDT": 2750.00, "SOLUSDT": 118.00, "BNBUSDT": 790.00,
            "XRPUSDT": 1.60, "AVAXUSDT": 11.20, "LINKUSDT": 11.20, "NEARUSDT": 4.80,
            "ADAUSDT": 0.3550, "SUIUSDT": 1.7500, "DOGEUSDT": 0.10500, "DOTUSDT": 4.25,
            "LTCUSDT": 65.00, "ARBUSDT": 0.5400, "OPUSDT": 1.5200, "SEIUSDT": 0.4200,
            "INJUSDT": 21.50, "WIFUSDT": 2.3500, "PENDLEUSDT": 4.150, "JUPUSDT": 0.8200,
            "RENDERUSDT": 5.60, "AAVEUSDT": 155.00, "UNIUSDT": 7.80, "CRVUSDT": 0.2850,
            "DYDXUSDT": 1.15, "ENAUSDT": 0.3850, "WLDUSDT": 1.95, "PYTHUSDT": 0.3250,
            "GMXUSDT": 24.50, "TIAUSDT": 5.80, "ZROUSDT": 3.95, "APEUSDT": 0.7500,
            "GALAUSDT": 0.02250, "SANDUSDT": 0.2750, "MANAUSDT": 0.2950, "LRCUSDT": 0.00917,
            "STXUSDT": 1.6500
        };
        window.FALLBACK_PRICES = FALLBACK_PRICES;

        // One lot represents a different base-asset quantity per market.
        // This shared table keeps ticket calculations and chart-line PnL
        // aligned for every supported symbol.
        const LOT_CONTRACT_SIZES = {BTCUSDT:1,ETHUSDT:10,SOLUSDT:100,BNBUSDT:10,XRPUSDT:1000,AVAXUSDT:100,LINKUSDT:100,NEARUSDT:1000,ADAUSDT:1000,SUIUSDT:1000,DOGEUSDT:10000,DOTUSDT:100,LTCUSDT:10,ARBUSDT:1000,OPUSDT:1000,SEIUSDT:1000,INJUSDT:100,WIFUSDT:1000,PENDLEUSDT:1000,JUPUSDT:1000,RENDERUSDT:100,AAVEUSDT:10,UNIUSDT:100,CRVUSDT:1000,DYDXUSDT:1000,ENAUSDT:1000,WLDUSDT:1000,PYTHUSDT:1000,GMXUSDT:10,TIAUSDT:100,ZROUSDT:100,APEUSDT:1000,GALAUSDT:10000,SANDUSDT:1000,MANAUSDT:1000,LRCUSDT:1000,STXUSDT:1000};

        function getLotContractSize(sym) {
            return LOT_CONTRACT_SIZES[sym] || 1;
        }

        function calculatePositionPnl(position, marketPrice) {
            const entry = Number(position?.entry_price);
            const price = Number(marketPrice);
            const lot = Number(position?.volume_lots ?? position?.lot ?? 0.01);
            if (!Number.isFinite(entry) || !Number.isFinite(price) || !Number.isFinite(lot) || entry <= 0 || price <= 0) return 0;
            const isSell = (position.side === 'SELL' || position.side === 'SHORT');
            const directionalMove = isSell ? (entry - price) : (price - entry);
            const isReal = Boolean(position?.is_real || (position?.pos_id && String(position.pos_id).startsWith("REAL-")));
            const contractSize = isReal ? 1.0 : (Number(position?.contract_size) || getLotContractSize(position.symbol));
            const pnl = directionalMove * lot * contractSize;
            return Number.isFinite(pnl) ? pnl : 0;
        }

        function _setFloatingPnlDisplay(totalPnl) {
            const text = `${totalPnl >= 0 ? '+$' : '-$'}${Math.abs(totalPnl).toFixed(2)}`;
            const className = totalPnl >= 0 ? 'val-green' : 'val-red';
            const nav = document.getElementById('stat-floating');
            const dock = document.getElementById('dock-floating-pnl');
            const account = document.getElementById('disp-tradew-floating');
            if (nav) { nav.textContent = text; nav.className = `nav-stat-val ${className}`; }
            if (dock) { dock.textContent = text; dock.className = className; }
            if (account) {
                account.textContent = `${totalPnl >= 0 ? '+' : '-'}${Math.abs(totalPnl).toFixed(2)}`;
                account.style.color = totalPnl >= 0 ? '#00C076' : '#EF5350';
            }
        }

        function refreshLivePositionMetrics(symbol, price) {
            const positions = cachedPortfolioState?.active_positions || [];
            if (!positions.length || !Number.isFinite(Number(price))) return;
            const numericPrice = Number(price);
            livePricesBySymbol.set(symbol, numericPrice);
            if (symbol === currentSymbol) {
                lastKnownPrice = numericPrice;
            }
            let totalPnl = 0;
            for (const position of positions) {
                const quoted = Number(livePricesBySymbol.get(position.symbol));
                const current = (position.symbol === symbol)
                    ? numericPrice
                    : (Number.isFinite(quoted) && quoted > 0
                        ? quoted
                        : (Number(position.current_price) || Number(position.entry_price)));
                position.current_price = current;
                position.unrealized_pnl = calculatePositionPnl(position, current);
                totalPnl += position.unrealized_pnl;

                const spec = getSymbolSpec(position.symbol);
                const currentCell = document.getElementById(`position-current-${position.pos_id}`);
                const pnlCell = document.getElementById(`position-pnl-${position.pos_id}`);
                if (currentCell) currentCell.textContent = current.toFixed(spec.prec);
                if (pnlCell) {
                    pnlCell.textContent = `${position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}`;
                    pnlCell.className = position.unrealized_pnl >= 0 ? 'val-green' : 'val-red';
                }

                // Fallback: also update by tr[data-pos-id] query selector
                if (!currentCell || !pnlCell) {
                    const row = document.querySelector(`tr[data-pos-id="${position.pos_id}"]`);
                    if (row) {
                        const cells = row.children;
                        if (cells.length >= 12) {
                            if (!currentCell) cells[5].textContent = current.toFixed(spec.prec);
                            if (!pnlCell) {
                                cells[11].textContent = `${position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}`;
                                cells[11].className = position.unrealized_pnl >= 0 ? 'val-green' : 'val-red';
                            }
                        }
                    }
                }

                // Immediate TP/SL Execution Check on Live Tick
                if (!position._closing && !_isDragging && !_isPlacingMissingLevel) {
                    const isLong = (position.side === 'BUY' || position.side === 'LONG');
                    const rawSl = Number(position.sl_price);
                    const rawTp = Number(position.tp_price || position.tranches?.queen?.tp_price);
                    const hasSl = Number.isFinite(rawSl) && rawSl > 0;
                    const hasTp = Number.isFinite(rawTp) && rawTp > 0;

                    const hitSl = hasSl && (isLong ? current <= rawSl : current >= rawSl);
                    const hitTp = hasTp && (isLong ? current >= rawTp : current <= rawTp);

                    if (hitSl || hitTp) {
                        position._closing = true;
                        const reason = hitTp ? 'TP_HIT' : 'SL_HIT';
                        const trigPrice = hitTp ? rawTp : rawSl;
                        fetch('/api/order/close', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pos_id: position.pos_id, reason, trigger_price: trigPrice })
                        }).then(r => r.json()).then(data => {
                            if (typeof fetchPortfolio === 'function') fetchPortfolio();
                        }).catch(() => {
                            position._closing = false;
                        });
                    }
                }
            }
            _setFloatingPnlDisplay(totalPnl);

            // Instant synchronization with on-chart order lines when current symbol ticks
            if (symbol === currentSymbol) {
                const c = document.getElementById('tv-chart');
                if (c && candleSeries && !_isDragging) {
                    _syncOrderLineTickets(c, c.getBoundingClientRect());
                }
            }
        }

        // Apply batched watchlist quotes to any open symbols that don't yet have active WS ticks
        function refreshAllPositionMetricsFromQuotes(quotes) {
            if (!quotes || !cachedPortfolioState?.active_positions?.length) return;
            for (const position of cachedPortfolioState.active_positions) {
                const quote = Number(quotes[position.symbol]);
                if (Number.isFinite(quote) && quote > 0) {
                    const lastTick = _lastTickTimes.get(position.symbol) || 0;
                    if (Date.now() - lastTick > 1500) {
                        refreshLivePositionMetrics(position.symbol, quote);
                    }
                }
            }
        }

        function getSymbolSpec(sym) {
            return SYMBOL_SPECS[sym] || {
                display: `${(sym || "").replace("USDT", "")}/USDT`,
                name: sym,
                cat: "crypto",
                prec: (sym || "").includes("DOGE") ? 5 : ((sym || "").includes("BTC") ? 1 : 2),
                minMove: (sym || "").includes("DOGE") ? 0.00001 : 0.01,
                pip: 0.01,
                tvSym: (sym === "LRCUSDT" ? "BINANCE:LRCUSDT" : `BINANCE:${sym}.P`)
            };
        }

        function formatSymbolDisplay(sym) {
            return getSymbolSpec(sym).display;
        }

        function getSymbolPrecision(sym) {
            return getSymbolSpec(sym).prec;
        }

        // &#9472;&#9472; Nanosecond Micro-Tick Pulse Flashes &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        function triggerTickFlash(elementIdOrEl, isUp) {
            const el = typeof elementIdOrEl === 'string' ? document.getElementById(elementIdOrEl) : elementIdOrEl;
            if (!el) return;
            el.classList.remove('flash-tick-up', 'flash-tick-down');
            void el.offsetWidth; // Force CSS reflow
            el.classList.add(isUp ? 'flash-tick-up' : 'flash-tick-down');



// ============================================================================
// Module: 04_audio.js
// ============================================================================

}

        // &#9472;&#9472; Pure Web Audio API High-Tech Sound Synthesizer &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        let audioCtx = null;
        function getAudioContext() {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) audioCtx = new AudioContext();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return audioCtx;
        }

        function playHapticTone(type) {
            if (!audioEnabled) return;
            try {
                const ctx = getAudioContext();
                if (!ctx) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                const now = ctx.currentTime;
                if (type === 'order' || type === 'BUY' || type === 'SELL') {
                    // High-speed 1200Hz tactical chirp
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1100, now);
                    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.035);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                    osc.start(now);
                    osc.stop(now + 0.04);
                } else if (type === 'close' || type === 'TP') {
                    // Dual tone chime
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(780, now);
                    osc.frequency.exponentialRampToValueAtTime(560, now + 0.06);
                    gain.gain.setValueAtTime(0.09, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                    osc.start(now);
                    osc.stop(now + 0.07);
                } else if (type === 'click') {
                    // Subtle 18ms tactile click
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1800, now);
                    gain.gain.setValueAtTime(0.03, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
                    osc.start(now);
                    osc.stop(now + 0.018);
                }
            } catch(e) { console.warn("Position refresh:", e.message); }
        }

        // &#9472;&#9472; 240Hz RAF Visual Engine & Telemetry Counter &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        let lastRafTime = performance.now();
        let rafFps = 240;
        let rafFrames = 0;



// ============================================================================
// Module: 05_ticker_engine.js
// ============================================================================

function startRafTickerEngine() {
            function loop(now) {
                rafFrames++;
                if (now - lastRafTime >= 850) {
                    rafFps = Math.max(60, Math.round((rafFrames * 1000) / (now - lastRafTime)));
                    rafFrames = 0;
                    lastRafTime = now;

                }
                requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
        }
        startRafTickerEngine();

        // &#9472;&#9472; High-Speed Scalper Hotkeys ([B], [S], [C], [Space], [1-4]) &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        window.addEventListener('keydown', function(e) {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            const key = (e.key || "").toUpperCase();
            if (key === 'B') {
                e.preventDefault();
                playHapticTone('click');
                selectOrderSide('BUY');
                executeSelectedOrder();
            } else if (key === 'S') {
                e.preventDefault();
                playHapticTone('click');
                selectOrderSide('SELL');
                executeSelectedOrder();
            } else if (key === 'C') {
                e.preventDefault();
                batchClosePositions();
            } else if (key === ' ' || e.code === 'Space') {
                e.preventDefault();
                const mktBtn = document.getElementById("btn-tab-market");
                const pndBtn = document.getElementById("btn-tab-limit");
                if (currentOrderType === 'market' && pndBtn) {
                    switchOrderType('limit');
                } else if (mktBtn) {
                    switchOrderType('market');
                }
            } else if (key === '1') {
                setLotPreset(0.01);
            } else if (key === '2') {
                setLotPreset(0.10);
            } else if (key === '3') {
                setLotPreset(0.50);
            } else if (key === '4') {
                setLotPreset(1.00);
            }
        });



// ============================================================================
// Module: 06_order_ticket.js
// ============================================================================

function setLotPreset(val) {
            currentLotSize = val;
            const inp = document.getElementById("inp-lot-val");
            if (inp) inp.value = val.toFixed(2);
            document.querySelectorAll(".lot-preset-btn").forEach(c => {
                if (parseFloat(c.innerText) === val) c.classList.add("active");
                else c.classList.remove("active");
            });
            updateOrderSummary();
        }

        // Theme Toggle (Light vs Dark Screen Mode - Matches User Request for Extra Theme Icon)
        function toggleTheme() {
            const isLight = document.body.classList.toggle("theme-light");
            document.body.classList.toggle("theme-dark", !isLight);

            const themeSvg = document.getElementById("theme-svg-icon");
            const btnTheme = document.getElementById("btn-theme-toggle");
            if (isLight) {
                if (btnTheme) btnTheme.setAttribute("title", "Switch to Dark Theme");
                if (themeSvg) {
                    // Moon SVG Icon
                    themeSvg.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
                }
                localStorage.setItem("tradew_theme", "light");
            } else {
                if (btnTheme) btnTheme.setAttribute("title", "Switch to Light Theme");
                if (themeSvg) {
                    // Sun SVG Icon
                    themeSvg.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
                }
                localStorage.setItem("tradew_theme", "dark");
            }

            // Update Lightweight Charts theme options dynamically
            if (chart) {
                chart.applyOptions({
                    layout: {
                        background: { color: isLight ? '#FFFFFF' : '#121418' },
                        textColor: isLight ? '#1E2329' : '#848E9C',
                    },
                    grid: {
                        vertLines: { color: isLight ? 'rgba(0, 0, 0, 0.035)' : 'rgba(255, 255, 255, 0.05)', style: 1 },
                        horzLines: { color: isLight ? 'rgba(0, 0, 0, 0.035)' : 'rgba(255, 255, 255, 0.05)', style: 1 },
                    },
                    crosshair: {
                        vertLine: { color: isLight ? '#CBD5E1' : '#4A5568' },
                        horzLine: { color: isLight ? '#CBD5E1' : '#4A5568' },
                    },
                    rightPriceScale: {
                        borderColor: isLight ? '#E2E6ED' : '#2A2E39',
                    },
                    timeScale: {
                        borderColor: isLight ? '#E2E6ED' : '#2A2E39',
                    },
                });
            }

            // Apply candle styling: soothing TradeW green & red, or minimalist B&W if toggled
            if (candleSeries) {
                const isBw = isBwCandleMode;
                if (isBw) {
                    candleSeries.applyOptions({
                        upColor: '#FFFFFF',
                        downColor: '#000000',
                        borderUpColor: '#000000',
                        borderDownColor: '#000000',
                        wickUpColor: '#000000',
                        wickDownColor: '#000000',
                    });
                } else {
                    candleSeries.applyOptions({
                        upColor: '#00C076',
                        downColor: '#EF5350',
                        borderUpColor: '#00C076',
                        borderDownColor: '#EF5350',
                        wickUpColor: '#00C076',
                        wickDownColor: '#EF5350',
                    });
                }
            }

            // Volume histogram styling (Color-engineered: vibrant soothing TradeW green/red)
            if (volumeSeries && cachedCandles.length > 0) {
                const volData = cachedCandles.map(c => ({
                    time: c.time,
                    value: (typeof c.volume === 'number' && Number.isFinite(c.volume)) ? c.volume : 0,
                    color: isLight 
                        ? (c.close >= c.open ? 'rgba(0, 192, 118, 0.45)' : 'rgba(239, 83, 80, 0.45)')
                        : (c.close >= c.open ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)')
                }));
                volumeSeries.setData(volData);
                volumeSeries.applyOptions({ visible: isVolumeVisible });
            }

            updateHighLowMarkers();
            requestTradeWOverlayUpdate();
        }

        // Toggle Candlestick Style (Color vs Image 3 Minimalist B&W)
        function toggleCandleStyle() {
            isBwCandleMode = !isBwCandleMode;
            const btn = document.getElementById("btn-candle-style");
            btn.innerHTML = isBwCandleMode ? "<span>&#127912; Color</span>" : "<span>&#127912; B&W</span>";

            if (candleSeries) {
                if (isBwCandleMode) {
                    candleSeries.applyOptions({
                        upColor: '#FFFFFF',
                        downColor: '#000000',
                        borderUpColor: '#000000',
                        borderDownColor: '#000000',
                        wickUpColor: '#000000',
                        wickDownColor: '#000000',
                    });
                } else {
                    candleSeries.applyOptions({
                        upColor: '#0ECB81',
                        downColor: '#F6465D',
                        borderUpColor: '#0ECB81',
                        borderDownColor: '#F6465D',
                        wickUpColor: '#0ECB81',
                        wickDownColor: '#F6465D',
                    });
                }
            }
        }

        // Toggle Footer Height (Expand / Compact, Matches Image 2)
        function toggleDockExpand() {
            const layout = document.querySelector(".master-layout");
            const arrow = document.getElementById("expand-arrow");
            const isExp = layout.classList.toggle("dock-expanded");
            if (arrow) arrow.innerText = isExp ? "&#8963;" : "&#8964;";
            setTimeout(() => {
                if (chart && document.getElementById("tv-chart")) {
                    chart.applyOptions({
                        width: document.getElementById("tv-chart").clientWidth,
                        height: document.getElementById("tv-chart").clientHeight
                    });
                    requestTradeWOverlayUpdate();
                }
            }, 260);
        }

        // High & Low markers handled cleanly via updateBinanceHighLowMarkers overlay (no canvas redraw flicker)
        function updateHighLowMarkers() {
            if (candleSeries && typeof candleSeries.setMarkers === 'function') {
                try { candleSeries.setMarkers([]); } catch(e) {}
            }
        }

        // Helper to format price into prefix and bold suffix (Last 2 digits prominent, exact TradeW style)
        function formatTradeWQuotePrice(price, prec) {
            const s = Number(price).toFixed(prec);
            if (s.length <= 2) return { prefix: s, suffix: "" };
            return {
                prefix: s.slice(0, -2),
                suffix: s.slice(-2)
            };
        }

        // Stepper for Lot sizing (TradeW Vertical +/-)
        function stepLot(delta) {
            currentLotSize = Math.max(0.01, Math.round((currentLotSize + delta) * 100) / 100);
            const inp = document.getElementById("inp-lot-val");
            if (inp) inp.value = currentLotSize.toFixed(2);
            updateOrderSummary();
        }

        function setLotVal(val, btn) {
            currentLotSize = val;
            const inp = document.getElementById("inp-lot-val");
            if (inp) inp.value = val.toFixed(2);
            document.querySelectorAll(".lot-preset-btn").forEach(c => c.classList.remove("active"));
            if (btn) btn.classList.add("active");
            updateOrderSummary();
        }

        function selectOrderSide(side) {
            currentSelectedSide = side;
            const btnAction = document.getElementById("btn-primary-action");
            const btnText = document.getElementById("btn-action-text");
            const cardSell = document.getElementById("quote-card-sell");
            const cardBuy = document.getElementById("quote-card-buy");

            if (side === "BUY") {
                if (cardBuy) cardBuy.classList.add("active");
                if (cardSell) cardSell.classList.remove("active");
                if (btnAction) {
                    btnAction.className = "btn-tradew-main-action btn-buy";
                }
                if (btnText) btnText.innerText = "Buy";
            } else {
                if (cardSell) cardSell.classList.add("active");
                if (cardBuy) cardBuy.classList.remove("active");
                if (btnAction) {
                    btnAction.className = "btn-tradew-main-action btn-sell";
                }
                if (btnText) btnText.innerText = "Sell";
            }

            // Update Take Profit condition text to match active side
            const tpCond = document.getElementById("lbl-tp-cond");
            if (tpCond && lastKnownPrice > 0) {
                const prec = currentSymbol.includes("DOGE") ? 5 : 2;
                const tpRef = side === "BUY" ? (lastKnownPrice * 1.008) : (lastKnownPrice * 0.992);
                tpCond.innerHTML = `&le; ${tpRef.toFixed(prec)}`;
            }
            // Switching direction changes which side of market is protective;
            // regenerate the ticket defaults instead of retaining the old
            // direction's TP/SL levels.
            for (const id of ['inp-tp-price', 'inp-sl-price', 'inp-limit-price']) {
                const input = document.getElementById(id);
                if (input) input.dataset.symbol = '';
            }
            _syncOrderTicketForSymbol(currentSymbol, lastKnownPrice, getSymbolSpec(currentSymbol).prec);
            updateOrderSummary();
        }

        let currentOrderType = "market";
        let isSidebarSummaryExpanded = false;

        function switchOrderType(type) {
            currentOrderType = type;
            document.querySelectorAll(".tradew-tab-item").forEach(b => b.classList.remove("active"));
            const target = document.getElementById(`btn-tab-${type}`);
            if (target) target.classList.add("active");

            const limitSec = document.getElementById("tradew-limit-section");
            if (limitSec) {
                if (type === "limit") {
                    limitSec.style.display = "flex";
                    const inpLimit = document.getElementById("inp-limit-price");
                    if (inpLimit) {
                        const prec = currentSymbol.includes("DOGE") ? 5 : (currentSymbol.includes("BTC") ? 1 : 2);
                        if (lastKnownPrice > 0) {
                            inpLimit.value = lastKnownPrice.toFixed(prec);
                        }
                    }
                } else {
                    limitSec.style.display = "none";
                }
            }
            updateOrderSummary();
        }

        function stepLimitPrice(delta) {
            const inp = document.getElementById("inp-limit-price");
            if (!inp) return;
            const prec = currentSymbol.includes("DOGE") ? 5 : (currentSymbol.includes("BTC") ? 1 : 2);
            const step = prec === 5 ? 0.00005 : (prec === 1 ? 5 : 0.5);
            let val = parseFloat(inp.value) || lastKnownPrice || 0.08860;
            val += delta * step;
            inp.value = val.toFixed(prec);
            updateOrderSummary();
        }

        function onLimitPriceChange() {
            updateOrderSummary();
        }

        function checkLimitPriceValidity() {
            const warn = document.getElementById("limit-price-warning");
            const inp = document.getElementById("inp-limit-price");
            if (!warn || !inp) return;
            const limVal = parseFloat(inp.value);
            if (isNaN(limVal) || limVal <= 0 || lastKnownPrice <= 0) {
                warn.style.display = "none";
                return;
            }
            // In financial limit orders:
            // For SELL limit order: limit price must be higher than market price. If lower or equal, show Incorrect Price
            // For BUY limit order: limit price must be lower than market price. If higher or equal, show Incorrect Price
            if (currentSelectedSide === "SELL" && limVal <= lastKnownPrice * 0.9999) {
                warn.style.display = "block";
                warn.innerText = "Incorrect Price";
            } else if (currentSelectedSide === "BUY" && limVal >= lastKnownPrice * 1.0001) {
                warn.style.display = "block";
                warn.innerText = "Incorrect Price";
            } else {
                warn.style.display = "none";
            }
        }

        function toggleSidebarSummaryExpand() {
            isSidebarSummaryExpanded = !isSidebarSummaryExpanded;
            const extra = document.getElementById("tradew-extra-summary");
            const lbl = document.getElementById("sidebar-expand-text");
            if (extra) {
                extra.style.display = isSidebarSummaryExpanded ? "flex" : "none";
            }
            if (lbl) {
                lbl.innerText = isSidebarSummaryExpanded ? "Collapse &#8963;" : "Expand &#8744;";
            }
        }

        function toggleTpSection(checked) {
            const body = document.getElementById("tp-body");
            if (body) body.style.display = checked ? "flex" : "none";
        }

        function toggleSlSection(checked) {
            const body = document.getElementById("sl-body");
            if (body) body.style.display = checked ? "flex" : "none";
        }

        function stepTpPrice(delta) {
            const inp = document.getElementById("inp-tp-price");
            if (!inp) return;
            const prec = currentSymbol.includes("DOGE") ? 5 : 2;
            const step = prec === 5 ? 0.00005 : (prec === 1 ? 5 : 0.5);
            let val = parseFloat(inp.value) || (lastKnownPrice * 1.005);
            val += delta * step;
            inp.value = val.toFixed(prec);
            validateTpRange();
        }

        function stepSlPrice(delta) {
            const inp = document.getElementById("inp-sl-price");
            if (!inp) return;
            const prec = currentSymbol.includes("DOGE") ? 5 : 2;
            const step = prec === 5 ? 0.00005 : (prec === 1 ? 5 : 0.5);
            let val = parseFloat(inp.value) || (lastKnownPrice * 0.995);
            val += delta * step;
            inp.value = val.toFixed(prec);
            validateSlRange();
        }

        function validateTpRange() {
            const warn = document.getElementById("tp-range-warning");
            const inp = document.getElementById("inp-tp-price");
            const pnl = document.getElementById("disp-tp-pnl");
            const pts = document.getElementById("disp-tp-pts");
            if (!warn || !inp || lastKnownPrice <= 0) return;
            const val = parseFloat(inp.value);
            if (isNaN(val) || val <= 0) { warn.style.display = "none"; return; }
            const prec = currentSymbol.includes("DOGE") ? 5 : (currentSymbol.includes("BTC") ? 1 : 2);
            const pipMult = prec === 5 ? 100000 : (prec === 1 ? 10 : 100);
            let isOk = false;
            if (currentSelectedSide === "BUY") {
                isOk = val > lastKnownPrice;
            } else {
                isOk = val < lastKnownPrice;
            }
            warn.style.display = isOk ? "none" : "block";
            if (isOk) {
                const diff = (val - lastKnownPrice) * (currentSelectedSide === "BUY" ? 1 : -1);
                const pips = Math.round(diff * pipMult);
                const rawPnl = Math.abs(diff * currentLotSize * getLotContractSize(currentSymbol));
                const projectedPnl = Number.isFinite(rawPnl) ? rawPnl.toFixed(2) : "0.00";
                if (pnl) pnl.textContent = "Take Profit: +" + projectedPnl;
                if (pts) pts.textContent = "Point:" + (pips >= 0 ? "-" : "+") + Math.abs(pips);
            } else {
                if (pnl) pnl.textContent = "Take Profit: 0";
                if (pts) pts.textContent = "Point:--";
            }
        }

        function validateSlRange() {
            const warn = document.getElementById("sl-range-warning");
            const inp = document.getElementById("inp-sl-price");
            const pnl = document.getElementById("disp-sl-pnl");
            const pts = document.getElementById("disp-sl-pts");
            if (!warn || !inp || lastKnownPrice <= 0) return;
            const val = parseFloat(inp.value);
            if (isNaN(val) || val <= 0) { warn.style.display = "none"; return; }
            const prec = currentSymbol.includes("DOGE") ? 5 : (currentSymbol.includes("BTC") ? 1 : 2);
            const pipMult = prec === 5 ? 100000 : (prec === 1 ? 10 : 100);
            let isOk = false;
            if (currentSelectedSide === "BUY") {
                isOk = val < lastKnownPrice;
            } else {
                isOk = val > lastKnownPrice;
            }
            warn.style.display = isOk ? "none" : "block";
            if (isOk) {
                const diff = (lastKnownPrice - val) * (currentSelectedSide === "BUY" ? 1 : -1);
                const pips = Math.round(Math.abs(diff) * pipMult);
                const rawPnl = Math.abs(diff * currentLotSize * getLotContractSize(currentSymbol));
                const projectedPnl = Number.isFinite(rawPnl) ? rawPnl.toFixed(2) : "0.00";
                if (pnl) pnl.textContent = "Stop Loss: -" + projectedPnl;
                if (pts) pts.textContent = "Point:+" + pips;
            } else {
                if (pnl) pnl.textContent = "Stop Loss: 0";
                if (pts) pts.textContent = "Point:--";
            }
        }

        function updateOrderSummary() {
            const livePrice = Number(livePricesBySymbol.get(currentSymbol));
            const candleClose = (cachedCandles && cachedCandles.length > 0) ? cachedCandles[cachedCandles.length - 1]?.close : 0;
            const price = (lastKnownPrice > 0) ? lastKnownPrice : ((Number.isFinite(livePrice) && livePrice > 0) ? livePrice : (Number(candleClose) || 100));
            const contractSize = getLotContractSize(currentSymbol);
            const notional = price * currentLotSize * contractSize;
            const leverage = 50;
            const margin = notional / leverage;
            const fee = notional * 0.0005; // 0.05% standard taker fee

            const dispTotal = document.getElementById("disp-total-notional");
            const dispMargin = document.getElementById("disp-margin-req");
            const dispFee = document.getElementById("disp-fee-val");
            const dispLev = document.getElementById("disp-leverage-val");

            if (dispTotal) dispTotal.innerText = `${Number.isFinite(notional) ? notional.toFixed(2) : "0.00"}`;
            if (dispMargin) dispMargin.innerText = `${Number.isFinite(margin) ? margin.toFixed(2) : "0.00"}`;
            if (dispFee) dispFee.innerText = `${Number.isFinite(fee) ? fee.toFixed(2) : "0.00"}`;
            if (dispLev) dispLev.innerText = `1:${leverage}`;

            checkLimitPriceValidity();
        }

        function _resetOrderTicketForSymbolSwitch() {
            // Ticket inputs must never retain a previous market's price. An
            // empty, disabled ticket is safer than displaying BTC levels while
            // ETH (or any other market) is selected.
            for (const id of ['inp-tp-price', 'inp-sl-price', 'inp-limit-price']) {
                const input = document.getElementById(id);
                if (input) {
                    input.value = '';
                    input.dataset.symbol = '';
                }
            }
            for (const id of ['lbl-tp-cond', 'lbl-sl-cond']) {
                const label = document.getElementById(id);
                if (label) label.textContent = '—';
            }
            for (const id of ['disp-tp-pnl', 'disp-tp-pts', 'disp-sl-pnl', 'disp-sl-pts']) {
                const label = document.getElementById(id);
                if (label) label.textContent = id.includes('pts') ? 'Point:--' : '—';
            }
            const action = document.getElementById('btn-primary-action');
            if (action) {
                action.disabled = false;
                action.dataset.symbol = currentSymbol;
            }
        }

        function _syncOrderTicketForSymbol(symbol, price, precision) {
            if (symbol !== currentSymbol || !Number.isFinite(price) || price <= 0) return;
            const isBuy = currentSelectedSide === 'BUY';
            const levels = {
                'inp-tp-price': isBuy ? price * 1.008 : price * 0.992,
                'inp-sl-price': isBuy ? price * 0.992 : price * 1.008,
                'inp-limit-price': price,
            };
            for (const [id, value] of Object.entries(levels)) {
                const input = document.getElementById(id);
                // Preserve a manual edit only while the trader stays on the
                // same market; a new market always receives new valid levels.
                if (input && input.dataset.symbol !== symbol) {
                    input.value = value.toFixed(precision);
                    input.dataset.symbol = symbol;
                }
            }
            const tpCond = document.getElementById('lbl-tp-cond');
            const slCond = document.getElementById('lbl-sl-cond');
            if (tpCond) tpCond.textContent = `${isBuy ? '≥' : '≤'} ${(isBuy ? price * 1.008 : price * 0.992).toFixed(precision)}`;
            if (slCond) slCond.textContent = `${isBuy ? '≤' : '≥'} ${(isBuy ? price * 0.992 : price * 1.008).toFixed(precision)}`;
            const action = document.getElementById('btn-primary-action');
            if (action) {
                action.disabled = false;
                action.dataset.symbol = symbol;
            }
            validateTpRange();
            validateSlRange();
            updateOrderSummary();
        }

        // TradeW Account Switching (Demo vs Standard/Real - Matches media_1789955158818.png)
        let currentActiveAccount = localStorage.getItem('tradew_active_account') || 'demo';
        let tempSelectedAccount = currentActiveAccount;



// ============================================================================
// Module: 07_theme_account.js
// ============================================================================

function toggleSelectAccountModal(event) {
            if (event) event.stopPropagation();
            const dropdown = document.getElementById('tradew-select-acct-dropdown');
            const chevron = document.getElementById('disp-tradew-chevron');
            if (!dropdown) return;
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                dropdown.classList.remove('open');
                if (chevron) chevron.innerText = '&#9660;';
            } else {
                tempSelectedAccount = currentActiveAccount;
                updateAccountCardSelectionUI();
                dropdown.classList.add('open');
                if (chevron) chevron.innerText = '&#9650;';
            }
        }

        function selectAccountOption(choice) {
            tempSelectedAccount = choice;
            updateAccountCardSelectionUI();
        }

        function updateAccountCardSelectionUI() {
            const cardStd = document.getElementById('card-standard');
            const cardDemo = document.getElementById('card-demo');
            if (cardStd && cardDemo) {
                if (tempSelectedAccount === 'standard') {
                    cardStd.classList.add('selected');
                    cardDemo.classList.remove('selected');
                } else {
                    cardDemo.classList.add('selected');
                    cardStd.classList.remove('selected');
                }
            }
        }

        function confirmAccountChoice() {
            currentActiveAccount = tempSelectedAccount;
            try { localStorage.setItem('tradew_active_account', currentActiveAccount); } catch(e) {}
            
            const dropdown = document.getElementById('tradew-select-acct-dropdown');
            const chevron = document.getElementById('disp-tradew-chevron');
            if (dropdown) dropdown.classList.remove('open');
            if (chevron) chevron.innerText = '▼';

            // 1. Completely purge in-memory portfolio state
            cachedPortfolioState = null;

            // 2. Clear all chart lines, badges, and tickets immediately
            if (typeof _clearActiveChartLines === 'function') _clearActiveChartLines();
            if (typeof _elbSetPosition === 'function') _elbSetPosition(null);
            if (typeof _hideOrderLineTickets === 'function') _hideOrderLineTickets();

            // 3. Clear bottom dock positions table and counter immediately
            const posTbody = document.getElementById("dock-pos-tbody");
            if (posTbody) {
                posTbody.innerHTML = `
                    <tr>
                        <td colspan="13">
                            <div class="tradew-empty-container">
                                <svg width="56" height="56" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:8px;opacity:0.45">
                                    <ellipse cx="40" cy="66" rx="22" ry="5" fill="#2B313A" opacity="0.5"/>
                                    <g transform="rotate(-12, 40, 38)">
                                        <rect x="18" y="16" width="44" height="36" rx="4" fill="#1E2329" stroke="#2B313A" stroke-width="1.5"/>
                                        <line x1="26" y1="27" x2="54" y2="27" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                        <line x1="26" y1="33" x2="48" y2="33" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                        <line x1="26" y1="39" x2="42" y2="39" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                    </g>
                                    <g transform="rotate(6, 40, 42)" opacity="0.5">
                                        <rect x="20" y="24" width="40" height="30" rx="4" fill="#181A20" stroke="#2B313A" stroke-width="1.2"/>
                                    </g>
                                    <circle cx="14" cy="22" r="1.5" fill="#3D4755" opacity="0.6"/>
                                    <circle cx="64" cy="30" r="1" fill="#3D4755" opacity="0.5"/>
                                    <circle cx="60" cy="58" r="1.5" fill="#3D4755" opacity="0.4"/>
                                </svg>
                                <span style="font-size: 13px; font-weight: 400; color: #848E9C;">No records</span>
                            </div>
                        </td>
                    </tr>
                `;
            }
            if (typeof _lastRenderedPosIds !== 'undefined') _lastRenderedPosIds = "";
            const cntPosEl = document.getElementById("cnt-pos");
            if (cntPosEl) cntPosEl.innerText = "0";
            const cntPendEl = document.getElementById("cnt-pending");
            if (cntPendEl) cntPendEl.innerText = "0";

            // 4. Reset floating P&L and balance displays
            if (typeof _setFloatingPnlDisplay === 'function') _setFloatingPnlDisplay(0);

            // 5. Reset multi-position stream
            if (typeof multiPosWs !== 'undefined' && multiPosWs) {
                try { multiPosWs.close(); } catch(e) {}
                multiPosWs = null;
            }
            if (typeof _activeMultiPosStreams !== 'undefined') _activeMultiPosStreams = "";

            // 6. Apply account theme/labels
            applyActiveAccountUI();

            // 7. Request fresh portfolio for the chosen mode
            if (typeof fetchPortfolio === 'function') fetchPortfolio();
        }

        function applyActiveAccountUI() {
            const badge = document.getElementById('disp-tradew-acct-badge');
            const idEl = document.getElementById('disp-tradew-acct-id');
            const balEl = document.getElementById('disp-tradew-bal');
            const pnlEl = document.getElementById('disp-tradew-floating');
            const demoBadge = document.getElementById('badge-action-demo');
            const btnPrimary = document.getElementById('btn-primary-action');

            if (currentActiveAccount === 'standard') {
                if (badge) {
                    badge.innerText = 'LIVE ⚡';
                    badge.style.background = '#F0B90B';
                    badge.style.color = '#000000';
                    badge.style.border = 'none';
                    badge.style.fontWeight = '800';
                    badge.style.boxShadow = '0 0 10px rgba(240, 185, 11, 0.45)';
                }
                if (idEl) {
                    idEl.innerHTML = '#161****1279 <span class="tradew-chevron" id="disp-tradew-chevron">&#9660;</span>';
                }
                if (demoBadge) {
                    demoBadge.innerText = 'LIVE ⚡';
                    demoBadge.style.background = '#F0B90B';
                    demoBadge.style.color = '#000000';
                }
                if (btnPrimary) {
                    btnPrimary.style.boxShadow = '0 0 14px rgba(240, 185, 11, 0.35)';
                }
            } else {
                if (badge) {
                    badge.innerText = 'Demo';
                    badge.style.background = '#1877F2';
                    badge.style.color = '#FFFFFF';
                    badge.style.border = 'none';
                    badge.style.fontWeight = '700';
                    badge.style.boxShadow = 'none';
                }
                if (idEl) {
                    idEl.innerHTML = '#161****1279 <span class="tradew-chevron" id="disp-tradew-chevron">&#9660;</span>';
                }
                if (demoBadge) {
                    demoBadge.innerText = 'DEMO';
                    demoBadge.style.background = 'rgba(0, 0, 0, 0.25)';
                    demoBadge.style.color = '#FFFFFF';
                }
                if (btnPrimary) {
                    btnPrimary.style.boxShadow = 'none';
                }
            }

            if (cachedPortfolioState && cachedPortfolioState.wallet_balance !== undefined) {
                if (balEl) balEl.innerText = cachedPortfolioState.wallet_balance.toFixed(2);
            } else {
                if (balEl && (!balEl.innerText || balEl.innerText === '0.00')) balEl.innerText = '20.55';
            }
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('tradew-select-acct-dropdown');
            const topBar = document.getElementById('tradew-top-account-bar');
            if (dropdown && dropdown.classList.contains('open')) {
                if (!dropdown.contains(e.target) && (!topBar || !topBar.contains(e.target))) {
                    dropdown.classList.remove('open');
                    const chevron = document.getElementById('disp-tradew-chevron');
                    if (chevron) chevron.innerText = '&#9660;';
                }
            }
        });



// ============================================================================
// Module: 08_chart_engine.js
// ============================================================================

function executeSelectedOrder() {
            const action = document.getElementById('btn-primary-action');
            let price = Number(lastKnownPrice);
            if (!price || price <= 0) {
                price = Number(currentCandle?.close);
            }
            if ((!price || price <= 0) && cachedCandles && cachedCandles.length > 0) {
                price = Number(cachedCandles[cachedCandles.length - 1].close);
            }
            if (!price || price <= 0) {
                _dragToast('Connecting to market price feed...', '#F6465D');
                return;
            }
            lastKnownPrice = price;
            if (action) {
                action.dataset.symbol = currentSymbol;
                action.disabled = false;
            }

            const lot = currentLotSize || 0.01;
            const side = currentSelectedSide || "BUY";
            const isLimit = currentOrderType === "limit";
            const limitPrice = isLimit ? parseFloat(document.getElementById("inp-limit-price")?.value) : null;
            
            // Sanity-check TP/SL to ensure they match current market magnitude
            let tpPrice = null;
            let slPrice = null;
            const isBuy = (side === "BUY");
            const spec = getSymbolSpec(currentSymbol);
            const prec = spec.prec || 2;

            if (document.getElementById("chk-tp-enable")?.checked) {
                const val = parseFloat(document.getElementById("inp-tp-price")?.value);
                if (Number.isFinite(val) && val > price * 0.1 && val < price * 10) {
                    tpPrice = val;
                } else {
                    tpPrice = parseFloat((isBuy ? price * 1.008 : price * 0.992).toFixed(prec));
                }
            }
            if (document.getElementById("chk-sl-enable")?.checked) {
                const val = parseFloat(document.getElementById("inp-sl-price")?.value);
                if (Number.isFinite(val) && val > price * 0.1 && val < price * 10) {
                    slPrice = val;
                } else {
                    slPrice = parseFloat((isBuy ? price * 0.992 : price * 1.008).toFixed(prec));
                }
            }

            sendOrder(side, lot, isLimit, limitPrice, tpPrice, slPrice, price);
        }

        // Timeframe Switch
        function switchTf(tf, btn) {
            if (tf === currentInterval) return;
            currentInterval = tf;
            _resetChartForSymbolSwitch();
            document.querySelectorAll(".tf-pill").forEach(b => b.classList.remove("active"));
            if (btn) btn.classList.add("active");
            document.getElementById("chart-sym-title").innerText = `&#128200; ${currentSymbol} · ${tf}`;

            const tvIframe = document.getElementById("tv-iframe");
            if (tvIframe) {
                const isLight = document.body.classList.contains("theme-light");
                const map = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
                const spec = getSymbolSpec(currentSymbol);
                const tvSymbol = spec.tvSym || (currentSymbol === 'LRCUSDT' ? 'BINANCE:LRCUSDT' : 'BINANCE:' + currentSymbol + '.P');
                const newSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${encodeURIComponent(tvSymbol)}&interval=${map[tf] || "1"}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=${isLight ? 'FFFFFF' : '181A20'}&theme=${isLight ? 'light' : 'dark'}&style=1&timezone=Etc%2FUTC&studies=%5B%5D&hideideas=1`;
                tvIframe.dataset.src = newSrc;
                if (currentChartMode === 'tv' && tvIframe.src !== newSrc) tvIframe.src = newSrc;
            }

            const binanceIframe = document.getElementById("binance-iframe");
            if (binanceIframe) {
                const map = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
                const spec = getSymbolSpec(currentSymbol);
                const tvSymbol = spec.tvSym || (currentSymbol === 'LRCUSDT' ? 'BINANCE:LRCUSDT' : 'BINANCE:' + currentSymbol + '.P');
                const newBinanceSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_binance&symbol=${encodeURIComponent(tvSymbol)}&interval=${map[tf] || "1"}&hidesidetoolbar=0&symboledit=0&saveimage=1&toolbarbg=181A20&theme=dark&style=1&timezone=Etc%2FUTC&studies=%5B%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A7%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A25%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A99%7D%7D%5D&hideideas=1`;
                binanceIframe.dataset.src = newBinanceSrc;
                if (currentChartMode === 'binance' && binanceIframe.src !== newBinanceSrc) binanceIframe.src = newBinanceSrc;
            }

            loadChartCandles();
            initNanoWebSocket(currentSymbol, tf);
        }

        // Set Chart Mode: 'native' | 'tv' | 'binance'
        function setChartMode(mode) {
            currentChartMode = mode;
            isTvIframeMode = (mode === 'tv' || mode === 'binance');
            try { localStorage.setItem("watch_chart_mode", mode); } catch(e) {}

            const wrap = document.getElementById("chart-wrapper");
            const tvChart = document.getElementById("tv-chart");
            const tvIframe = document.getElementById("tv-iframe");
            const binanceWrap = document.getElementById("binance-iframe-wrap");
            const binanceIframe = document.getElementById("binance-iframe");

            const btnNative = document.getElementById("btn-mode-native");
            const btnTv = document.getElementById("btn-mode-tv");
            const btnBinance = document.getElementById("btn-mode-binance");

            if (btnNative) btnNative.classList.toggle("active", mode === "native");
            if (btnTv) btnTv.classList.toggle("active", mode === "tv");
            if (btnBinance) btnBinance.classList.toggle("active", mode === "binance");

            const isLight = document.body.classList.contains("theme-light");

            if (mode === "binance") {
                if (wrap) wrap.classList.add("iframe-mode");
                if (tvChart) tvChart.style.display = "none";
                if (tvIframe) tvIframe.style.display = "none";
                if (binanceWrap) binanceWrap.style.display = "block";

                const map = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
                const spec = getSymbolSpec(currentSymbol);
                const tvSymbol = spec.tvSym || (currentSymbol === 'LRCUSDT' ? 'BINANCE:LRCUSDT' : 'BINANCE:' + currentSymbol + '.P');
                const targetSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_binance&symbol=${encodeURIComponent(tvSymbol)}&interval=${map[currentInterval] || "1"}&hidesidetoolbar=0&symboledit=0&saveimage=1&toolbarbg=181A20&theme=dark&style=1&timezone=Etc%2FUTC&studies=%5B%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A7%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A25%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A99%7D%7D%5D&hideideas=1`;

                if (binanceIframe && (!binanceIframe.src || binanceIframe.src === "" || binanceIframe.src === "about:blank" || binanceIframe.src !== targetSrc)) {
                    binanceIframe.src = targetSrc;
                    binanceIframe.dataset.src = targetSrc;
                }
                const extLink = document.getElementById("binance-external-link");
                if (extLink) extLink.href = `https://www.binance.com/en/futures/${currentSymbol}`;
                const btnLink = document.getElementById("btn-mode-binance-link");
                if (btnLink) btnLink.href = `https://www.binance.com/en/futures/${currentSymbol}`;
                const binanceSymEl = document.getElementById("binance-frame-sym");
                if (binanceSymEl) binanceSymEl.innerText = `${currentSymbol} Perpetual`;
                updateOnChartOrderLines();
            } else if (mode === "tv") {
                if (wrap) wrap.classList.add("iframe-mode");
                if (tvChart) tvChart.style.display = "none";
                if (binanceWrap) binanceWrap.style.display = "none";
                if (tvIframe) tvIframe.style.display = "block";

                const map = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
                const spec = getSymbolSpec(currentSymbol);
                const tvSymbol = spec.tvSym || (currentSymbol === 'LRCUSDT' ? 'BINANCE:LRCUSDT' : 'BINANCE:' + currentSymbol + '.P');
                const expectedSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${encodeURIComponent(tvSymbol)}&interval=${map[currentInterval] || "1"}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=${isLight ? 'FFFFFF' : '181A20'}&theme=${isLight ? 'light' : 'dark'}&style=1&timezone=Etc%2FUTC&studies=%5B%5D&hideideas=1`;
                if (!tvIframe.src || tvIframe.src === "" || tvIframe.src === "about:blank" || tvIframe.src !== expectedSrc) {
                    tvIframe.src = expectedSrc;
                    tvIframe.dataset.src = expectedSrc;
                }
                updateOnChartOrderLines();
            } else {
                // native
                if (wrap) wrap.classList.remove("iframe-mode");
                if (binanceWrap) binanceWrap.style.display = "none";
                if (tvIframe) tvIframe.style.display = "none";
                if (tvChart) tvChart.style.display = "block";

                updateOnChartOrderLines();
                if (chart && document.getElementById("tv-chart")) {
                    chart.applyOptions({
                        width: document.getElementById("tv-chart").clientWidth,
                        height: document.getElementById("tv-chart").clientHeight
                    });
                }
                loadChartCandles();
                initNanoWebSocket(currentSymbol, currentInterval);
            }
        }

        // Toggle Chart Mode (legacy support)
        function toggleChartMode(forceMode) {
            if (typeof forceMode === "boolean") {
                setChartMode(forceMode ? 'tv' : 'native');
            } else {
                setChartMode(currentChartMode === 'native' ? 'tv' : 'native');
            }
        }

        // Initialize TradingView Candlestick Chart (Matches Global TV Reference in Volume & Grid)
        function initTradingViewChart() {
            const container = document.getElementById("tv-chart");
            if (chartResizeObserver) {
                chartResizeObserver.disconnect();
                chartResizeObserver = null;
            }
            // Destroy previous chart instance cleanly to prevent duplicate series / price lines
            if (chart) {
                try {
                    // Remove all active price lines first
                    if (candleSeries) {
                        for (const pl of activePriceLines) {
                            try { candleSeries.removePriceLine(pl); } catch(e) {}
                        }
                    }
                    if (ma7Series) { try { chart.removeSeries(ma7Series); } catch(e) {} ma7Series = null; }
                    if (ma25Series) { try { chart.removeSeries(ma25Series); } catch(e) {} ma25Series = null; }
                    if (ma99Series) { try { chart.removeSeries(ma99Series); } catch(e) {} ma99Series = null; }
                    chart.remove();
                } catch(e) {}
                chart = null;
                candleSeries = null;
                volumeSeries = null;
                ma7Series = null;
                ma25Series = null;
                ma99Series = null;
                activePriceLines = [];
            }
            container.innerHTML = "";
            
            const isLight = document.body.classList.contains("theme-light");
            const spec = getSymbolSpec(currentSymbol);
            const prec = spec.prec !== undefined ? spec.prec : 2;
            const minMove = spec.minMove !== undefined ? spec.minMove : 0.1;

            chart = LightweightCharts.createChart(container, {
                width: container.clientWidth || 800,
                height: container.clientHeight || 500,
                attributionLogo: false,
                layout: {
                    background: { color: isLight ? '#FFFFFF' : '#181A20' },
                    textColor: isLight ? '#1E2329' : '#848E9C',
                    attributionLogo: false,
                },
                grid: {
                    vertLines: { color: isLight ? 'rgba(0, 0, 0, 0.035)' : 'rgba(255, 255, 255, 0.04)', style: 1 },
                    horzLines: { color: isLight ? 'rgba(0, 0, 0, 0.035)' : 'rgba(255, 255, 255, 0.04)', style: 1 },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                    vertLine: { visible: false },
                    horzLine: { color: isLight ? '#CBD5E1' : '#848E9C', style: 2, width: 1 },
                },
                rightPriceScale: {
                    borderColor: isLight ? '#E2E6ED' : '#2B313A',
                    scaleMargins: { top: 0.08, bottom: 0.08 },
                },
                timeScale: {
                    borderColor: isLight ? '#E2E6ED' : '#2B313A',
                    timeVisible: true,
                    secondsVisible: false,
                    rightOffset: 5,
                    barSpacing: 15,
                    minBarSpacing: 2,
                    tickMarkFormatter: (time) => {
                        const d = new Date(time * 1000);
                        const h = String(d.getUTCHours()).padStart(2, '0');
                        const m = String(d.getUTCMinutes()).padStart(2, '0');
                        return `${h}:${m}`;
                    }
                },
                localization: {
                    timeFormatter: (timestamp) => {
                        const d = new Date(timestamp * 1000);
                        const h = String(d.getUTCHours()).padStart(2, '0');
                        const m = String(d.getUTCMinutes()).padStart(2, '0');
                        return `${h}:${m}`;
                    },
                    dateFormatter: (timestamp) => {
                        const d = new Date(timestamp * 1000);
                        const y = d.getUTCFullYear();
                        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(d.getUTCDate()).padStart(2, '0');
                        return `${y}/${m}/${day}`;
                    },
                    priceFormatter: (price) => {
                        if (typeof price !== 'number' || isNaN(price)) return '';
                        return Number(price).toFixed(prec);
                    }
                }
            });

            const isBw = isBwCandleMode;
            candleSeries = chart.addCandlestickSeries({
                upColor: isBw ? '#FFFFFF' : '#0ECB81',
                downColor: isBw ? '#000000' : '#F6465D',
                borderUpColor: isBw ? '#000000' : '#0ECB81',
                borderDownColor: isBw ? '#000000' : '#F6465D',
                wickUpColor: isBw ? '#000000' : '#0ECB81',
                wickDownColor: isBw ? '#000000' : '#F6465D',
                wickVisible: true,
                borderVisible: true,
                priceFormat: {
                    type: 'price',
                    precision: prec,
                    minMove: minMove,
                },
            });

            // Pure clean candlesticks: No MA lines, no volume bars on chart
            ma7Series = null;
            ma25Series = null;
            ma99Series = null;
            volumeSeries = null;

            chartResizeObserver = new ResizeObserver(entries => {
                if (!entries || entries.length === 0) return;
                const { width, height } = entries[0].contentRect;
                if (chart && width > 0 && height > 0) {
                    chart.applyOptions({ width, height });
                    requestTradeWOverlayUpdate();
                    updateBinanceHighLowMarkers();
                }
            });
            chartResizeObserver.observe(container);

            chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
                requestTradeWOverlayUpdate();
                updateBinanceHighLowMarkers();
            });
            chart.timeScale().subscribeVisibleTimeRangeChange(() => {
                requestTradeWOverlayUpdate();
                updateBinanceHighLowMarkers();
            });
            chart.subscribeCrosshairMove((param) => {
                requestTradeWOverlayUpdate();
                const pointerY = Number(param?.point?.y);
                let overlapsOrderTag = false;
                if (Number.isFinite(pointerY) && candleSeries) {
                    for (const line of activePriceLines) {
                        const type = line?._meta?.lineType;
                        if (type !== 'SL' && type !== 'TP' && type !== 'ENTRY' && type !== 'MARKET') continue;
                        let lineY = null;
                        try { lineY = candleSeries.priceToCoordinate(Number(line.options().price)); } catch (error) {}
                        if (Number.isFinite(lineY) && Math.abs(lineY - pointerY) < 12) {
                            overlapsOrderTag = true;
                            break;
                        }
                    }
                }
                const nextCrosshairVisible = !overlapsOrderTag;
                if (nextCrosshairVisible !== crosshairPriceLabelVisible) {
                    crosshairPriceLabelVisible = nextCrosshairVisible;
                    try {
                        chart.applyOptions({
                            crosshair: {
                                horzLine: {
                                    color: document.body.classList.contains('theme-light') ? '#CBD5E1' : '#848E9C',
                                    visible: nextCrosshairVisible,
                                    labelVisible: nextCrosshairVisible,
                                },
                            },
                        });
                    } catch (error) {}
                }
                // Update Binance OHLC Header Legend
                if (param && param.seriesData && candleSeries) {
                    const c = param.seriesData.get(candleSeries);
                    updateBinanceOhlcLegend(c || currentCandle);
                } else {
                    updateBinanceOhlcLegend(currentCandle);
                }
                // Update Binance OHLC Header Legend
                if (param && param.seriesData && candleSeries) {
                    const c = param.seriesData.get(candleSeries);
                    updateBinanceOhlcLegend(c || currentCandle);
                } else {
                    updateBinanceOhlcLegend(currentCandle);
                }
            });

            updateBinanceHighLowMarkers();
            startCandleCountdownTimer();
        }

        // Clean naked price action: MA and volume calculations disabled
        // Clean naked price action: MA and volume calculations disabled
        function calculateSMA(candles, period) { return []; }
        function updateLiveMAs(c, candles) { return; }
        function toggleMaVisibility(e) { return; }
        function toggleVolumeVisibility(e) { return; }
        function applyVolumeVisibilityUI() { return; }

        // Live Candle Countdown Timer (Exact Binance Futures Parity)
        let _candleCountdownTimer = null;
        function startCandleCountdownTimer() {
            if (_candleCountdownTimer) return;
            _candleCountdownTimer = setInterval(() => {
                const el = document.getElementById('disp-candle-countdown');
                if (!el) return;
                if (!currentCandle || !currentCandle.time) {
                    el.innerText = '--:--';
                    return;
                }
                const tfSec = getTfSeconds(currentInterval);
                const nowSec = Math.floor(Date.now() / 1000);
                const candleCloseTime = currentCandle.time + tfSec;
                const rem = Math.max(0, candleCloseTime - nowSec);
                const m = Math.floor(rem / 60);
                const s = rem % 60;
                el.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }, 500);
        }

        // Binance Official OHLC Bar Header Updater
        function updateBinanceOhlcLegend(c) {
            if (!c) c = currentCandle;
            if (!c && cachedCandles && cachedCandles.length > 0) c = cachedCandles[cachedCandles.length - 1];
            if (!c) return;

            const elDate = document.getElementById("ohlc-disp-date");
            const elOpen = document.getElementById("ohlc-disp-open");
            const elHigh = document.getElementById("ohlc-disp-high");
            const elLow = document.getElementById("ohlc-disp-low");
            const elClose = document.getElementById("ohlc-disp-close");
            const elChange = document.getElementById("ohlc-disp-change");
            const elRange = document.getElementById("ohlc-disp-range");

            if (!elOpen) return;

            const spec = getSymbolSpec(currentSymbol);
            const prec = spec.prec !== undefined ? spec.prec : 2;

            const open = Number(c.open);
            const high = Number(c.high);
            const low = Number(c.low);
            const close = Number(c.close);

            const isUp = close >= open;
            const colorClass = isUp ? "up" : "down";

            if (c.time) {
                const d = new Date(c.time * 1000);
                const y = d.getUTCFullYear();
                const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day = String(d.getUTCDate()).padStart(2, '0');
                const h = String(d.getUTCHours()).padStart(2, '0');
                const min = String(d.getUTCMinutes()).padStart(2, '0');
                if (elDate) elDate.innerText = `${y}/${m}/${day} ${h}:${min} UTC`;
            }

            if (elOpen && Number.isFinite(open)) {
                elOpen.innerText = open.toLocaleString('en-US', { minimumFractionDigits: prec, maximumFractionDigits: prec });
                elOpen.className = `ohlc-val ${colorClass}`;
            }
            if (elHigh && Number.isFinite(high)) {
                elHigh.innerText = high.toLocaleString('en-US', { minimumFractionDigits: prec, maximumFractionDigits: prec });
                elHigh.className = `ohlc-val ${colorClass}`;
            }
            if (elLow && Number.isFinite(low)) {
                elLow.innerText = low.toLocaleString('en-US', { minimumFractionDigits: prec, maximumFractionDigits: prec });
                elLow.className = `ohlc-val ${colorClass}`;
            }
            if (elClose && Number.isFinite(close)) {
                elClose.innerText = close.toLocaleString('en-US', { minimumFractionDigits: prec, maximumFractionDigits: prec });
                elClose.className = `ohlc-val ${colorClass}`;
            }
            if (elChange && open > 0 && Number.isFinite(close)) {
                const diff = close - open;
                const pct = (diff / open) * 100;
                const sign = diff >= 0 ? "+" : "";
                elChange.innerText = `${sign}${pct.toFixed(2)}%`;
                elChange.className = `ohlc-val ${colorClass}`;
            }
            if (elRange && low > 0 && Number.isFinite(high)) {
                const rangePct = ((high - low) / low) * 100;
                elRange.innerText = `${rangePct.toFixed(2)}%`;
                elRange.className = `ohlc-val ${colorClass}`;
            }
        }

        // Dynamic High & Low Price Markers (Exact Binance Parity, Throttled to RAF)
        let _binanceHlRafPending = false;
        function updateBinanceHighLowMarkers() {
            if (_binanceHlRafPending) return;
            _binanceHlRafPending = true;
            requestAnimationFrame(_doUpdateBinanceHighLowMarkers);
        }

        function _doUpdateBinanceHighLowMarkers() {
            _binanceHlRafPending = false;
            const overlay = document.getElementById("chart-high-low-overlay");
            if (!overlay || !chart || !candleSeries || !cachedCandles || cachedCandles.length === 0) {
                if (overlay && overlay.innerHTML !== "") overlay.innerHTML = "";
                return;
            }
            let range = null;
            try { range = chart.timeScale().getVisibleLogicalRange(); } catch(e) {}
            if (!range) return;

            const fromIdx = Math.max(0, Math.floor(range.from));
            const toIdx = Math.min(cachedCandles.length - 1, Math.ceil(range.to));
            if (toIdx < fromIdx) return;

            let maxHigh = -Infinity;
            let maxHighIdx = -1;
            let minLow = Infinity;
            let minLowIdx = -1;

            for (let i = fromIdx; i <= toIdx; i++) {
                const c = cachedCandles[i];
                if (!c) continue;
                if (c.high > maxHigh) {
                    maxHigh = c.high;
                    maxHighIdx = i;
                }
                if (c.low < minLow) {
                    minLow = c.low;
                    minLowIdx = i;
                }
            }

            if (currentCandle && toIdx >= cachedCandles.length - 1) {
                if (currentCandle.high > maxHigh) {
                    maxHigh = currentCandle.high;
                    maxHighIdx = cachedCandles.length - 1;
                }
                if (currentCandle.low < minLow) {
                    minLow = currentCandle.low;
                    minLowIdx = cachedCandles.length - 1;
                }
            }

            if (!Number.isFinite(maxHigh) || !Number.isFinite(minLow) || maxHighIdx === -1 || minLowIdx === -1) {
                if (overlay.innerHTML !== "") overlay.innerHTML = "";
                return;
            }

            let xHigh = null, yHigh = null, xLow = null, yLow = null;
            try {
                xHigh = chart.timeScale().logicalToCoordinate(maxHighIdx);
                yHigh = candleSeries.priceToCoordinate(maxHigh);
                xLow = chart.timeScale().logicalToCoordinate(minLowIdx);
                yLow = candleSeries.priceToCoordinate(minLow);
            } catch(e) {}

            const spec = getSymbolSpec(currentSymbol);
            const prec = spec.prec !== undefined ? spec.prec : 2;
            const highStr = maxHigh.toLocaleString('en-US', { minimumFractionDigits: prec, maximumFractionDigits: prec });
            const lowStr = minLow.toLocaleString('en-US', { minimumFractionDigits: prec, maximumFractionDigits: prec });

            let html = "";
            const chartContainer = document.getElementById("tv-chart");
            const chartWidth = chartContainer ? chartContainer.clientWidth : 800;
            if (Number.isFinite(xHigh) && Number.isFinite(yHigh) && xHigh >= 0 && yHigh >= 0) {
                const isNearRight = (xHigh > chartWidth - 90);
                const transform = isNearRight ? "transform: translateY(-50%) translateX(-100%);" : "transform: translateY(-50%);";
                html += `<div class="binance-hl-marker high-marker" style="left: ${xHigh}px; top: ${yHigh}px; ${transform}">
                    ${isNearRight ? `<span>${highStr}</span><span class="hl-pointer"></span>` : `<span class="hl-pointer"></span><span>${highStr}</span>`}
                </div>`;
            }
            if (Number.isFinite(xLow) && Number.isFinite(yLow) && xLow >= 0 && yLow >= 0) {
                const isNearRight = (xLow > chartWidth - 90);
                const transform = isNearRight ? "transform: translateY(-50%) translateX(-100%);" : "transform: translateY(-50%);";
                html += `<div class="binance-hl-marker low-marker" style="left: ${xLow}px; top: ${yLow}px; ${transform}">
                    ${isNearRight ? `<span>${lowStr}</span><span class="hl-pointer"></span>` : `<span class="hl-pointer"></span><span>${lowStr}</span>`}
                </div>`;
            }
            if (overlay.innerHTML !== html) {
                overlay.innerHTML = html;
            }
        }

        // ── Ultra-Nano High-Speed Direct Binance WebSocket Engine ────────────────────────
        let nanoWs = null;
        let nanoWsReconnectTimer = null;
        let isNanoWsActive = false;
        let lastNanoTickTime = 0;
        let nanoTickCount = 0;
        let nanoLatencyMs = 0;
        let nanoTpsInterval = null;
        let activeNanoStreamSymbol = null;
        let activeNanoStreamInterval = null;
        // Browser-to-Binance sockets fail on networks that block or override
        // the fstream DNS endpoint. REST ticker polling remains the stable
        // live-data path until a local Rust WebSocket relay is enabled.
        const NANO_WS_ENABLED = true;

        
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // MULTI-POSITION INSTANT UPDATE WEBSOCKET (Nanosecond Speed)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        let multiPosWs = null;
        let multiPosReconnectTimer = null;
        let _activeMultiPosStreams = "";
        let _lastMultiPosTickTime = 0;
        let _multiPosWatchdogInterval = null;



// ============================================================================
// Module: 09_websocket.js
// ============================================================================

function initMultiPositionWebSocket() {
            const positions = cachedPortfolioState?.active_positions || [];
            if (positions.length === 0) {
                if (multiPosWs) {
                    try { multiPosWs.close(); } catch(e) {}
                    multiPosWs = null;
                }
                _activeMultiPosStreams = "";
                return;
            }

            // Build stream list: symbol@aggTrade for each position
            const uniqueSyms = [...new Set(positions.map(p => p.symbol.toLowerCase()))];
            const streams = uniqueSyms.map(s => `${s}@aggTrade`).join('/');

            // If already open or connecting for the exact same streams, keep connection
            if (multiPosWs && (multiPosWs.readyState === WebSocket.OPEN || multiPosWs.readyState === WebSocket.CONNECTING)) {
                if (_activeMultiPosStreams === streams) return;
                try { multiPosWs.close(); } catch(e) {}
                multiPosWs = null;
            }

            _activeMultiPosStreams = streams;
            
            // Primary: Binance Futures Direct Stream (real matching engine, 0 latency gap)
            // Secondary: Binance Futures Alternate CDN Endpoint (Never Spot!)
            const streamUrl = `wss://fstream.binance.com/stream?streams=${streams}`;
            const fallbackStreamUrl = `wss://fstream.binancefuture.com/stream?streams=${streams}`;

            if (multiPosReconnectTimer) {
                clearTimeout(multiPosReconnectTimer);
                multiPosReconnectTimer = null;
            }

            // Start watchdog to monitor connection health every 4 seconds
            if (!_multiPosWatchdogInterval) {
                _multiPosWatchdogInterval = setInterval(() => {
                    const pos = cachedPortfolioState?.active_positions || [];
                    if (pos.length > 0 && Date.now() - _lastMultiPosTickTime > 6000) {
                        // Stalled or dead socket: reconnect
                        if (multiPosWs) {
                            try { multiPosWs.close(); } catch(e) {}
                            multiPosWs = null;
                        }
                        _activeMultiPosStreams = "";
                        initMultiPositionWebSocket();
                    }
                }, 4000);
            }

            let triedFallback = false;
            function connectMultiWs(url) {
                try {
                    const ws = new WebSocket(url);
                    multiPosWs = ws;

                    ws.onopen = () => {
                        if (ws !== multiPosWs) return;
                        _lastMultiPosTickTime = Date.now();
                    };

                    ws.onmessage = (event) => {
                        if (ws !== multiPosWs) return;
                        _lastMultiPosTickTime = Date.now();
                        try {
                            const msg = JSON.parse(event.data);
                            const data = msg.data || msg;
                            if (!data || !data.s || !data.p) return;

                            const symbol = data.s.toUpperCase();
                            const price = parseFloat(data.p);
                            if (isNaN(price) || price <= 0) return;

                            _lastTickTimes.set(symbol, Date.now());
                            livePricesBySymbol.set(symbol, price);

                            if (symbol === currentSymbol) {
                                lastKnownPrice = price;
                            }

                            // Instantly update position cells and floating PnL
                            refreshLivePositionMetrics(symbol, price);

                        } catch(e) { console.error("WS parse error:", e); }
                    };

                    ws.onerror = () => {
                        if (ws !== multiPosWs) return;
                        if (!triedFallback) {
                            triedFallback = true;
                            connectMultiWs(fallbackStreamUrl);
                            return;
                        }
                        multiPosReconnectTimer = setTimeout(() => initMultiPositionWebSocket(), 2000);
                    };

                    ws.onclose = () => {
                        if (ws !== multiPosWs) return;
                        if (!triedFallback && (Date.now() - _lastMultiPosTickTime > 3000)) {
                            triedFallback = true;
                            connectMultiWs(fallbackStreamUrl);
                            return;
                        }
                        multiPosReconnectTimer = setTimeout(() => initMultiPositionWebSocket(), 2000);
                    };

                } catch(e) {
                    if (!triedFallback) {
                        triedFallback = true;
                        connectMultiWs(fallbackStreamUrl);
                    } else {
                        multiPosReconnectTimer = setTimeout(() => initMultiPositionWebSocket(), 3000);
                    }
                }
            }

            connectMultiWs(streamUrl);
        }

        function getTfSeconds(tf) {
            const map = {
                "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
                "1h": 3600, "2h": 7200, "4h": 14400, "6h": 21600, "8h": 28800,
                "12h": 43200, "1d": 86400, "3d": 259200, "1w": 604800
            };
            return map[tf] || 60;
        }

        let _nanoIntentionalClose = false; // true when WE close the socket (not a crash)

        let _nanoWsWatchdogInterval = null;

        function initNanoWebSocket(symbol, interval) {
            if (!NANO_WS_ENABLED) {
                isNanoWsActive = false;
                return;
            }
            const targetSymbol = (symbol || currentSymbol).toUpperCase();
            const targetInterval = (interval || currentInterval).toLowerCase();

            // Setup Nano WebSocket watchdog to heal silent TCP drops/sleep (gentle 12s timeout)
            if (!_nanoWsWatchdogInterval) {
                _nanoWsWatchdogInterval = setInterval(() => {
                    if (isNanoWsActive && lastNanoTickTime > 0 && nanoWs && nanoWs.readyState === WebSocket.OPEN && (Date.now() - lastNanoTickTime > 12000)) {
                        isNanoWsActive = false;
                        if (nanoWs) {
                            try { nanoWs.close(); } catch(e) {}
                            nanoWs = null;
                        }
                        initNanoWebSocket(currentSymbol, currentInterval);
                        if (typeof _requestDebouncedBackfill === 'function') _requestDebouncedBackfill();
                    }
                }, 5000);
            }

            // Already streaming the right symbol/interval on an OPEN socket — do nothing
            if (isNanoWsActive && nanoWs &&
                activeNanoStreamSymbol === targetSymbol &&
                activeNanoStreamInterval === targetInterval &&
                nanoWs.readyState === WebSocket.OPEN) {
                return;
            }

            // Already CONNECTING for the same symbol — wait, don't close it
            if (nanoWs &&
                nanoWs.readyState === WebSocket.CONNECTING &&
                activeNanoStreamSymbol === targetSymbol &&
                activeNanoStreamInterval === targetInterval) {
                return;
            }

            if (nanoWsReconnectTimer) {
                clearTimeout(nanoWsReconnectTimer);
                nanoWsReconnectTimer = null;
            }

            // Close existing socket safely — only if it's not already closing/closed
            if (nanoWs) {
                _nanoIntentionalClose = true;   // tell onclose: don't auto-reconnect
                nanoWs.onopen    = null;
                nanoWs.onmessage = null;
                nanoWs.onerror   = null;
                nanoWs.onclose   = null;
                if (nanoWs.readyState === WebSocket.OPEN) {
                    try { nanoWs.close(); } catch(e) {}
                }
                // If CONNECTING, just detach handlers — browser will finish handshake then close
                nanoWs = null;
                _nanoIntentionalClose = false;
            }

            activeNanoStreamSymbol   = targetSymbol;
            activeNanoStreamInterval = targetInterval;

            const s = targetSymbol.toLowerCase();
            const streamUrl = `wss://fstream.binance.com/stream?streams=${s}@kline_${targetInterval}/${s}@aggTrade`;
            const fallbackStreamUrl = `wss://fstream.binancefuture.com/stream?streams=${s}@kline_${targetInterval}/${s}@aggTrade`;

            let nanoTriedFallback = false;
            function connectNano(url) {
                try {
                    const ws = new WebSocket(url);
                    nanoWs = ws;

                    ws.onopen = () => {
                        if (ws !== nanoWs) return;
                        isNanoWsActive = true;
                        lastNanoTickTime = Date.now();
                        _lastTickTimes.set(targetSymbol, Date.now());
                    };

                    ws.onmessage = (event) => {
                        if (ws !== nanoWs) return;
                        handleNanoStreamMessage(event.data);
                    };

                    ws.onerror = () => {
                        if (ws !== nanoWs) return;
                        if (!nanoTriedFallback) {
                            nanoTriedFallback = true;
                            connectNano(fallbackStreamUrl);
                            return;
                        }
                        isNanoWsActive = false;
                    };

                    ws.onclose = () => {
                        if (ws !== nanoWs) return;   // stale socket — ignore
                        isNanoWsActive = false;
                        if (!nanoTriedFallback && (Date.now() - lastNanoTickTime > 3000)) {
                            nanoTriedFallback = true;
                            connectNano(fallbackStreamUrl);
                            return;
                        }
                        // Only auto-reconnect on unexpected close (not when we switched symbols)
                        if (!_nanoIntentionalClose) {
                            nanoWsReconnectTimer = setTimeout(() => {
                                initNanoWebSocket(currentSymbol, currentInterval);
                            }, 1000);
                        }
                    };
                } catch(e) {
                    if (!nanoTriedFallback) {
                        nanoTriedFallback = true;
                        connectNano(fallbackStreamUrl);
                    } else {
                        isNanoWsActive = false;
                        nanoWsReconnectTimer = setTimeout(() => {
                            initNanoWebSocket(currentSymbol, currentInterval);
                        }, 2000);
                    }
                }
            }

            connectNano(streamUrl);
        }

        function handleNanoStreamMessage(raw) {
            try {
                const msg = JSON.parse(raw);
                const data = msg.data || msg;
                if (!data) return;

                const eventType = data.e || (msg.stream && msg.stream.includes("kline") ? "kline" : (msg.stream && msg.stream.includes("Trade") ? "aggTrade" : null));
                if (eventType === "aggTrade" || eventType === "trade") {
                    onNanoAggTrade(data);
                } else if (eventType === "kline") {
                    onNanoKlineTick(data.k, data.E);
                }
            } catch(e) {}
        }

        let _lastAggTradeMs = 0;

        // Sub-millisecond direct AggTrade tick from matching engine:
        // Updates candle body, wick, high/low, hero price badge, and dual quotes in <1ms!
        function onNanoAggTrade(t) {
            if (!t) return;
            const sym = t.s ? t.s.toUpperCase() : activeNanoStreamSymbol;
            if (sym !== currentSymbol) return;

            const curPrice = parseFloat(t.p);
            if (isNaN(curPrice) || curPrice <= 0) return;

            // Sanity Filter: reject extreme anomalous spikes or mis-routed ticks (>25% from last price)
            if (lastKnownPrice > 0) {
                if (curPrice < lastKnownPrice * 0.75 || curPrice > lastKnownPrice * 1.25) {
                    console.warn(`[CHART-GUARD] Outlier tick rejected for ${sym}: ${curPrice} (last=${lastKnownPrice})`);
                    return;
                }
            }

            const now = Date.now();
            lastNanoTickTime = now;
            _lastTickTimes.set(sym, now);
            livePricesBySymbol.set(sym, curPrice);
            nanoTickCount++;
            if (t.T) {
                nanoLatencyMs = Math.max(0, now - t.T);
            }
            const tradeMs = t.T || now;
            _lastAggTradeMs = tradeMs;

            const tradeSec = Math.floor(tradeMs / 1000);
            const tfSec = getTfSeconds(currentInterval);
            const expectedCandleTime = Math.floor(tradeSec / tfSec) * tfSec;
            const tradeQty = parseFloat(t.q) || 0;

            // Check for gap / discontinuity: request continuous backfill without dropping live ticks!
            if (currentCandle && (expectedCandleTime - currentCandle.time > tfSec * 1.5)) {
                if (typeof _requestDebouncedBackfill === 'function') {
                    _requestDebouncedBackfill();
                }
            }

            // 1. Instant Candle Wick, Body & Volume update (Zero latency, perfect sync)
            if (candleSeries) {
                if (!currentCandle || expectedCandleTime > currentCandle.time) {
                    // New candle period starts this exact millisecond!
                    currentCandle = {
                        time: expectedCandleTime,
                        open: curPrice,
                        high: curPrice,
                        low: curPrice,
                        close: curPrice,
                        volume: tradeQty
                    };
                    if (cachedCandles && cachedCandles.length > 0) {
                        const last = cachedCandles[cachedCandles.length - 1];
                        if (last.time === expectedCandleTime) {
                            cachedCandles[cachedCandles.length - 1] = currentCandle;
                        } else if (expectedCandleTime > last.time) {
                            cachedCandles.push(currentCandle);
                        }
                    } else if (cachedCandles) {
                        cachedCandles.push(currentCandle);
                    }
                } else if (expectedCandleTime === currentCandle.time) {
                    // Clamp wick updates to prevent rogue ticks from corrupting wick
                    if (curPrice > currentCandle.high) {
                        if (currentCandle.open > 0 && curPrice > currentCandle.open * 1.20) {
                            console.warn('[CHART-GUARD] Rogue high tick ignored for candle:', curPrice);
                        } else {
                            currentCandle.high = curPrice;
                        }
                    }
                    if (curPrice < currentCandle.low) {
                        if (currentCandle.open > 0 && curPrice < currentCandle.open * 0.80) {
                            console.warn('[CHART-GUARD] Rogue low tick ignored for candle:', curPrice);
                        } else {
                            currentCandle.low = curPrice;
                        }
                    }
                    currentCandle.close = curPrice;
                    currentCandle.volume = (currentCandle.volume || 0) + tradeQty;
                    if (cachedCandles && cachedCandles.length > 0) {
                        cachedCandles[cachedCandles.length - 1] = currentCandle;
                    }
                }
                candleSeries.update(currentCandle);
                if (typeof updateBinanceHighLowMarkers === 'function') updateBinanceHighLowMarkers();
                if (typeof updateBinanceOhlcLegend === 'function') updateBinanceOhlcLegend(currentCandle);
                if (typeof updateLiveMAs === 'function') updateLiveMAs(currentCandle, cachedCandles);

                if (volumeSeries && isVolumeVisible) {
                    try {
                        const isLight = document.body.classList.contains("theme-light");
                        const volColor = (currentCandle.close >= currentCandle.open ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)');
                        volumeSeries.update({
                            time: currentCandle.time,
                            value: currentCandle.volume,
                            color: volColor
                        });
                        updateLegendVolume(currentCandle.volume);
                    } catch(ve) {}
                }
            }

            // 2. Instant Hero Price Badge & Tick Color Flash
            const spec = getSymbolSpec(currentSymbol);
            const prec = spec.prec;
            const priceEl = document.getElementById("disp-last");
            
            if (lastKnownPrice > 0 && curPrice !== lastKnownPrice) {
                const isUp = curPrice >= lastKnownPrice;
                if (priceEl) {
                    priceEl.className = "hero-price-badge " + (isUp ? "up" : "down");
                }
                if (currentSelectedSide === "BUY") {
                    const sellSuf = document.getElementById("dual-quote-sell-suffix");
                    if (sellSuf) {
                        sellSuf.style.color = isUp ? "#00FF88" : "#EF5350";
                        setTimeout(() => { if (sellSuf) sellSuf.style.color = ""; }, 200);
                    }
                } else {
                    const buySuf = document.getElementById("dual-quote-buy-suffix");
                    if (buySuf) {
                        buySuf.style.color = isUp ? "#00FF88" : "#EF5350";
                        setTimeout(() => { if (buySuf) buySuf.style.color = ""; }, 200);
                    }
                }
            }

            lastKnownPrice = curPrice;
            if (priceEl) priceEl.innerText = curPrice.toFixed(prec);
            refreshLivePositionMetrics(currentSymbol, curPrice);

            // 3. Fast INR equivalent
            const inrEl = document.getElementById("disp-inr-equiv");
            if (inrEl) inrEl.innerText = `≈ ${(curPrice * 97.98).toFixed(prec > 3 ? 4 : 2)} INR`;

            // 4. Dual Quote Box Prices & Spread
            const spreadPips = prec === 5 ? 0.00015 : (prec === 1 ? 0.5 : (prec === 3 ? 0.015 : (prec === 6 ? 0.000002 : 0.02)));
            const sellParts = formatTradeWQuotePrice(curPrice, prec);
            const buyParts = formatTradeWQuotePrice(curPrice + spreadPips, prec);

            const qSellPre = document.getElementById("dual-quote-sell-prefix");
            const qSellSuf = document.getElementById("dual-quote-sell-suffix");
            const qBuyPre = document.getElementById("dual-quote-buy-prefix");
            const qBuySuf = document.getElementById("dual-quote-buy-suffix");
            if (qSellPre && qSellSuf) {
                qSellPre.innerText = sellParts.prefix;
                qSellSuf.innerText = sellParts.suffix;
            }
            if (qBuyPre && qBuySuf) {
                qBuyPre.innerText = buyParts.prefix;
                qBuySuf.innerText = buyParts.suffix;
            }

            // 5. Dock Substrip & Watchlist Item Real-Time Price
            const subPrice = document.getElementById("dock-substrip-price");
            if (subPrice) subPrice.innerText = curPrice.toFixed(prec);

            const wlPriceEl = document.getElementById(`wl-price-${currentSymbol}`);
            if (wlPriceEl) wlPriceEl.innerText = curPrice.toFixed(prec);

            requestTradeWOverlayUpdate();
        }

        // Authoritative Kline sync from Binance (arrives every 250ms during active candle)
        function onNanoKlineTick(k, eventTimeMs) {
            if (!k || !candleSeries) return;
            const sym = k.s ? k.s.toUpperCase() : activeNanoStreamSymbol;
            if (sym !== currentSymbol) return;

            const candleTime = Math.floor(k.t / 1000);
            const openP = parseFloat(k.o);
            const highP = parseFloat(k.h);
            const lowP = parseFloat(k.l);
            const closeP = parseFloat(k.c);
            const vol = parseFloat(k.v);
            const isClosed = (k.x === true);
            const eventMs = eventTimeMs || Date.now();

            // Validate kline prices: must be positive numbers and structurally coherent
            if (isNaN(openP) || isNaN(highP) || isNaN(lowP) || isNaN(closeP) || openP <= 0 || highP <= 0 || lowP <= 0 || closeP <= 0) return;
            if (lowP > Math.min(openP, closeP) * 1.0001 || highP < Math.max(openP, closeP) * 0.9999) return;

            // Sanity filter against lastKnownPrice (>25% deviation rejected as bad packet)
            if (lastKnownPrice > 0) {
                if (closeP < lastKnownPrice * 0.75 || closeP > lastKnownPrice * 1.25) {
                    console.warn(`[CHART-GUARD] Kline tick outlier rejected for ${sym}: close=${closeP}, last=${lastKnownPrice}`);
                    return;
                }
            }

            const tfSec = getTfSeconds(currentInterval);
            // Gap detection: request continuous backfill without dropping live kline tick
            if (currentCandle && (candleTime - currentCandle.time > tfSec * 1.5)) {
                if (typeof _requestDebouncedBackfill === 'function') {
                    _requestDebouncedBackfill();
                }
            }

            if (!currentCandle || candleTime > currentCandle.time) {
                currentCandle = {
                    time: candleTime,
                    open: openP,
                    high: highP,
                    low: lowP,
                    close: closeP,
                    volume: vol
                };
                if (cachedCandles && cachedCandles.length > 0) {
                    const lastIdx = cachedCandles.length - 1;
                    if (cachedCandles[lastIdx].time === candleTime) {
                        cachedCandles[lastIdx] = currentCandle;
                    } else if (candleTime > cachedCandles[lastIdx].time) {
                        cachedCandles.push(currentCandle);
                    }
                } else if (cachedCandles) {
                    cachedCandles.push(currentCandle);
                }
                if (!isNaN(closeP) && closeP > 0) {
                    lastKnownPrice = closeP;
                    livePricesBySymbol.set(sym, closeP);
                    refreshLivePositionMetrics(sym, closeP);
                }
            } else if (isClosed) {
                currentCandle.open = openP;
                currentCandle.high = highP;
                currentCandle.low = lowP;
                currentCandle.close = closeP;
                currentCandle.volume = vol;
                if (cachedCandles && cachedCandles.length > 0) {
                    const lastIdx = cachedCandles.length - 1;
                    if (cachedCandles[lastIdx].time === candleTime) {
                        cachedCandles[lastIdx] = Object.assign({}, currentCandle);
                    } else if (candleTime > cachedCandles[lastIdx].time) {
                        cachedCandles.push(Object.assign({}, currentCandle));
                    }
                }
            } else if (candleTime === currentCandle.time) {
                currentCandle.open = openP;
                currentCandle.high = highP;
                currentCandle.low = lowP;
                currentCandle.close = closeP;
                currentCandle.volume = vol;
                
                if (!isNaN(closeP) && closeP > 0) {
                    lastKnownPrice = closeP;
                    livePricesBySymbol.set(sym, closeP);
                    refreshLivePositionMetrics(sym, closeP);
                }
                if (cachedCandles && cachedCandles.length > 0 && cachedCandles[cachedCandles.length - 1].time === candleTime) {
                    cachedCandles[cachedCandles.length - 1] = currentCandle;
                }
            }

            candleSeries.update(currentCandle);

            if (volumeSeries && isVolumeVisible) {
                try {
                    const isLight = document.body.classList.contains("theme-light");
                    const volVal = (typeof currentCandle.volume === 'number' && Number.isFinite(currentCandle.volume)) ? currentCandle.volume : 0;
                    const volColor = isLight 
                        ? (currentCandle.close >= currentCandle.open ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)')
                        : (currentCandle.close >= currentCandle.open ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)');
                    volumeSeries.update({ time: candleTime, value: volVal, color: volColor });
                    updateLegendVolume(volVal);
                } catch(ve) {}
            }

            if (typeof updateBinanceHighLowMarkers === 'function') updateBinanceHighLowMarkers();
            if (typeof updateBinanceOhlcLegend === 'function') updateBinanceOhlcLegend(currentCandle);
            if (typeof updateLiveMAs === 'function') updateLiveMAs(currentCandle, cachedCandles);
            requestTradeWOverlayUpdate();
        }

        // TPS ticker &#8212; badge is hidden; just track tick count
        function startNanoTpsTicker() {
            if (nanoTpsInterval) clearInterval(nanoTpsInterval);
            nanoTpsInterval = setInterval(() => {
                if (isNanoWsActive) nanoTickCount = 0;
            }, 1000);
        }

        // Load Real Klines into the Candlestick Chart (Zero Flickering, Smooth Incremental Updates)
        let _lastChartSymbol = null;
        let _lastChartInterval = null;
        let _chartRequestId = 0;



// ============================================================================
// Module: 10_chart_candles.js
// ============================================================================

function _clearActiveChartLines() {
            for (const line of activePriceLines) {
                try { candleSeries?.removePriceLine(line); } catch (error) {}
            }
            activePriceLines = [];
        }

        function _resetChartForSymbolSwitch() {
            // A ticker response can arrive after the user selects another
            // market. Never let the previous market's candle be extended with
            // the new market's price (for example BTC 85k plus ETH 2.7k).
            currentCandle = null;
            cachedCandles = [];
            lastKnownPrice = 0;
            _lastChartSymbol = null;
            _lastChartInterval = null;
            // A switch cancels any in-progress drag and removes every old
            // symbol's order line before price scaling is recalculated.
            _isDragging = false;
            _dragState = null;
            _mousedownPl = null;
            _mousedownY = null;
            _setChartNavigationLocked(false);
            _clearActiveChartLines();
            // Keep the previously rendered canvas until a verified new batch
            // is ready. This is an internal atomic reload, not a white/blank
            // chart flash between symbols.
        }

        function _isValidCandleBatch(candles, symbol) {
            // // console.log("[CHART] Validating " + (candles?.length || 0) + " candles for " + symbol);
            if (!Array.isArray(candles) || candles.length < 10) return false;
            let previousTime = 0;
            for (const candle of candles) {
                const { time, open, high, low, close, volume } = candle || {};
                if (![time, open, high, low, close, volume].every(Number.isFinite)
                    || time <= previousTime || open <= 0 || high <= 0 || low <= 0 || close <= 0
                    || high < (Math.max(open, close) - 1e-6) || low > (Math.min(open, close) + 1e-6) || volume < 0) {
                    return false;
                }
                previousTime = time;
            }
            const lastClose = candles[candles.length - 1].close;
            const watchItem = cachedWatchlistData.find(item => item.symbol === symbol);
            const reference = Number(lastKnownPrice) || Number(watchItem?.lastPrice) || 0;
            // A stale synthetic 1.0 candle batch must never replace SOL at
            // 117, ETH at 2,700, etc. Wide bounds permit ordinary volatility.
            return !reference || (lastClose > reference * 0.2 && lastClose < reference * 5);
        }

        let _isLoadingCandles = false;
        let _backfillDebounceTimer = null;

        function _requestDebouncedBackfill() {
            if (_backfillDebounceTimer) return;
            _backfillDebounceTimer = setTimeout(() => {
                _backfillDebounceTimer = null;
                if (!_isLoadingCandles) {
                    loadChartCandles(true);
                }
            }, 600);
        }

        async function loadChartCandles(forceFullReload = false) {
            const sym = currentSymbol;
            const interval = currentInterval;
            if (_isLoadingCandles && !forceFullReload && _lastChartSymbol === sym && _lastChartInterval === interval) return;
            _isLoadingCandles = true;
            try {
                const sym = currentSymbol;
                const interval = currentInterval;
                const requestId = ++_chartRequestId;
                const res = await apiFetch(`/api/klines?symbol=${sym}&interval=${interval}&limit=1000&_=${Date.now()}`, { cache: 'no-store' });
                if (!res) return;
                const candles = await res.json();
                // Ignore an out-of-order response from a previous symbol or timeframe
                if (requestId !== _chartRequestId || sym !== currentSymbol || interval !== currentInterval) return;
                if (_isValidCandleBatch(candles, sym)) {
                    const isNewSeries = (_lastChartSymbol !== sym || _lastChartInterval !== interval);
                    _lastChartSymbol = sym;
                    _lastChartInterval = interval;

                    const isLight = document.body.classList.contains("theme-light");
                    const lastCandle = candles[candles.length - 1];
                    const tfSec = getTfSeconds(interval);

                    // Robust Gap Detection:
                    // If the browser tab was asleep, backgrounded, or network reconnected,
                    // intermediate candles will be missing. Detect this and force full setData!
                    let hasGap = false;
                    if (!cachedCandles || cachedCandles.length < 10) {
                        hasGap = true;
                    } else if (currentCandle && Math.abs(lastCandle.time - currentCandle.time) > tfSec * 1.5) {
                        hasGap = true;
                    } else if (cachedCandles.length > 0) {
                        const lastCached = cachedCandles[cachedCandles.length - 1];
                        if (Math.abs(lastCandle.time - lastCached.time) > tfSec * 1.5) {
                            hasGap = true;
                        }
                    }

                    const shouldFullReload = isNewSeries || forceFullReload || hasGap;
                    cachedCandles = candles;

                    if (shouldFullReload) {
                        // Preserve visible logical range across seamless gap repairs
                        const currentLogicalRange = (!isNewSeries && chart?.timeScale()) ? chart.timeScale().getVisibleLogicalRange() : null;

                        // Full load on symbol/timeframe switch OR continuous gap recovery
                        if (candleSeries) candleSeries.setData(candles);

                        if (isNewSeries || !currentLogicalRange) {
                            // Set Binance Parity viewport showing ~48 candles with zero right-side awkward gap
                            try {
                                const totalBars = candles.length;
                                if (totalBars > 0 && chart?.timeScale()) {
                                    chart.timeScale().setVisibleLogicalRange({
                                        from: Math.max(0, totalBars - 48),
                                        to: totalBars + 4
                                    });
                                } else {
                                    chart?.timeScale().fitContent();
                                }
                            } catch (error) {
                                try { chart?.timeScale().fitContent(); } catch (e) {}
                            }
                        } else {
                            // Maintain user's scroll view perfectly during gap repair
                            try {
                                chart.timeScale().setVisibleLogicalRange(currentLogicalRange);
                            } catch (e) {}
                        }

                        currentCandle = Object.assign({}, lastCandle);
                        lastKnownPrice = currentCandle.close;
                    } else {
                        // Smooth incremental update — skip running candle when WS is live
                        if (candleSeries && lastCandle) {
                            if (isNanoWsActive && currentCandle && lastCandle.time === currentCandle.time) {
                                if (lastCandle.high > currentCandle.high) currentCandle.high = lastCandle.high;
                                if (lastCandle.low < currentCandle.low) currentCandle.low = lastCandle.low;
                            } else {
                                candleSeries.update(lastCandle);
                            }
                        }
                        if (!isNanoWsActive || !currentCandle || lastCandle.time > currentCandle.time) {
                            currentCandle = Object.assign({}, lastCandle);
                            lastKnownPrice = currentCandle.close;
                        }
                    }

                    if (typeof updateBinanceHighLowMarkers === 'function') updateBinanceHighLowMarkers();
                    if (typeof updateBinanceOhlcLegend === 'function') updateBinanceOhlcLegend(currentCandle || lastCandle);
                    updateOnChartOrderLines();
                    requestTradeWOverlayUpdate();
                    updateOrderSummary();
                    _syncOrderTicketForSymbol(sym, currentCandle ? currentCandle.close : lastCandle.close, getSymbolSpec(sym).prec);

                    // Ensure Nano WebSocket is connected and streaming for current pair
                    initNanoWebSocket(sym, interval);
                }
            } catch(e) {
                console.error("Chart load error:", e);
            } finally {
                _isLoadingCandles = false;
            }
        }

        // Automatic Tab Wakeup / Sleep-Resume Gap-Healer
        if (typeof document !== 'undefined') {
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") {
                    // Tab woke up from background/sleep — heal chart immediately
                    if (typeof loadChartCandles === 'function') loadChartCandles(true);
                    if (typeof initNanoWebSocket === 'function') initNanoWebSocket(currentSymbol, currentInterval);
                }
            });
            window.addEventListener("focus", () => {
                if (typeof loadChartCandles === 'function') loadChartCandles(true);
            });
            window.addEventListener("online", () => {
                if (typeof loadChartCandles === 'function') loadChartCandles(true);
                if (typeof initNanoWebSocket === 'function') initNanoWebSocket(currentSymbol, currentInterval);
            });
        }

        // Clean TradeW Native On-Chart Order Lines (0 Buffering, 0 Lag, 100% Canvas Native)



// ============================================================================
// Module: 11_order_lines.js
// ============================================================================

function updateOnChartOrderLines() {
            if (typeof _isDragging !== 'undefined' && _isDragging) return;
            if (!candleSeries) return;

            // When viewing Global TV Reference chart, clear all order lines completely
            if (isTvIframeMode) {
                _clearActiveChartLines();
                return;
            }

            const newLines = [];
            const prec = currentSymbol.includes("DOGE") ? 5 : (currentSymbol.includes("BTC") ? 1 : 2);

            // 1. Active Open Positions for Current Symbol (Supports Multi-Position Trade Stacking)
            const activePositions = (cachedPortfolioState && cachedPortfolioState.active_positions)
                ? cachedPortfolioState.active_positions.filter(p => p.symbol === currentSymbol)
                : [];

            if (typeof _elbSetPosition === 'function') {
                _elbSetPosition(activePositions.length > 0 ? activePositions[0] : null);
            }

            for (const pos of activePositions) {
                const isBuy = pos.side === "BUY";
                const entryP = parseFloat(pos.entry_price);
                const slP = (pos.sl_price !== null && pos.sl_price !== undefined && !isNaN(pos.sl_price)) ? parseFloat(pos.sl_price) : null;
                let tpP = null;
                if (pos.tp_price !== null && pos.tp_price !== undefined && !isNaN(pos.tp_price)) {
                    tpP = parseFloat(pos.tp_price);
                } else if (pos.tranches && pos.tranches.queen && pos.tranches.queen.tp_price && !isNaN(pos.tranches.queen.tp_price)) {
                    tpP = parseFloat(pos.tranches.queen.tp_price);
                }
                const lot = pos.volume_lots !== undefined ? pos.volume_lots : (pos.lot || 0.01);

                newLines.push({
                    price: entryP,
                    color: isBuy ? "#00C076" : "#F6465D",
                    lineStyle: 1, // Dashed, matching SL/TP
                    lineWidth: 1, // Thin, matching SL/TP
                    // Keep the entry price on the chart's right price scale.
                    // Lot/PnL is rendered separately by the centered overlay ticket.
                    axisLabelVisible: true,
                    axisLabelColor: isBuy ? "#00C076" : "#F6465D",
                    axisLabelTextColor: "#FFFFFF",
                    title: '',
                    _meta: { posId: pos.pos_id, lineType: "ENTRY", entryPrice: entryP, side: pos.side, symbol: pos.symbol, lot: lot, slPrice: slP, tpPrice: tpP }
                });

                // SL line: ONLY when user configured a stop loss
                if (slP !== null && !isNaN(slP) && slP > 0) {
                    newLines.push({
                        price: slP,
                        color: "#F6465D",
                        lineStyle: 1, // Dashed
                        lineWidth: 1,
                        axisLabelVisible: true,
                        axisLabelColor: "#F6465D",
                        axisLabelTextColor: "#FFFFFF",
                        title: '',
                        _meta: { posId: pos.pos_id, lineType: "SL", entryPrice: entryP, side: pos.side, symbol: pos.symbol, lot: lot }
                    });
                }

                // TP line: ONLY when user configured a take profit
                if (tpP !== null && !isNaN(tpP) && tpP > 0) {
                    newLines.push({
                        price: tpP,
                        color: "#00C076",
                        lineStyle: 1, // Dashed
                        lineWidth: 1,
                        axisLabelVisible: true,
                        axisLabelColor: "#00C076",
                        axisLabelTextColor: "#FFFFFF",
                        title: '',
                        _meta: { posId: pos.pos_id, lineType: "TP", entryPrice: entryP, side: pos.side, symbol: pos.symbol, lot: lot }
                    });
                }
            }

            // 2. Pending Limit Orders for Current Symbol
            if (cachedPortfolioState && cachedPortfolioState.pending_orders) {
                const pending = cachedPortfolioState.pending_orders.filter(o => o.symbol === currentSymbol);
                for (const ord of pending) {
                    const isBuy = (ord.side === "BUY" || (ord.type && ord.type.includes("BUY")));
                    const ordP = parseFloat(ord.order_price !== undefined ? ord.order_price : ord.price);
                    const ordLot = ord.volume_lots !== undefined ? ord.volume_lots : (ord.lot || 0.01);
                    if (ordP && ordP > 0) {
                        newLines.push({
                            price: ordP,
                            color: isBuy ? "#00C076" : "#F6465D",
                            lineStyle: 1,
                            lineWidth: 1,
                            axisLabelVisible: true,
                            axisLabelColor: isBuy ? "#00C076" : "#F6465D",
                            axisLabelTextColor: "#FFFFFF",
                            title: `${isBuy ? "Buy Limit" : "Sell Limit"} | ${ordLot}`,
                            _meta: { posId: ord.order_no, lineType: "LIMIT", entryPrice: ordP, side: ord.side, symbol: ord.symbol, lot: ordLot }
                        });
                    }
                }
            }

            // 3. Limit Order Ticket Preview (When user is placing a Limit Order)
            if (currentOrderType === "limit") {
                const inpLimit = document.getElementById("inp-limit-price");
                const limitVal = inpLimit ? parseFloat(inpLimit.value) : null;
                if (limitVal && limitVal > 0) {
                    const isBuy = currentSelectedSide === "BUY";
                    newLines.push({
                        price: limitVal,
                        color: isBuy ? "#00C076" : "#F6465D",
                        lineStyle: 1,
                        lineWidth: 1,
                        axisLabelVisible: false,
                        axisLabelColor: isBuy ? "#00C076" : "#F6465D",
                        axisLabelTextColor: "#FFFFFF",
                        title: `${isBuy ? "Buy Limit" : "Sell Limit"} | ${currentLotSize || 0.01}`
                    });
                }
            }

            // Let the candlestick series handle the single live price line natively (no duplicate lines)
            try {
                candleSeries.applyOptions({
                    priceLineVisible: true,
                    lastValueVisible: true,
                });
            } catch (error) {}

            // Incremental Smart Reconciliation: Never wipe and recreate all lines!
            // This guarantees 100% flicker-free rendering when adding, dragging, or modifying lines.
            const remainingExisting = [];
            const matchedNewIndices = new Set();

            for (const pl of activePriceLines) {
                const pMeta = pl._meta;
                const matchIdx = newLines.findIndex((nl, idx) => 
                    !matchedNewIndices.has(idx) &&
                    String(nl._meta?.posId) === String(pMeta?.posId) &&
                    nl._meta?.lineType === pMeta?.lineType
                );

                if (matchIdx !== -1) {
                    matchedNewIndices.add(matchIdx);
                    const nl = newLines[matchIdx];
                    try {
                        pl.applyOptions(nl);
                        pl._meta = nl._meta;
                    } catch(e) {}
                    remainingExisting.push(pl);
                } else {
                    // Line no longer exists (e.g. SL or TP cleared or position closed)
                    try { candleSeries.removePriceLine(pl); } catch(e) {}
                }
            }

            // Create only truly new lines that didn't previously exist
            for (let i = 0; i < newLines.length; i++) {
                if (!matchedNewIndices.has(i)) {
                    try {
                        const pl = candleSeries.createPriceLine(newLines[i]);
                        pl._meta = newLines[i]._meta;
                        remainingExisting.push(pl);
                    } catch(e) {}
                }
            }

            activePriceLines = remainingExisting;
        }

        // Aliases for seamless integration        // Aliases for seamless integration with existing hooks
        // Debounced to prevent crosshair/resize rapid-fire from causing duplicate price lines
        let _overlayRafId = null;
        function updateTradeWOverlay() {
            if (_overlayRafId) return; // coalesce multiple calls in same frame
            _overlayRafId = requestAnimationFrame(() => {
                _overlayRafId = null;
                updateOnChartOrderLines();
            });
        }
        function requestTradeWOverlayUpdate() {
            updateTradeWOverlay();
        }

        // Web Audio Synthesizer for Chimes
        function playChime(type) {
            if (!audioEnabled) return;
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                if (type === "BUY") {
                    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
                } else if (type === "SELL") {
                    osc.frequency.setValueAtTime(880, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.15);
                } else if (type === "TP") {
                    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.25);
                }
                
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            } catch(e) {}
        }

        function toggleAudio() {
            audioEnabled = !audioEnabled;
            const el = document.getElementById("snd-status");
            if (el) el.innerText = audioEnabled ? "ON" : "OFF";
        }

        // Symbol Switch across UI



// ============================================================================
// Module: 12_watchlist.js
// ============================================================================

function switchSymbol(sym, btn, isManual = true) {
            // // // console.log("[CHART] Switching..."); // REMOVED: Excessive logging
            if (isManual) userManuallySelectedSymbol = true;
            // Keep the initial BTC selection loading; later duplicate clicks
            // on an already-rendered market do not need a full reset.
            if (sym === currentSymbol && currentCandle) return;
            currentSymbol = sym;
            _resetChartForSymbolSwitch();
            _resetOrderTicketForSymbolSwitch();

            const spec = getSymbolSpec(sym);
            if (!chart || !candleSeries) {
                if (!isTvIframeMode) initTradingViewChart();
            } else {
                _clearActiveChartLines();
                if (candleSeries) {
                    candleSeries.applyOptions({
                        priceFormat: { type: 'price', precision: spec.prec, minMove: spec.minMove }
                    });
                }
                const container = document.getElementById("tv-chart");
                if (chart && container && container.clientWidth > 0 && container.clientHeight > 0) {
                    chart.applyOptions({
                        width: container.clientWidth,
                        height: container.clientHeight
                    });
                }
                if (chart) {
                    try { chart.priceScale('right').applyOptions({ autoScale: true }); } catch(e) {}
                }
            }

            // Highlight in watchlist (both tradew-wl-row and wl-item)
            document.querySelectorAll(".tradew-wl-row, .wl-item").forEach(el => {
                if (el.dataset.sym === sym) el.classList.add("active");
                else el.classList.remove("active");
            });

            const coinLetter = spec.display.slice(0, 1);
            const avatarEl = document.getElementById("disp-coin-avatar");
            if (avatarEl) avatarEl.innerText = coinLetter;

            const titleEl = document.getElementById("chart-sym-title");
            if (titleEl) titleEl.innerText = `${spec.display} · ${spec.name}`;
            
            const tvIframe = document.getElementById("tv-iframe");
            if (tvIframe) {
                const map = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
                const tvSymbol = spec.tvSym || (sym === "LRCUSDT" ? "BINANCE:LRCUSDT" : `BINANCE:${sym}.P`);
                const newSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${encodeURIComponent(tvSymbol)}&interval=${map[currentInterval] || "1"}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=181A20&theme=dark&style=1&timezone=Etc%2FUTC&studies=%5B%5D&hideideas=1`;
                tvIframe.dataset.src = newSrc;
                if (currentChartMode === 'tv' && tvIframe.src !== newSrc) tvIframe.src = newSrc;
            }

            const binanceIframe = document.getElementById("binance-iframe");
            if (binanceIframe) {
                const map = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
                const tvSymbol = spec.tvSym || (sym === "LRCUSDT" ? "BINANCE:LRCUSDT" : `BINANCE:${sym}.P`);
                const newBinanceSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_binance&symbol=${encodeURIComponent(tvSymbol)}&interval=${map[currentInterval] || "1"}&hidesidetoolbar=0&symboledit=0&saveimage=1&toolbarbg=181A20&theme=dark&style=1&timezone=Etc%2FUTC&studies=%5B%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A7%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A25%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A99%7D%7D%5D&hideideas=1`;
                binanceIframe.dataset.src = newBinanceSrc;
                if (currentChartMode === 'binance' && binanceIframe.src !== newBinanceSrc) {
                    binanceIframe.src = newBinanceSrc;
                }
                const binanceExtLink = document.getElementById("binance-external-link");
                if (binanceExtLink) binanceExtLink.href = `https://www.binance.com/en/futures/${sym}`;
                const binanceBtnLink = document.getElementById("btn-mode-binance-link");
                if (binanceBtnLink) binanceBtnLink.href = `https://www.binance.com/en/futures/${sym}`;
                const binanceSymEl = document.getElementById("binance-frame-sym");
                if (binanceSymEl) binanceSymEl.innerText = `${sym} Perpetual`;
            }

            loadChartCandles();
            fetchTicker();
            requestTradeWOverlayUpdate();
            initNanoWebSocket(sym, currentInterval);
            initMultiPositionWebSocket();
        }

        // Safe no-op for removed orderbook
        function fetchOrderbook() {}

        // Fetch Live Binance Ticker & 24h Stats
        async function fetchTicker() {
            try {
                const tickerSymbol = currentSymbol;
                const res = await apiFetch(`/api/ticker24h?symbol=${tickerSymbol}&_=${Date.now()}`, { cache: 'no-store' });
                if (!res) return;
                const d = await res.json();
                // The selected symbol changed while this fetch was in flight.
                // Its response belongs to the old market and must be ignored.
                if (tickerSymbol !== currentSymbol) return;
                if (!d || !d.lastPrice) return;

                const curPrice = parseFloat(d.lastPrice);
                const spec = getSymbolSpec(currentSymbol);
                livePricesBySymbol.set(tickerSymbol, curPrice);
                const prec = spec.prec;
                const isNanoStreaming = isNanoWsActive && (Date.now() - lastNanoTickTime < 3000);

                // Only update real-time price & candles from REST if WebSocket is not actively streaming
                if (!isNanoStreaming) {
                    const priceEl = document.getElementById("disp-last");
                    if (lastKnownPrice > 0 && curPrice !== lastKnownPrice) {
                        const isUp = curPrice >= lastKnownPrice;
                        if (priceEl) {
                            priceEl.className = "hero-price-badge " + (isUp ? "up" : "down");
                        }
                        if (currentSelectedSide === "BUY") {
                            const sellSuf = document.getElementById("dual-quote-sell-suffix");
                            if (sellSuf) {
                                sellSuf.style.color = isUp ? "#00FF88" : "#EF5350";
                                setTimeout(() => { if (sellSuf) sellSuf.style.color = ""; }, 350);
                            }
                        } else {
                            const buySuf = document.getElementById("dual-quote-buy-suffix");
                            if (buySuf) {
                                buySuf.style.color = isUp ? "#00FF88" : "#EF5350";
                                setTimeout(() => { if (buySuf) buySuf.style.color = ""; }, 350);
                            }
                        }
                    }
                    lastKnownPrice = curPrice;

                    if (priceEl) priceEl.innerText = curPrice.toFixed(prec);

                    const inrEl = document.getElementById("disp-inr-equiv");
                    if (inrEl) inrEl.innerText = `≈ ${(curPrice * 97.98).toFixed(prec > 3 ? 4 : 2)} INR`;

                    // Update Dual Quote box prices & spread (TradeX Exact Match)
                    const spreadPips = prec === 5 ? 0.00015 : (prec === 1 ? 0.5 : (prec === 3 ? 0.015 : (prec === 6 ? 0.000002 : 0.02)));
                    const sellP = curPrice;
                    const buyP = curPrice + spreadPips;
                    
                    const sellParts = formatTradeWQuotePrice(sellP, prec);
                    const buyParts = formatTradeWQuotePrice(buyP, prec);

                    const qSellPre = document.getElementById("dual-quote-sell-prefix");
                    const qSellSuf = document.getElementById("dual-quote-sell-suffix");
                    const qBuyPre = document.getElementById("dual-quote-buy-prefix");
                    const qBuySuf = document.getElementById("dual-quote-buy-suffix");
                    if (qSellPre && qSellSuf) {
                        qSellPre.innerText = sellParts.prefix;
                        qSellSuf.innerText = sellParts.suffix;
                    }
                    if (qBuyPre && qBuySuf) {
                        qBuyPre.innerText = buyParts.prefix;
                        qBuySuf.innerText = buyParts.suffix;
                    }

                    const subPrice = document.getElementById("dock-substrip-price");
                    if (subPrice) subPrice.innerText = curPrice.toFixed(prec);


                    if (candleSeries && currentCandle && !isNanoWsActive) {
                        if (curPrice > currentCandle.high) currentCandle.high = curPrice;
                        if (curPrice < currentCandle.low) currentCandle.low = curPrice;
                        currentCandle.close = curPrice;
                        candleSeries.update(currentCandle);
                    }
                }
                
                const changePct = parseFloat(d.priceChangePercent) || 0;
                const chgEl = document.getElementById("disp-change");
                if (chgEl) {
                    chgEl.innerText = (changePct >= 0 ? "+" : "") + changePct.toFixed(2) + "%";
                    chgEl.className = "stat-grp-val " + (changePct >= 0 ? "val-green" : "val-red");
                }

                const dispH = document.getElementById("disp-high");
                const dispL = document.getElementById("disp-low");
                const dispV = document.getElementById("disp-vol");
                if (dispH) dispH.innerText = parseFloat(d.highPrice || curPrice * 1.01).toFixed(prec);
                if (dispL) dispL.innerText = parseFloat(d.lowPrice || curPrice * 0.99).toFixed(prec);
                if (dispV) dispV.innerText = d.quoteVolume ? (parseFloat(d.quoteVolume) / 1000000).toFixed(1) + "M" : "12.4M";

                const spreadPips = prec === 5 ? 0.00015 : (prec === 1 ? 0.5 : (prec === 3 ? 0.015 : (prec === 6 ? 0.000002 : 0.02)));
                const qSpread = document.getElementById("dual-quote-spread");
                const pts = prec === 5 ? Math.round(spreadPips * 100000) : (prec === 1 ? Math.round(spreadPips * 10) : (prec === 6 ? Math.round(spreadPips * 1000000) : Math.round(spreadPips * 100)));
                if (qSpread) qSpread.innerText = pts > 0 ? pts : "15";

                _syncOrderTicketForSymbol(tickerSymbol, curPrice, prec);

                // Dynamic TradeW Signature Slanted Sentiment Meter
                const baseChg = parseFloat(d.priceChangePercent) || 0;
                let buyPct = Math.round(67.02 + Math.max(-20, Math.min(20, baseChg * 2)));
                let sellPct = 100 - buyPct;
                const sSellSeg = document.getElementById("sentiment-sell-seg");
                const sBuySeg = document.getElementById("sentiment-buy-seg");
                if (sSellSeg && sBuySeg) {
                    sSellSeg.style.width = `${sellPct}%`;
                    sSellSeg.innerText = `${sellPct.toFixed(2)}%`;
                    sBuySeg.innerText = `${buyPct.toFixed(2)}%`;
                }

                // Update Dock sub-strip (Image 2 style)
                const subSym = document.getElementById("dock-substrip-sym");
                const subChg = document.getElementById("dock-substrip-chg");
                if (subSym) subSym.innerText = `${currentSymbol} Pro`;
                if (subChg) {
                    subChg.innerText = (changePct >= 0 ? "+" : "") + changePct.toFixed(2) + "%";
                    subChg.className = "dock-sym-chg " + (changePct >= 0 ? "val-green" : "val-red");
                }

                refreshLivePositionMetrics(tickerSymbol, curPrice);
                requestTradeWOverlayUpdate();
            } catch(e) { console.error("Chart load error:", e); }
        }

        // Fetch Pure Rust Nanosecond Engine Telemetry
        async function fetchRustTelemetry() {
            try {
                const res = await apiFetch("/api/rust/status");
                if (!res) return;
                const d = await res.json();
                if (d && d.latency_ns !== undefined) {
                    const badge = document.getElementById("rust-badge");
                    if (badge) {
                        badge.innerHTML = `<span>&#9889; RUST: ${d.latency_ns}ns</span>`;
                        badge.style.color = "#0ECB81";
                        badge.style.borderColor = "rgba(14,203,129,0.4)";
                    }
                }
            } catch(e) { console.warn("Position refresh:", e.message); }
        }

        // &#9472;&#9472; TradeX 37 Institutional Backtested Watchlist State & Filtering &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        let currentWlCategory = "all";
        const defaultFavoriteSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "SUIUSDT", "DOGEUSDT", "WIFUSDT", "INJUSDT", "PENDLEUSDT", "NEARUSDT"];
        let favoriteSymbols = new Set((function() {
            try {
                const saved = JSON.parse(localStorage.getItem('tradew_favorite_symbols'));
                return Array.isArray(saved) ? saved : defaultFavoriteSymbols;
            } catch (error) {
                return defaultFavoriteSymbols;
            }
        })());

        function scrollWatchlistCats(dir) {
            const el = document.getElementById("tradew-cat-pills");
            if (el) el.scrollBy({ left: dir * 80, behavior: "smooth" });
        }

        function setWatchlistCategory(cat, btn) {
            currentWlCategory = (cat || "all").toLowerCase();
            document.querySelectorAll(".tradew-cat-pill").forEach(p => p.classList.remove("active"));
            if (btn) btn.classList.add("active");
            renderWatchlist();
        }

        function toggleFavorite(sym, e) {
            if (e) e.stopPropagation();
            if (favoriteSymbols.has(sym)) {
                favoriteSymbols.delete(sym);
            } else {
                favoriteSymbols.add(sym);
            }
            try { localStorage.setItem('tradew_favorite_symbols', JSON.stringify([...favoriteSymbols])); } catch (error) {}
            renderWatchlist();
        }

        // Fetch and Render Left Watchlist
        async function fetchWatchlist() {
            try {
                const res = await apiFetch(`/api/watchlist?_=${Date.now()}`, { cache: 'no-store' });
                if (!res) return;
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    cachedWatchlistData = list;
                    const quotes = Object.fromEntries(list.map(item => [item.symbol, item.lastPrice]));
                    for (const [symbol, price] of Object.entries(quotes)) {
                        const numericPrice = Number(price);
                        if (Number.isFinite(numericPrice) && numericPrice > 0) livePricesBySymbol.set(symbol, numericPrice);
                    }
                    refreshAllPositionMetricsFromQuotes(quotes);
                    renderWatchlist();
                }
            } catch(e) {}
        }

        function renderWatchlist() {
            const container = document.getElementById("watchlist-items");
            if (!container) return;

            const filterQuery = (document.getElementById("watchlist-search")?.value || "").toUpperCase().trim();

            let html = "";
            for (const item of cachedWatchlistData) {
                const spec = getSymbolSpec(item.symbol);
                const dispSym = item.display || spec.display;
                const assetName = item.name || spec.name;

                if (filterQuery) {
                    const matchSym = (item.symbol || "").toUpperCase().includes(filterQuery);
                    const matchDisp = dispSym.toUpperCase().includes(filterQuery);
                    const matchName = assetName.toUpperCase().includes(filterQuery);
                    if (!matchSym && !matchDisp && !matchName) continue;
                }

                const isFav = favoriteSymbols.has(item.symbol);
                if (currentWlCategory === "favorite") {
                    if (!isFav) continue;
                } else if (currentWlCategory === "hot") {
                    const hotList = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "SUIUSDT", "DOGEUSDT", "WIFUSDT", "INJUSDT", "PENDLEUSDT", "RENDERUSDT", "ENAUSDT"];
                    if (!hotList.includes(item.symbol)) continue;
                } else if (currentWlCategory === "major") {
                    const majorList = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT", "LINKUSDT", "LTCUSDT", "DOGEUSDT", "ADAUSDT"];
                    if (!majorList.includes(item.symbol) && item.category !== "major") continue;
                } else if (currentWlCategory === "layer1") {
                    const l1List = ["SOLUSDT", "BNBUSDT", "AVAXUSDT", "NEARUSDT", "ADAUSDT", "SUIUSDT", "DOTUSDT", "SEIUSDT", "INJUSDT", "TIAUSDT", "STXUSDT"];
                    if (!l1List.includes(item.symbol) && item.category !== "layer1") continue;
                } else if (currentWlCategory === "defi") {
                    const defiList = ["AAVEUSDT", "UNIUSDT", "CRVUSDT", "DYDXUSDT", "ENAUSDT", "PENDLEUSDT", "GMXUSDT", "JUPUSDT", "LRCUSDT"];
                    if (!defiList.includes(item.symbol) && item.category !== "defi") continue;
                } else if (currentWlCategory === "alts") {
                    const altsList = ["WIFUSDT", "RENDERUSDT", "WLDUSDT", "PYTHUSDT", "ZROUSDT", "APEUSDT", "GALAUSDT", "SANDUSDT", "MANAUSDT", "ARBUSDT", "OPUSDT"];
                    if (!altsList.includes(item.symbol) && item.category !== "alts") continue;
                }

                const isSelected = item.symbol === currentSymbol;
                const isUp = item.priceChangePercent >= 0;
                const prec = item.precision !== undefined ? item.precision : spec.prec;

                html += `
                <div class="tradew-wl-row ${isSelected ? 'active' : ''}" data-sym="${item.symbol}" onclick="switchSymbol('${item.symbol}', null, true)">
                    <div class="tradew-wl-sym">
                        <span class="tradew-star ${isFav ? 'starred' : ''}" onclick="toggleFavorite('${item.symbol}', event)" title="Favorite">&#9733;</span>
                    <div style="display:flex; align-items:center; overflow:hidden; min-width:0;">
                            <span style="overflow:hidden; text-overflow:ellipsis; font-weight:700; color:var(--text-primary); white-space:nowrap;" title="${dispSym}">${dispSym}</span>
                        </div>
                    </div>
                    <div class="tradew-wl-price" id="wl-price-${item.symbol}">${item.lastPrice.toFixed(prec)}</div>
                    <div class="tradew-wl-chg ${isUp ? 'val-green' : 'val-red'}">${isUp ? '+' : ''}${item.priceChangePercent.toFixed(2)}%</div>
                </div>`;
            }

            if (!html) {
                html = `<div style="padding: 24px 12px; text-align: center; color: var(--text-secondary); font-size: 11px;">No pairs in ${currentWlCategory.toUpperCase()}</div>`;
            }
            container.innerHTML = html;
        }

        function filterWatchlist() {
            renderWatchlist();
        }

        // &#9472;&#9472; Trade W SL/TP Edit Modal State & Functions (Matches Image 1) &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        let currentEditModal = null; // { posId, type, entryPrice, side, symbol, lot, tick, prec }



// ============================================================================
// Module: 13_dock_positions.js
// ============================================================================

function getSymbolTickSpec(sym) {
            const s = (sym || "").toUpperCase();
            const contractSize = getLotContractSize(s);
            if (s.includes("DOGE") || s.includes("GALA")) return { tick: 0.00001, prec: 5, contractSize };
            if (s.includes("BTC")) return { tick: 0.1, prec: 1, contractSize };
            if (s.includes("ETH") || s.includes("SOL") || s.includes("BNB") || s.includes("AVAX")) return { tick: 0.01, prec: 2, contractSize };
            if (s.includes("NEAR") || s.includes("XRP") || s.includes("ADA")) return { tick: 0.001, prec: 3, contractSize };
            return { tick: 0.0001, prec: 4, contractSize };
        }


        // Validate SL/TP price before display (prevent showing wrong symbol's prices)
        function isValidSLTP(sltp_price, entry_price, symbol) {
            if (!sltp_price || sltp_price == null || sltp_price <= 0) return false;
            const ratio = sltp_price / entry_price;
            // SL/TP should be within ±50% of entry (catches cross-symbol contamination)
            if (ratio < 0.5 || ratio > 1.5) return false;
            return true;
        }

        function openSLTPModal(posId, type, currentTargetPrice, entryPrice, side, symbol, lot) {
            const spec = getSymbolTickSpec(symbol);
            const isLong = side === "BUY" || side === "LONG";
            const initialPrice = currentTargetPrice > 0 ? currentTargetPrice : (type === "SL" ? (isLong ? entryPrice * 0.9965 : entryPrice * 1.0035) : (isLong ? entryPrice * 1.015 : entryPrice * 0.985));
            const contractSize = spec.contractSize || getLotContractSize(symbol) || 1;
            
            currentEditModal = {
                posId: posId,
                type: type,
                entryPrice: parseFloat(entryPrice) || 0,
                side: side,
                symbol: symbol,
                lot: parseFloat(lot) || 0.01,
                tick: spec.tick || 0.01,
                prec: spec.prec || 2,
                contractSize: contractSize
            };

            const modal = document.getElementById("tradew-sltp-modal-overlay");
            const title = document.getElementById("sltp-modal-title");
            const constraint = document.getElementById("sltp-modal-constraint");
            const input = document.getElementById("sltp-input-price");
            const lbl = document.getElementById("sltp-metric-label");

            const isSL = type === "SL";
            if (title) title.textContent = isSL ? "Stop Loss" : "Take Profit";
            if (lbl) lbl.textContent = isSL ? "Stop Loss" : "Take Profit";

            const constraintOp = isSL ? (isLong ? "≤" : "≥") : (isLong ? "≥" : "≤");
            if (constraint) constraint.textContent = `${constraintOp}${currentEditModal.entryPrice.toFixed(spec.prec)}`;
            if (input) input.value = initialPrice.toFixed(spec.prec);

            updateSLTPMetrics(initialPrice);
            if (modal) modal.style.display = "flex";
        }

        function closeSLTPModal(event) {
            if (event && event.target && event.target.id !== "tradew-sltp-modal-overlay") return;
            const modal = document.getElementById("tradew-sltp-modal-overlay");
            if (modal) modal.style.display = "none";
            currentEditModal = null;
        }

        function stepSLTP(direction) {
            if (!currentEditModal) return;
            const input = document.getElementById("sltp-input-price");
            let val = parseFloat(input.value);
            if (isNaN(val)) val = currentEditModal.entryPrice;
            val = val + (direction * currentEditModal.tick);
            input.value = val.toFixed(currentEditModal.prec);
            updateSLTPMetrics(val);
        }

        function onSLTPInputChange() {
            if (!currentEditModal) return;
            const input = document.getElementById("sltp-input-price");
            const val = parseFloat(input.value);
            if (!isNaN(val)) {
                updateSLTPMetrics(val);
            }
        }

        function updateSLTPMetrics(targetVal) {
            if (!currentEditModal) return;
            const isLong = currentEditModal.side === "BUY" || currentEditModal.side === "LONG";
            const val = parseFloat(targetVal);
            const entry = Number(currentEditModal.entryPrice);
            const tick = Number(currentEditModal.tick) || 0.01;
            const lot = Number(currentEditModal.lot) || 0.01;
            const contractSize = Number(currentEditModal.contractSize) || getLotContractSize(currentEditModal.symbol) || 1;

            if (isNaN(val) || isNaN(entry)) return;

            const rawDiff = isLong ? (val - entry) : (entry - val);
            const points = Math.round(rawDiff / tick);
            const estPnl = rawDiff * lot * contractSize;

            const pnlEl = document.getElementById("sltp-metric-pnl");
            const pointEl = document.getElementById("sltp-metric-point");
            if (pnlEl) {
                if (Number.isFinite(estPnl)) {
                    pnlEl.textContent = `${estPnl >= 0 ? '+' : ''}${estPnl.toFixed(2)}`;
                    pnlEl.className = estPnl >= 0 ? "val-green" : "val-red";
                } else {
                    pnlEl.textContent = "+0.00";
                    pnlEl.className = "val-green";
                }
            }
            if (pointEl) {
                if (Number.isFinite(points)) {
                    pointEl.textContent = `${points >= 0 ? '+' : ''}${points}`;
                    pointEl.className = points >= 0 ? "val-green" : "val-red";
                } else {
                    pointEl.textContent = "--";
                    pointEl.className = "";
                }
            }
        }

        async function submitSLTPModal() {
            if (!currentEditModal) return;
            const input = document.getElementById("sltp-input-price");
            const newPrice = parseFloat(input.value);
            if (isNaN(newPrice) || newPrice <= 0) return;

            try {
                const resp = await fetch("/api/order/edit_sltp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pos_id: currentEditModal.posId,
                        type: currentEditModal.type,
                        price: newPrice
                    })
                });
                await resp.json();
                closeSLTPModal();
                fetchPortfolio();
            } catch(e) {
                console.error("Failed to update SL/TP:", e);
            }
        }

        // &#9472;&#9472; Trade W Custom Close & Batch Close Functions &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
        function toggleCustomCloseMenu() {
            const el = document.getElementById("dock-custom-close-menu");
            if (el) el.style.display = el.style.display === "none" ? "block" : "none";
        }

        async function batchClosePositions() {
            if (!confirm("Close ALL active positions at current market prices?")) return;
            try {
                await fetch("/api/order/batch_close", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filter: "ALL" })
                });
                fetchPortfolio();
            } catch(e) {
                console.error("Batch close error:", e);
            }
        }

        async function customClosePositions(filterType) {
            const menu = document.getElementById("dock-custom-close-menu");
            if (menu) menu.style.display = "none";
            try {
                await fetch("/api/order/batch_close", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filter: filterType })
                });
                fetchPortfolio();
            } catch(e) {
                console.error("Custom close error:", e);
            }
        }

        // Orderbook removed for ultra-fast, zero-overhead TradeW performance

        // Switch Dock Tabs (Matches Image 1)
        function switchDockTab(tabName) {
            document.querySelectorAll(".dock-tab-btn").forEach(b => b.classList.remove("active"));
            const views = ["position", "pending", "history", "brain", "vault"];
            for (const v of views) {
                const el = document.getElementById(`dock-view-${v}`);
                if (el) el.style.display = "none";
            }
            
            const targetBtn = document.getElementById(`tab-btn-${tabName}`);
            const targetView = document.getElementById(`dock-view-${tabName}`);
            if (targetBtn) targetBtn.classList.add("active");
            if (targetView) targetView.style.display = "block";
        }

        async function closePosition(posId) {
            try {
                const isLive = currentActiveAccount === 'standard' || (posId && String(posId).startsWith('REAL-'));
                const endpoint = isLive ? "/api/live/close" : "/api/order/close";
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ pos_id: posId, symbol: currentSymbol })
                });
                const d = await res.json();
                if (d.status === "FAILED") {
                    alert("Close Failed: " + (d.error || "Unable to close live position"));
                    return;
                }
                playChime("TP");
                fetchPortfolio();
            } catch(e) {
                alert("Close Position Error: " + e.message);
            }
        }

        async function lockBreakeven(posId) {
            try {
                const res = await fetch("/api/order/breakeven", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ pos_id: posId })
                });
                await res.json();
                playChime("TP");
                fetchPortfolio();
            } catch(e) {
                alert("Lock Breakeven Error: " + e.message);
            }
        }

        function formatTradeWTime(t) {
            if (!t) return '19:02:45 20/09/2026';
            if (typeof t === 'string' && t.includes(':') && t.includes('/')) return t;
            try {
                let d;
                if (typeof t === 'number') {
                    d = new Date(t > 1e11 ? t : t * 1000);
                } else {
                    d = new Date(t);
                }
                if (isNaN(d.getTime())) return String(t);
                const pad = n => String(n).padStart(2, '0');
                const hh = pad(d.getHours());
                const mm = pad(d.getMinutes());
                const ss = pad(d.getSeconds());
                const dd = pad(d.getDate());
                const mo = pad(d.getMonth() + 1);
                const yyyy = d.getFullYear();
                return `${hh}:${mm}:${ss} ${dd}/${mo}/${yyyy}`;
            } catch(e) {
                return String(t);
            }
        }

        // Fetch Portfolio State (Auto-Pilot / 6-Brain Demo or Live Binance)
        async function fetchPortfolio() {
            // Never rebuild chart lines while the user is dragging SL/TP
            if (_isDragging || _isPlacingMissingLevel) return;
            const isLive = currentActiveAccount === 'standard';
            const endpoint = isLive ? "/api/live/state" : "/api/demo/state";
            try {
                const res = await apiFetch(endpoint);
                if (!res) return;
                const d = await res.json();
                if (!d || d.wallet_balance === undefined) return;

                // Guard against race conditions where an in-flight request from previous mode arrives late
                if (isLive && !d.is_live_account) return;
                if (!isLive && d.is_live_account) return;

                cachedPortfolioState = d;

                // Update account modal card balance previews
                if (isLive) {
                    const cardStdBal = document.getElementById("card-standard-bal");
                    if (cardStdBal) cardStdBal.innerText = (d.wallet_balance !== undefined ? d.wallet_balance : 20.55).toFixed(2);
                } else {
                    const cardDemoBal = document.getElementById("card-demo-bal");
                    if (cardDemoBal) cardDemoBal.innerText = (d.wallet_balance !== undefined ? d.wallet_balance : 20.55).toFixed(2);
                }
                
                // Start/update multi-position WebSocket for instant price updates
                initMultiPositionWebSocket();
                if (typeof _elbSetPosition === 'function') {
                    _elbSetPosition(cachedPortfolioState && cachedPortfolioState.active_positions
                        ? cachedPortfolioState.active_positions.find(function(p) { return p.symbol === currentSymbol; })
                        : null);
                }

                // Auto-sync chart to first active trade once on initial boot if user hasn't selected another symbol
                if (!_hasInitialPositionBootSynced) {
                    _hasInitialPositionBootSynced = true;
                    if (!userManuallySelectedSymbol && d.active_positions && d.active_positions.length > 0) {
                        const activeSym = d.active_positions[0].symbol;
                        if (currentSymbol !== activeSym) {
                            switchSymbol(activeSym, null, false);
                        }
                    }
                }

                updateOnChartOrderLines();
                requestTradeWOverlayUpdate();
                renderWatchlist();

                // Top nav bar stats (guarded)
                const sWal = document.getElementById("stat-wallet");
                const sVlt = document.getElementById("stat-vault");
                const sEq = document.getElementById("stat-equity");
                const sWr = document.getElementById("stat-winrate");
                if (sWal) sWal.innerText = "$" + d.wallet_balance.toFixed(2);
                if (sVlt) sVlt.innerText = "$" + d.safe_vault.toFixed(2);
                if (sEq) sEq.innerText = "$" + d.total_equity.toFixed(2);
                if (sWr) sWr.innerText = (d.stats && d.stats.decided_win_rate_pct !== undefined ? d.stats.decided_win_rate_pct : 100.0) + "%";

                // Tab vault cards
                const vWallet = document.getElementById("vault-tab-wallet");
                const vVault = document.getElementById("vault-tab-vault");
                const vEq = document.getElementById("vault-tab-equity");
                const vPnl = document.getElementById("vault-tab-pnl");
                const vWr = document.getElementById("vault-tab-winrate");
                const vDd = document.getElementById("vault-tab-dd");
                if (vWallet) vWallet.innerText = "$" + d.wallet_balance.toFixed(2);
                if (vVault) vVault.innerText = "$" + d.safe_vault.toFixed(2);
                if (vEq) vEq.innerText = "$" + d.total_equity.toFixed(2);
                if (vPnl) vPnl.innerText = (d.session_pnl >= 0 ? "+$" : "-$") + Math.abs(d.session_pnl).toFixed(2);
                if (vWr) vWr.innerText = (d.stats && d.stats.decided_win_rate_pct !== undefined ? d.stats.decided_win_rate_pct : 100.0) + "%";
                if (vDd) vDd.innerText = "-$" + (d.max_drawdown_usd || 0).toFixed(2) + " (" + (d.max_drawdown_pct || 0) + "%)";

                const positions = d.active_positions || [];
                const closedTrades = d.closed_trades || [];
                const pendingOrders = d.pending_orders || [];

                // Portfolio files contain the order facts, not authoritative
                // UI PnL. Calculate it from price × contract size so stale or
                // legacy persisted `unrealized_pnl` values cannot be displayed.
                for (const position of positions) {
                    const quoted = Number(livePricesBySymbol.get(position.symbol));
                    const current = position.symbol === currentSymbol && Number(lastKnownPrice) > 0
                        ? Number(lastKnownPrice)
                        : (Number.isFinite(quoted) && quoted > 0
                            ? quoted
                            : (Number(position.current_price) || Number(position.entry_price)));
                    position.current_price = current;
                    position.unrealized_pnl = calculatePositionPnl(position, current);
                }

                // Badges in dock tab strip
                const cntPosEl = document.getElementById("cnt-pos");
                const cntPendEl = document.getElementById("cnt-pending");
                const cntHistEl = document.getElementById("cnt-history");
                if (cntPosEl) cntPosEl.innerText = positions.length;
                if (cntPendEl) cntPendEl.innerText = pendingOrders.length;
                if (cntHistEl) cntHistEl.innerText = closedTrades.length;

                // Total Floating PnL
                let totalUnrealized = 0;
                for (const p of positions) totalUnrealized += Number(p.unrealized_pnl) || 0;
                const fltNav = document.getElementById("stat-floating");
                const fltDock = document.getElementById("dock-floating-pnl");
                const fltStr = (totalUnrealized >= 0 ? "+$" : "-$") + Math.abs(totalUnrealized).toFixed(2);
                const fltCls = totalUnrealized >= 0 ? "val-green" : "val-red";
                _setFloatingPnlDisplay(totalUnrealized);

                // Update Dock Right Account Summary (Image 2 style)
                const sideTot = document.getElementById("dock-side-total");
                const sideMrg = document.getElementById("dock-side-margin");
                if (sideTot) sideTot.innerText = "$" + (d.wallet_balance !== undefined ? d.wallet_balance.toFixed(2) : "0.00");
                if (sideMrg) sideMrg.innerText = "$" + (d.used_margin !== undefined ? d.used_margin.toFixed(2) : (isLive ? "0.00" : "0.30"));

                // Update TradeW Right Sidebar Top Account Strip (media_1789950712703.png style)
                const acctBal = document.getElementById("disp-tradew-bal");
                const acctPnl = document.getElementById("disp-tradew-floating");
                if (acctBal) acctBal.innerText = (d.wallet_balance !== undefined ? d.wallet_balance.toFixed(2) : "20.55");
                if (acctPnl) {
                    const sign = totalUnrealized >= 0 ? "+" : "-";
                    acctPnl.innerText = `${sign}${Math.abs(totalUnrealized).toFixed(2)}`;
                    acctPnl.style.color = totalUnrealized >= 0 ? "#00C076" : "#EF5350";
                }

                // TradeW Empty State Illustration (Matches Demo)
                const emptyStateHtml = `
                    <tr>
                        <td colspan="13">
                            <div class="tradew-empty-container">
                                <svg width="56" height="56" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:8px;opacity:0.45">
                                    <!-- Base platform -->
                                    <ellipse cx="40" cy="66" rx="22" ry="5" fill="#2B313A" opacity="0.5"/>
                                    <!-- Main card body, slightly tilted -->
                                    <g transform="rotate(-12, 40, 38)">
                                        <rect x="18" y="16" width="44" height="36" rx="4" fill="#1E2329" stroke="#2B313A" stroke-width="1.5"/>
                                        <line x1="26" y1="27" x2="54" y2="27" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                        <line x1="26" y1="33" x2="48" y2="33" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                        <line x1="26" y1="39" x2="42" y2="39" stroke="#3D4755" stroke-width="1.5" stroke-linecap="round"/>
                                    </g>
                                    <!-- Shadow card behind -->
                                    <g transform="rotate(6, 40, 42)" opacity="0.5">
                                        <rect x="20" y="24" width="40" height="30" rx="4" fill="#181A20" stroke="#2B313A" stroke-width="1.2"/>
                                    </g>
                                    <!-- Small sparkle dots -->
                                    <circle cx="14" cy="22" r="1.5" fill="#3D4755" opacity="0.6"/>
                                    <circle cx="64" cy="30" r="1" fill="#3D4755" opacity="0.5"/>
                                    <circle cx="60" cy="58" r="1.5" fill="#3D4755" opacity="0.4"/>
                                </svg>
                                <span style="font-size: 13px; font-weight: 400; color: #848E9C;">No records</span>
                            </div>
                        </td>
                    </tr>
                `;

                // 1. Render Active Positions Table — smart diff: only rebuild HTML when
                //    positions open/close; otherwise tick live cells via DOM IDs so the
                //    multiPosWs 100ms updates are never wiped by a 1s innerHTML reset.
                const posTbody = document.getElementById("dock-pos-tbody");
                if (posTbody) {
                    if (positions.length === 0) {
                        posTbody.innerHTML = emptyStateHtml;
                        _lastRenderedPosIds = "";
                        if (typeof _clearActiveChartLines === 'function') _clearActiveChartLines();
                        if (typeof _elbSetPosition === 'function') _elbSetPosition(null);
                        if (typeof _hideOrderLineTickets === 'function') _hideOrderLineTickets();
                    } else {
                        const newPosIds = positions.map(p => `${p.pos_id}:${p.sl_price}:${p.tp_price || (p.tranches?.queen?.tp_price)}:${p.is_risk_free}`).join("|");
                        const needsFullRebuild = newPosIds !== _lastRenderedPosIds;

                        if (needsFullRebuild) {
                            // Structure changed (new position opened or closed, or SL/TP updated): full rebuild
                            let rows = "";
                            for (const pos of positions) {
                                const spec = getSymbolSpec(pos.symbol);
                                const prec = spec.prec;
                                const isBuy = pos.side === "BUY";
                                const sideText = isBuy ? `<span style="color: #00C076; font-weight: 700;">Buy</span>` : `<span style="color: #EF5350; font-weight: 700;">Sell</span>`;
                                const pnlVal = calculatePositionPnl(pos, Number(pos.current_price) || Number(pos.entry_price));
                                const pnlCls = pnlVal >= 0 ? "val-green" : "val-red";
                                const pnlSign = pnlVal >= 0 ? "+" : "";
                                const rawFee = Number(pos.fee);
                                const fee = Number.isFinite(rawFee)
                                    ? (Math.abs(rawFee) < 0.0000001 ? "0.00" : `-${Math.abs(rawFee).toFixed(2)}`)
                                    : "--";
                                const swap = Number.isFinite(Number(pos.swap)) ? Number(pos.swap).toFixed(2) : "--";
                                const lot = (pos.volume_lots || 0.01).toFixed(2);
                                const orderNo = pos.order_no || pos.pos_id || "--";
                                const rawSl = (pos.sl_price !== null && pos.sl_price !== undefined) ? pos.sl_price : (pos.side === 'BUY' ? pos.entry_price * 0.9965 : pos.entry_price * 1.0035);
                                const hasSl = pos.sl_price !== null && pos.sl_price !== undefined && Number(pos.sl_price) > 0 && isValidSLTP(pos.sl_price, pos.entry_price, pos.symbol);
                                const slDisp = hasSl
                                    ? `${Number(pos.sl_price).toFixed(prec)} <span class="position-edit-icon" onclick="openSLTPModal('${pos.pos_id}', 'SL', ${rawSl}, ${pos.entry_price}, '${pos.side}', '${pos.symbol}', ${pos.volume_lots || 0.01}); event.stopPropagation();" title="Edit Stop Loss">&#9998;</span>`
                                    : `<span style="color: #848E9C; cursor:pointer;" onclick="openSLTPModal('${pos.pos_id}', 'SL', ${rawSl}, ${pos.entry_price}, '${pos.side}', '${pos.symbol}', ${pos.volume_lots || 0.01}); event.stopPropagation();" title="Set Stop Loss">-- <span class="position-edit-icon">&#9998;</span></span>`;

                                let tpNum = null;
                                if (pos.tp_price !== null && pos.tp_price !== undefined && Number(pos.tp_price) > 0 && isValidSLTP(pos.tp_price, pos.entry_price, pos.symbol)) {
                                    tpNum = pos.tp_price;
                                } else if (pos.tranches && pos.tranches.queen && pos.tranches.queen.tp_price && isValidSLTP(pos.tranches.queen.tp_price, pos.entry_price, pos.symbol)) {
                                    tpNum = pos.tranches.queen.tp_price;
                                }
                                const rawTp = tpNum || (pos.side === 'BUY' ? pos.entry_price * 1.015 : pos.entry_price * 0.985);
                                const tpDisp = tpNum
                                    ? `${Number(tpNum).toFixed(prec)} <span class="position-edit-icon" onclick="openSLTPModal('${pos.pos_id}', 'TP', ${rawTp}, ${pos.entry_price}, '${pos.side}', '${pos.symbol}', ${pos.volume_lots || 0.01}); event.stopPropagation();" title="Edit Take Profit">&#9998;</span>`
                                    : `<span style="color: #848E9C; cursor:pointer;" onclick="openSLTPModal('${pos.pos_id}', 'TP', ${rawTp}, ${pos.entry_price}, '${pos.side}', '${pos.symbol}', ${pos.volume_lots || 0.01}); event.stopPropagation();" title="Set Take Profit">-- <span class="position-edit-icon">&#9998;</span></span>`;

                                const isCurrentFocus = pos.symbol === currentSymbol;
                                const symDisplay = spec.display;

                                rows += `
                                <tr data-pos-id="${pos.pos_id}" class="${isCurrentFocus ? 'row-focus' : ''}" onclick="switchSymbol('${pos.symbol}', null, true)" style="cursor: pointer;" title="Click to view chart for ${pos.symbol}">
                                    <td><strong style="color: var(--text-primary); display:flex; align-items:center; gap:5px;">${symDisplay}</strong></td>
                                    <td style="color: var(--text-secondary); font-size: 11px;">${formatTradeWTime(pos.entry_time)}</td>
                                    <td>${sideText}</td>
                                    <td style="font-family: 'Roboto Mono', monospace;">${lot}</td>
                                    <td style="font-family: 'Roboto Mono', monospace;">${(pos.entry_price || 0).toFixed(prec)}</td>
                                    <td id="position-current-${pos.pos_id}" style="font-family: 'Roboto Mono', monospace; font-weight: 700; color: var(--text-primary);">${(pos.current_price || pos.entry_price || 0).toFixed(prec)}</td>
                                    <td id="position-sl-${pos.pos_id}" style="font-family: 'Roboto Mono', monospace; color: var(--binance-red);">${slDisp}</td>
                                    <td id="position-tp-${pos.pos_id}" style="font-family: 'Roboto Mono', monospace; color: var(--binance-green);">${tpDisp}</td>
                                    <td style="color: var(--text-secondary); font-size: 11px;">${fee}</td>
                                    <td style="color: var(--text-secondary); font-size: 11px;">${swap}</td>
                                    <td style="color: var(--text-secondary); font-size: 11px; font-family: 'Roboto Mono', monospace;">${orderNo}</td>
                                    <td id="position-pnl-${pos.pos_id}" class="${pnlCls}" style="font-family: 'Roboto Mono', monospace; font-weight: 700;">${pnlSign}${pnlVal.toFixed(2)}</td>
                                    <td style="text-align: right;" onclick="event.stopPropagation();">
                                        ${!pos.is_risk_free ? `<button class="btn-dock-sm btn-dock-be" onclick="lockBreakeven('${pos.pos_id}')" title="Lock Breakeven (+0.15R)">&#128274; BE</button>` : ''}
                                        <button class="btn-dock-close-circle" onclick="closePosition('${pos.pos_id}')" title="Close Position">&#10005;</button>
                                    </td>
                                </tr>`;
                            }
                            posTbody.innerHTML = rows;
                            _lastRenderedPosIds = newPosIds;
                        } else {
                            // Same positions — update focus class and refresh SL / TP cell content
                            for (const pos of positions) {
                                const row = posTbody.querySelector(`tr[data-pos-id="${pos.pos_id}"]`);
                                if (row) {
                                    row.className = pos.symbol === currentSymbol ? 'row-focus' : '';
                                }
                                const spec = getSymbolSpec(pos.symbol);
                                const prec = spec.prec;
                                const rawSl = (pos.sl_price !== null && pos.sl_price !== undefined) ? pos.sl_price : (pos.side === 'BUY' ? pos.entry_price * 0.9965 : pos.entry_price * 1.0035);
                                const hasSl = pos.sl_price !== null && pos.sl_price !== undefined && Number(pos.sl_price) > 0 && isValidSLTP(pos.sl_price, pos.entry_price, pos.symbol);
                                const slDisp = hasSl
                                    ? `${Number(pos.sl_price).toFixed(prec)} <span class="position-edit-icon" onclick="openSLTPModal('${pos.pos_id}', 'SL', ${rawSl}, ${pos.entry_price}, '${pos.side}', '${pos.symbol}', ${pos.volume_lots || 0.01}); event.stopPropagation();" title="Edit Stop Loss">&#9998;</span>`
                                    : `<span style="color: #848E9C; cursor:pointer;" onclick="openSLTPModal('${pos.pos_id}', 'SL', ${rawSl}, ${pos.entry_price}, '${pos.side}', '${pos.symbol}', ${pos.volume_lots || 0.01}); event.stopPropagation();" title="Set Stop Loss">-- <span class="position-edit-icon">&#9998;</span></span>`;

                                let tpNum = null;
                                if (pos.tp_price !== null && pos.tp_price !== undefined && Number(pos.tp_price) > 0 && isValidSLTP(pos.tp_price, pos.entry_price, pos.symbol)) {
                                    tpNum = pos.tp_price;
                                } else if (pos.tranches && pos.tranches.queen && pos.tranches.queen.tp_price && isValidSLTP(pos.tranches.queen.tp_price, pos.entry_price, pos.symbol)) {
                                    tpNum = pos.tranches.queen.tp_price;
                                }
                                const rawTp = tpNum || (pos.side === 'BUY' ? pos.entry_price * 1.015 : pos.entry_price * 0.985);
                                const tpDisp = tpNum
                                    ? `${Number(tpNum).toFixed(prec)} <span class="position-edit-icon" onclick="openSLTPModal('${pos.pos_id}', 'TP', ${rawTp}, ${pos.entry_price}, '${pos.side}', '${pos.symbol}', ${pos.volume_lots || 0.01}); event.stopPropagation();" title="Edit Take Profit">&#9998;</span>`
                                    : `<span style="color: #848E9C; cursor:pointer;" onclick="openSLTPModal('${pos.pos_id}', 'TP', ${rawTp}, ${pos.entry_price}, '${pos.side}', '${pos.symbol}', ${pos.volume_lots || 0.01}); event.stopPropagation();" title="Set Take Profit">-- <span class="position-edit-icon">&#9998;</span></span>`;

                                const slEl = document.getElementById(`position-sl-${pos.pos_id}`);
                                if (slEl && slEl.innerHTML !== slDisp) slEl.innerHTML = slDisp;
                                const tpEl = document.getElementById(`position-tp-${pos.pos_id}`);
                                if (tpEl && tpEl.innerHTML !== tpDisp) tpEl.innerHTML = tpDisp;
                            }
                        }
                    }
                }

                // 2. Render Pending Orders Table

                // Immediately update all position cells with live prices from cache
                for (const pos of positions) {
                    const livePrice = Number(livePricesBySymbol.get(pos.symbol));
                    if (Number.isFinite(livePrice) && livePrice > 0) {
                        refreshLivePositionMetrics(pos.symbol, livePrice);
                    }
                }
                const pendingTbody = document.getElementById("dock-pending-tbody");
                if (pendingTbody) {
                    if (pendingOrders.length === 0) {
                        pendingTbody.innerHTML = emptyStateHtml;
                    } else {
                        let rows = "";
                        for (const ord of pendingOrders) {
                            const spec = getSymbolSpec(ord.symbol);
                            const prec = spec.prec;
                            rows += `
                            <tr>
                                <td><strong style="color: var(--text-primary);">${spec.display}</strong></td>
                                <td style="color: var(--text-secondary); font-size: 11px;">${ord.place_time || '--'}</td>
                                <td><span style="color: var(--binance-green); font-weight: 700;">${ord.type || 'BUY LIMIT'}</span></td>
                                <td style="font-family: 'Roboto Mono', monospace;">${(ord.volume_lots || 0.01).toFixed(2)}</td>
                                <td style="font-family: 'Roboto Mono', monospace; color: var(--binance-gold);">${(ord.order_price || 0).toFixed(prec)}</td>
                                <td style="font-family: 'Roboto Mono', monospace;">${ord.current_price ? ord.current_price.toFixed(prec) : '--'}</td>
                                <td style="font-family: 'Roboto Mono', monospace; color: var(--binance-red);">${ord.sl_price ? ord.sl_price.toFixed(prec) : '--'}</td>
                                <td style="font-family: 'Roboto Mono', monospace; color: var(--binance-green);">${ord.tp_price ? ord.tp_price.toFixed(prec) : '--'}</td>
                                <td style="color: var(--text-secondary); font-size: 11px;">$0.00</td>
                                <td style="color: var(--text-secondary); font-size: 11px; font-family: 'Roboto Mono', monospace;">#${ord.order_no || '--'}</td>
                                <td><span style="color: var(--binance-gold); font-size: 11px; font-weight: 700;">PENDING</span></td>
                                <td style="text-align: right;"><button class="btn-dock-sm btn-dock-close" onclick="cancelPendingOrder('${ord.order_no}')">Cancel</button></td>
                            </tr>`;
                        }
                        pendingTbody.innerHTML = rows;
                    }
                }

                // 3. Render Closed History Table
                const histTbody = document.getElementById("dock-hist-tbody");
                if (histTbody) {
                    if (closedTrades.length === 0) {
                        histTbody.innerHTML = emptyStateHtml;
                    } else {
                        let rows = "";
                        for (const t of closedTrades.slice(0, 25)) {
                            const spec = getSymbolSpec(t.symbol);
                            const prec = spec.prec;
                            const isBuy = t.side === "BUY";
                            const pnlVal = t.final_net_pnl !== undefined ? t.final_net_pnl : (t.realized_pnl || 0);
                            const pnlCls = pnlVal >= 0 ? "val-green" : "val-red";
                            const pnlSign = pnlVal >= 0 ? "+" : "";
                            const fee = t.total_fee ? `$${t.total_fee.toFixed(3)}` : "$0.00";
                            const lot = (t.volume_lots || 0.01).toFixed(2);
                            const orderNo = (t.pos_id || t.order_no || "").replace("POS-", "");
                            const exitReason = t.exit_reason || (pnlVal > 0 ? "&#9989; TP Settled (Vault Swept)" : "Exit");

                            rows += `
                            <tr>
                                <td><strong style="color: var(--text-primary);">${spec.display}</strong></td>
                                <td style="color: var(--text-secondary); font-size: 11px;">${t.closed_time || t.entry_time || '--'}</td>
                                <td><span style="color: ${isBuy ? 'var(--binance-green)' : 'var(--binance-red)'}; font-weight: 700;">${isBuy ? 'Buy' : 'Sell'}</span></td>
                                <td style="font-family: 'Roboto Mono', monospace;">${lot}</td>
                                <td style="font-family: 'Roboto Mono', monospace;">${(t.entry_price || 0).toFixed(prec)}</td>
                                <td style="font-family: 'Roboto Mono', monospace; font-weight: 700; color: var(--text-primary);">${(t.close_price || t.current_price || 0).toFixed(prec)}</td>
                                <td style="color: var(--text-secondary); font-size: 11px;">${fee}</td>
                                <td style="color: var(--text-secondary); font-size: 11px; font-family: 'Roboto Mono', monospace;">#${orderNo}</td>
                                <td class="${pnlCls}" style="font-family: 'Roboto Mono', monospace; font-weight: 700;">${pnlSign}$${pnlVal.toFixed(2)}</td>
                                <td style="text-align: right; color: var(--binance-gold); font-size: 11px; font-weight: 600;">${exitReason}</td>
                            </tr>`;
                        }
                        histTbody.innerHTML = rows;
                    }
                }

            } catch(e) { console.warn("Position refresh:", e.message); }
        }

        // 1-Click Order Execution (Supports Market & Limit Orders for both Demo & Live Binance)
        async function sendOrder(cmd, lot = 0.01, isLimit = false, limitPrice = null, tpPrice = null, slPrice = null, clientPrice = null) {
            playHapticTone(cmd);
            const btnAction = document.getElementById("btn-primary-action");
            if (btnAction) {
                btnAction.style.transform = "scale(0.96)";
                setTimeout(() => { if (btnAction) btnAction.style.transform = ""; }, 90);
            }

            const isLive = currentActiveAccount === 'standard';
            const endpoint = isLive ? "/api/live/order" : "/api/order";
            const liveCurrentPrice = (clientPrice && Number(clientPrice) > 0)
                ? Number(clientPrice)
                : ((typeof lastKnownPrice !== 'undefined' && Number(lastKnownPrice) > 0)
                    ? Number(lastKnownPrice)
                    : ((typeof currentCandle !== 'undefined' && currentCandle?.close)
                        ? Number(currentCandle.close)
                        : ((typeof cachedCandles !== 'undefined' && cachedCandles.length)
                            ? Number(cachedCandles[cachedCandles.length - 1].close)
                            : null)));

            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        symbol: currentSymbol,
                        cmd: cmd,
                        side: cmd,
                        order_type: isLimit ? "LIMIT" : "MARKET",
                        volume_lots: lot,
                        lot: lot,
                        is_limit: isLimit,
                        limit_price: limitPrice,
                        tp_price: tpPrice,
                        sl_price: slPrice,
                        sl_pips: 40,
                        tp_pips: 60,
                        use_3tranches: !isLive,
                        leverage: 50,
                        current_price: liveCurrentPrice,
                        client_price: liveCurrentPrice
                    })
                });
                const rawText = await res.text();
                let data = {};
                try {
                    data = JSON.parse(rawText);
                } catch(pe) {
                    console.error("Order JSON parse error:", rawText);
                    alert("Order Failed: Server error (" + res.status + ")");
                    return;
                }
                if (!res.ok || data.status === "ERROR" || data.status === "FAILED") {
                    alert("Order Failed: " + (data.message || data.error || "Execution error"));
                    return;
                }
                if (isLive) {
                    switchDockTab('position');
                    _dragToast(`⚡ [LIVE BINANCE] ${cmd} ${currentSymbol} executed! OrderId: ${data.orderId || ''}`, '#F0B90B');
                } else if (isLimit) {
                    switchDockTab('pending');
                    _dragToast(`✓ Limit order placed @ ${limitPrice}!`, '#0ECB81');
                } else {
                    switchDockTab('position');
                    _dragToast(`✓ ${cmd} ${lot} lot ${currentSymbol} executed @ ${data.entry || lastKnownPrice || ''}!`, '#0ECB81');
                }
                playHapticTone('trade_success');
                fetchPortfolio();
            } catch(e) {
                _dragToast("Order Error: " + e.message, '#F6465D');
            }
        }

        async function cancelPendingOrder(orderNo) {
            try {
                playHapticTone("click");
                const res = await fetch("/api/order/cancel_pending", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ order_no: orderNo })
                });
                await res.json();
                playHapticTone("close");
                fetchPortfolio();
            } catch(e) {
                alert("Cancel Order Error: " + e.message);
            }
        }

        async function resetDemo() {
            if (!confirm("Are you sure you want to reset the demo portfolio back to $15.00 USDT starting base?")) return;
            try {
                await fetch("/api/demo/reset", {method: "POST"});
                fetchPortfolio();
            } catch(e) {}
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // Global Engine: [TP] [SL] Entry Line Buttons & SL/TP Drag Engine
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        let _elbPos       = null;   // { posId, entryP, side, symbol, lot, slP, tpP }
        let _elbRafId     = null;
        let _isDragging   = false;
        let _dragState    = null;
        let _mousedownPl  = null;
        let _mousedownY   = null;
        let _sltpDragBound = false;
        let _pendingLevelDrag = null;
        let _isPlacingMissingLevel = false;
        let _pendingLevelPriceLine = null;
        let _chartNavigationLocked = false;



// ============================================================================
// Module: 14_order_overlays.js
// ============================================================================


        function _setChartNavigationLocked(locked) {
            if (_chartNavigationLocked === locked) return;
            _chartNavigationLocked = locked;
            const chartContainer = document.getElementById('tv-chart');
            if (chartContainer) {
                chartContainer.style.touchAction = locked ? 'none' : '';
                chartContainer.classList.toggle('sltp-line-dragging', locked);
            }
            // Lightweight Charts starts panning from the same mouse gesture as
            // our line drag. Disable its navigation for that brief gesture so
            // the price scale cannot slide underneath the SL/TP line.
            if (chart) {
                try {
                    chart.applyOptions({
                        handleScroll: !locked,
                        handleScale: !locked,
                    });
                } catch (error) {}
            }
        }

        function _clearPendingLevelPreview() {
            if (_pendingLevelPriceLine && candleSeries) {
                try { candleSeries.removePriceLine(_pendingLevelPriceLine); } catch (error) {}
            }
            _pendingLevelPriceLine = null;
            const dragCard = document.getElementById('order-line-drag-card');
            if (dragCard) dragCard.style.display = 'none';
        }

        // A new SL/TP has no real PriceLine until it is saved. Render this
        // preview immediately so the line and exact price travel
        // with the pointer while the trader chooses a level, along with a
        // real-time floating card displaying the exact price and calculated PnL.
        function _showPendingLevelPreview(type, price, position) {
            if (!candleSeries || !Number.isFinite(Number(price))) return;
            const color = type === 'SL' ? '#F6465D' : '#00C076';
            const options = {
                price: Number(price),
                color,
                lineStyle: 1,
                lineWidth: 1,
                axisLabelVisible: true,
                axisLabelColor: color,
                axisLabelTextColor: '#FFFFFF',
                title: '',
            };
            if (_pendingLevelPriceLine) {
                try { _pendingLevelPriceLine.applyOptions(options); } catch (error) {
                    _clearPendingLevelPreview();
                }
            } else {
                try { _pendingLevelPriceLine = candleSeries.createPriceLine(options); } catch (error) {}
            }

            const chartContainer = document.getElementById('tv-chart');
            if (!chartContainer) return;
            const rect = chartContainer.getBoundingClientRect();
            const y = candleSeries.priceToCoordinate(Number(price));
            if (!Number.isFinite(y) || y < 0 || y > chartContainer.clientHeight) {
                const dragCard = document.getElementById('order-line-drag-card');
                if (dragCard) dragCard.style.display = 'none';
                return;
            }

            let dragCard = document.getElementById('order-line-drag-card');
            if (!dragCard) {
                dragCard = document.createElement('div');
                dragCard.id = 'order-line-drag-card';
                dragCard.className = 'order-line-ticket is-dragging';
                dragCard.style.cssText = 'position:fixed;display:none;z-index:10005;transform:translateY(-50%);height:22px;line-height:22px;white-space:nowrap;pointer-events:none;border-radius:3px;box-shadow:0 2px 8px rgba(0,0,0,0.8);align-items:center;user-select:none;';
                const lbl = document.createElement('span');
                lbl.className = 'order-line-ticket-label';
                dragCard.appendChild(lbl);
                document.body.appendChild(dragCard);
            }

            const pos = position || cachedPortfolioState?.active_positions?.find(p => p.symbol === currentSymbol) || _elbPos;
            const isLong = (String(pos?.side).toUpperCase() === 'BUY' || String(pos?.side).toUpperCase() === 'LONG');
            const lot = Number(pos?.lot || pos?.volume_lots || 0.01);
            const entryP = Number(pos?.entryP || pos?.entry_price || price);
            const sym = pos?.symbol || currentSymbol;
            const contractSize = getLotContractSize(sym);
            const difference = isLong ? (Number(price) - entryP) : (entryP - Number(price));
            const pnl = difference * lot * contractSize;
            const sign = pnl >= 0 ? '+' : '';

            const lbl = dragCard.querySelector('.order-line-ticket-label');
            if (lbl) {
                lbl.innerHTML = `${type} ${lot}&nbsp;&nbsp;Est: ${sign}${pnl.toFixed(2)}`;
            }
            dragCard.style.background = color;
            const baseRight = Math.max(0, window.innerWidth - rect.right + 82);
            dragCard.style.right = `${baseRight}px`;
            dragCard.style.left = 'auto';
            dragCard.style.top = `${rect.top + y}px`;
            dragCard.style.display = 'inline-flex';
        }



        function _bindTicketDragButton(button, posId, level) {
            let startX = 0, startY = 0;
            let isButtonDragging = false;
            let onDocMove = null;
            let onDocUp = null;

            button.setAttribute('draggable', 'false');
            button.addEventListener('pointerdown', (event) => {
                if (event.button !== 0 || !candleSeries) return;
                const chartContainer = document.getElementById('tv-chart');
                if (!chartContainer) return;

                let pos = cachedPortfolioState?.active_positions?.find(p => String(p.pos_id) === String(posId)) || _elbPos;
                if (!pos) {
                    const line = activePriceLines.find(l => l._meta && String(l._meta.posId) === String(posId));
                    if (line && line._meta) {
                        pos = {
                            pos_id: line._meta.posId,
                            entry_price: line._meta.entryPrice,
                            side: line._meta.side,
                            symbol: line._meta.symbol,
                            volume_lots: line._meta.lot,
                            sl_price: line._meta.slPrice,
                            tp_price: line._meta.tpPrice
                        };
                    }
                }
                if (!pos) return;

                event.preventDefault();
                event.stopPropagation();
                try { button.setPointerCapture(event.pointerId); } catch(e) {}

                startX = event.clientX;
                startY = event.clientY;
                isButtonDragging = false;

                const curSl = pos.sl_price !== undefined ? pos.sl_price : pos.slP;
                const curTp = pos.tp_price !== undefined ? pos.tp_price : (pos.tranches?.queen?.tp_price || pos.tpP);

                const dragInfo = {
                    type: level,
                    posId: posId,
                    startY: event.clientY,
                    position: {
                        posId: pos.pos_id || pos.posId,
                        entryP: parseFloat(pos.entry_price || pos.entryP || 0),
                        side: pos.side,
                        symbol: pos.symbol,
                        lot: pos.volume_lots || pos.lot || 0.01,
                        slP: curSl,
                        tpP: curTp
                    },
                    moved: false,
                    price: null
                };
                _pendingLevelDrag = dragInfo;
                _setChartNavigationLocked(true);

                onDocMove = (e) => {
                    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
                    if (dist > 3) {
                        dragInfo.moved = true;
                        isButtonDragging = true;
                        button.classList.add('is-dragging');
                        _isPlacingMissingLevel = true;
                        document.body.style.userSelect = 'none';

                        const c = document.getElementById('tv-chart');
                        if (c) {
                            const relY = e.clientY - c.getBoundingClientRect().top;
                            try {
                                const price = candleSeries.coordinateToPrice(relY);
                                if (price && Number.isFinite(price) && price > 0) {
                                    dragInfo.price = price;
                                    _showPendingLevelPreview(level, price, dragInfo.position);
                                }
                            } catch(err) {}
                        }
                    }
                };

                onDocUp = async (e) => {
                    try { if (e && e.pointerId) button.releasePointerCapture(e.pointerId); } catch(err) {}
                    window.removeEventListener('pointermove', onDocMove, true);
                    window.removeEventListener('pointerup', onDocUp, true);
                    window.removeEventListener('pointercancel', onDocUp, true);
                    onDocMove = null;
                    onDocUp = null;

                    _pendingLevelDrag = null;
                    _isPlacingMissingLevel = false;
                    document.body.style.userSelect = '';
                    _setChartNavigationLocked(false);
                    button.classList.remove('is-dragging');

                    if (dragInfo.moved && Number.isFinite(dragInfo.price) && dragInfo.price > 0) {
                        _clearPendingLevelPreview();
                        await _saveMissingLevel(dragInfo.type, dragInfo.position, e.clientY);
                    } else if (!isButtonDragging) {
                        _clearPendingLevelPreview();
                        // Clicked without drag -> open precision SL/TP modal!
                        const p = dragInfo.position;
                        const cur = level === 'TP'
                            ? (p.tpP && Number(p.tpP) > 0 ? parseFloat(p.tpP) : (p.entryP * (p.side === 'BUY' ? 1.01 : 0.99)))
                            : (p.slP && Number(p.slP) > 0 ? parseFloat(p.slP) : (p.entryP * (p.side === 'BUY' ? 0.99 : 1.01)));
                        openSLTPModal(posId, level, cur, p.entryP, p.side, p.symbol, p.lot);
                    } else {
                        _clearPendingLevelPreview();
                    }
                };

                window.addEventListener('pointermove', onDocMove, true);
                window.addEventListener('pointerup', onDocUp, true);
                window.addEventListener('pointercancel', onDocUp, true);
            });
        }

        function _orderLineTicket(posId, type) {
            const ticketId = `order-line-ticket-${posId}-${type.toLowerCase()}`;
            let ticket = document.getElementById(ticketId);
            if (ticket) return ticket;
            ticket = document.createElement('div');
            ticket.id = ticketId;
            ticket.className = 'order-line-ticket';
            ticket.dataset.posId = posId;
            ticket.dataset.lineType = type;

            const label = document.createElement('span');
            label.className = 'order-line-ticket-label';
            ticket.appendChild(label);

            // For SL and TP badges: direct pointer drag with capture (Zero buffer, zero lag, smooth 60fps)
            if (type === 'SL' || type === 'TP') {
                ticket.addEventListener('pointerdown', function(event) {
                    if (event.button !== 0 || !candleSeries) return;
                    if (event.target.closest('.order-line-ticket-close')) return;
                    const pl = activePriceLines.find(l => l._meta && l._meta.lineType === type && String(l._meta.posId) === String(posId));
                    if (!pl) return;
                    const c = document.getElementById('tv-chart');
                    if (!c) return;

                    event.preventDefault();
                    event.stopPropagation();
                    try { ticket.setPointerCapture(event.pointerId); } catch(e) {}

                    _mousedownPl = pl;
                    _mousedownY = event.clientY;
                    _cachedRect = c.getBoundingClientRect();
                    _isDragging = true;
                    _dragState = { pl: pl, meta: pl._meta, currentPrice: pl.options().price, posId: posId, type: type };
                    _setChartNavigationLocked(true);
                    ticket.classList.add('is-dragging');
                    ticket.style.cursor = 'grabbing';
                    c.style.cursor = 'grabbing';
                    document.body.style.userSelect = 'none';

                    let moveRaf = false;
                    let pendingY = event.clientY;

                    const processMove = () => {
                        moveRaf = false;
                        if (!_isDragging || !_dragState || !candleSeries) return;
                        const ry = pendingY - _cachedRect.top;
                        let price = null;
                        try { price = candleSeries.coordinateToPrice(ry); } catch(err) {}
                        if (!price || !Number.isFinite(price) || price <= 0) return;
                        _dragState.currentPrice = price;

                        try {
                            pl.applyOptions({
                                price: price,
                                title: '',
                                axisLabelVisible: true,
                                axisLabelColor: type === 'SL' ? '#F6465D' : '#00C076',
                                axisLabelTextColor: '#FFFFFF',
                            });
                        } catch(err) {}

                        _syncOrderLineTickets(c, _cachedRect);
                    };

                    const onMove = (e) => {
                        pendingY = e.clientY;
                        if (!moveRaf) {
                            moveRaf = true;
                            requestAnimationFrame(processMove);
                        }
                    };

                    const onUp = async (e) => {
                        try { if (e && e.pointerId) ticket.releasePointerCapture(e.pointerId); } catch(err) {}
                        window.removeEventListener('pointermove', onMove, true);
                        window.removeEventListener('pointerup', onUp, true);
                        window.removeEventListener('pointercancel', onUp, true);

                        ticket.classList.remove('is-dragging');
                        ticket.style.cursor = 'grab';
                        c.style.cursor = '';
                        document.body.style.userSelect = '';
                        _setChartNavigationLocked(false);

                        const finalPrice = _dragState?.currentPrice;
                        const meta = _dragState?.meta;

                        if (finalPrice && meta) {
                            await _commitOrderLevelUpdate(meta, finalPrice);
                        }
                        _isDragging = false;
                        _dragState = null;
                        _mousedownPl = null;
                    };

                    window.addEventListener('pointermove', onMove, true);
                    window.addEventListener('pointerup', onUp, true);
                    window.addEventListener('pointercancel', onUp, true);
                });
            }

            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'order-line-ticket-close';
            close.textContent = '×';
            close.title = type === 'ENTRY' ? 'Close position now' : `Remove ${type}`;
            close.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); });
            close.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                window.closeChartLine?.(type, posId);
            });
            ticket.appendChild(close);

            document.body.appendChild(ticket);
            return ticket;
        }

        function _getOuterActionTag(posId) {
            const tagId = `order-line-outer-${posId}`;
            let tag = document.getElementById(tagId);
            if (tag) return tag;
            tag = document.createElement('div');
            tag.id = tagId;
            tag.className = 'order-line-outer-tag';
            tag.dataset.posId = posId;

            const tpBtn = document.createElement('button');
            tpBtn.type = 'button';
            tpBtn.className = 'elb-btn elb-btn-tp';
            tpBtn.dataset.posId = posId;
            tpBtn.dataset.level = 'TP';
            tpBtn.textContent = 'TP';
            tpBtn.title = 'Drag onto chart to set Take Profit, or click to edit';

            const slBtn = document.createElement('button');
            slBtn.type = 'button';
            slBtn.className = 'elb-btn elb-btn-sl';
            slBtn.dataset.posId = posId;
            slBtn.dataset.level = 'SL';
            slBtn.textContent = 'SL';
            slBtn.title = 'Drag onto chart to set Stop Loss, or click to edit';

            _bindTicketDragButton(tpBtn, posId, 'TP');
            _bindTicketDragButton(slBtn, posId, 'SL');

            tag.appendChild(tpBtn);
            tag.appendChild(slBtn);
            document.body.appendChild(tag);
            return tag;
        }

        function _syncOuterActionTag(posId, rect, y, rightPx, ticket) {
            const tag = _getOuterActionTag(posId);
            const tpBtn = tag.querySelector('.elb-btn-tp');
            const slBtn = tag.querySelector('.elb-btn-sl');

            // Detect whether TP or SL line is already active on the chart for this position
            const hasTP = activePriceLines.some(l => l._meta && String(l._meta.posId) === String(posId) && l._meta.lineType === 'TP');
            const hasSL = activePriceLines.some(l => l._meta && String(l._meta.posId) === String(posId) && l._meta.lineType === 'SL');

            // If already dragged onto the chart, hide that specific button from the entry line
            if (tpBtn) tpBtn.style.display = hasTP ? 'none' : 'inline-flex';
            if (slBtn) slBtn.style.display = hasSL ? 'none' : 'inline-flex';

            // If BOTH TP and SL are already set / active on the chart, hide the entry line action tag completely!
            if (hasTP && hasSL) {
                tag.style.display = 'none';
                return;
            }

            const ticketW = (ticket && ticket.offsetWidth > 50) ? ticket.offsetWidth : 135;
            const outerRight = (rightPx || Math.max(0, window.innerWidth - rect.right + 82)) + ticketW + 8;

            tag.style.top = `${rect.top + y}px`;
            tag.style.right = `${outerRight}px`;
            tag.style.left = 'auto';
            tag.style.display = 'flex';
        }

        function _hideOrderLineTickets() {
            document.querySelectorAll('.order-line-ticket').forEach(ticket => {
                ticket.style.display = 'none';
            });
            document.querySelectorAll('.order-line-outer-tag').forEach(tag => {
                tag.style.display = 'none';
            });
        }

        function _syncOrderLineTicket(posId, type, price, meta, container, rect, yCoord, rightPx) {
            const ticket = _orderLineTicket(posId, type);
            if (!meta || !Number.isFinite(Number(price))) { ticket.style.display = 'none'; return; }
            const y = (yCoord !== undefined && yCoord !== null) ? yCoord : candleSeries.priceToCoordinate(Number(price));
            if (!Number.isFinite(y) || y < 0 || y > container.clientHeight) { ticket.style.display = 'none'; return; }

            const isSell = (String(meta.side).toUpperCase() === 'SELL' || String(meta.side).toUpperCase() === 'SHORT');
            const color = type === 'SL' ? '#F6465D' : (type === 'TP' ? '#00C076' : (isSell ? '#F6465D' : '#00C076'));
            const label = ticket.querySelector('.order-line-ticket-label');

            if (type === 'ENTRY') {
                const position = cachedPortfolioState?.active_positions?.find(p => p.pos_id === meta.posId);
                const mark = (meta.symbol === currentSymbol && Number(lastKnownPrice) > 0)
                    ? Number(lastKnownPrice)
                    : (Number(position?.current_price) || Number(lastKnownPrice) || meta.entryPrice);
                const pnl = position ? calculatePositionPnl(position, mark) : 0;
                const pnlSign = pnl >= 0 ? '+' : '';
                const sideStr = isSell ? 'SELL' : 'BUY';
                const nextText = `${sideStr} ${meta.lot}  ${pnlSign}${pnl.toFixed(2)}`;
                if (label.textContent !== nextText) label.textContent = nextText;
            } else {
                const isLong = (String(meta.side).toUpperCase() === 'BUY' || String(meta.side).toUpperCase() === 'LONG');
                const lot = Number(meta.lot) || 0.01;
                const difference = isLong ? Number(price) - meta.entryPrice : meta.entryPrice - Number(price);
                const isReal = Boolean(meta.is_real || (meta.posId && String(meta.posId).startsWith("REAL-")));
                const contractSize = isReal ? 1.0 : getLotContractSize(meta.symbol);
                const pnl = difference * lot * contractSize;
                const sign = pnl >= 0 ? '+' : '';
                const nextHtml = `${type} ${lot}&nbsp;&nbsp;Est: ${sign}${pnl.toFixed(2)}`;
                if (label.innerHTML !== nextHtml) label.innerHTML = nextHtml;
            }

            if (ticket.style.background !== color) ticket.style.background = color;
            if (label.style.background !== 'transparent') label.style.background = 'transparent';
            const targetRight = `${rightPx || Math.max(0, window.innerWidth - rect.right + 82)}px`;
            if (ticket.style.right !== targetRight) ticket.style.right = targetRight;
            if (ticket.style.left !== 'auto') ticket.style.left = 'auto';
            const targetTop = `${rect.top + y}px`;
            if (ticket.style.top !== targetTop) ticket.style.top = targetTop;
            if (ticket.style.display !== 'inline-flex') ticket.style.display = 'inline-flex';

            if (type === 'ENTRY') {
                _syncOuterActionTag(posId, rect, y, rightPx, ticket);
            }
        }

        function _syncOrderLineTickets(container, rect) {
            if (!candleSeries || isTvIframeMode) {
                _hideOrderLineTickets();
                return;
            }

            const visibleItems = [];
            for (const line of activePriceLines) {
                if (!line?._meta) continue;
                const meta = line._meta;
                const type = meta.lineType;
                if (type !== 'ENTRY' && type !== 'SL' && type !== 'TP') continue;
                let price = null;
                try { price = Number(line.options().price); } catch (error) {}
                if (!Number.isFinite(price) || price <= 0) continue;
                let y = null;
                try { y = candleSeries.priceToCoordinate(price); } catch (error) {}
                if (!Number.isFinite(y) || y < 5 || y > container.clientHeight - 20) continue;
                visibleItems.push({ posId: meta.posId, type, price, meta, y });
            }

            const activeTicketIds = new Set();
            const activeOuterTagIds = new Set();
            const baseRight = Math.max(0, window.innerWidth - rect.right + 82);

            visibleItems.sort((a, b) => (a.y - b.y) || String(a.posId).localeCompare(String(b.posId)));

            function _measureItemWidth(item) {
                const ticket = document.getElementById(`order-line-ticket-${item.posId}-${item.type.toLowerCase()}`);
                const tag = item.type === 'ENTRY' ? document.getElementById(`order-line-outer-${item.posId}`) : null;

                let w = (ticket && ticket.offsetWidth > 60) ? ticket.offsetWidth : 145;

                if (item.type === 'ENTRY') {
                    const hasTP = activePriceLines.some(l => l._meta && String(l._meta.posId) === String(item.posId) && l._meta.lineType === 'TP');
                    const hasSL = activePriceLines.some(l => l._meta && String(l._meta.posId) === String(item.posId) && l._meta.lineType === 'SL');

                    let tagW = 0;
                    if (tag && tag.offsetWidth > 20 && tag.style.display !== 'none') {
                        tagW = tag.offsetWidth;
                    } else if (!hasTP && !hasSL) {
                        tagW = 68; // both [TP] and [SL] buttons visible
                    } else if (!hasTP || !hasSL) {
                        tagW = 35; // single button visible
                    }

                    if (tagW > 0) {
                        w += 8 + tagW;
                    }
                }
                return w;
            }

            const rightOffsets = new Map();
            for (let i = 0; i < visibleItems.length; i++) {
                let offset = baseRight;
                for (let j = 0; j < i; j++) {
                    if (Math.abs(visibleItems[i].y - visibleItems[j].y) < 24) {
                        const prevWidth = _measureItemWidth(visibleItems[j]);
                        const neededOffset = (rightOffsets.get(visibleItems[j]) || baseRight) + prevWidth + 14;
                        offset = Math.max(offset, neededOffset);
                    }
                }
                rightOffsets.set(visibleItems[i], offset);
            }

            for (const item of visibleItems) {
                const ticketId = `order-line-ticket-${item.posId}-${item.type.toLowerCase()}`;
                activeTicketIds.add(ticketId);
                if (item.type === 'ENTRY') {
                    activeOuterTagIds.add(`order-line-outer-${item.posId}`);
                }
                const offset = rightOffsets.get(item) || baseRight;
                _syncOrderLineTicket(item.posId, item.type, item.price, item.meta, container, rect, item.y, offset);
            }

            document.querySelectorAll('.order-line-ticket').forEach(el => {
                if (!activeTicketIds.has(el.id)) {
                    if (el.style.display !== 'none') el.style.display = 'none';
                }
            });
            document.querySelectorAll('.order-line-outer-tag').forEach(el => {
                if (!activeOuterTagIds.has(el.id)) {
                    if (el.style.display !== 'none') el.style.display = 'none';
                }
            });
        }

        function _liveChartLinePrice(type, fallback) {
            const line = activePriceLines.find(function(candidate) {
                return candidate._meta
                    && candidate._meta.lineType === type
                    && (!_elbPos || candidate._meta.posId === _elbPos.posId);
            });
            if (!line) return fallback;
            try {
                const price = Number(line.options().price);
                return Number.isFinite(price) ? price : fallback;
            } catch (error) {
                return fallback;
            }
        }

        function _elbTick() {
            const container = document.getElementById('tv-chart');
            if (isTvIframeMode || !candleSeries || !container) {
                _hideOrderLineTickets();
                _elbRafId = requestAnimationFrame(_elbTick);
                return;
            }
            const rect = container.getBoundingClientRect();
            // Keep all on-chart order line tickets synced (Entry, SL, TP) across all positions
            _syncOrderLineTickets(container, rect);
            _elbRafId = requestAnimationFrame(_elbTick);
        }

        window._elbSetPosition = function(posData) {
            if (!posData) {
                _elbPos = null;
                if (typeof _hideOrderLineTickets === 'function') _hideOrderLineTickets();
                return;
            }
            _elbPos = {
                posId:  posData.pos_id,
                entryP: parseFloat(posData.entry_price),
                side:   posData.side,
                symbol: posData.symbol,
                lot:    posData.volume_lots || posData.lot || 0.01,
                slP:    posData.sl_price,
                tpP:    posData.tp_price || (posData.tranches && posData.tranches.queen && posData.tranches.queen.tp_price)
            };
        };

        window._startElbLoop = function() {
            if (!_elbRafId) _elbRafId = requestAnimationFrame(_elbTick);
        };
        window._initEntryLineBar = function() {
            window._startElbLoop();
        };

        window.elbOpenTP = function() {
            if (!_elbPos) return;
            const p = _elbPos;
            const cur = (p.tpP && p.tpP > 0) ? parseFloat(p.tpP) : (p.entryP * (p.side === 'BUY' ? 1.01 : 0.99));
            openSLTPModal(p.posId, 'TP', cur, p.entryP, p.side, p.symbol, p.lot);
        };

        window.elbOpenSL = function() {
            if (!_elbPos) return;
            const p = _elbPos;
            const cur = (p.slP && p.slP > 0) ? parseFloat(p.slP) : (p.entryP * (p.side === 'BUY' ? 0.99 : 1.01));
            openSLTPModal(p.posId, 'SL', cur, p.entryP, p.side, p.symbol, p.lot);
        };

        function _validateDraggedLevel(type, side, price, livePrice) {
            const isLong = (String(side).toUpperCase() === 'BUY' || String(side).toUpperCase() === 'LONG');
            if (type === 'SL') return isLong ? price < livePrice : price > livePrice;
            return isLong ? price > livePrice : price < livePrice;
        }

        function _lineTitleAtDraggedPrice(meta, price) {
            const isLong = (String(meta.side).toUpperCase() === 'BUY' || String(meta.side).toUpperCase() === 'LONG');
            const lot = Number(meta.lot) || 0.01;
            const difference = isLong ? price - meta.entryPrice : meta.entryPrice - price;
            const pnl = difference * lot * getLotContractSize(meta.symbol);
            const sign = pnl >= 0 ? '+' : '';
            return `${meta.lineType} ${lot}&nbsp;&nbsp;Est: ${sign}${pnl.toFixed(2)}`;
        }

        async function _commitOrderLevelUpdate(meta, finalPrice) {
            if (!finalPrice || finalPrice <= 0 || !meta) return;

            const isLong = (String(meta.side).toUpperCase() === 'BUY' || String(meta.side).toUpperCase() === 'LONG');
            const livePrice = (lastKnownPrice && lastKnownPrice > 0) ? lastKnownPrice : meta.entryPrice;

            if (meta.lineType === 'SL') {
                if (isLong && finalPrice >= livePrice) {
                    _dragToast('SL must be below current price for BUY', '#F6465D');
                    fetchPortfolio();
                    return;
                }
                if (!isLong && finalPrice <= livePrice) {
                    _dragToast('SL must be above current price for SELL', '#F6465D');
                    fetchPortfolio();
                    return;
                }
            } else {
                if (isLong && finalPrice <= livePrice) {
                    _dragToast('TP must be above current price for BUY', '#F6465D');
                    fetchPortfolio();
                    return;
                }
                if (!isLong && finalPrice >= livePrice) {
                    _dragToast('TP must be below current price for SELL', '#F6465D');
                    fetchPortfolio();
                    return;
                }
            }

            const prec = _getPricePrec(meta.symbol);
            const snapped = parseFloat(finalPrice.toFixed(prec));

            // 1. OPTIMISTIC IN-MEMORY STATE UPDATE (Zero buffering, zero jitter, zero bouncing)
            if (cachedPortfolioState && cachedPortfolioState.active_positions) {
                const p = cachedPortfolioState.active_positions.find(pos => String(pos.pos_id) === String(meta.posId));
                if (p) {
                    if (meta.lineType === 'SL') p.sl_price = snapped;
                    if (meta.lineType === 'TP') {
                        p.tp_price = snapped;
                        if (p.tranches && p.tranches.queen) p.tranches.queen.tp_price = snapped;
                    }
                }
            }
            if (_elbPos && String(_elbPos.posId) === String(meta.posId)) {
                if (meta.lineType === 'SL') _elbPos.slP = snapped;
                if (meta.lineType === 'TP') _elbPos.tpP = snapped;
            }

            // Immediately keep the chart line at the exact snapped price
            const pl = activePriceLines.find(l => l._meta && l._meta.lineType === meta.lineType && String(l._meta.posId) === String(meta.posId));
            if (pl) {
                try {
                    pl.applyOptions({ price: snapped });
                    if (pl._meta) pl._meta.price = snapped;
                } catch(e) {}
            }

            const c = document.getElementById('tv-chart');
            if (c) {
                _syncOrderLineTickets(c, c.getBoundingClientRect());
            }

            // 2. Instantly update the bottom Position table cells
            const slCell = document.getElementById(`position-sl-${meta.posId}`);
            if (slCell && meta.lineType === 'SL') {
                slCell.innerHTML = `${snapped.toFixed(prec)} <span class="position-edit-icon" onclick="openSLTPModal('${meta.posId}', 'SL', ${snapped}, ${meta.entryPrice}, '${meta.side}', '${meta.symbol}', ${meta.lot}); event.stopPropagation();" title="Edit Stop Loss">&#9998;</span>`;
            }
            const tpCell = document.getElementById(`position-tp-${meta.posId}`);
            if (tpCell && meta.lineType === 'TP') {
                tpCell.innerHTML = `${snapped.toFixed(prec)} <span class="position-edit-icon" onclick="openSLTPModal('${meta.posId}', 'TP', ${snapped}, ${meta.entryPrice}, '${meta.side}', '${meta.symbol}', ${meta.lot}); event.stopPropagation();" title="Edit Take Profit">&#9998;</span>`;
            }

            // 3. BACKGROUND SERVER SYNC (Seamless network commit)
            try {
                const resp = await fetch('/api/order/edit_sltp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pos_id: meta.posId, type: meta.lineType, price: snapped })
                });
                const data = await resp.json();
                if (data.status === 'SUCCESS' || data.status === 'ok') {
                    _dragToast(`${meta.lineType} set to ${snapped.toFixed(prec)}`, '#00C076');
                } else if (data.status === 'NOT_FOUND') {
                    _dragToast(data.message || 'Position no longer active', '#F6465D');
                    fetchPortfolio();
                    return;
                } else {
                    _dragToast(data.message || 'Error saving level', '#F6465D');
                }
            } catch(err) {
                _dragToast('Network error saving level', '#F6465D');
            }
            fetchPortfolio();
        }

        async function _saveMissingLevel(type, position, clientY) {
            const chartContainer = document.getElementById('tv-chart');
            if (!chartContainer || !candleSeries) return;
            const relativeY = clientY - chartContainer.getBoundingClientRect().top;
            let price = null;
            try { price = candleSeries.coordinateToPrice(relativeY); } catch (e) {}
            if (!Number.isFinite(price) || price <= 0) return;
            const livePrice = Number(lastKnownPrice) > 0 ? Number(lastKnownPrice) : position.entryP;
            if (!_validateDraggedLevel(type, position.side, price, livePrice)) {
                _dragToast(`${type} must be on the protective side of the current price`, '#F6465D');
                return;
            }
            const precision = _getPricePrec(position.symbol);
            const snapped = Number(price.toFixed(precision));

            // Optimistic update in local state to prevent buffering/flickering
            if (cachedPortfolioState && cachedPortfolioState.active_positions) {
                const p = cachedPortfolioState.active_positions.find(pos => String(pos.pos_id) === String(position.posId));
                if (p) {
                    if (type === 'SL') p.sl_price = snapped;
                    if (type === 'TP') {
                        p.tp_price = snapped;
                        if (p.tranches && p.tranches.queen) p.tranches.queen.tp_price = snapped;
                    }
                }
            }
            if (_elbPos && String(_elbPos.posId) === String(position.posId)) {
                if (type === 'SL') _elbPos.slP = snapped;
                if (type === 'TP') _elbPos.tpP = snapped;
            }
            if (typeof updateOnChartOrderLines === 'function') {
                updateOnChartOrderLines();
            }

            // Instantly update the bottom Position table cell
            const slCell = document.getElementById(`position-sl-${position.posId}`);
            if (slCell && type === 'SL') {
                slCell.innerHTML = `${snapped.toFixed(precision)} <span class="position-edit-icon" onclick="openSLTPModal('${position.posId}', 'SL', ${snapped}, ${position.entryP}, '${position.side}', '${position.symbol}', ${position.lot}); event.stopPropagation();" title="Edit Stop Loss">&#9998;</span>`;
            }
            const tpCell = document.getElementById(`position-tp-${position.posId}`);
            if (tpCell && type === 'TP') {
                tpCell.innerHTML = `${snapped.toFixed(precision)} <span class="position-edit-icon" onclick="openSLTPModal('${position.posId}', 'TP', ${snapped}, ${position.entryP}, '${position.side}', '${position.symbol}', ${position.lot}); event.stopPropagation();" title="Edit Take Profit">&#9998;</span>`;
            }

            try {
                const response = await fetch('/api/order/edit_sltp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pos_id: position.posId, type, price: snapped }),
                });
                const result = await response.json();
                if (result.status === 'NOT_FOUND') {
                    _dragToast(result.message || 'Position is no longer active', '#F6465D');
                    fetchPortfolio();
                    return;
                }
                if (!response.ok || result.status !== 'SUCCESS') {
                    throw new Error(result.message || `Could not set ${type}`);
                }
                _dragToast(`${type} set to ${snapped.toFixed(precision)}`, '#00C076');
                fetchPortfolio();
            } catch (error) {
                _dragToast(`Could not set ${type}: ${error.message}`, '#F6465D');
            }
        }
        window.closeChartLine = async function(type, targetPosId) {
            const posId = targetPosId || _elbPos?.posId;
            if (!posId) return;
            try {
                // Entry × closes the position; TP/SL × removes only that
                // protective level. Both paths are immediate cancel actions.
                if (type === 'ENTRY') {
                    await closePosition(posId);
                    return;
                }
                const response = await fetch('/api/order/edit_sltp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pos_id: posId, type, clear: true }),
                });
                const result = await response.json();
                if (result.status === 'NOT_FOUND') {
                    fetchPortfolio();
                    return;
                }
                if (!response.ok || result.status !== 'SUCCESS') {
                    throw new Error(result.message || `Could not remove ${type}`);
                }
                fetchPortfolio();
            } catch (error) {
                alert(`Chart ${type} action failed: ${error.message}`);
            }
        };

        // ── Drag Engine ──────────────────────────────────────────────────────
        function _getPricePrec(sym) {
            return {BTCUSDT:2,ETHUSDT:2,SOLUSDT:3,BNBUSDT:2,XRPUSDT:4,AVAXUSDT:3,LINKUSDT:3,NEARUSDT:4,ADAUSDT:5,SUIUSDT:4,DOGEUSDT:5,DOTUSDT:3,LTCUSDT:2,ARBUSDT:4,OPUSDT:4,SEIUSDT:4,INJUSDT:3,WIFUSDT:4,PENDLEUSDT:4,JUPUSDT:4,RENDERUSDT:3,AAVEUSDT:2,UNIUSDT:3,CRVUSDT:4,DYDXUSDT:4,ENAUSDT:4,WLDUSDT:4,PYTHUSDT:5,GMXUSDT:2,TIAUSDT:4,ZROUSDT:4,APEUSDT:4,GALAUSDT:5,SANDUSDT:4,MANAUSDT:4,LRCUSDT:5,STXUSDT:4}[sym] || 4;
        }

        function _dragToast(msg, color) {
            let t = document.getElementById('_drag_toast');
            if (!t) {
                t = document.createElement('div');
                t.id = '_drag_toast';
                t.style.cssText = 'position:fixed;top:112px;left:50%;transform:translateX(-50%);padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600;z-index:99999;pointer-events:none;opacity:0;transition:opacity 0.2s;background:#1E222D;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
                document.body.appendChild(t);
            }
            t.textContent = msg;
            t.style.borderLeft = '4px solid ' + color;
            t.style.opacity = '1';
            clearTimeout(t._tid);
            t._tid = setTimeout(() => { t.style.opacity = '0'; }, 2200);
        }

        window.initSLTPDrag = function() {
            setTimeout(function() {
                const c = document.getElementById('tv-chart');
                if (!c || _sltpDragBound) return;
                _sltpDragBound = true;

                let _dragRafPending = false;
                let _pendingDragY = null;
                let _cachedRect = null;

                // Mousedown: check if near a SL/TP line (has _meta)
                c.addEventListener('mousedown', function(e) {
                    if (e.button !== 0 || !candleSeries || !activePriceLines.length) return;
                    const rect = c.getBoundingClientRect();
                    // The right price scale is reserved for chart scaling.
                    // Never start an SL/TP drag from this protected rail.
                    if (e.clientX >= rect.right - 55) return;
                    const relY = e.clientY - rect.top;
                    let closest = null, bestDist = 18;
                    for (const pl of activePriceLines) {
                        if (!pl._meta || (pl._meta.lineType !== 'SL' && pl._meta.lineType !== 'TP')) continue;
                        let ly = null;
                        try { ly = candleSeries.priceToCoordinate(pl.options().price); } catch(er) {}
                        if (ly === null || ly === undefined) continue;
                        const d = Math.abs(ly - relY);
                        if (d < bestDist) { bestDist = d; closest = pl; }
                    }
                    if (!closest) return;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    _mousedownPl = closest;
                    _mousedownY  = e.clientY;
                    _cachedRect  = rect;
                    _setChartNavigationLocked(true);
                    c.style.cursor = 'grabbing';
                }, true);

                function _processSLTPDragMove() {
                    _dragRafPending = false;
                    if (!_isDragging || !_dragState || !candleSeries || _pendingDragY === null) return;
                    const c2 = document.getElementById('tv-chart');
                    if (!c2) return;
                    const rect = _cachedRect || c2.getBoundingClientRect();
                    const ry = _pendingDragY - rect.top;
                    let price = null;
                    try { price = candleSeries.coordinateToPrice(ry); } catch(er) {}
                    if (!price || !Number.isFinite(price) || price <= 0) return;
                    _dragState.currentPrice = price;

                    try {
                        _dragState.pl.applyOptions({
                            price: price,
                            title: '',
                            axisLabelVisible: true,
                            axisLabelColor: _dragState.meta.lineType === 'SL' ? '#F6465D' : '#00C076',
                            axisLabelTextColor: '#FFFFFF',
                        });
                    } catch(er) {}
                    if (_elbPos && _elbPos.posId === _dragState.meta.posId) {
                        if (_dragState.meta.lineType === 'SL') _elbPos.slP = price;
                        if (_dragState.meta.lineType === 'TP') _elbPos.tpP = price;
                    }
                    _syncOrderLineTickets(c2, rect);
                }

                // Mousemove: move line during drag throttled to RAF screen refresh rate
                document.addEventListener('mousemove', function(e) {
                    if (!_mousedownPl) return;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (!_isDragging) {
                        if (Math.abs(e.clientY - _mousedownY) < 3) return;
                        _isDragging = true;
                        _dragState  = { pl: _mousedownPl, meta: _mousedownPl._meta, currentPrice: _mousedownPl.options().price };
                        document.body.style.userSelect = 'none';
                        const c2 = document.getElementById('tv-chart');
                        if (c2) {
                            c2.style.cursor = 'grabbing';
                            _cachedRect = c2.getBoundingClientRect();
                        }
                    }
                    _pendingDragY = e.clientY;
                    if (!_dragRafPending) {
                        _dragRafPending = true;
                        requestAnimationFrame(_processSLTPDragMove);
                    }
                }, true);

                // Mouseup: validate + save to server
                document.addEventListener('mouseup', async function(e) {
                    if (_mousedownPl) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                    const c3 = document.getElementById('tv-chart');
                    if (c3) c3.style.cursor = '';
                    document.body.style.userSelect = '';
                    _setChartNavigationLocked(false);
                    document.querySelectorAll('.order-line-ticket').forEach(t => {
                        t.classList.remove('is-dragging');
                        if (t.dataset.lineType !== 'ENTRY') t.style.cursor = 'grab';
                    });

                    _dragRafPending = false;
                    _pendingDragY = null;
                    const cachedRect = _cachedRect;
                    _cachedRect = null;

                    if (!_isDragging || !_dragState) {
                        // SL/TP are direct-manipulation handles: a click alone
                        // does not open another editor or alter the order.
                        _mousedownPl = null; _mousedownY = null;
                        return;
                    }

                    // Calculate final price accurately from release coordinate
                    if (candleSeries && c3) {
                        const finalRect = cachedRect || c3.getBoundingClientRect();
                        const relY = e.clientY - finalRect.top;
                        try {
                            const releasePrice = candleSeries.coordinateToPrice(relY);
                            if (releasePrice && Number.isFinite(releasePrice) && releasePrice > 0) {
                                _dragState.currentPrice = releasePrice;
                            }
                        } catch(er) {}
                    }

                    const meta  = _dragState.meta;
                    const final = _dragState.currentPrice;

                    if (final && meta) {
                        await _commitOrderLevelUpdate(meta, final);
                    }
                    _isDragging  = false;
                    _dragState   = null;
                    _mousedownPl = null;
                    _mousedownY  = null;
                }, true);

            }, 300);
        };

        // Initialize & Run
        window.addEventListener("DOMContentLoaded", () => {
            // Restore saved theme preference (defaults to TradeW Dark Mode)
            const savedTheme = localStorage.getItem("tradew_theme") || "dark";
            if (savedTheme === "light") {
                toggleTheme();
            }

            initTradingViewChart();
            switchSymbol("BTCUSDT", null, false);
            // Default chart is always our high-speed Pro chart for execution
            setChartMode('native');
            try {
                localStorage.removeItem("watch_chart_iframe_mode");
                localStorage.setItem("watch_chart_mode", "native");
            } catch(e) {}
            applyActiveAccountUI();
            fetchWatchlist();
            fetchPortfolio();
            fetchRustTelemetry();

            // ── Staggered Polling (protected by apiFetch circuit breaker) ──
            // Intervals are safe: the circuit breaker stops ALL polls after
            // 3 consecutive failures, so the server can never be hammered.
            setInterval(fetchTicker, 1000);
            setTimeout(() => setInterval(fetchPortfolio, 2000), 200);
            setTimeout(() => setInterval(fetchRustTelemetry, 4000), 400);
            setTimeout(() => setInterval(fetchWatchlist, 2000), 600);

            // Chart candle refresh & live connection watchdog (Gentle safety net)
            let _lastWsWatchdogCheck = Date.now();
            setTimeout(() => setInterval(() => {
                const now = Date.now();
                if (now - _lastWsWatchdogCheck < 6000) return;
                _lastWsWatchdogCheck = now;
                if (!isNanoWsActive && (now - lastNanoTickTime > 15000)) {
                    if (typeof _requestDebouncedBackfill === 'function') {
                        _requestDebouncedBackfill();
                    }
                    initNanoWebSocket(currentSymbol, currentInterval);
                }
            }, 6000), 3000);

        startNanoTpsTicker();
        initSLTPDrag();
        _initEntryLineBar();
        _startElbLoop();
        });


