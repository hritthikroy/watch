// ============================================================================
// Module: 14_order_overlays.js
// ============================================================================

function _elbBar() { return document.getElementById('elb-bar'); }

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
        }

        // A new SL/TP has no real PriceLine until it is saved. Render this
        // lightweight preview immediately so the line and exact price travel
        // with the pointer while the trader chooses a level.
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
                // Preview only the TP/SL line and its native price badge.
                // Do not show a separate DROP ticket or leave a ticket gap.
                title: '',
            };
            if (_pendingLevelPriceLine) {
                try { _pendingLevelPriceLine.applyOptions(options); return; } catch (error) {
                    _clearPendingLevelPreview();
                }
            }
            try { _pendingLevelPriceLine = candleSeries.createPriceLine(options); } catch (error) {}
        }

        function _lineCloseButton(type) {
            return document.getElementById(`line-close-${type.toLowerCase()}`);
        }

        function _bindChartLineCloseControls() {
            for (const type of ['ENTRY', 'SL', 'TP']) {
                const button = _lineCloseButton(type);
                if (!button || button.dataset.bound === 'true') continue;
                button.dataset.bound = 'true';
                // Keep the fixed inline button out of the chart canvas event
                // path. This makes it reliably clickable even over the scale.
                button.addEventListener('pointerdown', event => {
                    event.preventDefault();
                    event.stopPropagation();
                });
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.closeChartLine?.(type);
                });
            }
        }



        function _runningPriceFront() {
            let front = document.getElementById('running-price-front');
            if (front) return front;
            front = document.createElement('div');
            front.id = 'running-price-front';
            front.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:9999;';
            front.innerHTML = '<div data-role="line" style="position:absolute;left:0;right:0;top:0;border-top:1px dotted #00C076;"></div><span data-role="tag" style="position:absolute;right:2px;top:-9px;display:flex;align-items:center;justify-content:center;height:18px;min-width:58px;padding:0 6px;box-sizing:border-box;background:#00C076;color:#fff;text-align:center;font:700 11px Arial,sans-serif;">--</span>';
            document.body.appendChild(front);
            return front;
        }

        function _syncRunningPriceFront(container, rect) {
            const front = document.getElementById('running-price-front');
            if (front) front.style.display = 'none';
        }

        function _hideChartLineCloseControls() {
            for (const type of ['ENTRY', 'SL', 'TP']) {
                const button = _lineCloseButton(type);
                if (button) button.style.display = 'none';
            }
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
                    try { button.releasePointerCapture(event.pointerId); } catch(err) {}
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
                    _clearPendingLevelPreview();

                    if (dragInfo.moved && Number.isFinite(dragInfo.price) && dragInfo.price > 0) {
                        await _saveMissingLevel(dragInfo.type, dragInfo.position, e.clientY);
                    } else if (!isButtonDragging) {
                        // Clicked without drag -> open precision SL/TP modal!
                        const p = dragInfo.position;
                        const cur = level === 'TP'
                            ? (p.tpP && Number(p.tpP) > 0 ? parseFloat(p.tpP) : (p.entryP * (p.side === 'BUY' ? 1.01 : 0.99)))
                            : (p.slP && Number(p.slP) > 0 ? parseFloat(p.slP) : (p.entryP * (p.side === 'BUY' ? 0.99 : 1.01)));
                        openSLTPModal(posId, level, cur, p.entryP, p.side, p.symbol, p.lot);
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

            // For SL and TP badges: clicking directly on the ticket initiates line drag!
            if (type === 'SL' || type === 'TP') {
                ticket.addEventListener('mousedown', function(event) {
                    if (event.button !== 0 || !candleSeries) return;
                    if (event.target.closest('.order-line-ticket-close')) return;
                    event.preventDefault();
                    event.stopPropagation();

                    const pl = activePriceLines.find(l => l._meta && l._meta.lineType === type && l._meta.posId === posId);
                    if (!pl) return;

                    const c = document.getElementById('tv-chart');
                    if (!c) return;

                    _mousedownPl = pl;
                    _mousedownY = event.clientY;
                    _cachedRect = c.getBoundingClientRect();
                    _setChartNavigationLocked(true);
                    ticket.classList.add('is-dragging');
                    ticket.style.cursor = 'grabbing';
                    c.style.cursor = 'grabbing';
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

            const isSell = (meta.side === 'SELL' || meta.side === 'SHORT');
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
                label.textContent = `${sideStr} ${meta.lot}  ${pnlSign}${pnl.toFixed(2)}`;
            } else {
                const isLong = (meta.side === 'BUY' || meta.side === 'LONG');
                const lot = Number(meta.lot) || 0.01;
                const difference = isLong ? Number(price) - meta.entryPrice : meta.entryPrice - Number(price);
                const pnl = difference * lot * getLotContractSize(meta.symbol);
                const sign = pnl >= 0 ? '+' : '';
                label.textContent = `${type} ${lot}  Est: ${sign}${pnl.toFixed(2)}`;
            }

            ticket.style.background = color;
            label.style.background = 'transparent';
            ticket.style.right = `${rightPx || Math.max(0, window.innerWidth - rect.right + 82)}px`;
            ticket.style.left = 'auto';
            ticket.style.top = `${rect.top + y}px`;
            ticket.style.display = 'inline-flex';

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

                let w = (ticket && ticket.offsetWidth > 50) ? ticket.offsetWidth : 135;

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
                        const neededOffset = (rightOffsets.get(visibleItems[j]) || baseRight) + prevWidth + 12;
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
                    el.style.display = 'none';
                }
            });
            document.querySelectorAll('.order-line-outer-tag').forEach(el => {
                if (!activeOuterTagIds.has(el.id)) {
                    el.style.display = 'none';
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

        function _syncChartLineCloseControls(container, rect) {
            _hideChartLineCloseControls();
            _syncOrderLineTickets(container, rect);
        }

        function _elbHasConfiguredLevel(price, entryPrice, symbol) {
            return Number.isFinite(Number(price))
                && Number(price) > 0
                && isValidSLTP(Number(price), Number(entryPrice), symbol);
        }

        function _elbSyncActions() {
            const bar = _elbBar();
            const tpButton = document.getElementById('elb-btn-tp');
            const slButton = document.getElementById('elb-btn-sl');
            if (!bar || !tpButton || !slButton) return;

            if (!_elbPos) {
                bar.style.display = 'none';
                _hideChartLineCloseControls();
                return;
            }

            // Hide TP/SL buttons if already set — user adjusts via drag lines
            const hasTP = _elbPos.tpP && Number(_elbPos.tpP) > 0;
            const hasSL = _elbPos.slP && Number(_elbPos.slP) > 0;
            tpButton.hidden = hasTP;
            slButton.hidden = hasSL;
            // If both are already set, hide the whole bar — nothing to add
            _elbPos.needsProtectionAction = !(hasTP && hasSL);
        }

        function _elbTick() {
            const bar = _elbBar();
            if (!bar) { _elbRafId = null; return; }

            if (isTvIframeMode || !candleSeries) {
                bar.style.display = 'none';
                _hideChartLineCloseControls();
                _hideOrderLineTickets();
                const runningFront = document.getElementById('running-price-front');
                if (runningFront) runningFront.style.display = 'none';
                _elbRafId = requestAnimationFrame(_elbTick);
                return;
            }

            const container = document.getElementById('tv-chart');
            if (!container) { _elbRafId = requestAnimationFrame(_elbTick); return; }
            const rect = container.getBoundingClientRect();
            _syncRunningPriceFront(container, rect);

            // Keep all on-chart order line tickets synced (Entry, SL, TP) across all positions
            _syncOrderLineTickets(container, rect);

            if (!_elbPos) {
                bar.style.display = 'none';
                _elbRafId = requestAnimationFrame(_elbTick);
                return;
            }

            let entryY = null;
            try { entryY = candleSeries.priceToCoordinate(_elbPos.entryP); } catch(e) {}
            if (entryY === null || entryY === undefined || entryY < 0 || entryY > container.clientHeight) {
                bar.style.display = 'none';
                _elbRafId = requestAnimationFrame(_elbTick);
                return;
            }

            // Legacy standalone #elb-bar is replaced by dynamic per-position .order-line-outer-tag
            bar.style.display = 'none';

            _elbRafId = requestAnimationFrame(_elbTick);
        }

        window._elbSetPosition = function(posData) {
            if (!posData) {
                _elbPos = null;
                _elbSyncActions();
                if (typeof _hideOrderLineTickets === 'function') _hideOrderLineTickets();
                if (typeof _hideChartLineCloseControls === 'function') _hideChartLineCloseControls();
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
            _elbSyncActions();
        };

        window._startElbLoop = function() {
            if (!_elbRafId) _elbRafId = requestAnimationFrame(_elbTick);
        };
        window._initEntryLineBar = function() {
            _bindChartLineCloseControls();
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
            const isLong = side === 'BUY' || side === 'LONG';
            if (type === 'SL') return isLong ? price < livePrice : price > livePrice;
            return isLong ? price > livePrice : price < livePrice;
        }

        function _lineTitleAtDraggedPrice(meta, price) {
            const isLong = meta.side === 'BUY' || meta.side === 'LONG';
            const lot = Number(meta.lot) || 0.01;
            const difference = isLong ? price - meta.entryPrice : meta.entryPrice - price;
            const pnl = difference * lot * getLotContractSize(meta.symbol);
            const sign = pnl >= 0 ? '+' : '';
            return `${meta.lineType} ${lot}  Est: ${sign}${pnl.toFixed(2)}`;
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

        function initMissingLevelDrag() {
            const bar = _elbBar();
            if (!bar || bar.dataset.dragBound === 'true') return;
            bar.dataset.dragBound = 'true';

            bar.addEventListener('pointerdown', (event) => {
                const button = event.target.closest('[data-level]');
                if (!button || event.button !== 0 || !_elbPos || !candleSeries) return;
                const chartContainer = document.getElementById('tv-chart');
                if (!chartContainer) return;
                event.preventDefault();
                event.stopPropagation();
                button.setPointerCapture?.(event.pointerId);
                _pendingLevelDrag = {
                    type: button.dataset.level,
                    startY: event.clientY,
                    position: { ..._elbPos },
                    moved: false,
                };
                _isPlacingMissingLevel = true;
                document.body.style.userSelect = 'none';
                button.classList.add('is-dragging');
            });

            bar.addEventListener('click', (event) => {
                // These are drag handles, never modal-opening buttons.
                event.preventDefault();
                event.stopPropagation();
            });

            // Native drag/drop is the primary path; it works in browsers that
            // do not deliver pointer moves outside a fixed overlay.
            bar.addEventListener('dragstart', (event) => {
                const button = event.target.closest('[data-level]');
                if (!button || !_elbPos) return;
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('application/x-tradew-level', button.dataset.level);
                event.dataTransfer.setData('text/plain', button.dataset.level);
                button.classList.add('is-dragging');
            });
            bar.addEventListener('dragend', () => {
                bar.querySelectorAll('[data-level]').forEach(button => button.classList.remove('is-dragging'));
                _clearPendingLevelPreview();
            });
            const chartContainer = document.getElementById('tv-chart');
            if (chartContainer) {
                chartContainer.addEventListener('dragover', (event) => {
                    if (event.dataTransfer.types.includes('application/x-tradew-level')) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                        const type = event.dataTransfer.getData('application/x-tradew-level');
                        const relativeY = event.clientY - chartContainer.getBoundingClientRect().top;
                        let price = null;
                        try { price = candleSeries.coordinateToPrice(relativeY); } catch (error) {}
                        if (type && _elbPos && Number.isFinite(Number(price))) {
                            _showPendingLevelPreview(type, price, _elbPos);
                        }
                    }
                });
                chartContainer.addEventListener('drop', async (event) => {
                    const type = event.dataTransfer.getData('application/x-tradew-level');
                    if (!type || !_elbPos) return;
                    event.preventDefault();
                    _clearPendingLevelPreview();
                    await _saveMissingLevel(type, { ..._elbPos }, event.clientY);
                });
            }

            let _missingLevelRafPending = false;
            let _pendingPointerEvent = null;

            function _processMissingLevelMove() {
                _missingLevelRafPending = false;
                if (!_pendingLevelDrag || !candleSeries || !_pendingPointerEvent) return;
                const chartContainer = document.getElementById('tv-chart');
                if (!chartContainer) return;
                if (Math.abs(_pendingPointerEvent.clientY - _pendingLevelDrag.startY) >= 3) {
                    _pendingLevelDrag.moved = true;
                }
                const relativeY = _pendingPointerEvent.clientY - chartContainer.getBoundingClientRect().top;
                let price = null;
                try { price = candleSeries.coordinateToPrice(relativeY); } catch (e) {}
                if (!Number.isFinite(price) || price <= 0) return;
                _pendingLevelDrag.price = price;
                _showPendingLevelPreview(_pendingLevelDrag.type, price, _pendingLevelDrag.position);
            }

            document.addEventListener('pointermove', (event) => {
                if (!_pendingLevelDrag || !candleSeries) return;
                _pendingPointerEvent = event;
                if (!_missingLevelRafPending) {
                    _missingLevelRafPending = true;
                    requestAnimationFrame(_processMissingLevelMove);
                }
            });

            document.addEventListener('pointerup', async (event) => {
                const drag = _pendingLevelDrag;
                if (!drag) return;
                _pendingLevelDrag = null;
                _pendingPointerEvent = null;
                _isPlacingMissingLevel = false;
                document.body.style.userSelect = '';
                _clearPendingLevelPreview();
                bar.querySelectorAll('[data-level]').forEach(button => button.classList.remove('is-dragging'));
                if (!drag.moved || !Number.isFinite(drag.price) || drag.price <= 0) return;

                await _saveMissingLevel(drag.type, drag.position, event.clientY);
            });
        }

        window.closeChartLine = async function(type, targetPosId) {
            const posId = targetPosId || _elbPos?.posId;
            if (!posId) return;
            const button = _lineCloseButton(type);
            if (button?.dataset.cancelling === 'true') return;
            if (button) {
                button.dataset.cancelling = 'true';
                button.classList.add('is-cancelling');
                button.setAttribute('aria-busy', 'true');
            }
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
            } finally {
                if (button) {
                    button.dataset.cancelling = 'false';
                    button.classList.remove('is-cancelling');
                    button.removeAttribute('aria-busy');
                }
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

        function _dragLevelFront() {
            let front = document.getElementById('drag-level-front');
            if (front) return front;
            front = document.createElement('div');
            front.id = 'drag-level-front';
            front.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:10000;';
            front.innerHTML = '<div data-role="line" style="position:absolute;left:0;right:78px;top:0;border-top:1px dashed #F6465D;"></div><span data-role="title" style="position:absolute;right:60px;top:-9px;display:flex;align-items:center;height:18px;padding:0 6px;box-sizing:border-box;background:#F6465D;color:#fff;font:700 11px Arial,sans-serif;white-space:nowrap;"></span><span data-role="price" style="position:absolute;right:2px;top:-9px;display:flex;align-items:center;justify-content:center;height:18px;min-width:58px;padding:0 6px;box-sizing:border-box;background:#F6465D;color:#fff;font:700 11px Arial,sans-serif;"></span>';
            document.body.appendChild(front);
            return front;
        }

        function _hideDragLevelFront() {
            const front = document.getElementById('drag-level-front');
            if (front) front.style.display = 'none';
        }

        function _syncDragLevelFront(meta, price, container) {
            const front = _dragLevelFront();
            let y = null;
            try { y = candleSeries.priceToCoordinate(price); } catch (error) {}
            if (!Number.isFinite(y)) return;
            const rect = container.getBoundingClientRect();
            const color = meta.lineType === 'SL' ? '#F6465D' : '#00C076';
            const line = front.querySelector('[data-role="line"]');
            const title = front.querySelector('[data-role="title"]');
            const priceTag = front.querySelector('[data-role="price"]');
            front.style.left = `${rect.left}px`;
            front.style.top = `${rect.top + y}px`;
            front.style.width = `${rect.width}px`;
            if (line) line.style.borderTopColor = color;
            // The native TP/SL ticket remains the only ticket during drag so
            // it never changes width, color, or layout. This overlay raises
            // only the dashed line above the crosshair.
            if (title) title.style.display = 'none';
            if (priceTag) priceTag.style.display = 'none';
            front.style.display = 'block';
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

                    _hideDragLevelFront();
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
                        _hideDragLevelFront();
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
                    _isDragging  = false;
                    _dragState   = null;
                    _mousedownPl = null;
                    _mousedownY  = null;
                    _hideDragLevelFront();

                    if (!final || final <= 0) { fetchPortfolio(); return; }

                    const isLong    = meta.side === 'BUY' || meta.side === 'LONG';
                    const livePrice = (lastKnownPrice && lastKnownPrice > 0) ? lastKnownPrice : meta.entryPrice;

                    if (meta.lineType === 'SL') {
                        if (isLong  && final >= livePrice) { _dragToast('SL must be below current price for BUY', '#F6465D'); fetchPortfolio(); return; }
                        if (!isLong && final <= livePrice) { _dragToast('SL must be above current price for SELL', '#F6465D'); fetchPortfolio(); return; }
                    } else {
                        if (isLong  && final <= livePrice) { _dragToast('TP must be above current price for BUY', '#F6465D'); fetchPortfolio(); return; }
                        if (!isLong && final >= livePrice) { _dragToast('TP must be below current price for SELL', '#F6465D'); fetchPortfolio(); return; }
                    }

                    const prec    = _getPricePrec(meta.symbol);
                    const snapped = parseFloat(final.toFixed(prec));

                    try {
                        const resp = await fetch('/api/order/edit_sltp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pos_id: meta.posId, type: meta.lineType, price: snapped })
                        });
                        const data = await resp.json();
                        if (data.status === 'SUCCESS' || data.status === 'ok') {
                            _dragToast(meta.lineType + ' updated to ' + snapped.toFixed(prec), '#00C076');
                        } else if (data.status === 'NOT_FOUND') {
                            _dragToast(data.message || 'Position no longer active', '#F6465D');
                        } else {
                            _dragToast(data.message || 'Error saving', '#F6465D');
                        }
                    } catch(err) {
                        _dragToast('Network error', '#F6465D');
                    }
                    fetchPortfolio();
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
        initMissingLevelDrag();
        _initEntryLineBar();
        _startElbLoop();
        });
