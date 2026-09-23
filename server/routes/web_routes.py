# -*- coding: utf-8 -*-
from pathlib import Path
from flask import Blueprint, render_template, send_from_directory, Response

web_bp = Blueprint("web", __name__)
STATIC_DIR = Path(r"c:\tradebot\BINANCE_SYSTEM\core\static")

@web_bp.route("/")
@web_bp.route("/demo")
def index():
    return render_template("terminal.html")

@web_bp.route("/test")
def test():
    return render_template("test.html")

@web_bp.route("/favicon.ico")
def favicon():
    return Response("", status=204, mimetype="image/x-icon")

@web_bp.route("/static/<path:filename>")
def serve_static(filename):
    response = send_from_directory(STATIC_DIR, filename)
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response
