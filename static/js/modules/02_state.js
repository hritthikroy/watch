// ============================================================================
// Module: 02_state.js
// ============================================================================

let currentSymbol = "BTCUSDT";
        let currentInterval = "1m";
        let currentChartMode = "native"; // 'native' | 'tv' | 'binance'
        let isTvIframeMode = false;
        let userManuallySelectedSymbol = false;
        let _hasInitialPositionBootSynced = false;
        let currentCandle = null;
        let audioEnabled = true;
        let lastKnownPrice = 0;
        let chart = null;
        let candleSeries = null;
        let chartResizeObserver = null;
        let crosshairPriceLabelVisible = true;
        let activePriceLines = [];
        let lastOrderLinePnlRenderAt = 0;
        let cachedPortfolioState = null;
        let cachedCandles = [];
        let cachedWatchlistData = [];
        // Quotes are independent from the persisted demo portfolio. Keeping
        // them here prevents a portfolio refresh from putting an old saved
        // current_price back into the live position table.
        const livePricesBySymbol = new Map();
        const _lastTickTimes = new Map();
        let currentSelectedSide = "BUY";
        let currentLotSize = 0.01;
        let isBwCandleMode = false;
        // Smart position table diff — tracks which pos_ids are currently rendered
        // so we can skip innerHTML rebuild when only prices change (not structure).
        let _lastRenderedPosIds = "";

        // ── Circuit Breaker: tracks server health, shows reconnecting UI ─────────
        let _cbFailures = 0;          // consecutive fetch failures
        let _cbOpen = false;          // true = server considered DOWN, requests paused
        const CB_THRESHOLD = 3;       // failures before circuit opens
        const CB_RESET_MS  = 8000;    // ms to wait before probing again after open
