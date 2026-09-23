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
            _hideDragLevelFront();
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
