// ============================================================================
// Module: 01_shield.js
// ============================================================================

// AGGRESSIVE network error suppression - completely hide all connection errors
window.addEventListener('unhandledrejection', function(e) {
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_IO_SUSPENDED|net::/i.test(String(e.reason))) {
        e.preventDefault(); // stops it appearing in console
    }
});

// Completely suppress all console errors and warnings
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = function(...args) {
    const message = args.join(' ');
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_IO_SUSPENDED|net::|apiFetch|fetchTicker|fetchWatchlist|fetchPortfolio|fetchRustTelemetry|loadChartCandles/i.test(message)) {
        return; // suppress all connection and API errors
    }
    originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
    const message = args.join(' ');
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_IO_SUSPENDED|net::|apiFetch|fetchTicker|fetchWatchlist|fetchPortfolio|fetchRustTelemetry|loadChartCandles/i.test(message)) {
        return; // suppress all connection and API warnings
    }
    originalConsoleWarn.apply(console, args);
};

console.log = function(...args) {
    const message = args.join(' ');
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_IO_SUSPENDED|net::|apiFetch|fetchTicker|fetchWatchlist|fetchPortfolio|fetchRustTelemetry|loadChartCandles/i.test(message)) {
        return; // suppress all connection and API logs
    }
    originalConsoleLog.apply(console, args);
};
