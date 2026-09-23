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
