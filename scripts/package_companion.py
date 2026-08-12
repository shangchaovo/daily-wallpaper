#!/usr/bin/env python3
"""Package the desktop companion as a simple, double-clickable zip.

The user experience we're after: download ONE zip → double-click to unzip →
double-click 启动伴侣.command → the wallpaper website + auto desktop wallpaper
+ floating pet window all start. No `node`, no terminal typing.

Bundle layout (inside 每日壁纸伴侣.zip):
    每日壁纸伴侣/
        启动伴侣.command      ← double-click this (chmod +x, opens Terminal & runs)
        server.js + lib/      ← authenticated one-port web/API service
        companion.js          ← local-only Mac integration on 127.0.0.1
        index/login/css/js/   ← complete website
        data/                 ← public word libraries
        使用说明.txt           ← 3-step plain-language guide

Zero third-party deps — uses only the stdlib zipfile.
"""
import os
import stat
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "每日壁纸伴侣.zip")
BUNDLE = "每日壁纸伴侣"

LAUNCHER = """#!/bin/bash
# WordPaper · 桌面伴侣启动器。
cd "$(dirname "$0")"

echo ""
echo "  🌱 每日壁纸 · 桌面伴侣"
echo "  ────────────────────────────"

# 找到电脑上的 node（常见安装位置都试一下）
NODE=""
for c in node /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.nvm/versions/node"/*/bin/node; do
  if [ -x "$(command -v "$c" 2>/dev/null)" ] || [ -x "$c" ]; then NODE="$c"; break; fi
done

if [ -z "$NODE" ]; then
  echo "  没找到 Node.js。"
  echo "  桌面伴侣需要 Node（只装一次，免费的）："
  echo "    1. 打开 https://nodejs.org 下载 LTS 版安装"
  echo "    2. 装完再双击本文件即可"
  echo ""
  read -n 1 -s -r -p "  按任意键打开下载页…"
  open "https://nodejs.org"
  exit 1
fi

NODE_MAJOR="$("$NODE" -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 22 ] || [ "$NODE_MAJOR" -gt 24 ] || ! "$NODE" -e "require('node:sqlite')" >/dev/null 2>&1; then
  echo "  当前 $("$NODE" -v) 不受支持，需要 Node 22.23.2+ 或 Node 24。"
  read -n 1 -s -r -p "  按任意键打开 Node 下载页…"
  open "https://nodejs.org"
  exit 1
fi

echo "  用 $("$NODE" -v) 启动…  关掉这个窗口就停止。"
echo ""

export HOST=127.0.0.1
export PORT=8770
export WORDPAPER_MODE=local
export WORDPAPER_DATA_DIR="${WORDPAPER_DATA_DIR:-$HOME/.wordpaper}"
export WORDPAPER_COMPANION_ENABLED=1
export WORDPAPER_WEB_ORIGIN=http://localhost:8770

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

if ! curl -fsS http://127.0.0.1:8770/healthz >/dev/null 2>&1; then
  mkdir -p "$HOME/Library/Logs/wordpaper"
  "$NODE" server.js >>"$HOME/Library/Logs/wordpaper/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS http://127.0.0.1:8770/healthz >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

if ! curl -fsS http://127.0.0.1:8770/healthz >/dev/null 2>&1; then
  echo "  WordPaper 主服务启动失败，请查看 ~/Library/Logs/wordpaper/server.log"
  exit 1
fi

"$NODE" companion.js
"""

README = """每日壁纸 · 桌面伴侣 —— 使用说明
======================================

就 3 步：

  1. 解压这个 zip（双击即可）。
  2. 双击文件夹里的「启动伴侣.command」。
  3. 第一次 macOS 可能会拦一下：
     右键点它 →「打开」→ 再点「打开」。以后双击就能直接跑。

跑起来之后（保持那个黑色窗口开着就行）：

  • 自动把你的 Mac 桌面壁纸换成今日单词，每 30 分钟换一组。
  • 屏幕角落有个常驻小窗，显示今天的单词和提醒。
  • 浏览器会打开 http://localhost:8770；首次使用请创建自己的账号。
  • 词库、提醒和复习数据保存在 ~/.wordpaper，更新或移动本文件夹也不会丢。

不想自动换桌面壁纸了？
  打开 ~/Library/Application Support/WordPaper/companion/companion-config.json，把
  "autoSetWallpaper": true 改成 false，再重新双击启动即可。

前提：电脑装了 Node.js（https://nodejs.org 免费下载，只装一次）。
没装的话启动器会提示并帮你打开下载页。
"""


def add_file(zf, src, arc, mode=None):
    """Write a file into the zip, optionally forcing a unix mode (for +x)."""
    with open(src, "rb") as f:
        data = f.read()
    zi = zipfile.ZipInfo(arc)
    zi.date_time = (2026, 8, 7, 0, 0, 0)
    if mode is not None:
        zi.external_attr = (stat.S_IFREG | mode) << 16
    else:
        zi.external_attr = (stat.S_IFREG | 0o644) << 16
    zi.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(zi, data)


def main():
    data_dir = os.path.join(ROOT, "data")
    words = sorted(f for f in os.listdir(data_dir)
                   if f.startswith("words_") and f.endswith(".json"))
    if not words:
        raise SystemExit("data/words_*.json 不存在，先跑 scripts/build_wordlibs.py")

    if os.path.exists(OUT):
        os.remove(OUT)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        # launcher (executable)
        zi = zipfile.ZipInfo(f"{BUNDLE}/启动伴侣.command")
        zi.date_time = (2026, 8, 7, 0, 0, 0)
        zi.external_attr = (stat.S_IFREG | 0o755) << 16
        zi.compress_type = zipfile.ZIP_DEFLATED
        zf.writestr(zi, LAUNCHER)
        # Complete portable local service + website.
        for name in ("server.js", "companion.js", "index.html", "login.html", "package.json", ".node-version"):
            add_file(zf, os.path.join(ROOT, name), f"{BUNDLE}/{name}")
        for directory in ("lib", "css", "js", "data"):
            source_dir = os.path.join(ROOT, directory)
            for current, dirs, files in os.walk(source_dir):
                dirs[:] = sorted(d for d in dirs if not d.startswith("."))
                for name in sorted(files):
                    if name.startswith("."):
                        continue
                    source = os.path.join(current, name)
                    relative = os.path.relpath(source, ROOT)
                    add_file(zf, source, f"{BUNDLE}/{relative}")
        add_file(zf, os.path.join(ROOT, "scripts", "package_companion.py"), f"{BUNDLE}/scripts/package_companion.py")
        # readme
        zi = zipfile.ZipInfo(f"{BUNDLE}/使用说明.txt")
        zi.date_time = (2026, 8, 7, 0, 0, 0)
        zi.external_attr = (stat.S_IFREG | 0o644) << 16
        zi.compress_type = zipfile.ZIP_DEFLATED
        zf.writestr(zi, README)

    size = os.path.getsize(OUT)
    print(f"打包完成 -> {OUT}  ({size/1024:.0f} KB, 含 {len(words)} 个词库)")
    with zipfile.ZipFile(OUT) as zf:
        for n in zf.namelist():
            print("   ", n)


if __name__ == "__main__":
    main()
