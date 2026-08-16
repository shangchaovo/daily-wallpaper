#!/usr/bin/env python3
"""Build WordPaper.app (zero-install Mac companion) and package it as DMGs.

Variants (uploaded to GitHub Releases, linked from the site's download modal):
  WordPaper-macOS-AppleSilicon.dmg  — bundled node-arm64, ~35MB, offline-ready
  WordPaper-macOS-Intel.dmg         — bundled node-x64,   ~37MB, offline-ready
  WordPaper-macOS-Slim.dmg          — no runtime, ~3MB; launcher downloads Node
                                      on first launch (npmmirror CDN first,
                                      nodejs.org fallback, SHA256-verified)

Prereqs:
  - assets/icon.icns                       (python3 scripts/make_icon.py)
  - scripts/node-dist/node-arm64|node-x64  (official v24.19.0 bin/node; only
    needed for the full variants — slim builds without them)

Output: scripts/dist/*.dmg

Launcher runtime resolution order (Contents/MacOS/WordPaper):
  1. Resources/bin/node-<arch>          (bundled — full variants)
  2. ~/.wordpaper/runtime/node-<arch>   (cached from a previous slim download)
  3. system Node 22–24 with node:sqlite (dev machines)
  4. download tarball, verify SHA256, cache under ~/.wordpaper/runtime
Self-test hooks (used by CI-ish checks, harmless for users):
  WORDPAPER_SELFTEST=1       resolve runtime, print it, exit before serving
  WORDPAPER_FORCE_DOWNLOAD=1 skip steps 1–3 to exercise the download path
  WORDPAPER_SKIP_COMPANION=1 start server only (no pet/wallpaper)
  WORDPAPER_RUNTIME_DIR      override the runtime cache location

The app is UNSIGNED: first launch needs 系统设置→隐私与安全性→仍要打开 once
(documented in 使用说明.txt on the DMG and in the site's download modal).
Developer-ID signing + notarization can be layered on later without changing
the bundle layout.
"""
import os
import plistlib
import shutil
import stat
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(HERE, "build")
DIST = os.path.join(HERE, "dist")
NODE_DIST = os.path.join(HERE, "node-dist")
ICON = os.path.join(ROOT, "assets", "icon.icns")

APP_NAME = "WordPaper.app"
EXEC_NAME = "WordPaper"
BUNDLE_ID = "cc.cd.wordpaper.companion"
VERSION = "2.0.0"

PAYLOAD_FILES = ["server.js", "companion.js", "package.json", "index.html", "login.html"]
PAYLOAD_DIRS = ["lib", "css", "js", "data"]

LAUNCHER = r'''#!/bin/bash
# WordPaper 每日壁纸 · Mac 桌面伴侣启动器(.app 内,双击即跑,无终端窗口)。
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
RES="$(cd "$HERE/../Resources" && pwd)"
cd "$RES"

ARCH="$(uname -m)"   # arm64 | x86_64
NODE_VER="v24.19.0"
NODE_DIST="darwin-arm64"; [ "$ARCH" = "x86_64" ] && NODE_DIST="darwin-x64"
SHA_EXPECT="8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d"
[ "$ARCH" = "x86_64" ] && SHA_EXPECT="d1b5e999db158c62fe8f7267a4476b035d8bd93b1a605bac24a3f0dd166e3316"
RUNTIME_DIR="${WORDPAPER_RUNTIME_DIR:-$HOME/.wordpaper/runtime}"
LOG_DIR="$HOME/Library/Logs/wordpaper"
mkdir -p "$LOG_DIR"
SELFTEST="${WORDPAPER_SELFTEST:-0}"

ok_sqlite() { "$1" -e "require('node:sqlite')" >/dev/null 2>&1; }

wp_alert() {  # 纯提示弹窗(消息经环境变量传入,避免引号地狱)
  WP_MSG="$1" /usr/bin/osascript -e 'display dialog (system attribute "WP_MSG") buttons {"好"} default button 1 with title "WordPaper 每日壁纸" with icon note' >/dev/null 2>&1 || true
}
wp_confirm() { # 取消/继续:选「继续」返回 0
  WP_MSG="$1" /usr/bin/osascript -e 'display dialog (system attribute "WP_MSG") buttons {"取消","继续"} default button 2 with title "WordPaper 每日壁纸" with icon note' >/dev/null 2>&1
}

# ── 运行时解析:包内 → 缓存 → 系统 → 下载 ──────────────────────
NODE=""
if [ -x "$RES/bin/node-$ARCH" ] && ok_sqlite "$RES/bin/node-$ARCH"; then NODE="$RES/bin/node-$ARCH"; fi
if [ -z "$NODE" ] && [ -x "$RUNTIME_DIR/node-$ARCH" ] && ok_sqlite "$RUNTIME_DIR/node-$ARCH"; then NODE="$RUNTIME_DIR/node-$ARCH"; fi
if [ -z "$NODE" ]; then
  for c in node /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.nvm/versions/node"/*/bin/node; do
    { [ -x "$(command -v "$c" 2>/dev/null)" ] || [ -x "$c" ]; } || continue
    maj="$("$c" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
    if [ "$maj" -ge 22 ] 2>/dev/null && [ "$maj" -le 24 ] 2>/dev/null && ok_sqlite "$c"; then NODE="$c"; break; fi
  done
fi
[ "${WORDPAPER_FORCE_DOWNLOAD:-0}" = "1" ] && NODE=""   # 测试钩子:强制走下载

if [ -z "$NODE" ]; then
  if [ "$SELFTEST" != "1" ]; then
    wp_confirm "$(printf '首次使用需要下载运行环境(约 40MB,只此一次,之后离线可用)。\n\n来自淘宝 NPM 镜像或 nodejs.org 的官方文件,已做完整性校验。需要联网。')" || exit 1
  fi
  mkdir -p "$RUNTIME_DIR"
  TGZ="$RUNTIME_DIR/node-$NODE_DIST.tar.gz"
  DLG=""
  if [ "$SELFTEST" != "1" ]; then
    WP_MSG="正在下载运行环境…(完成后此提示自动关闭)" /usr/bin/osascript -e 'display dialog (system attribute "WP_MSG") buttons {"请稍候"} default button 1 with title "WordPaper 每日壁纸" giving up after 1800' >/dev/null 2>&1 &
    DLG=$!
  fi
  OK=0
  for BASE in "https://registry.npmmirror.com/-/binary/node" "https://nodejs.org/dist"; do
    echo "下载运行时: $BASE/$NODE_VER/node-$NODE_VER-$NODE_DIST.tar.gz" >>"$LOG_DIR/server.log"
    if curl -fL --connect-timeout 15 --retry 2 -o "$TGZ" "$BASE/$NODE_VER/node-$NODE_VER-$NODE_DIST.tar.gz" 2>>"$LOG_DIR/server.log"; then
      GOT="$(shasum -a 256 "$TGZ" | awk '{print $1}')"
      if [ "$GOT" = "$SHA_EXPECT" ]; then OK=1; break; fi
      echo "SHA256 不匹配: $GOT" >>"$LOG_DIR/server.log"
    fi
  done
  [ -n "$DLG" ] && kill "$DLG" 2>/dev/null
  if [ "$OK" = "1" ]; then
    tar -xzf "$TGZ" -C "$RUNTIME_DIR" "node-$NODE_VER-$NODE_DIST/bin/node"
    mv "$RUNTIME_DIR/node-$NODE_VER-$NODE_DIST/bin/node" "$RUNTIME_DIR/node-$ARCH"
    rm -rf "$RUNTIME_DIR/node-$NODE_VER-$NODE_DIST" "$TGZ"
    chmod +x "$RUNTIME_DIR/node-$ARCH"
    ok_sqlite "$RUNTIME_DIR/node-$ARCH" && NODE="$RUNTIME_DIR/node-$ARCH"
  fi
fi

if [ -z "$NODE" ]; then
  wp_alert "$(printf '运行环境准备失败:请检查网络后重试。\n也可以先到 nodejs.org 免费安装 Node.js(LTS 版),再打开本 App。')"
  open "https://nodejs.org" >/dev/null 2>&1 &
  exit 1
fi

if [ "$SELFTEST" = "1" ]; then echo "SELFTEST OK: NODE=$NODE"; "$NODE" -v; exit 0; fi

# ── 主服务 + 伴侣 ─────────────────────────────────────────────
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-8770}"
export WORDPAPER_MODE="${WORDPAPER_MODE:-local}"
export WORDPAPER_DATA_DIR="${WORDPAPER_DATA_DIR:-$HOME/.wordpaper}"
export WORDPAPER_COMPANION_ENABLED=1
export WORDPAPER_WEB_ORIGIN="${WORDPAPER_WEB_ORIGIN:-http://localhost:$PORT}"

SERVER_PID=""
COMP_PID=""
cleanup() {
  [ -n "$COMP_PID" ] && kill "$COMP_PID" 2>/dev/null
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

if ! curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
  "$NODE" server.js >>"$LOG_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 40); do
    curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi
if ! curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
  wp_alert "$(printf 'WordPaper 主服务启动失败。\n请把日志文件发给开发者:\n%s/server.log' "$LOG_DIR")"
  exit 1
fi

if [ "${WORDPAPER_SKIP_COMPANION:-0}" = "1" ]; then
  echo "server up at :$PORT (companion skipped)"
  wait "$SERVER_PID"
  exit 0
fi

"$NODE" companion.js &
COMP_PID=$!
wait "$COMP_PID"
'''

README_COMMON = """每日壁纸 WordPaper · Mac 桌面伴侣
================================

安装(10 秒):
  1. 把「WordPaper」拖到右边的「应用程序」文件夹。
  2. 到「应用程序」里双击 WordPaper 的图标。

★ 第一次打开会被 macOS 拦一下(所有没交苹果年费的免费软件都会,
  不是病毒,放心):
  1. 弹窗里点「完成」——千万别点「移到废纸篓」!
  2. 打开「系统设置」→「隐私与安全性」,拉到最下面,
     会看到「已阻止 WordPaper…」,点右边的「仍要打开」。
  3. 再点「打开」(可能要按指纹或输开机密码)。
  这一步只需要做一次,以后双击直接用,永远不再拦。

{extra}
跑起来之后:
  • 自动把桌面壁纸换成今天的单词,每 30 分钟换一组。
  • 屏幕角落有常驻的「小词灵」窗,点词卡就是学习。
  • 浏览器会打开 http://localhost:8770 ,首次使用请创建账号。
  • 数据保存在 ~/.wordpaper ,删掉 App 也不会丢。

退出:程序坞(Dock)里右键 WordPaper 图标 →「退出」。

不想自动换桌面壁纸?
  编辑 ~/Library/Application Support/WordPaper/companion/companion-config.json,
  把 "autoSetWallpaper": true 改成 false,重新打开 App 即可。
"""

README_SLIM_EXTRA = """★ 这个「国内加速版」第一次打开时会自动下载运行环境(约 40MB,
  走国内高速镜像,一般 10~30 秒),只下载这一次,之后离线可用。

"""

VARIANTS = [
    # (key, dmg name, bundled arch or None)
    ("arm64", "WordPaper-macOS-AppleSilicon.dmg", "arm64"),
    ("x64", "WordPaper-macOS-Intel.dmg", "x64"),
    ("slim", "WordPaper-macOS-Slim.dmg", None),
]


def log(msg):
    print(msg, flush=True)


def build_app(dest, bundled_arch):
    """Create WordPaper.app at dest; bundled_arch='arm64'|'x64'|None."""
    if os.path.exists(dest):
        shutil.rmtree(dest)
    macos = os.path.join(dest, "Contents", "MacOS")
    res = os.path.join(dest, "Contents", "Resources")
    os.makedirs(macos)
    os.makedirs(res)

    # Info.plist
    plist = {
        "CFBundleDevelopmentRegion": "zh_CN",
        "CFBundleDisplayName": "每日壁纸 WordPaper",
        "CFBundleExecutable": EXEC_NAME,
        "CFBundleIconFile": "icon",
        "CFBundleIdentifier": BUNDLE_ID,
        "CFBundleInfoDictionaryVersion": "6.0",
        "CFBundleName": "WordPaper",
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": VERSION,
        "CFBundleVersion": "2",
        "LSMinimumSystemVersion": "13.0",
        "NSHighResolutionCapable": True,
    }
    with open(os.path.join(dest, "Contents", "Info.plist"), "wb") as f:
        plistlib.dump(plist, f)

    # launcher
    exe = os.path.join(macos, EXEC_NAME)
    with open(exe, "w") as f:
        f.write(LAUNCHER)
    os.chmod(exe, 0o755)

    # payload
    for name in PAYLOAD_FILES:
        shutil.copy2(os.path.join(ROOT, name), os.path.join(res, name))
    for d in PAYLOAD_DIRS:
        shutil.copytree(
            os.path.join(ROOT, d), os.path.join(res, d),
            ignore=shutil.ignore_patterns(".*", "__pycache__"),
        )
    shutil.copy2(ICON, os.path.join(res, "icon.icns"))

    # bundled runtime
    if bundled_arch:
        src = os.path.join(NODE_DIST, f"node-{bundled_arch}")
        if not os.path.exists(src):
            raise SystemExit(f"缺自带运行时: {src}(见 scripts/node-dist/README)")
        bin_dir = os.path.join(res, "bin")
        os.makedirs(bin_dir)
        shutil.copy2(src, os.path.join(bin_dir, f"node-{bundled_arch}"))
        os.chmod(os.path.join(bin_dir, f"node-{bundled_arch}"), 0o755)


def make_dmg(stage, out_path, volname):
    if os.path.exists(out_path):
        os.remove(out_path)
    subprocess.run(
        ["hdiutil", "create", "-volname", volname, "-srcfolder", stage,
         "-ov", "-format", "UDZO", out_path],
        check=True, capture_output=True, text=True,
    )


def main():
    if not os.path.exists(ICON):
        raise SystemExit("缺 assets/icon.icns,先跑 python3 scripts/make_icon.py")
    shutil.rmtree(BUILD, ignore_errors=True)
    os.makedirs(DIST, exist_ok=True)

    results = []
    for key, dmg_name, arch in VARIANTS:
        stage = os.path.join(BUILD, f"stage-{key}")
        os.makedirs(stage)
        app_dest = os.path.join(stage, APP_NAME)
        log(f"· 构建 {APP_NAME} ({key})…")
        build_app(app_dest, arch)
        os.symlink("/Applications", os.path.join(stage, "Applications"))
        extra = README_SLIM_EXTRA if arch is None else ""
        with open(os.path.join(stage, "使用说明.txt"), "w") as f:
            f.write(README_COMMON.format(extra=extra))
        out = os.path.join(DIST, dmg_name)
        log(f"· 打包 {dmg_name}…")
        make_dmg(stage, out, "WordPaper 每日壁纸")
        mb = os.path.getsize(out) / 1024 / 1024
        results.append((dmg_name, mb))
        log(f"  ✓ {dmg_name}  {mb:.1f} MB")

    log("\n完成。上传到 GitHub Release 后,网站下载弹窗里的 latest/download 链接即生效:")
    for name, mb in results:
        log(f"  {name}  {mb:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
