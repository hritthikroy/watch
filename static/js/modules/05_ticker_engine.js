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
