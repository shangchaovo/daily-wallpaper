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

# 伴侣独立版(约 77MB,自带 Node 运行时)超过 CF Pages ~25MiB 单文件上限,
# 改托管 GitHub Releases;app.js 的下载按钮直接指 latest/download。
# 如需更新:python3 scripts/package_companion.py && gh release upload ... (见 MEMORY)

npx wrangler pages deploy "$STAGE" --project-name wordpaper --commit-dirty=true
echo "✅ https://wordpaper.pages.dev/"
