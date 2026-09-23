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
