#!/usr/bin/env node
'use strict';
/* 验证:网页端的版面位置(anchorWords/offWords/anchorReminders/offReminders)
 * 经 pet-sync 同步给 companion 后,buildSVG 重渲壁纸时真的应用了这些位置,
 * 而不是回退到写死的默认布局。 */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

async function freePort() {
  return await new Promise((resolve, reject) => {
    const s = http.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
async function waitForServer(base) {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(base + '/status.json'); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('companion did not start');
}
async function json(base, url, options) {
  const r = await fetch(base + url, options);
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}
function listSvgs() {
  return fs.readdirSync(os.tmpdir())
    .filter(f => /^dw_\d+_\d+\.svg$/.test(f))
    .map(f => path.join(os.tmpdir(), f));
}
// 触发一次壁纸渲染(/next.php),并等出现一个“新的” tmp SVG,返回其文本 y 坐标数组。
async function renderAndGrabWordYs(base, before) {
  await json(base, '/next.php', { method: 'POST' });
  let svgPath = null;
  for (let i = 0; i < 60; i++) {
    const fresh = listSvgs().filter(p => !before.has(p));
    if (fresh.length) { svgPath = fresh.map(p => [p, fs.statSync(p).mtimeMs]).sort((a, b) => b[1] - a[1])[0][0]; break; }
    await new Promise(r => setTimeout(r, 50));
  }
  assert.ok(svgPath, 'a fresh wallpaper SVG should be rendered');
  const svg = fs.readFileSync(svgPath, 'utf8');
  // 单词正文是 font-weight="700" 的 <text>;提取它们的 y。
  const ys = [...svg.matchAll(/<text[^>]*font-weight="700"[^>]*>/g)].map(m => {
    const y = /y="(-?\d+(?:\.\d+)?)"/.exec(m[0]);
    return y ? Number(y[1]) : null;
  }).filter(v => v != null);
  const xs = [...svg.matchAll(/<text[^>]*font-weight="700"[^>]*>/g)].map(m => {
    const x = /x="(-?\d+(?:\.\d+)?)"/.exec(m[0]);
    return x ? Number(x[1]) : null;
  }).filter(v => v != null);
  assert.ok(ys.length >= 3, `expected several word rows, got ${ys.length}`);
  return { ys, xs, svgPath };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wordpaper-layout-test-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const configPath = path.join(temp, 'config.json');
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'companion.js')], {
    cwd: path.join(__dirname, '..'), stdio: 'ignore',
    env: Object.assign({}, process.env, {
      WORDPAPER_TEST_MODE: '1', WORDPAPER_PORT: String(port),
      WORDPAPER_COMPANION_DATA_DIR: temp,
      WORDPAPER_STATE_PATH: path.join(temp, 'state.json'),
      WORDPAPER_CONFIG_PATH: configPath,
      WORDPAPER_CUSTOM_WORDS_PATH: path.join(temp, 'custom-words.json'),
    }),
  });
  try {
    await waitForServer(base);
    // 关 petWallpaperSync,让壁纸用 loadWords+pickForDate 出真词;先给默认布局。
    let r = await json(base, '/pet-sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library: 'ielts', wordsPerGroup: 6, petWallpaperSync: false, knownWords: [] }),
    });
    assert.equal(r.status, 200);

    // --- 默认布局渲染 ---
    let before = new Set(listSvgs());
    const def = await renderAndGrabWordYs(base, before);
    const defY = def.ys.slice().sort((a, b) => a - b);
    const defX = def.xs.slice().sort((a, b) => a - b);

    // --- 自定义布局:单词块锚定到底部 + 下移/右移 ---
    await sleep(600); // 越过 500ms 安全阀
    r = await json(base, '/pet-sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        library: 'ielts', wordsPerGroup: 6, petWallpaperSync: false, knownWords: [],
        anchorWords: 'bottom', offWords: { x: 0.1, y: 0.2 },
        anchorReminders: 'top', offReminders: { x: 0.05, y: -0.05 },
      }),
    });
    assert.equal(r.status, 200);

    // 配置必须持久化到 companion-config.json
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(cfg.anchorWords, 'bottom', 'anchorWords persisted');
    assert.equal(cfg.anchorReminders, 'top', 'anchorReminders persisted');
    assert.ok(Math.abs(cfg.offWords.y - 0.2) < 1e-9, 'offWords.y persisted');
    assert.ok(Math.abs(cfg.offWords.x - 0.1) < 1e-9, 'offWords.x persisted');
    console.log('✓ 布局字段已同步并持久化到 companion-config.json');

    await sleep(600);
    before = new Set(listSvgs());
    const cust = await renderAndGrabWordYs(base, before);
    const custY = cust.ys.slice().sort((a, b) => a - b);
    const custX = cust.xs.slice().sort((a, b) => a - b);

    // 底部锚点 + 正偏移 → 单词整体下移;x 正偏移 → 整体右移。
    const defMid = defY[Math.floor(defY.length / 2)];
    const custMid = custY[Math.floor(custY.length / 2)];
    console.log(`默认布局单词 y 中位: ${defMid}px,自定义: ${custMid}px`);
    assert.ok(custMid > defMid + 50, `bottom anchor + offY should push words down (default ${defMid} -> ${custMid})`);
    const defMinX = defX[0], custMinX = custX[0];
    console.log(`默认布局单词最小 x: ${defMinX}px,自定义: ${custMinX}px`);
    assert.ok(custMinX > defMinX, `offWords.x>0 should push words right (${defMinX} -> ${custMinX})`);

    console.log('✓ buildSVG 应用了锚点+偏移,壁纸不再回默认布局');
    console.log('ALL LAYOUT SYNC TESTS PASSED');
  } finally {
    child.kill('SIGTERM');
  }
})().catch(e => { console.error('LAYOUT TEST FAILED:', e && e.message); process.exit(1); });
