#!/usr/bin/env bash
# Point Claude Code's `gitlab` MCP server at the hodyhq fork (binary + update support).
# RUN THIS WITH CLAUDE CODE FULLY QUIT, then relaunch — the running app owns
# ~/.claude.json and will clobber the edit otherwise.
#
#   bash ~/.dev/Projects/gitlab-mcp/activate-fork.sh          # activate fork
#   bash ~/.dev/Projects/gitlab-mcp/activate-fork.sh --revert # back to upstream npx
set -euo pipefail

CFG="$HOME/.claude.json"
BUILD="/home/hody/.dev/Projects/gitlab-mcp/build/index.js"
MODE="${1:-activate}"

[ -f "$CFG" ] || { echo "no $CFG"; exit 1; }
[ "$MODE" = "activate" ] && [ ! -f "$BUILD" ] && { echo "build missing: $BUILD (run: cd ~/.dev/Projects/gitlab-mcp && npm install && npm run build)"; exit 1; }

cp "$CFG" "$CFG.bak.$(date +%s)"

python3 - "$CFG" "$BUILD" "$MODE" <<'PY'
import json, sys
cfg, build, mode = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(cfg)); n = 0
def walk(o):
    global n
    if isinstance(o, dict):
        ms = o.get("mcpServers")
        if isinstance(ms, dict) and "gitlab" in ms:
            g = ms["gitlab"]
            if mode == "revert":
                g["command"] = "npx"; g["args"] = ["-y", "@zereight/mcp-gitlab"]
            else:
                g["command"] = "node"; g["args"] = [build]
            n += 1
        for v in o.values(): walk(v)
walk(d)
json.dump(d, open(cfg, "w"), indent=2); open(cfg, "a").write("\n")
print(f"{'reverted' if mode=='revert' else 'activated fork on'} {n} gitlab server(s). Backup saved. Now relaunch Claude Code.")
PY
