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
            "BTCUSDT":    { display: "BTC/USDT",    name: "Bitcoin",       cat: "major",  prec: 1, minMove: 0.1,      pip: 0.10,     stepSize: 0.001, minQty: 0.001, minNotional: 50.0, tvSym: "BINANCE:BTCUSDT.P" },
            "ETHUSDT":    { display: "ETH/USDT",    name: "Ethereum",      cat: "major",  prec: 2, minMove: 0.01,     pip: 0.01,     stepSize: 0.001, minQty: 0.001, minNotional: 20.0, tvSym: "BINANCE:ETHUSDT.P" },
            "SOLUSDT":    { display: "SOL/USDT",    name: "Solana",        cat: "major",  prec: 2, minMove: 0.01,     pip: 0.01,     stepSize: 0.01,  minQty: 0.01,  minNotional: 5.0,  tvSym: "BINANCE:SOLUSDT.P" },
            "BNBUSDT":    { display: "BNB/USDT",    name: "BNB",           cat: "major",  prec: 2, minMove: 0.01,     pip: 0.01,     stepSize: 0.01,  minQty: 0.01,  minNotional: 5.0,  tvSym: "BINANCE:BNBUSDT.P" },
            "XRPUSDT":    { display: "XRP/USDT",    name: "XRP",           cat: "major",  prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:XRPUSDT.P" },
            "AVAXUSDT":   { display: "AVAX/USDT",   name: "Avalanche",     cat: "major",  prec: 3, minMove: 0.001,    pip: 0.001,    stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:AVAXUSDT.P" },
            "LINKUSDT":   { display: "LINK/USDT",   name: "Chainlink",     cat: "major",  prec: 3, minMove: 0.001,    pip: 0.001,    stepSize: 0.01,  minQty: 0.01,  minNotional: 20.0, tvSym: "BINANCE:LINKUSDT.P" },
            "NEARUSDT":   { display: "NEAR/USDT",   name: "NEAR Protocol", cat: "layer1", prec: 3, minMove: 0.001,    pip: 0.001,    stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:NEARUSDT.P" },
            "ADAUSDT":    { display: "ADA/USDT",    name: "Cardano",       cat: "layer1", prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:ADAUSDT.P" },
            "SUIUSDT":    { display: "SUI/USDT",    name: "Sui",           cat: "layer1", prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:SUIUSDT.P" },
            "DOGEUSDT":   { display: "DOGE/USDT",   name: "Dogecoin",      cat: "major",  prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:DOGEUSDT.P" },
            "DOTUSDT":    { display: "DOT/USDT",    name: "Polkadot",      cat: "layer1", prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:DOTUSDT.P" },
            "LTCUSDT":    { display: "LTC/USDT",    name: "Litecoin",      cat: "major",  prec: 2, minMove: 0.01,     pip: 0.01,     stepSize: 0.001, minQty: 0.001, minNotional: 20.0, tvSym: "BINANCE:LTCUSDT.P" },
            "ARBUSDT":    { display: "ARB/USDT",    name: "Arbitrum",      cat: "alts",   prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:ARBUSDT.P" },
            "OPUSDT":     { display: "OP/USDT",     name: "Optimism",      cat: "alts",   prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:OPUSDT.P" },
            "SEIUSDT":    { display: "SEI/USDT",    name: "Sei",           cat: "layer1", prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:SEIUSDT.P" },
            "INJUSDT":    { display: "INJ/USDT",    name: "Injective",     cat: "layer1", prec: 3, minMove: 0.001,    pip: 0.001,    stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:INJUSDT.P" },
            "WIFUSDT":    { display: "WIF/USDT",    name: "dogwifhat",     cat: "alts",   prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:WIFUSDT.P" },
            "PENDLEUSDT": { display: "PENDLE/USDT", name: "Pendle",        cat: "defi",   prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:PENDLEUSDT.P" },
            "JUPUSDT":    { display: "JUP/USDT",    name: "Jupiter",       cat: "defi",   prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:JUPUSDT.P" },
            "RENDERUSDT": { display: "RENDER/USDT", name: "Render",        cat: "alts",   prec: 3, minMove: 0.001,    pip: 0.001,    stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:RENDERUSDT.P" },
            "AAVEUSDT":   { display: "AAVE/USDT",   name: "Aave",          cat: "defi",   prec: 2, minMove: 0.01,     pip: 0.01,     stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:AAVEUSDT.P" },
            "UNIUSDT":    { display: "UNI/USDT",    name: "Uniswap",       cat: "defi",   prec: 3, minMove: 0.001,    pip: 0.001,    stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:UNIUSDT.P" },
            "CRVUSDT":    { display: "CRV/USDT",    name: "Curve DAO",     cat: "defi",   prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:CRVUSDT.P" },
            "DYDXUSDT":   { display: "DYDX/USDT",   name: "dYdX",          cat: "defi",   prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:DYDXUSDT.P" },
            "ENAUSDT":    { display: "ENA/USDT",    name: "Ethena",        cat: "defi",   prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:ENAUSDT.P" },
            "WLDUSDT":    { display: "WLD/USDT",    name: "Worldcoin",     cat: "alts",   prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:WLDUSDT.P" },
            "PYTHUSDT":   { display: "PYTH/USDT",   name: "Pyth Network",  cat: "alts",   prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:PYTHUSDT.P" },
            "GMXUSDT":    { display: "GMX/USDT",    name: "GMX",           cat: "defi",   prec: 3, minMove: 0.001,    pip: 0.001,    stepSize: 0.01,  minQty: 0.01,  minNotional: 5.0,  tvSym: "BINANCE:GMXUSDT.P" },
            "TIAUSDT":    { display: "TIA/USDT",    name: "Celestia",      cat: "layer1", prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:TIAUSDT.P" },
            "ZROUSDT":    { display: "ZRO/USDT",    name: "LayerZero",     cat: "alts",   prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 0.1,   minQty: 0.1,   minNotional: 5.0,  tvSym: "BINANCE:ZROUSDT.P" },
            "APEUSDT":    { display: "APE/USDT",    name: "ApeCoin",       cat: "alts",   prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:APEUSDT.P" },
            "GALAUSDT":   { display: "GALA/USDT",   name: "Gala",          cat: "alts",   prec: 6, minMove: 0.000001, pip: 0.000001, stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:GALAUSDT.P" },
            "SANDUSDT":   { display: "SAND/USDT",   name: "The Sandbox",   cat: "alts",   prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:SANDUSDT.P" },
            "MANAUSDT":   { display: "MANA/USDT",   name: "Decentraland",  cat: "alts",   prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:MANAUSDT.P" },
            "LRCUSDT":    { display: "LRC/USDT",    name: "Loopring",      cat: "defi",   prec: 5, minMove: 0.00001,  pip: 0.00001,  stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:LRCUSDT" },
            "STXUSDT":    { display: "STX/USDT",    name: "Stacks",        cat: "layer1", prec: 4, minMove: 0.0001,   pip: 0.0001,   stepSize: 1.0,   minQty: 1.0,   minNotional: 5.0,  tvSym: "BINANCE:STXUSDT.P" }
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
