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

            // Synchronize activePriceLines cleanly (exact 1:1 match by posId + lineType, no ghost lines)
            let canReconcile = (activePriceLines.length === newLines.length);
            if (canReconcile) {
                for (let i = 0; i < newLines.length; i++) {
                    const existingMeta = activePriceLines[i]?._meta;
                    const nextMeta = newLines[i]?._meta;
                    if (existingMeta?.posId !== nextMeta?.posId || existingMeta?.lineType !== nextMeta?.lineType) {
                        canReconcile = false;
                        break;
                    }
                }
            }
            if (canReconcile) {
                for (let i = 0; i < newLines.length; i++) {
                    try {
                        activePriceLines[i].applyOptions(newLines[i]);
                        activePriceLines[i]._meta = newLines[i]._meta;
                    } catch(e) {}
                }
            } else {
                _clearActiveChartLines();
                for (const lineOpts of newLines) {
                    try {
                        const pl = candleSeries.createPriceLine(lineOpts);
                        pl._meta = lineOpts._meta;
                        activePriceLines.push(pl);
                    } catch(e) {}
                }
            }
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
