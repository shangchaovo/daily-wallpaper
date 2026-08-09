#!/usr/bin/env python3
"""End-to-end checks for WordPaper (daily-wallpaper).

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

            check("页面标题", "WordPaper" in page.title())
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
            # back to group for the rest
            page.locator('#layout-switch .seg-btn[data-layout="group"]').click()
            page.wait_for_timeout(300)

            # 位置布局(锚点预设)卡片已移除，拖拽即可
            check("锚点预设卡片已移除", page.locator('#anchor-words').count() == 0)

            # desktop size
            page.select_option("#sel-size", "desktop-1920x1080")
            page.wait_for_timeout(400)
            dims2 = page.evaluate("() => { const c=document.querySelector('#preview-canvas'); return {w:c.width,h:c.height}; }")
            check("切桌面 1920×1080", dims2["w"] == 1920 and dims2["h"] == 1080)

            # paste import -> custom library card (import UI now lives in a button-triggered modal)
            check("导入按钮存在", page.locator("#btn-open-import").count() == 1)
            page.click("#btn-open-import")
            page.wait_for_timeout(200)
            check("导入弹窗打开", page.locator("#import-modal").evaluate("e=>!e.hidden"))
            page.fill("#txt-paste", "serendipity, /ˌserənˈdɪpəti/, n., 意外发现珍奇事物的本领\nephemeral, /ɪˈfemərəl/, adj., 短暂的")
            page.click("#btn-paste-import")
            page.wait_for_timeout(400)
            check("粘贴导入切到我的词库", page.locator("#library-cards .lib-card").last.evaluate("e=>e.classList.contains('on')"))
            check("我的词库卡片有计数", "2词" in page.inner_text("#library-cards"))

            # screenshot import affordance present (inside modal)
            check("截图导入入口", page.locator("#file-screenshot").count() == 1)
            # close modal
            page.click("#btn-close-import")
            page.wait_for_timeout(150)
            check("导入弹窗可关闭", page.locator("#import-modal").evaluate("e=>e.hidden"))

            # add reminder
            page.fill("#inp-reminder", "下午 3 点开组会")
            page.click("#btn-add-reminder")
            page.wait_for_timeout(200)
            check("提醒出现在列表", "开组会" in page.inner_text("#reminder-list"))

            # manual refresh keeps canvas
            page.click("#btn-refresh")
            page.wait_for_timeout(400)
            check("换一组后仍有画布", page.evaluate("() => document.querySelector('#preview-canvas').width > 0"))

            # visual drag: press on the words block and pull down -> offWords.y changes
            box = page.locator("#preview-canvas").bounding_box()
            before = page.evaluate("() => (JSON.parse(localStorage.getItem('wp:settings')||'{}').offWords||{}).y")
            cx, cy = box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.35
            page.mouse.move(cx, cy); page.mouse.down()
            for i in range(6):
                page.mouse.move(cx, cy + 20 * (i + 1), steps=3); page.wait_for_timeout(20)
            page.mouse.up()
            page.wait_for_timeout(250)
            after = page.evaluate("() => (JSON.parse(localStorage.getItem('wp:settings')||'{}').offWords||{}).y")
            check("预览拖动单词块", before != after)

            # PNG download
            with page.expect_download() as dl:
                page.click("#btn-download")
            check("PNG 下载", dl.value.suggested_filename.endswith(".png"))

            # SRS (艾宾浩斯) — 记忆复习 card. The paste-import step above switched the
            # library to 我的词库 (custom), where 记忆轮换 is intentionally disabled — so
            # first switch back to a built-in library (四级) before exercising 记好了.
            check("记忆复习卡片存在", page.locator("#btn-learned").count() == 1)
            page.locator("#library-cards .lib-card", has_text="四级").first.click()
            page.wait_for_timeout(500)
            lib = page.evaluate("() => JSON.parse(localStorage.getItem('wp:settings')||'{}').library")
            check("切到内置词库(四级)", lib == "cet4")
            before = page.evaluate("l => window.Review.stats(l).total", lib)
            page.click("#btn-learned")  # 这组记好了，换一组
            page.wait_for_timeout(500)
            after = page.evaluate("l => window.Review.stats(l).total", lib)
            check("记好了登记一组复习", after == before + 1)
            check("复习倒计时出现", page.eval_on_selector("#srs-countdown", "e=>!e.hidden"))
            page.uncheck("#chk-srs")
            page.wait_for_timeout(300)
            check("关闭艾宾浩斯后倒计时隐藏", page.eval_on_selector("#srs-countdown", "e=>e.hidden"))
            page.check("#chk-srs")  # restore
            page.wait_for_timeout(200)

            # page-cycling checkbox reveals interval row (自动与轮换 card is a collapsed <details> — open it first)
            page.locator("details.card summary", has_text="自动与轮换").click()
            page.wait_for_timeout(150)
            page.check("#chk-cycle")
            page.wait_for_timeout(200)
            check("周期切换间隔行显示", page.eval_on_selector("#cycle-sec-row", "e=>e.style.display") != "none")

            # desktop companion buttons present
            check("设为桌面壁纸按钮", page.locator("#btn-set-wallpaper").count() == 1)
            check("下载桌面伴侣按钮", page.locator("#btn-companion").count() == 1)

            # companion one-click zip route serves a real zip with launcher + data
            import urllib.request, zipfile, io
            zdata = urllib.request.urlopen(f"http://127.0.0.1:{port}/companion.zip", timeout=15).read()
            zf = zipfile.ZipFile(io.BytesIO(zdata))
            names = zf.namelist()
            check("伴侣一键包(zip含启动器+词库)",
                  any(n.endswith("启动伴侣.command") for n in names)
                  and any(n.endswith("companion.js") for n in names)
                  and sum(1 for n in names if n.startswith("每日壁纸伴侣/data/words_")) == 8)
            launcher = next(i for i in zf.infolist() if i.filename.endswith(".command"))
            check("启动器可执行(+x)", (launcher.external_attr >> 16) & 0o111 != 0)

            # one-click enable endpoint: POST /companion/start (dry mode for tests)
            import urllib.request, urllib.error, json
            try:
                dryr = urllib.request.urlopen(urllib.request.Request(
                    f"http://127.0.0.1:{port}/companion/start?dry=1", method="POST"), timeout=10)
                dryj = json.loads(dryr.read())
                check("一键启用端点(dry)", dryj.get("ok") is True and dryj.get("dry") is True)
            except Exception as e:
                check("一键启用端点(dry)", False)
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/companion/start", timeout=10)
                check("一键启用非POST返回405", False)
            except urllib.error.HTTPError as e:
                check("一键启用非POST返回405", e.code == 405)

            # companion's own server carries the same endpoints (page is served from 8771 too)
            with open(os.path.join(ROOT, "companion.js"), encoding="utf-8") as f:
                companion_src = f.read()
            check("伴侣服务同款一键/下载端点",
                  "'/companion/start'" in companion_src and "'/companion.zip'" in companion_src
                  and "freshWallpaperFile" in companion_src)

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
