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
