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

                // Update Dock Right Account Summary with dynamic margin calculation (0 hardcoded values)
                let computedMargin = 0;
                for (const p of positions) {
                    const lev = Number(p.leverage) || 20;
                    const isRealPos = Boolean(p.is_real || (p.pos_id && String(p.pos_id).startsWith("REAL-")));
                    const cSize = isRealPos ? 1.0 : (Number(p.contract_size) || getLotContractSize(p.symbol));
                    const entryP = Number(p.entry_price) || 0;
                    const vol = Number(p.volume_lots ?? p.lot ?? 0.01);
                    computedMargin += (entryP * vol * cSize) / lev;
                }
                const sideTot = document.getElementById("dock-side-total");
                const sideMrg = document.getElementById("dock-side-margin");
                if (sideTot) sideTot.innerText = "$" + (d.wallet_balance !== undefined ? d.wallet_balance.toFixed(2) : "0.00");
                if (sideMrg) sideMrg.innerText = "$" + (d.used_margin !== undefined ? d.used_margin.toFixed(2) : computedMargin.toFixed(2));

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
                                const pnlSign = pnlVal >= 0 ? "+" : "-";

                                const lev = Number(pos.leverage) || 20;
                                const isRealPos = Boolean(pos.is_real || (pos.pos_id && String(pos.pos_id).startsWith("REAL-")));
                                const contractSize = isRealPos ? 1.0 : (Number(pos.contract_size) || getLotContractSize(pos.symbol));
                                const entry = Number(pos.entry_price) || 1;
                                const lotNum = Number(pos.volume_lots ?? pos.lot ?? 0.01);
                                const initialMargin = (entry * lotNum * contractSize) / lev;
                                const roe = initialMargin > 0 ? (pnlVal / initialMargin) * 100 : 0;
                                const roeSign = roe >= 0 ? "+" : "-";

                                const rawFee = Number(pos.fee);
                                const feeRate = Number(pos.fee_rate) || (pos.order_type === 'LIMIT' ? 0.0002 : 0.0005);
                                const feeType = feeRate <= 0.00025 ? "Maker" : "Taker";
                                const feeRatePct = (feeRate * 100).toFixed(2) + "%";
                                const feeDisp = Number.isFinite(rawFee)
                                    ? (Math.abs(rawFee) < 0.0000001 ? `$0.00 <span style="font-size:9px;color:#848E9C;">${feeType}</span>` : `-$${Math.abs(rawFee).toFixed(2)} <span style="font-size:9px;color:#848E9C;">${feeType} (${feeRatePct})</span>`)
                                    : "--";

                                const openFee = Math.abs(rawFee || 0);
                                const currPrice = Number(pos.current_price) || Number(pos.entry_price);
                                const notional = currPrice * lotNum * contractSize;
                                const estExitFee = notional * 0.0005; // Standard Taker 0.05% on market exit
                                const netPnl = pnlVal - openFee - estExitFee;
                                const netSign = netPnl >= 0 ? "+" : "-";

                                const swap = Number.isFinite(Number(pos.swap)) ? Number(pos.swap).toFixed(2) : "--";
                                const lot = lotNum.toFixed(2);
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
                                    <td id="position-fee-${pos.pos_id}" style="color: var(--text-secondary); font-size: 11px; white-space: nowrap;">${feeDisp}</td>
                                    <td style="color: var(--text-secondary); font-size: 11px;">${swap}</td>
                                    <td style="color: var(--text-secondary); font-size: 11px; font-family: 'Roboto Mono', monospace;">${orderNo}</td>
                                    <td id="position-pnl-${pos.pos_id}" class="${pnlCls}" style="font-family: 'Roboto Mono', monospace; font-weight: 700; white-space: nowrap;">
                                        <div>${pnlSign}$${Math.abs(pnlVal).toFixed(2)} <span style="font-size:10px;">(${roeSign}${Math.abs(roe).toFixed(2)}%)</span></div>
                                        <div style="font-size:10px; font-weight:400; color: #848E9C;">Net: ${netSign}$${Math.abs(netPnl).toFixed(2)}</div>
                                    </td>
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
                                <td style="color: var(--text-secondary); font-size: 11px; white-space: nowrap;">$0.00 <span style="font-size:9px;color:#848E9C;">Maker (${((Number(ord.fee_rate) || 0.0002) * 100).toFixed(2)}%)</span></td>
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
