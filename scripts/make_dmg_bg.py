#!/usr/bin/env python3
"""Render the DMG installer-window background → assets/dmg-background.png.

1x canvas (660x420) matching the Finder window size — dmgbuild doesn't do
HiDPI backgrounds. Layout: title up top, purple arrow from the app icon slot
to the Applications alias, one-time Gatekeeper + Rosetta hints at the bottom.
Re-run when the layout changes:

    python3 scripts/make_dmg_bg.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "dmg-background.png")

# Icon centers (logical coords): WordPaper.app (170,160), Applications (490,160),
# 使用说明.txt (80,385). Arrow sits between the two icon slots.
SVG = """<svg xmlns='http://www.w3.org/2000/svg' width='660' height='420' viewBox='0 0 660 420'>
<rect width='660' height='420' fill='#fbf9ff'/>
<text x='330' y='53' text-anchor='middle' font-family='PingFang SC,Hiragino Sans GB,sans-serif'
      font-size='21' font-weight='600' fill='#5b4a72'>把 WordPaper 拖进「应用程序」文件夹</text>
<g stroke='#a176e5' stroke-width='7' stroke-linecap='round' stroke-linejoin='round' fill='none'>
  <line x1='270' y1='160' x2='385' y2='160'/>
  <path d='M368 141 L402 160 L368 179'/>
</g>
<text x='330' y='346' text-anchor='middle' font-family='PingFang SC,Hiragino Sans GB,sans-serif'
      font-size='14.5' fill='#9b8bb0'>首次打开如被拦截:系统设置 → 隐私与安全性 → 仍要打开(只需一次)</text>
<text x='330' y='370' text-anchor='middle' font-family='PingFang SC,Hiragino Sans GB,sans-serif'
      font-size='12' fill='#b7a9c6'>若提示安装 Rosetta 点「以后」——说明下错了芯片版本,不影响使用</text>
</svg>"""


def main():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 660, "height": 420},
                                device_scale_factor=1)
        # data: URL 会吃掉 SVG 里的 #,用 set_content
        page.set_content(f"<body style='margin:0'>{SVG}</body>")
        page.locator("svg").screenshot(path=OUT)
        browser.close()
    print(f"background -> {OUT} ({os.path.getsize(OUT)//1024} KB)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        sys.exit(f"Playwright 渲染失败: {e}")
