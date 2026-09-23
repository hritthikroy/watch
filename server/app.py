# -*- coding: utf-8 -*-
"""
Flask Application Factory & Blueprint Assembler
"""
import re
from pathlib import Path
from flask import Flask, request

from .catalog import WATCHLIST_CATALOG, WATCHLIST_SYMBOLS, FALLBACK_PRICES
from .routes.web_routes import web_bp
from .routes.market_routes import market_bp
from .routes.order_routes import order_bp
from .routes.live_routes import live_bp

TEMPLATES_DIR = Path(r"c:\tradebot\BINANCE_SYSTEM\core\templates")
STATIC_DIR    = Path(r"c:\tradebot\BINANCE_SYSTEM\core\static")

def get_full_template():
    html_file = TEMPLATES_DIR / "terminal.html"
    css_file = STATIC_DIR / "css" / "terminal.css"
    js_file = STATIC_DIR / "js" / "terminal.js"
    html = html_file.read_text(encoding="utf-8") if html_file.exists() else "<h1>Watch Terminal</h1>"
    
    modules_dir = STATIC_DIR / "css" / "modules"
    if modules_dir.exists():
        full_css = []
        for mod in ["variables.css", "layout.css", "watchlist.css", "chart.css", "ticket.css", "dock.css", "modals.css", "responsive.css"]:
            p = modules_dir / mod
            if p.exists():
                full_css.append(p.read_text(encoding="utf-8"))
        css = "\n".join(full_css)
    else:
        css = css_file.read_text(encoding="utf-8") if css_file.exists() else ""
        
    js = js_file.read_text(encoding="utf-8") if js_file.exists() else ""
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="/static/css/terminal\.css(?:\?[^"]*)?">', lambda _: f'<style>\n{css}\n</style>', html)
    html = re.sub(r'<script\s+src="/static/js/terminal\.js(?:\?[^"]*)?"></script>', lambda _: f'<script>\n{js}\n</script>', html)
    return html

BINANCE_PRO_TEMPLATE = get_full_template()

def create_app():
    app = Flask(__name__, template_folder=str(TEMPLATES_DIR), static_folder=str(STATIC_DIR))
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    app.config['TEMPLATES_AUTO_RELOAD'] = True

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    @app.after_request
    def disable_terminal_asset_cache(response):
        if request.path.startswith(("/static/", "/api/")) or request.path in ("/", "/demo", "/terminal"):
            response.headers["Cache-Control"] = "no-store, no-cache, max-age=0, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

    app.register_blueprint(web_bp)
    app.register_blueprint(market_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(live_bp)
    return app
