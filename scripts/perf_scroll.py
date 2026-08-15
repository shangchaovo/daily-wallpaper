#!/usr/bin/env python3
"""正确测量【主页】liquid vs cream 滚动性能(确保登录进主页)。"""
import os, sys, time, subprocess, socket, signal, shutil
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p
def wait_up(port, timeout=10):
    import urllib.request
    t0 = time.time()
    while time.time() - t0 < timeout:
        try: urllib.request.urlopen(f"http://127.0.0.1:{port}/login.html", timeout=1); return True
        except Exception: time.sleep(0.2)
    return False

BENCH_JS = """
async (theme) => {
  document.documentElement.dataset.uiTheme = theme;
  document.dispatchEvent(new CustomEvent('wordpaper:ui-theme-change', {detail:{theme}}));
  await new Promise(r => setTimeout(r, 500));
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 120));
  const frames = []; let last = performance.now(); let run = true;
  function tick(t){ frames.push(t-last); last=t; if(run) requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
  const dist = Math.max(600, document.body.scrollHeight - window.innerHeight);
  for (let i=0;i<=70;i++){ window.scrollTo(0, Math.round(dist*i/70)); await new Promise(r=>setTimeout(r,16)); }
  run = false; frames.shift(); frames.sort((a,b)=>a-b);
  const avg = frames.reduce((a,b)=>a+b,0)/frames.length;
  const p95 = frames[Math.floor(frames.length*0.95)]||0;
  const jank = frames.filter(f=>f>32).length;
  return { avg:+avg.toFixed(1), p95:+p95.toFixed(1), jank, total:frames.length };
}
"""

def main():
    port = free_port(); data = os.path.join(ROOT, "scripts", f".perf_db_{port}")
    env = dict(os.environ, PORT=str(port), WORDPAPER_DATA_DIR=data, WORDPAPER_COMPANION_PORT="1")
    srv = subprocess.Popen(["node", "server.js"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_up(port): print("server 起不来"); sys.exit(1)
        base = f"http://127.0.0.1:{port}"
        with sync_playwright() as p:
            try: browser = p.chromium.launch()
            except Exception: browser = p.chromium.launch(channel="chrome")
            context = browser.new_context(viewport={"width":1460,"height":980})
            acc = context.request.post(base+"/api/auth/register", headers={"Origin":base},
                                       data={"username":f"perf_{port}","password":"wordpaper-e2e-password"})
            if acc.status != 201: print("注册失败", acc.text); sys.exit(1)
            page = context.new_page()
            page.goto(base, wait_until="domcontentloaded")
            page.wait_for_selector("#preview-canvas", timeout=8000)   # 确保进了主页
            page.wait_for_timeout(900)
            print("已进主页:", "#preview-canvas" in page.content() and "OK")
            def bench(js_setup, label):
                js = f"""(async () => {{
                  document.documentElement.dataset.uiTheme='liquid';
                  document.dispatchEvent(new CustomEvent('wordpaper:ui-theme-change',{{detail:{{theme:'liquid'}}}}));
                  {js_setup}
                  await new Promise(r=>setTimeout(r,500));
                  window.scrollTo(0,0); await new Promise(r=>setTimeout(r,120));
                  const frames=[]; let last=performance.now(); let run=true;
                  function tick(t){{frames.push(t-last);last=t;if(run)requestAnimationFrame(tick);}}
                  requestAnimationFrame(tick);
                  const dist=Math.max(600,document.body.scrollHeight-window.innerHeight);
                  for(let i=0;i<=70;i++){{window.scrollTo(0,Math.round(dist*i/70));await new Promise(r=>setTimeout(r,16));}}
                  run=false; frames.shift(); frames.sort((a,b)=>a-b);
                  const avg=frames.reduce((a,b)=>a+b,0)/frames.length;
                  const p95=frames[Math.floor(frames.length*0.95)]||0;
                  const jank=frames.filter(f=>f>32).length;
                  return {{avg:+avg.toFixed(1),p95:+p95.toFixed(1),jank,total:frames.length}};
                }})()"""
                r = page.evaluate(js)
                print(f"[{label:30}] avg {r['avg']:5}ms  p95 {r['p95']:5}ms  掉帧 {r['jank']}/{r['total']}")
            bench("", "liquid 基线")
            bench("const s=document.createElement('style');s.id='pb';s.textContent=':root[data-ui-theme=liquid] body::before{display:none!important}';document.head.appendChild(s);", "关 body::before")
            bench("document.getElementById('pb')?.remove();const s=document.createElement('style');s.id='pa';s.textContent=':root[data-ui-theme=liquid] body::after{display:none!important}';document.head.appendChild(s);", "关 body::after")
            bench("const s=document.createElement('style');s.textContent=':root[data-ui-theme=liquid] [data-liquid-optic]::before,:root[data-ui-theme=liquid] [data-liquid-optic]::after{display:none!important}';document.head.appendChild(s);", "再关面板高光伪元素")
            bench("const s=document.createElement('style');s.textContent+=':root[data-ui-theme=liquid] *{{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}';document.head.appendChild(s);", "再关所有 backdrop-filter")
            browser.close()
    finally:
        srv.send_signal(signal.SIGTERM); shutil.rmtree(data, ignore_errors=True)

if __name__ == "__main__":
    main()
