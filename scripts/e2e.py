#!/usr/bin/env python3
"""End-to-end checks for 每日壁纸 v2 (daily-wallpaper).

Self-contained: launches its own server.js on a free port, runs Playwright
assertions, then kills the server. Covers v1 paths plus v2: library cards,
background patterns, typography controls, anchors, page cycling, drag nudge,
screenshot-import affordance, and the desktop-companion buttons. Ends by
asserting no pageerror / console.error.
"""
import os
import socket
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("需要 playwright:  pip install playwright && playwright install chromium")
    sys.exit(1)


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close(); return port


def wait_up(port, timeout=10):
    import urllib.request
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1); return True
        except Exception:
            time.sleep(0.2)
    return False


def main():
    port = free_port()
    env = dict(os.environ, PORT=str(port))
    server = subprocess.Popen(["node", "server.js"], cwd=ROOT, env=env,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if not wait_up(port):
        print("server failed to start"); server.kill(); sys.exit(1)

    base = f"http://127.0.0.1:{port}"
    results = []
    errors = []

    def check(name, cond):
        results.append((name, bool(cond)))
        print(("PASS  " if cond else "FAIL  ") + name)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1460, "height": 980})
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            page.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" else None)

            page.goto(base, wait_until="networkidle")
            page.wait_for_timeout(700)

            check("页面标题", "每日壁纸" in page.title())
            check("换一组按钮", page.locator("#btn-refresh").count() == 1)

            # library cards (v3) — 8 exam libraries + 我的词库 (custom, last)
            check("词库卡片渲染(9张)", page.locator("#library-cards .lib-card").count() == 9)
            # default canvas size phone 1080x2400
            dims = page.evaluate("() => { const c=document.querySelector('#preview-canvas'); return {w:c.width,h:c.height}; }")
            check("默认手机画布 1080×2400", dims["w"] == 1080 and dims["h"] == 2400)

            # switch library via the cet4 card (locate by text, not index)
            page.locator("#library-cards .lib-card", has_text="四级").first.click()
            page.wait_for_timeout(400)
            check("点卡片切四级词库", "四级" in page.inner_text("#meta") or "CET4" in page.inner_text("#meta"))

            # background pattern picker
            page.locator("#pattern-picker .pattern-chip").nth(2).click()  # dots
            page.wait_for_timeout(300)
            check("背景纹理切换", page.locator("#pattern-picker .pattern-chip").nth(2).evaluate("e=>e.classList.contains('on')"))

            # typography: font scale slider
            page.locator("#rng-fontscale").fill("1.3")
            page.wait_for_timeout(400)
            check("字号缩放生效(label)", "130%" in page.inner_text("#fontscale-val"))

            # weight select
            page.select_option("#sel-weight", "800")
            page.wait_for_timeout(300)
            check("字重切换", page.eval_on_selector("#sel-weight", "e=>e.value") == "800")

            # v3: font-style select
            page.select_option("#sel-fontstyle", "song")
            page.wait_for_timeout(300)
            check("字体风格切换(宋体)", page.eval_on_selector("#sel-fontstyle", "e=>e.value") == "song")
            page.select_option("#sel-fontstyle", "hei")  # restore

            # v3: ink (text color) picker — pick a swatch, "跟随主题" resets
            page.locator("#ink-picker .ink-chip.sw").nth(1).click()
            page.wait_for_timeout(300)
            check("文字颜色选择生效", page.locator("#ink-picker .ink-chip.sw").nth(1).evaluate("e=>e.classList.contains('on')"))
            page.locator("#ink-picker .ink-chip.auto").click()
            page.wait_for_timeout(200)
            check("文字颜色跟随主题复位", page.locator("#ink-picker .ink-chip.auto").evaluate("e=>e.classList.contains('on')"))

            # v3: date & clock checkboxes removed from the appearance card
            check("日期/时间开关已移除", page.locator("#chk-date").count() == 0 and page.locator("#chk-clock").count() == 0)

            # v3: background photo control present (upload tile + clear hidden until set)
            check("背景照片上传入口", page.locator("#file-bgphoto").count() == 1)

            # layout poster
            page.locator('#layout-switch .seg-btn[data-layout="poster"]').click()
            page.wait_for_timeout(400)
            check("切大字海报", page.locator('#layout-switch .seg-btn[data-layout="poster"]').evaluate("e=>e.classList.contains('on')"))

            # anchor switch
            page.locator('#anchor-words .seg-btn[data-anchor="top"]').click()
            page.wait_for_timeout(300)
            check("单词锚点切靠上", page.locator('#anchor-words .seg-btn[data-anchor="top"]').evaluate("e=>e.classList.contains('on')"))

            # desktop size
            page.select_option("#sel-size", "desktop-1920x1080")
            page.wait_for_timeout(400)
            dims2 = page.evaluate("() => { const c=document.querySelector('#preview-canvas'); return {w:c.width,h:c.height}; }")
            check("切桌面 1920×1080", dims2["w"] == 1920 and dims2["h"] == 1080)

            # paste import -> custom library card
            page.fill("#txt-paste", "serendipity, /ˌserənˈdɪpəti/, n., 意外发现珍奇事物的本领\nephemeral, /ɪˈfemərəl/, adj., 短暂的")
            page.click("#btn-paste-import")
            page.wait_for_timeout(400)
            check("粘贴导入切到我的词库", page.locator("#library-cards .lib-card").last.evaluate("e=>e.classList.contains('on')"))
            check("我的词库卡片有计数", "2词" in page.inner_text("#library-cards"))

            # screenshot import affordance present
            check("截图导入入口", page.locator("#file-screenshot").count() == 1)

            # add reminder
            page.fill("#inp-reminder", "下午 3 点开组会")
            page.click("#btn-add-reminder")
            page.wait_for_timeout(200)
            check("提醒出现在列表", "开组会" in page.inner_text("#reminder-list"))

            # manual refresh keeps canvas
            page.click("#btn-refresh")
            page.wait_for_timeout(400)
            check("换一组后仍有画布", page.evaluate("() => document.querySelector('#preview-canvas').width > 0"))

            # PNG download
            with page.expect_download() as dl:
                page.click("#btn-download")
            check("PNG 下载", dl.value.suggested_filename.endswith(".png"))

            # page-cycling checkbox reveals interval row
            page.check("#chk-cycle")
            page.wait_for_timeout(200)
            check("周期切换间隔行显示", page.eval_on_selector("#cycle-sec-row", "e=>e.style.display") != "none")

            # desktop companion buttons present
            check("设为桌面壁纸按钮", page.locator("#btn-set-wallpaper").count() == 1)
            check("下载桌面伴侣按钮", page.locator("#btn-companion").count() == 1)

            # live mode
            page.click("#btn-live")
            page.wait_for_timeout(400)
            check("实时壁纸覆盖层", page.eval_on_selector("#live-overlay", "e=>!e.hidden"))
            page.mouse.click(730, 480)
            page.wait_for_timeout(200)
            check("短按不触发(防误触)", page.eval_on_selector("#live-peek", "e=>e.hidden"))
            page.click("#btn-exit-live")
            page.wait_for_timeout(300)
            check("退出实时壁纸", page.eval_on_selector("#live-overlay", "e=>e.hidden"))

            check("无 pageerror / console.error", len(errors) == 0)
            browser.close()
    finally:
        server.kill()

    print("\n==== 结果 ====")
    failed = [n for n, ok in results if not ok]
    print(f"通过 {len(results) - len(failed)}/{len(results)}")
    if errors:
        print("\n捕获错误:")
        for e in errors:
            print("  " + e)
    if failed:
        print("失败项:")
        for n in failed:
            print("  - " + n)
        sys.exit(1)
    print("全部通过 ✅")


if __name__ == "__main__":
    main()
