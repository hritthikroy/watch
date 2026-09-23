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

            sendOrder(side, lot, isLimit, limitPrice, tpPrice, slPrice);
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
