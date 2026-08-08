#!/usr/bin/env node
/* companion.js — 每日壁纸 · 桌面伴侣 (zero dependencies, macOS).
 *
 * Double-click or `node companion.js` and you get, all on localhost:
 *   1. The wallpaper website itself (so OCR + "set wallpaper" buttons work).
 *   2. A scheduler that renders today's wallpaper to PNG and sets it as your
 *      REAL macOS desktop picture via osascript — auto-changes on a timer.
 *   3. An always-on-top floating "pet" mini-window showing today's word/reminders.
 *
 * No npm install, no packages. Uses only Node's stdlib + macOS built-ins
 * (osascript/System Events, Apple Vision OCR via JXA, and a native floating
 * window through the `osascript`-driven WebKit bridge). Safe to copy to any Mac.
 *
 * Config: companion-config.json (auto-created on first run).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, exec } = require('child_process');
const os = require('os');

const ROOT = __dirname;
const DEFAULT_PORT = 8771;
const isMac = process.platform === 'darwin';

/* ---------------- config ---------------- */
const CONFIG_PATH = path.join(ROOT, 'companion-config.json');
function loadConfig() {
  const dflt = {
    port: DEFAULT_PORT,
    // which wallpaper to push to the real desktop
    autoSetWallpaper: true,
    intervalMinutes: 30,          // how often the real desktop wallpaper changes
    size: 'desktop-1920x1080',    // match your screen
    theme: 'cream',
    layout: 'group',              // 'group' | 'poster'
    library: 'ielts',
    wordsPerGroup: 6,
    bgPattern: 'soft',
    showReminders: true,
    // floating pet window
    petEnabled: true,
    petCorner: 'top-right',       // 'top-right'|'top-left'|'bottom-right'|'bottom-left'
    reminders: [],                // optional: hard-code reminders for wallpaper
    // one-key switch to the next word group + refresh the desktop wallpaper
    advanceByClick: true,         // single-click the pet = advance, shift-click = back
    hotkeyEnabled: false,         // global hotkey (needs Input Monitoring; off by default)
    hotkey: 'ctrl+alt+w',         // format: ctrl/alt/shift/cmd + '+' + a-z or 'space'
    hotkeyBack: 'ctrl+alt+shift+w', // back (undo last advance)
  };
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return Object.assign(dflt, c);
  } catch {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(dflt, null, 2));
    return dflt;
  }
}
const CFG = loadConfig();

/* Manual-advance state: each "next" (pet click or global hotkey) bumps the
 * counter, which is mixed into the pick seed so the wallpaper + pet jump to a
 * new word group right away (the auto interval still rotates by bucket). */
const STATE_PATH = path.join(ROOT, 'companion-state.json');
let state = { bump: 0 };
try { state = Object.assign({ bump: 0 }, JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))); } catch {}
function bumpDelta(d) {
  state.bump = (((state.bump + d) % 1000000) + 1000000) % 1000000;
  try { fs.writeFileSync(STATE_PATH, JSON.stringify(state)); } catch {}
}
function bumpNext() { bumpDelta(1); }
function bumpPrev() { bumpDelta(-1); }
/* Same seed for wallpaper & pet so both show the same group. When bump is 0 the
 * seed is byte-identical to the old behaviour, so first-run is unchanged. */
function todaySeed() {
  return dateKey(new Date()) + '#' + rotationBucket() + (state.bump ? '#bump' + state.bump : '');
}
/* Parse 'ctrl+alt+w'-style hotkey into { keyCode, mask, label }. */
const KEYCODES = { a:0,b:11,c:8,d:2,e:14,f:3,g:5,h:4,i:34,j:38,k:40,l:37,m:46,n:45,o:31,p:35,q:12,r:15,s:1,t:17,u:32,v:9,w:13,x:7,y:16,z:6, space:49 };
function parseHotkey(spec) {
  const parts = String(spec).split('+').map(s => s.trim().toLowerCase());
  const key = parts.pop();
  const keyCode = KEYCODES[key];
  if (keyCode == null) return null;
  let mask = 0;
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control') mask |= 1;                 // control
    else if (p === 'alt' || p === 'option' || p === 'opt') mask |= 2; // option
    else if (p === 'shift') mask |= 4;                              // shift
    else if (p === 'cmd' || p === 'command' || p === 'meta') mask |= 8; // command
    else return null;
  }
  return { keyCode, mask, label: spec };
}

/* ---------------- word data ---------------- */
function loadWords(library) {
  if (library === 'custom') {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'custom-words.json'), 'utf8')); }
    catch { return []; }
  }
  const f = path.join(ROOT, 'data', `words_${library}.json`);
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; }
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function pickForDate(list, count, dateStr, order) {
  if (!list || !list.length) return [];
  const n = Math.max(1, Math.min(count, list.length));
  const seed = hash(dateStr + '|' + order);
  if (order === 'random') {
    const rand = rng(seed);
    const idx = list.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, n).map(i => list[i]);
  }
  const dayIndex = Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 86400000);
  const start = (dayIndex * n + (seed % 7)) % list.length;
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[(start + i) % list.length]);
  return out;
}

const SIZES = {
  'desktop-1920x1080': [1920, 1080],
  'desktop-2560x1440': [2560, 1440],
  'desktop-3840x2160': [3840, 2160],
  'phone-1080x2400': [1080, 2400],
};

/* Build the settings object render.js expects, from config. */
function buildSettings() {
  return {
    layout: CFG.layout, bgPattern: CFG.bgPattern, fontScale: 1, fontWeight: 700,
    letterSpacing: 0, lineHeight: 1, anchorWords: 'center', anchorReminders: 'bottom',
    offWords: { x: 0, y: 0 }, offReminders: { x: 0, y: 0 },
    showPhonetic: true, showExample: true, showDate: true, showReminders: CFG.showReminders,
    showClock: true, custom: { enabled: false, title: '', footer: '' },
  };
}
const THEMES = {
  cream: { bg: '#fdf6ec', bg2: '#f7e8d4', ink: '#4a3b2e', sub: '#a08a73', accent: '#e8834a', accentSoft: '#fbe0c8', line: 'rgba(74,59,46,0.12)', patternInk: '#d9b48f' },
  mint: { bg: '#eafaf1', bg2: '#d3f2e0', ink: '#1f4536', sub: '#6f9a87', accent: '#2fae7d', accentSoft: '#c0ecd8', line: 'rgba(31,69,54,0.12)', patternInk: '#9ed9bd' },
  sky: { bg: '#e8f4fd', bg2: '#d3e9fb', ink: '#1e3a52', sub: '#6f8ba3', accent: '#3b8fd9', accentSoft: '#c2e0f7', line: 'rgba(30,58,82,0.12)', patternInk: '#a4cdec' },
  night: { bg: '#151a2e', bg2: '#1f2745', ink: '#eef1f8', sub: '#8b95b3', accent: '#7aa2f7', accentSoft: '#2a3358', line: 'rgba(238,241,248,0.14)', patternInk: '#3a4670' },
  forest: { bg: '#12211c', bg2: '#1c332a', ink: '#e8f0ea', sub: '#8fae9f', accent: '#5ec99a', accentSoft: '#234534', line: 'rgba(232,240,234,0.12)', patternInk: '#2e5040' },
};

/* Render the wallpaper to a PNG file WITHOUT any dependency, by drawing SVG
 * and rasterizing with macOS's built-in `sips`/`qlmanage`. This mirrors
 * render.js's GROUP/POSTER layouts closely enough for a desktop wallpaper. */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildSVG(opts) {
  const { width: W, height: H, layout, theme, words, reminders, settings, dateStr } = opts;
  const t = theme;
  const margin = Math.round(W * 0.06);
  const parts = [];
  parts.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bg2 || t.bg}"/></linearGradient>
    <radialGradient id="blob" cx="0.85" cy="0.12" r="0.6">
    <stop offset="0" stop-color="${t.accentSoft}" stop-opacity="0.6"/><stop offset="1" stop-color="${t.accentSoft}" stop-opacity="0"/></radialGradient></defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);
  if (settings.bgPattern !== 'none') parts.push(`<rect width="${W}" height="${H}" fill="url(#blob)"/>`);
  const fam = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';
  const text = (x, y, s, size, fill, weight, anchor) =>
    `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" fill="${fill}" font-weight="${weight || 400}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`;

  if (layout === 'poster') {
    const w0 = words[0] || { word: '', meaning: '' };
    let fs = Math.round(W * (H >= W ? 0.17 : 0.11));
    let y = Math.round(H * 0.32);
    parts.push(`<rect x="${margin}" y="${y - W * 0.03}" width="${W * 0.06}" height="${Math.max(4, W * 0.008)}" fill="${t.accent}"/>`);
    parts.push(text(margin, y + fs * 0.8, w0.word, fs, t.ink, 800));
    y += fs * 1.35;
    if (w0.phonetic) { parts.push(text(margin, y, w0.phonetic, fs * 0.32, t.accent, 500)); y += fs * 0.5; }
    const meaning = (w0.pos ? w0.pos + ' ' : '') + (w0.meaning || '');
    parts.push(text(margin, y + fs * 0.2, meaning, fs * 0.3, t.ink, 500));
  } else {
    // Mirror render.js renderGroup(): adaptive rows. When rows are tall enough we
    // stack word over meaning; when short (landscape / many words) we lay the row
    // out on a single line — index · word · phonetic · meaning — with divider rules.
    const n = Math.max(1, words.length);
    const hasRem = settings.showReminders && reminders && reminders.length;
    const blockTop = Math.round(H * 0.19);
    const blockBottom = Math.round(H * (hasRem ? 0.64 : 0.88));
    const rowH = Math.floor((blockBottom - blockTop) / n);
    const wordFs = Math.max(Math.round(W * 0.018), Math.min(Math.round(W * 0.052), Math.round(rowH * 0.34)));
    const stacked = rowH >= wordFs * 2.4;
    const gap = Math.round(W * 0.014);
    // rough proportional width estimates (latin ~0.55em, CJK ~1em, phonetic slimmer)
    const estW = (s, fs) => {
      let u = 0;
      for (const ch of String(s)) u += /[　-鿿豈-﫿]/.test(ch) ? 1 : (ch === ' ' ? 0.3 : 0.55);
      return u * fs;
    };
    const fit = (x, y, s, fs, fill, weight, maxW) => {
      const nat = estW(s, fs);
      const tl = nat > maxW ? ` textLength="${Math.round(maxW)}" lengthAdjust="spacingAndGlyphs"` : '';
      return `<text x="${x}" y="${y}" font-family="${fam}" font-size="${fs}" fill="${fill}" font-weight="${weight}"${tl}>${esc(s)}</text>`;
    };
    words.forEach((w, i) => {
      const rowY = blockTop + i * rowH;
      const midY = rowY + rowH / 2;
      parts.push(text(margin, midY + wordFs * 0.17, String(i + 1).padStart(2, '0'), wordFs * 0.5, t.sub, 500));
      const ix = margin + W * 0.075;
      const meaning = (w.pos ? w.pos + ' ' : '') + (w.meaning || '');
      if (stacked) {
        parts.push(text(ix, midY - rowH * 0.16 + wordFs * 0.36, w.word, wordFs, t.ink, 700));
        const ww = estW(w.word, wordFs);
        if (w.phonetic) parts.push(fit(ix + ww + W * 0.015, midY - rowH * 0.16 + wordFs * 0.36, w.phonetic, wordFs * 0.48, t.sub, 400, W - ix - ww - margin - W * 0.015));
        parts.push(fit(ix, midY + rowH * 0.22 + wordFs * 0.18, meaning, wordFs * 0.54, t.sub, 400, W - ix - margin));
      } else {
        const baseY = midY + wordFs * 0.36;
        parts.push(fit(ix, baseY, w.word, wordFs, t.ink, 700, W * 0.42));
        let tx = ix + Math.min(estW(w.word, wordFs), W * 0.42) + gap;
        if (w.phonetic) {
          parts.push(fit(tx, baseY, w.phonetic, wordFs * 0.48, t.sub, 400, W * 0.2));
          tx += Math.min(estW(w.phonetic, wordFs * 0.48), W * 0.2) + gap;
        }
        parts.push(fit(tx, baseY, meaning, wordFs * 0.5, t.sub, 400, W - tx - margin));
      }
      if (i < n - 1) parts.push(`<line x1="${margin}" y1="${rowY + rowH}" x2="${W - margin}" y2="${rowY + rowH}" stroke="${t.line || 'rgba(128,128,128,0.18)'}" stroke-width="1"/>`);
    });
  }

  if (settings.showReminders && reminders && reminders.length) {
    let y = Math.round(H * 0.72);
    const fs = Math.round(W * 0.02);
    parts.push(text(margin, y, '今日提醒', fs, t.accent, 600));
    y += fs * 1.8;
    reminders.slice(0, 6).forEach(r => {
      parts.push(`<rect x="${margin}" y="${y - fs * 0.7}" width="${fs * 0.9}" height="${fs * 0.9}" fill="none" stroke="${t.sub}" stroke-width="${Math.max(1, W * 0.0012)}"/>`);
      parts.push(text(margin + fs * 1.5, y, r.text + (r.time ? ' · ' + r.time : ''), fs, t.ink, 400));
      y += fs * 1.8;
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

function rasterizeSVG(svg, outPng, W, H, cb) {
  const tag = Date.now() + '_' + Math.floor(Math.random() * 1e6);
  const tmpSvg = path.join(os.tmpdir(), 'dw_' + tag + '.svg');
  fs.writeFileSync(tmpSvg, svg);
  // sips rasterizes SVG -> PNG at the SVG's own dimensions (macOS built-in).
  // (qlmanage would letterbox to a square thumbnail, so we don't use it.)
  const tmpPng = path.join(os.tmpdir(), 'dw_' + tag + '.png');
  execFile('sips', ['-s', 'format', 'png', tmpSvg, '--out', tmpPng], { timeout: 20000 }, (err) => {
    if (err || !fs.existsSync(tmpPng)) {
      // fallback: try qlmanage
      return execFile('qlmanage', ['-t', '-s', String(W), '-o', os.tmpdir(), tmpSvg], { timeout: 20000 }, (e2) => {
        const produced = path.join(os.tmpdir(), 'dw_' + tag + '.svg.png');
        if (e2 || !fs.existsSync(produced)) return cb(new Error('rasterize failed'), null);
        fs.renameSync(produced, outPng);
        cb(null, outPng);
      });
    }
    try { fs.renameSync(tmpPng, outPng); } catch { fs.copyFileSync(tmpPng, outPng); }
    cb(null, outPng);
  });
}

/* ---------------- floating "pet" window (zero-dep, JXA + WKWebView) ----------------
 * A real always-on-top mini panel showing today's words + reminders, rendered as
 * HTML in a borderless-ish WKWebView. No install, no focus stealing (Accessory
 * policy), lives on every Space. Respawned on a timer to refresh its content;
 * killed on companion exit. */
/* Pet card footer: a hint line + two visible ←回退 / 前进→ buttons, so the
 * window is self-explanatory without remembering click gestures. These geometry
 * constants feed BOTH the SVG (where buttons are drawn) and the JXA (where they
 * are hit-tested), so they must stay in sync. */
const PET_FOOTER_H = 62;                       // 底部提示行 + 按钮栏总高 (pt)
const PET_BTN = { w: 96, h: 32, bottomPad: 8, gap: 16 };  // 按钮宽/高/距底边距/间距 (pt)
const PET_RESIZE = { pad: 4, size: 32 };       // 右下角拉伸手柄尺寸 (pt) — 大一点好抓
const MIN_PET_W = 250, MIN_PET_H = 170, MAX_PET = 900;   // 宠物可拉伸的尺寸范围 (pt)

/* 形状 → 排列模式：竖版窄条=逐行堆叠；横版宽条=每词一列；方形=两列网格。 */
function petMode(W, H) {
  const r = W / H;
  if (r >= 1.5) return 'wide';
  if (r <= 0.75) return 'tall';
  return 'square';
}
/* 文字等比缩放：相对默认卡（320×428）的几何平均比例，放大卡片字也跟着放大。
 * clamp 到 0.7–2.6 防止极小/极大窗口下文字失控。 */
function petScale(W, H) {
  const s = Math.sqrt((W / 320) * (H / 428));
  return Math.max(0.7, Math.min(2.6, s));
}

/* Render the pet card as SVG (rasterized to PNG later). The pet WINDOW is a
 * borderless draggable grip that just draws this image — no WKWebView, because
 * a web view swallows the mouse drag (movableByWindowBackground won't work). */
function buildPetSVG(words, reminders, theme, W, H) {
  const s = 2; // render at 2x so it's crisp on retina
  const w = W * s, h = H * s;
  const padX = 15, padY = 14;                  // pt
  const footerH = PET_FOOTER_H;
  const parts = [];
  parts.push(`<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${theme.bg}"/><stop offset="1" stop-color="${theme.bg2 || theme.bg}"/></linearGradient></defs>`);
  parts.push(`<rect x="0" y="0" width="${w}" height="${h}" rx="${16 * s}" fill="url(#pg)"/>`);
  const fam = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';
  const txt = (x, y, str, size, fill, weight) =>
    `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" fill="${fill}"${weight ? ` font-weight="${weight}"` : ''}>${esc(str)}</text>`;
  const ctxt = (cx, cy, str, size, fill, weight) =>
    `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="${fam}" font-size="${size}" fill="${fill}"${weight ? ` font-weight="${weight}"` : ''}>${esc(str)}</text>`;
  const maxW = w - 2 * padX * s;
  const estW = (str, fs) => { let u = 0; for (const ch of String(str)) u += /[　-鿿豈-﫿]/.test(ch) ? 1 : (ch === ' ' ? 0.3 : 0.55); return u * fs; };
  parts.push(txt(padX * s, padY * s + Math.round(11 * s * 0.85), '🌱 每日壁纸', 11 * s, theme.sub));
  // 右上角关闭按钮（✕），点击可关闭小窗
  const cR = 14 * s;
  const cX = w - padX * s - cR, cY = padY * s + cR;
  parts.push(`<circle cx="${cX}" cy="${cY}" r="${cR}" fill="${theme.sub}" opacity="0.55"/>`);
  parts.push(`<path d="M ${cX - 6 * s} ${cY - 6 * s} L ${cX + 6 * s} ${cY + 6 * s} M ${cX + 6 * s} ${cY - 6 * s} L ${cX - 6 * s} ${cY + 6 * s}" stroke="#ffffff" stroke-width="${2 * s}" stroke-linecap="round"/>`);
  // 单词区（底部预留 footerH 给提示行 + 按钮栏）
  const mode = petMode(W, H);
  const scale = petScale(W, H);              // 文字等比缩放：卡片越大字越大
  const footerTop = (H - footerH);                       // pt
  const waX = padX, waY = padY + 24;
  const waW = W - 2 * padX, waH = H - footerH - padY - 24 - padY;
  const n = Math.max(1, words.length);
  const shown = words.slice(0, n);
  const meaning = wd => (wd.pos ? wd.pos + ' ' : '') + (wd.meaning || '');
  if (mode === 'wide') {
    // 横版宽条：每词一格（词上释义下，居中）。列数放不下就自动换行成多行网格，
    // 保证全部单词都显示——旧版 slice(0, cols) 会在拉伸时「丢失」后面的词。
    const minCol = 80 * scale;                                 // 每列最小宽度
    const cols = Math.max(1, Math.min(n, Math.floor(waW / minCol) || 1));
    const rows = Math.ceil(n / cols);
    const colW = waW / cols;
    const rowH = waH / rows;
    // 行高不够时略缩字号，避免挤爆
    const cellScale = Math.min(scale, Math.max(0.55, rowH / 56));
    shown.forEach((wd, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const cx = waX + c * colW + colW / 2;
      const mid = waY + r * rowH + rowH / 2;
      const wordFs = 14 * cellScale;
      const subFs = 9.5 * cellScale;
      // 词 + 音标 + 释义垂直居中于该格
      const blockH = (wd.phonetic ? 3 : 2) * (subFs + 4) + wordFs * 0.2;
      let yy = mid - blockH / 2 + wordFs * 0.75;
      parts.push(ctxt(cx * s, yy * s, wd.word, wordFs * s, theme.ink, 700));
      yy += wordFs * 0.95;
      if (wd.phonetic) { parts.push(ctxt(cx * s, yy * s, wd.phonetic, 9 * s * cellScale, theme.sub)); yy += subFs + 3; }
      parts.push(ctxt(cx * s, yy * s, truncate(meaning(wd), subFs * s, (colW - 8) * s), subFs * s, theme.sub));
      // 列分隔线（最后一列不画；多行时整列通高）
      if (c < cols - 1 && r === 0) {
        parts.push(`<line x1="${(waX + (c + 1) * colW) * s}" y1="${waY * s}" x2="${(waX + (c + 1) * colW) * s}" y2="${(waY + waH) * s}" stroke="${theme.line || 'rgba(128,128,128,0.14)'}" stroke-width="${s}"/>`);
      }
      // 行分隔线
      if (r < rows - 1 && c === 0) {
        parts.push(`<line x1="${waX * s}" y1="${(waY + (r + 1) * rowH) * s}" x2="${(waX + waW) * s}" y2="${(waY + (r + 1) * rowH) * s}" stroke="${theme.line || 'rgba(128,128,128,0.14)'}" stroke-width="${s}"/>`);
      }
    });
  } else if (mode === 'square') {
    // 方形：两列网格，序号 + 词 + 释义（字号随卡片缩放）
    const cols = 2, rows = Math.max(1, Math.ceil(n / 2));
    const colW = (waW - padX) / cols;
    const rowH = waH / rows;
    shown.forEach((wd, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = waX + c * (colW + padX);
      const mid = waY + r * rowH + rowH / 2;
      parts.push(txt(x * s, mid * s + Math.round(4 * s * scale), String(i + 1).padStart(2, '0'), 9 * s * scale, theme.sub));
      const ix = x + 22 * scale;
      parts.push(txt(ix * s, (mid - 6 * scale) * s, wd.word, 14 * s * scale, theme.ink, 700));
      parts.push(txt(ix * s, (mid + 11 * scale) * s, truncate(meaning(wd), 9.5 * s * scale, (colW - 30 * scale) * s), 9.5 * s * scale, theme.sub));
    });
  } else {
    // 竖版窄条：逐行堆叠（词 + 音标 + 释义，字号随卡片缩放）
    const rowH = waH / n;
    shown.forEach((wd, i) => {
      const rowTop = waY + i * rowH;
      const mid = rowTop + rowH / 2;
      parts.push(txt(padX * s, mid * s + Math.round(4 * s * scale), String(i + 1).padStart(2, '0'), 10 * s * scale, theme.sub));
      const ix = padX + 28 * scale;
      parts.push(txt(ix * s, (mid - 5 * scale) * s, wd.word, 16 * s * scale, theme.ink, 700));
      if (wd.phonetic) {
        const ww = Math.round(estW(wd.word, 16 * s * scale));
        parts.push(txt((ix + ww + 7 * scale) * s, (mid - 5 * scale) * s, wd.phonetic, 10.5 * s * scale, theme.sub));
      }
      parts.push(txt(ix * s, (mid + 11 * scale) * s, truncate(meaning(wd), 11 * s * scale, maxW - 28 * s * scale), 11 * s * scale, theme.sub));
      if (i < n - 1) parts.push(`<line x1="${padX * s}" y1="${(rowTop + rowH) * s}" x2="${(w - padX * s)}" y2="${(rowTop + rowH) * s}" stroke="${theme.line || 'rgba(128,128,128,0.14)'}" stroke-width="${s}"/>`);
    });
  }
  // 提醒（横版太矮放不下，只竖版/方形画；字号随卡片缩放）
  if (reminders && reminders.length && mode !== 'wide') {
    let ry = waY + (mode === 'square' ? Math.ceil(n / 2) * (waH / Math.max(1, Math.ceil(n / 2))) : n * (waH / n)) + 4 * scale;
    parts.push(txt(padX * s, ry * s, '今日提醒', 12 * s * scale, theme.accent, 600));
    ry += 18 * scale;
    reminders.slice(0, 5).forEach(r => {
      if (ry > footerTop - 14 * scale) return;   // 不压到按钮栏
      parts.push(`<rect x="${padX * s}" y="${(ry - 8 * scale) * s}" width="${11 * s * scale}" height="${11 * s * scale}" fill="none" stroke="${theme.sub}" stroke-width="${s}"/>`);
      parts.push(txt(padX * s + 18 * s * scale, ry * s, truncate(r.text + (r.time ? ' · ' + r.time : ''), 11 * s * scale, maxW - 18 * s * scale), 11 * s * scale, theme.ink));
      ry += 16 * scale;
    });
  }
  // ---- 底部提示行（标注，降低使用门槛）----
  parts.push(ctxt(w / 2, (H - footerH + 13) * s, '单击卡片＝前进 · Shift＋单击＝回退', 10.5 * s, theme.sub));
  // ---- 底部可视化按钮：◀ 回退 / 前进 ▶（窄窗口自动变窄，避开右下拉伸手柄）----
  const btn = PET_BTN;
  const btnW = Math.min(btn.w, Math.floor((W - 3 * padX - btn.gap - PET_RESIZE.size) / 2));
  const btnTop = (H - btn.h - btn.bottomPad);
  const btnX0 = Math.round((W - (2 * btnW + btn.gap)) / 2);
  const btnX1 = btnX0 + btnW + btn.gap;
  const btnC = (x0, label) =>
    `<rect x="${x0 * s}" y="${btnTop * s}" width="${btnW * s}" height="${btn.h * s}" rx="${12 * s}" fill="${theme.accentSoft}" stroke="${theme.line}" stroke-width="${s}"/>` +
    `<text x="${(x0 + btnW / 2) * s}" y="${(btnTop + btn.h / 2) * s + Math.round(4.5 * s)}" text-anchor="middle" font-family="${fam}" font-size="${13 * s}" font-weight="600" fill="${theme.ink}">${esc(label)}</text>`;
  parts.push(btnC(btnX0, '◀ 回退'));
  parts.push(btnC(btnX1, '前进 ▶'));
  // ---- 右下角拉伸手柄（三条斜线，明显的"可拖拽调大小"提示）----
  const rs = PET_RESIZE;
  const gx = (W - rs.pad - rs.size) * s, gy = (H - rs.pad - rs.size) * s, gs = rs.size * s;
  for (let i = 0; i < 3; i++) {
    const o = i * 8 * s;
    parts.push(`<line x1="${gx + gs - 4 - o}" y1="${gy + 10 + o}" x2="${gx + gs - 12 - o}" y2="${gy + 18 + o}" stroke="${theme.sub}" stroke-width="${2 * s}" stroke-linecap="round" opacity="0.55"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
}
/* crude width estimate + truncate with ellipsis (SVG text doesn't wrap). */
function truncate(str, fs, maxW) {
  let out = '';
  let wid = 0;
  for (const ch of String(str)) {
    const cw = /[　-鿿豈-﫿]/.test(ch) ? fs : (ch === ' ' ? fs * 0.3 : fs * 0.55);
    if (wid + cw > maxW && out) return out.replace(/\s+$/, '') + '…';
    out += ch; wid += cw;
  }
  return out;
}

function buildPetJXA(W, H) {
  const meta = JSON.stringify({ btn: PET_BTN, rsz: PET_RESIZE, minW: MIN_PET_W, minH: MIN_PET_H, max: MAX_PET, port: CFG.port, advance: CFG.advanceByClick !== false });
  return `
ObjC.import('Cocoa');
function run(argv){
  var pngPath = argv[0], corner = argv[1], posFile = argv[2], savedPos = argv[3], closeFile = argv[4], W = ${W}, H = ${H};
  var META = ${meta};
  var BTN = META.btn, RSZ = META.rsz, MINW = META.minW, MINH = META.minH, MAXS = META.max, PORT = META.port, clickEnabled = META.advance;
  var nextUrl = 'http://127.0.0.1:' + PORT + '/next.php';
  var prevUrl = 'http://127.0.0.1:' + PORT + '/prev.php';
  var sizeUrl = 'http://127.0.0.1:' + PORT + '/pet-size.php';
  var renderUrl = 'http://127.0.0.1:' + PORT + '/pet-render.php';
  var img = $.NSImage.alloc.initWithContentsOfFile(pngPath);
  var startX = 0, startY = 0, oX = 0, oY = 0, dragging = false, moved = false, downTime = 0;
  var resizing = false, rStartX = 0, rStartY = 0, rW0 = 0, rH0 = 0, lastRenderAt = 0;
  function postUrl(u){
    var req = $.NSMutableURLRequest.alloc.initWithURL($.NSURL.URLWithString(u));
    req.setHTTPMethod('POST');
    $.NSURLConnection.sendSynchronousRequestReturningResponseError(req, $(), $());
  }
  // 动态布局：所有命中区都按“当前窗口尺寸”算，拉伸后无需重启窗口
  function layout(){
    var fs = win.frame.size;
    var W2 = fs.width, H2 = fs.height;
    var bw = Math.min(BTN.w, Math.floor((W2 - 45 - BTN.gap - RSZ.size) / 2));
    var bx0 = Math.round((W2 - (2 * bw + BTN.gap)) / 2);
    return {
      W: W2, H: H2,
      closeX: W2 - 38, closeY: H2 - 38,
      rszX: W2 - RSZ.pad - RSZ.size, rszY0: RSZ.pad, rszY1: RSZ.pad + RSZ.size,
      btnY0: BTN.bottomPad, btnY1: BTN.bottomPad + BTN.h,
      btnX0: bx0, btnX1: bx0 + bw + BTN.gap, btnW: bw
    };
  }
  // 拖动中实时重渲：用异步请求（不阻塞主线程），窗口全程跟手；
  // 渲染在服务端 ~50ms 完成，回到主线程后刷新成清晰图（token 保证只应用最新一次）
  var renderToken = 0, lastRenderAt = 0, lastRendered = '';
  function renderAsync(w, h){
    var nw = Math.round(w), nh = Math.round(h);
    var key = nw + 'x' + nh;
    if (key === lastRendered) return;             // 尺寸没变，跳过
    var now = Date.now();
    if (now - lastRenderAt < 90) return;          // 节流 ~11fps，不阻塞
    lastRenderAt = now;
    lastRendered = key;
    renderToken++;
    var tok = renderToken;
    var req = $.NSMutableURLRequest.alloc.initWithURL($.NSURL.URLWithString(renderUrl + '?w=' + nw + '&h=' + nh));
    req.setHTTPMethod('POST');
    $.NSURLConnection.sendAsynchronousRequestQueueCompletionHandler(req, $.NSOperationQueue.mainQueue, function(resp, data, err){
      if (tok !== renderToken) return;            // 已有更新请求，丢弃这次
      img = $.NSImage.alloc.initWithContentsOfFile(pngPath);
      grip.setNeedsDisplay(true);
    });
  }
  var spawnedAt = Date.now();   // 新窗口预热期：spawn 后 1.5s 内忽略鼠标事件，挡幽灵事件
  ObjC.registerSubclass({ name: 'DWGrip', superclass: 'NSView', methods: {
    'mouseDownCanMoveWindow': function () { return false; },
    'drawRect:': function (rect) {
      var fs = win.frame.size;
      img.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, fs.width, fs.height), $.NSZeroRect, $.NSCompositeSourceOver, 1);
    },
    'mouseDown:': function (e) {
      var L = layout();
      var p = e.locationInWindow;
      if (p.x > L.closeX && p.y > L.closeY) {   // 右上角 ✕ 区域
        $.NSString.stringWithString('1').writeToFileAtomicallyEncodingError(closeFile, true, $.NSUTF8StringEncoding, $());
        win.orderOut($());
        $.NSApplication.sharedApplication.terminate($());   // 彻底退出，窗口消失
        return;
      }
      if (Date.now() - spawnedAt < 1500) return;   // 预热期：不响应幽灵按下
      if (p.x >= L.rszX && p.y >= L.rszY0 && p.y <= L.rszY1) {   // 右下角拉伸手柄
        var rm = $.NSEvent.mouseLocation;
        rStartX = rm.x; rStartY = rm.y;
        var rf = win.frame;
        rW0 = rf.size.width; rH0 = rf.size.height;
        resizing = true; moved = true;
        return;
      }
      if (p.y >= L.btnY0 && p.y <= L.btnY1) {   // 底部可视化按钮（优先于拖动）
        if (p.x >= L.btnX0 && p.x <= L.btnX0 + L.btnW) { postUrl(prevUrl); return; }
        if (p.x >= L.btnX1 && p.x <= L.btnX1 + L.btnW) { postUrl(nextUrl); return; }
      }
      var m = $.NSEvent.mouseLocation;
      startX = m.x; startY = m.y;
      moved = false; downTime = Date.now();
      var f = win.frame;
      oX = f.origin.x; oY = f.origin.y;
      dragging = true;
    },
    'mouseDragged:': function (e) {
      if (resizing) {   // 拉伸：保持左上角位置，右下角跟随鼠标；边拉边重渲
        var m = $.NSEvent.mouseLocation;
        var nw = Math.round(rW0 + (m.x - rStartX));
        var nh = Math.round(rH0 + (rStartY - m.y));   // Cocoa y 向上，鼠标下移=变高
        nw = Math.max(MINW, Math.min(MAXS, nw));
        nh = Math.max(MINH, Math.min(MAXS, nh));
        var f = win.frame;
        win.setFrameDisplay($.NSMakeRect(f.origin.x, f.origin.y + f.size.height - nh, nw, nh), true);   // setFrame:display:
        renderAsync(nw, nh);
        return;
      }
      if (!dragging) return;
      var m = $.NSEvent.mouseLocation;
      if (Math.abs(m.x - startX) > 4 || Math.abs(m.y - startY) > 4) moved = true;
      win.setFrameOrigin($.NSMakePoint(oX + (m.x - startX), oY + (m.y - startY)));
    },
    'mouseUp:': function (e) {
      if (resizing) {   // 松手：同步保存尺寸（/pet-size.php 渲染完才响应）→ 立刻加载最终高清图
        resizing = false;
        var f2 = win.frame;
        // 同步 POST：服务端串行渲染完才返回，保证读到的是最终尺寸的完整 PNG
        postUrl(sizeUrl + '?w=' + Math.round(f2.size.width) + '&h=' + Math.round(f2.size.height));
        img = $.NSImage.alloc.initWithContentsOfFile(pngPath);
        grip.setNeedsDisplay(true);
        lastRendered = Math.round(f2.size.width) + 'x' + Math.round(f2.size.height);
        renderToken++;   // 作废任何还在飞的异步重渲，避免旧尺寸覆盖最终图
        return;
      }
      dragging = false;
      if (Date.now() - spawnedAt < 1500 || downTime === 0) return;   // 预热期 / 没有真实按下
      // 单击＝前进；Shift+单击＝回退。按钮点击在 mouseDown 已 POST，且 downTime 未
      // 设置（=0）→ Date.now()-0 远超 400ms，不会在这里重复触发。
      if (clickEnabled && !moved && Date.now() - downTime < 400) {
        var back = (e.modifierFlags & ${FLAG_SHIFT}) ? true : false;
        postUrl(back ? prevUrl : nextUrl);
      }
    }
  }});
  // 轮询 PNG 变化：外部重渲（网页换形状 / 定时刷新 / 拉伸重渲）自动重载，不用重启窗口
  var lastMtime = 0;
  try {
    var at0 = $.NSFileManager.defaultManager.attributesOfItemAtPathError(pngPath, $());
    if (at0) { var d0 = at0.objectForKey($.NSFileModificationDate); if (d0) lastMtime = d0.timeIntervalSince1970 || 0; }
  } catch (e) {}
  $.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(0.6, true, function(){
    try {
      var at = $.NSFileManager.defaultManager.attributesOfItemAtPathError(pngPath, $());
      if (!at) return;
      var d = at.objectForKey($.NSFileModificationDate);
      if (!d) return;
      var mt = d.timeIntervalSince1970 || 0;
      if (mt > lastMtime + 0.05) {
        lastMtime = mt;
        img = $.NSImage.alloc.initWithContentsOfFile(pngPath);
        grip.setNeedsDisplay(true);
      }
    } catch (e) {}
  });
  var screen = $.NSScreen.mainScreen.frame;
  var screen = $.NSScreen.mainScreen.frame;
  var pad = 18;
  var x, y;
  if (savedPos) {
    var p = JSON.parse(savedPos);
    x = p.x; y = p.y;
    x = Math.max(10, Math.min(x, screen.size.width - W - 10));
    y = Math.max(10, Math.min(y, screen.size.height - H - 10));
  } else {
    x = /left/.test(corner) ? pad : screen.size.width - W - pad;
    var top = /top/.test(corner) ? pad + 22 : screen.size.height - H - pad - 12;
    y = screen.size.height - top - H;  // Cocoa y is from bottom
  }
  var win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer($.NSMakeRect(x, y, W, H), $.NSWindowStyleMaskBorderless, $.NSBackingStoreBuffered, false);
  win.opaque = false; win.backgroundColor = $.NSColor.clearColor;
  win.level = $.NSFloatingWindowLevel;
  win.collectionBehavior = $.NSWindowCollectionBehaviorCanJoinAllSpaces | $.NSWindowCollectionBehaviorStationary | $.NSWindowCollectionBehaviorIgnoresCycle;
  win.hasShadow = true;
  var grip = $.DWGrip.alloc.initWithFrame($.NSMakeRect(0, 0, W, H));
  grip.autoresizingMask = $.NSViewWidthSizable | $.NSViewHeightSizable;
  win.contentView.addSubview(grip);
  win.orderFrontRegardless;
  // 每 3 秒存一次当前位置，下次重启小窗留在你放的地方
  function savePos(){
    var f = win.frame;
    var s = JSON.stringify({x: f.origin.x, y: f.origin.y, w: f.size.width, h: f.size.height});
    $.NSString.stringWithString(s).writeToFileAtomicallyEncodingError(posFile, true, $.NSUTF8StringEncoding, $());
  }
  $.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(3, true, function(){ savePos(); });
  $.NSApplication.sharedApplication.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
  $.NSApplication.sharedApplication.run;
}`;
}

let petChild = null;
let petVisible = false;   // whether the floating pet window is currently shown
function stopPet() {
  petVisible = false;
  if (petChild) { try { petChild.kill(); } catch {} petChild = null; }
}

/* ---------------- global hotkey (zero-dep, via a JXA event monitor) ------- */
/* A dedicated osascript listener stays alive while the companion runs. Global
 * key monitors need the host process to be Accessibility-trusted (System
 * Settings → 隐私与安全性 → 辅助功能 → add osascript / your terminal), else the
 * events never arrive — the pet click still works without it. */
const FLAG_CTRL = 262144, FLAG_OPT = 524288, FLAG_SHIFT = 131072, FLAG_CMD = 1048576;
function buildHotkeyJXA(combos, port) {
  const spec = combos.map(c => ({
    keyCode: c.keyCode,
    wantC: (c.mask & 1) ? 1 : 0, wantO: (c.mask & 2) ? 1 : 0,
    wantS: (c.mask & 4) ? 1 : 0, wantM: (c.mask & 8) ? 1 : 0,
    dir: c.dir, last: 0,
  }));
  return `ObjC.import('AppKit'); ObjC.import('Foundation');
function run(){
  var combos = ${JSON.stringify(spec)};
  var events = 0, fires = 0;
  function fire(dir){
    var urlStr = 'http://127.0.0.1:${port}/' + (dir > 0 ? 'next' : 'prev') + '.php';
    var req = $.NSMutableURLRequest.alloc.initWithURL($.NSURL.URLWithString(urlStr));
    req.setHTTPMethod('POST');
    $.NSURLConnection.sendSynchronousRequestReturningResponseError(req, $(), $());
  }
  $.NSEvent.addGlobalMonitorForEventsMatchingMaskHandler($.NSEventMaskKeyDown, function(e){
    events++;
    if (e.isARepeat) return;                 // 长按自动重复只算一次
    var f = e.modifierFlags;
    var gotC = (f & ${FLAG_CTRL}) ? 1 : 0, gotO = (f & ${FLAG_OPT}) ? 1 : 0, gotS = (f & ${FLAG_SHIFT}) ? 1 : 0, gotM = (f & ${FLAG_CMD}) ? 1 : 0;
    for (var i = 0; i < combos.length; i++){
      var c = combos[i];
      if (e.keyCode !== c.keyCode) continue;
      if (gotC !== c.wantC || gotO !== c.wantO || gotS !== c.wantS || gotM !== c.wantM) continue;
      var now = Date.now();
      if (now - c.last < 400) break;         // 快速重按节流
      c.last = now; fires++;
      fire(c.dir);
      break;
    }
  });
  $.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(2, true, function(){
    $.NSString.stringWithString('{"events":' + events + ',"fires":' + fires + ',"t":' + Date.now() + '}').writeToFileAtomicallyEncodingError('/tmp/dw_hotkey_beat.json', true, $.NSUTF8StringEncoding, $());
  });
  while (true) { $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.5)); }
}
`;
}
let hotkeyChild = null;
let hotkeyAlive = false;
function hotkeyStatus() {
  let beat = { events: 0, fires: 0 };
  try { beat = Object.assign(beat, JSON.parse(fs.readFileSync('/tmp/dw_hotkey_beat.json', 'utf8'))); } catch {}
  return { enabled: CFG.hotkeyEnabled !== false, alive: hotkeyAlive, events: beat.events || 0, fires: beat.fires || 0 };
}
function startHotkey() {
  if (!isMac || !CFG.hotkeyEnabled) return;
  if (hotkeyChild) { try { hotkeyChild.kill(); } catch {} hotkeyChild = null; }
  const fwd = parseHotkey(CFG.hotkey || 'ctrl+alt+w');
  if (!fwd) { console.log('[companion] 快捷键配置无法识别，已跳过：' + CFG.hotkey); return; }
  const back = parseHotkey(CFG.hotkeyBack || 'ctrl+alt+shift+w');
  const combos = [{ keyCode: fwd.keyCode, mask: fwd.mask, dir: 1 }];
  if (back) combos.push({ keyCode: back.keyCode, mask: back.mask, dir: -1 });
  const scriptPath = path.join(os.tmpdir(), 'dw_hotkey.jxa.js');
  try { fs.writeFileSync(scriptPath, buildHotkeyJXA(combos, CFG.port)); } catch (err) { console.error('[companion] hotkey script failed:', err.message); return; }
  const { spawn } = require('child_process');
  hotkeyChild = spawn('osascript', ['-l', 'JavaScript', scriptPath], { stdio: 'ignore' });
  hotkeyChild.on('error', () => { hotkeyChild = null; hotkeyAlive = false; });
  hotkeyChild.unref();
  hotkeyAlive = true;
  const label = fwd.label + (back ? ' / ' + back.label : '');
  console.log(`[companion] 全局快捷键已开启：${label}（需在 系统设置→隐私与安全性→输入监控 里给 osascript 授权才生效，否则热键无响应）`);
}
/* Render the pet card PNG at a given size (shared by spawn + live resize +
 * shape change). sips is fast (~50ms), so it can run during a resize drag.
 * Serialized: concurrent POSTs during a fast drag would otherwise race on the
 * same /tmp/dw_pet.png and leave a half-written (blank / partial) image. */
let petRenderBusy = false;
let petRenderPending = null;   // {W,H,cbs:[]} — only the latest size is kept
function renderPetPng(W, H, cb) {
  if (petRenderBusy) {
    if (!petRenderPending) petRenderPending = { W, H, cbs: [] };
    else { petRenderPending.W = W; petRenderPending.H = H; }
    if (cb) petRenderPending.cbs.push(cb);
    return;
  }
  petRenderBusy = true;
  const doOne = (w, h, cbs) => {
    const words = loadWords(CFG.library);
    const picked = pickForDate(words, CFG.wordsPerGroup || 6, todaySeed(), 'random');
    const theme = THEMES[CFG.theme] || THEMES.cream;
    const svg = buildPetSVG(picked, CFG.reminders || [], theme, w, h);
    const pngPath = path.join(os.tmpdir(), 'dw_pet.png');
    rasterizeSVG(svg, pngPath, w * 2, h * 2, (err) => {
      for (const c of cbs) { try { c(err); } catch {} }
      if (petRenderPending) {
        const p = petRenderPending; petRenderPending = null;
        doOne(p.W, p.H, p.cbs);
      } else {
        petRenderBusy = false;
      }
    });
  };
  doOne(W, H, cb ? [cb] : []);
}

function startPet() {
  stopPet();
  if (!isMac || !CFG.petEnabled) return;
  const closeFile = path.join(ROOT, 'pet-closed');
  if (fs.existsSync(closeFile)) { console.log('[companion] 小窗已被关闭（点 ✕），重启伴侣后恢复'); return; }
  // 用上次拉伸保存的尺寸；没有就用默认（竖版卡片）
  const saved = state.petSize;
  const W = (saved && saved.w) ? Math.max(MIN_PET_W, Math.min(MAX_PET, saved.w)) : 320;
  const defH = Math.min(560, 90 + (CFG.wordsPerGroup || 6) * 46 + (CFG.reminders && CFG.reminders.length ? 90 : 0) + PET_FOOTER_H);
  const H = (saved && saved.h) ? Math.max(MIN_PET_H, Math.min(MAX_PET, saved.h)) : defH;
  // remember where the user last dragged the pet window
  const posFile = path.join(ROOT, 'pet-position.json');
  let savedPos = '';
  try {
    const p = JSON.parse(fs.readFileSync(posFile, 'utf8'));
    if (p && typeof p.x === 'number' && typeof p.y === 'number') savedPos = JSON.stringify({ x: p.x, y: p.y });
  } catch {}
  renderPetPng(W, H, (err) => {
    if (err) { console.error('[companion] pet render failed:', err.message); return; }
    const pngPath = path.join(os.tmpdir(), 'dw_pet.png');
    const jxa = buildPetJXA(W, H);
    const scriptPath = path.join(os.tmpdir(), 'dw_pet.jxa.js');
    fs.writeFileSync(scriptPath, jxa);
    const { spawn } = require('child_process');
    petVisible = true;
    petChild = spawn('osascript', ['-l', 'JavaScript', scriptPath, pngPath, CFG.petCorner || 'top-right', posFile, savedPos, closeFile], { stdio: 'ignore' });
    petChild.on('error', () => { petChild = null; petVisible = false; });
    petChild.unref();
    console.log(`[companion] 桌面宠物已显示（底部按钮可切换；单击卡片＝前进，Shift+单击＝回退；按住可拖动，拖右下角 ⤡ 可调大小；右上角 ✕ 关闭；每 ${Math.max(5, CFG.intervalMinutes)} 分钟刷新）`);
  });
}

/* ---------------- set the REAL macOS desktop wallpaper ---------------- */
function setMacWallpaper(pngPath, cb) {
  if (!isMac) return cb && cb(new Error('not macOS'));
  const posix = pngPath;
  const script = `tell application "System Events" to set picture of every desktop to "${posix}"`;
  execFile('osascript', ['-e', script], { timeout: 15000 }, (err) => cb && cb(err));
}

/* push one fresh wallpaper to the desktop */
function pushWallpaper(cb) {
  const words = loadWords(CFG.library);
  const today = dateKey(new Date());
  const count = CFG.layout === 'poster' ? 1 : CFG.wordsPerGroup;
  const picked = pickForDate(words, count, todaySeed(), 'random');
  const [W, H] = SIZES[CFG.size] || SIZES['desktop-1920x1080'];
  const svg = buildSVG({
    width: W, height: H, layout: CFG.layout, theme: THEMES[CFG.theme] || THEMES.cream,
    words: picked, reminders: CFG.reminders || [], settings: buildSettings(), dateStr: today,
  });
  // fresh filename EVERY push: macOS only redraws the desktop when the picture
  // path changes — re-setting the same path is a silent no-op, so the wallpaper
  // would look "stuck" forever.
  const out = freshWallpaperFile('wallpaper');
  rasterizeSVG(svg, out, W, H, (err, png) => {
    if (err) { console.error('[companion] render failed:', err.message); return cb && cb(err); }
    if (!CFG.autoSetWallpaper) { console.log('[companion] rendered', out, '(autoSet off)'); return cb && cb(null, out); }
    setMacWallpaper(out, (e2) => {
      cleanupOldWallpapers('wallpaper', 4);
      if (e2) console.error('[companion] set wallpaper failed:', e2.message);
      else console.log(`[companion] desktop wallpaper updated ${new Date().toLocaleTimeString()} (${picked.length} words)`);
      cb && cb(e2, out);
    });
  });
}
/* Fresh wallpaper file per set; macOS won't refresh the desktop if the picture
 * path stays the same. Old files get pruned, keeping the newest few. */
function freshWallpaperFile(prefix) {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return path.join(ROOT, `${prefix}-${stamp}.png`);
}
function cleanupOldWallpapers(prefix, keep) {
  try {
    const files = fs.readdirSync(ROOT).filter(f => f.startsWith(prefix + '-') && f.endsWith('.png')).sort();
    files.slice(0, Math.max(0, files.length - keep)).forEach(f => { try { fs.unlinkSync(path.join(ROOT, f)); } catch {} });
  } catch {}
}
function rotationBucket() {
  const now = new Date();
  return Math.floor((now.getHours() * 60 + now.getMinutes()) / Math.max(1, CFG.intervalMinutes));
}

/* One-key advance: bump the pick seed, render + set a fresh wallpaper, and
 * refresh the pet window so it shows the same new group. Renders are serialized
 * (sips is single-threaded enough that overlapping pushes race) — rapid clicks
 * bump immediately and queue one trailing render. */
let advancing = false;
let pendingDir = 0;
let lastAdvanceAt = 0;   // 服务端安全阀：500ms 内重复推进直接吞掉，防幽灵连发
function runAdvance(dir) {
  advancing = true;
  pushWallpaper(() => {
    startPet();
    advancing = false;
    if (pendingDir) { const d = pendingDir; pendingDir = 0; runAdvance(d); }
  });
}

/* ---------------- Apple Vision OCR (zero-dep, via JXA) ---------------- */
function ocrImage(pngPath, cb) {
  if (!isMac) return cb(new Error('OCR only on macOS'));
  const jxa = `
ObjC.import('Vision'); ObjC.import('Quartz');
function run(argv){
  var path = argv[0];
  var url = $.NSURL.fileURLWithPath(path);
  var img = $.CIImage.imageWithContentsOfURL(url);
  if (!img) return '';
  var req = $.VNRecognizeTextRequest.alloc.init;
  req.recognitionLevel = $.VNRequestTextRecognitionLevelAccurate;
  req.recognitionLanguages = ['en-US','zh-Hans'];
  var handler = $.VNImageRequestHandler.alloc.initWithCIImageOptions(img, $());
  var ok = handler.performRequestsError([req], $());
  var out = [];
  var results = req.results;
  if (results){
    for (var i=0;i<results.count;i++){
      var obs = results.objectAtIndex(i);
      var cand = obs.topCandidates(1);
      if (cand && cand.count>0) out.push(ObjC.unwrap(cand.objectAtIndex(0).string));
    }
  }
  return out.join('\\n');
}`;
  execFile('osascript', ['-l', 'JavaScript', '-e', jxa, pngPath], { timeout: 30000 }, (err, stdout) => {
    if (err) return cb(err);
    cb(null, String(stdout || ''));
  });
}

/* ---------------- HTTP server: serve app + endpoints ---------------- */
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv' };

function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(ROOT, p);
  const ext = path.extname(file).toLowerCase();
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function readBody(req, cb) {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => cb(Buffer.concat(chunks)));
}

/* Same one-click-enable + standalone-zip endpoints as server.js, so the desktop
 * card buttons work whether the page is served from the main site (8770) or
 * from here (8771, the page the companion auto-opens). */
function serveCompanionZip(req, res) {
  const script = path.join(ROOT, 'scripts', 'package_companion.py');
  execFile('python3', [script], { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('打包失败：' + (stderr || err.message)); }
    const zipPath = path.join(ROOT, 'scripts', '每日壁纸伴侣.zip');
    fs.readFile(zipPath, (e2, data) => {
      if (e2) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('读取安装包失败'); }
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="daily-wallpaper-companion.zip"; filename*=UTF-8\'\'%E6%AF%8F%E6%97%A5%E5%A3%81%E7%BA%B8%E4%BC%B4%E4%BE%A3.zip',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
}

/* naive multipart/form-data parse (enough for a single file field) */
function parseMultipart(buf, boundary) {
  const s = buf.toString('binary');
  const parts = s.split('--' + boundary);
  for (const part of parts) {
    if (!part.includes('filename=')) continue;
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    let data = part.slice(headerEnd + 4);
    if (data.endsWith('\r\n')) data = data.slice(0, -2);
    return Buffer.from(data, 'binary');
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // OCR endpoint (browser posts an image -> Vision -> text)
  if (url === '/ocr.php') {
    if (req.method === 'HEAD') { res.writeHead(isMac ? 200 : 404); return res.end(); }
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    return readBody(req, body => {
      const boundary = (req.headers['content-type'] || '').split('boundary=')[1];
      const img = boundary ? parseMultipart(body, boundary) : body;
      if (!img) { res.writeHead(400); return res.end(JSON.stringify({ error: 'no image' })); }
      const tmp = path.join(os.tmpdir(), 'dw_ocr.png');
      fs.writeFileSync(tmp, img);
      ocrImage(tmp, (err, text) => {
        if (err) { res.writeHead(500); return res.end(JSON.stringify({ error: err.message })); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text }));
      });
    });
  }

  // set-wallpaper endpoint (browser posts a rendered PNG -> set as desktop)
  if (url === '/set-wallpaper.php') {
    if (req.method === 'HEAD') { res.writeHead(isMac ? 200 : 404); return res.end(); }
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    return readBody(req, body => {
      const boundary = (req.headers['content-type'] || '').split('boundary=')[1];
      const img = boundary ? parseMultipart(body, boundary) : body;
      if (!img) { res.writeHead(400); return res.end(JSON.stringify({ error: 'no image' })); }
      const out = freshWallpaperFile('custom');
      fs.writeFileSync(out, img);
      setMacWallpaper(out, err => {
        cleanupOldWallpapers('custom', 3);
        res.writeHead(err ? 500 : 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(err ? { error: err.message } : { ok: true }));
      });
    });
  }

  // one-key switch: pet click / hotkey POST /next.php (+1) or /prev.php (-1)
  const handleAdvance = (req, res, dir) => {
    if (req.method === 'HEAD') { res.writeHead(isMac ? 200 : 404); return res.end(); }
    const now = Date.now();
    if (now - lastAdvanceAt < 500) {   // 服务端安全阀：500ms 内重复请求直接吞掉，防幽灵连发
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, bump: state.bump }));
    }
    lastAdvanceAt = now;
    bumpDelta(dir);
    if (advancing) pendingDir = dir; else runAdvance(dir);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, bump: state.bump }));
  };
  if (url === '/next.php') return handleAdvance(req, res, 1);
  if (url === '/prev.php') return handleAdvance(req, res, -1);

  // summon / hide the floating pet (called by the website control panel)
  if (url === '/pet.php') {
    if (req.method === 'HEAD') { res.writeHead(isMac ? 200 : 404); return res.end(); }
    let action = 'status';
    try { action = new URL(req.url, 'http://localhost').searchParams.get('action') || 'status'; } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (action === 'open') {
      try { fs.unlinkSync(path.join(ROOT, 'pet-closed')); } catch {}   // ✕ 关闭只对本次有效，召唤时清掉标记
      startPet();
      return res.end(JSON.stringify({ ok: true, pet: true }));
    }
    if (action === 'close') {
      try { fs.writeFileSync(path.join(ROOT, 'pet-closed'), '1'); } catch {}
      stopPet();
      return res.end(JSON.stringify({ ok: true, pet: false }));
    }
    return res.end(JSON.stringify({ ok: true, pet: petVisible }));
  }

  // live re-render during a resize drag: render PNG at the new size and respond
  // ONLY when sips finished, so the pet's synchronous POST + reload gets the new
  // image. No window respawn — stays sharp while dragging.
  if (url === '/pet-render.php') {
    let w = 0, h = 0;
    try {
      const q = new URL(req.url, 'http://localhost').searchParams;
      w = Math.max(MIN_PET_W, Math.min(MAX_PET, parseInt(q.get('w') || '0', 10) || 0));
      h = Math.max(MIN_PET_H, Math.min(MAX_PET, parseInt(q.get('h') || '0', 10) || 0));
    } catch {}
    const done = () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, w, h }));
    };
    if (w > 0 && h > 0) return renderPetPng(w, h, done);
    return done();
  }

  // final resize: save the size to state + re-render crisp, respond when done.
  // The pet reloads the new PNG itself (poll timer) — no window restart.
  if (url === '/pet-size.php') {
    if (req.method === 'HEAD') { res.writeHead(isMac ? 200 : 404); return res.end(); }
    let w = 0, h = 0;
    try {
      const q = new URL(req.url, 'http://localhost').searchParams;
      w = Math.max(MIN_PET_W, Math.min(MAX_PET, parseInt(q.get('w') || '0', 10) || 0));
      h = Math.max(MIN_PET_H, Math.min(MAX_PET, parseInt(q.get('h') || '0', 10) || 0));
    } catch {}
    const done = () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, w, h }));
    };
    if (w > 0 && h > 0) {
      state.petSize = { w, h };
      try { fs.writeFileSync(STATE_PATH, JSON.stringify(state)); } catch {}
      try { fs.unlinkSync(path.join(ROOT, 'pet-closed')); } catch {}   // 换形状时把宠物叫回来
      return renderPetPng(w, h, done);
    }
    return done();
  }

  // status endpoint
  if (url === '/status.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ mac: isMac, config: CFG, pet: petVisible, hotkey: hotkeyStatus() }));
  }

  // one-click enable: this server IS the companion, so it's already running.
  if (url === '/companion/start') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, already: true }));
  }
  // standalone download zip (same as the main server).
  if (url === '/companion.zip') return serveCompanionZip(req, res);

  serveStatic(req, res, url);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${CFG.port} 被占用，先关掉旧的 companion 再试`);
    process.exit(1);
  }
  throw err;
});

server.listen(CFG.port, '127.0.0.1', () => {
  console.log('');
  console.log('  🌱 每日壁纸 · 桌面伴侣已启动');
  console.log('  ────────────────────────────────');
  console.log(`  网站 + OCR：   http://localhost:${CFG.port}`);
  console.log(`  桌面壁纸自动换：${CFG.autoSetWallpaper ? '开（每 ' + CFG.intervalMinutes + ' 分钟）' : '关'}`);
  console.log(`  配置：         companion-config.json`);
  console.log('');
  if (isMac) {
    // open the site in the default browser
    exec(`open http://localhost:${CFG.port}`, () => {});
    // push the first wallpaper now, then on the interval
    if (CFG.autoSetWallpaper) {
      pushWallpaper();
      setInterval(() => pushWallpaper(), Math.max(1, CFG.intervalMinutes) * 60000);
    }
    // floating always-on-top pet window, refreshed on a timer
    if (CFG.petEnabled) {
      try { fs.unlinkSync(path.join(ROOT, 'pet-closed')); } catch {} // ✕ 关闭只对本次运行有效，重启伴侣恢复
      startPet();
      setInterval(startPet, Math.max(5, CFG.intervalMinutes) * 60000);
    }
    // global hotkey listener (independent of the pet; survives pet ✕ close)
    startHotkey();
    const cleanup = () => {
      stopPet();
      if (hotkeyChild) { try { hotkeyChild.kill(); } catch {} }
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } else {
    console.log('  （非 macOS：只提供网站，不改桌面壁纸 / 不做 OCR）');
  }
});
