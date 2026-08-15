#!/usr/bin/env bash
# Deploy WordPaper static site to Cloudflare Pages (https://wordpaper.pages.dev/)
# 只上传纯静态文件,不含 server/companion/登录等本地服务端文件。
set -euo pipefail

cd "$(dirname "$0")/.."
STAGE="$(mktemp -d /tmp/wordpaper-pages.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

cp index.html "$STAGE/"
cp -R css js lib data "$STAGE/"
rm -f "$STAGE/js/auth.js"   # auth 只属于本地伴侣端

# 伴侣独立版打包成静态 companion.zip(供「↓ 下载独立版」按钮)
python3 scripts/package_companion.py >/dev/null
cp scripts/每日壁纸伴侣.zip "$STAGE/companion.zip"

npx wrangler pages deploy "$STAGE" --project-name wordpaper --commit-dirty=true
echo "✅ https://wordpaper.pages.dev/"
