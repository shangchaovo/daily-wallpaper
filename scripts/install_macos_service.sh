#!/bin/zsh
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
node_path="$(command -v node || true)"

if [[ -z "$node_path" ]]; then
  echo "没有找到 Node.js，请先安装 Node 22.23.2+ 或 Node 24。" >&2
  exit 1
fi

node_major="$($node_path -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 22 || node_major > 24 )); then
  echo "当前 Node 版本不受支持：$($node_path --version)（需要 Node 22.23.2+ 或 Node 24）" >&2
  exit 1
fi
if ! "$node_path" -e "require('node:sqlite')" >/dev/null 2>&1; then
  echo "当前 Node 未提供 node:sqlite，请升级到 Node 22.23.2+ 或 Node 24。" >&2
  exit 1
fi

data_dir="${WORDPAPER_DATA_DIR:-$HOME/.wordpaper}"
log_dir="$HOME/Library/Logs/wordpaper"
log_path="$log_dir/server.log"
template="$project_dir/launchd/com.daily-wallpaper.server.plist"
target="$HOME/Library/LaunchAgents/com.wordpaper.server.plist"

mkdir -p "$data_dir" "$log_dir" "$(dirname "$target")"

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/|/\\|/g'
}

node_xml="$(xml_escape "$node_path")"
node_dir_xml="$(xml_escape "$(dirname "$node_path")")"
project_xml="$(xml_escape "$project_dir")"
data_xml="$(xml_escape "$data_dir")"
log_xml="$(xml_escape "$log_path")"

sed \
  -e "s|__NODE_PATH__|$node_xml|g" \
  -e "s|__NODE_DIR__|$node_dir_xml|g" \
  -e "s|__PROJECT_DIR__|$project_xml|g" \
  -e "s|__DATA_DIR__|$data_xml|g" \
  -e "s|__LOG_PATH__|$log_xml|g" \
  "$template" > "$target"

plutil -lint "$target"
launchctl bootout "gui/$UID" "$target" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$target"
launchctl enable "gui/$UID/com.wordpaper.server"

echo "WordPaper 已安装为当前用户的登录服务。"
echo "地址：http://localhost:8770"
echo "数据：$data_dir"
echo "日志：$log_path"
