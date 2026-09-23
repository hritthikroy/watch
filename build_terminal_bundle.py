import os

modules_dir = r"c:\tradebot\BINANCE_SYSTEM\core\static\js\modules"
target_file = r"c:\tradebot\BINANCE_SYSTEM\core\static\js\terminal.js"

module_files = sorted([f for f in os.listdir(modules_dir) if f.endswith(".js")])

bundle = []
bundle.append("/**")
bundle.append(" * Titan 6-Brain TradeW High-Speed Web Trading Terminal")
bundle.append(" * Modular Master Bundle - Generated from static/js/modules/")
bundle.append(" */\n")

for mf in module_files:
    path = os.path.join(modules_dir, mf)
    with open(path, "r", encoding="utf-8") as f:
        bundle.append(f.read())
    bundle.append("\n")

with open(target_file, "w", encoding="utf-8") as f:
    f.write("\n".join(bundle))

print(f"Successfully bundled {len(module_files)} modules into {target_file}")
