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
/* Render the pet card as SVG (rasterized to PNG later). The pet WINDOW is a
 * borderless draggable grip that just draws this image — no WKWebView, because
 * a web view swallows the mouse drag (movableByWindowBackground won't work). */
function buildPetSVG(words, reminders, theme, W, H) {
  const s = 2; // render at 2x so it's crisp on retina
  const w = W * s, h = H * s;
  const padX = 15 * s, padY = 14 * s;
  const parts = [];
  parts.push(`<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${theme.bg}"/><stop offset="1" stop-color="${theme.bg2 || theme.bg}"/></linearGradient></defs>`);
  parts.push(`<rect x="0" y="0" width="${w}" height="${h}" rx="${16 * s}" fill="url(#pg)"/>`);
  const fam = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';
  const txt = (x, y, str, size, fill, weight) =>
    `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" fill="${fill}"${weight ? ` font-weight="${weight}"` : ''}>${esc(str)}</text>`;
  const maxW = w - 2 * padX;
  const estW = (str, fs) => { let u = 0; for (const ch of String(str)) u += /[　-鿿豈-﫿]/.test(ch) ? 1 : (ch === ' ' ? 0.3 : 0.55); return u * fs; };
  parts.push(txt(padX, padY + Math.round(11 * s * 0.85), '🌱 每日壁纸', 11 * s, theme.sub));
  // 右上角关闭按钮（✕），点击可关闭小窗
  const cR = 14 * s;
  const cX = w - padX - cR, cY = padY + cR;
  parts.push(`<circle cx="${cX}" cy="${cY}" r="${cR}" fill="${theme.sub}" opacity="0.55"/>`);
  parts.push(`<path d="M ${cX - 6 * s} ${cY - 6 * s} L ${cX + 6 * s} ${cY + 6 * s} M ${cX + 6 * s} ${cY - 6 * s} L ${cX - 6 * s} ${cY + 6 * s}" stroke="#ffffff" stroke-width="${2 * s}" stroke-linecap="round"/>`);
  const y0 = padY + 24 * s;
  const n = Math.max(1, words.length);
  const rowH = Math.round((H - padY - 24 - padY) / n * s);
  words.slice(0, n).forEach((wd, i) => {
    const rowTop = y0 + i * rowH;
    const mid = rowTop + rowH / 2;
    parts.push(txt(padX, mid + Math.round(4 * s), String(i + 1).padStart(2, '0'), 10 * s, theme.sub));
    const ix = padX + 28 * s;
    parts.push(txt(ix, mid - Math.round(5 * s), wd.word, 16 * s, theme.ink, 700));
    if (wd.phonetic) {
      const ww = Math.round(estW(wd.word, 16 * s));
      parts.push(txt(ix + ww + 7 * s, mid - Math.round(5 * s), wd.phonetic, 10.5 * s, theme.sub));
    }
    const meaning = (wd.pos ? wd.pos + ' ' : '') + (wd.meaning || '');
    parts.push(txt(ix, mid + Math.round(11 * s), truncate(meaning, 11 * s, maxW - 28 * s), 11 * s, theme.sub));
    if (i < n - 1) parts.push(`<line x1="${padX}" y1="${rowTop + rowH}" x2="${w - padX}" y2="${rowTop + rowH}" stroke="${theme.line || 'rgba(128,128,128,0.14)'}" stroke-width="${s}"/>`);
  });
  if (reminders && reminders.length) {
    let ry = y0 + n * rowH + 4 * s;
    parts.push(txt(padX, ry, '今日提醒', 12 * s, theme.accent, 600));
    ry += 18 * s;
    reminders.slice(0, 5).forEach(r => {
      parts.push(`<rect x="${padX}" y="${ry - 8 * s}" width="${11 * s}" height="${11 * s}" fill="none" stroke="${theme.sub}" stroke-width="${s}"/>`);
      parts.push(txt(padX + 18 * s, ry, truncate(r.text + (r.time ? ' · ' + r.time : ''), 11 * s, maxW - 18 * s), 11 * s, theme.ink));
      ry += 16 * s;
    });
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
  return `
ObjC.import('Cocoa');
function run(argv){
  var pngPath = argv[0], corner = argv[1], posFile = argv[2], savedPos = argv[3], closeFile = argv[4], W = ${W}, H = ${H};
  var img = $.NSImage.alloc.initWithContentsOfFile(pngPath);
  // 自定义拖动 + 右上角 ✕ 关闭：mouseDownCanMoveWindow 走系统机制会吞掉鼠标事件
  // 导致无法检测 ✕ 点击，所以这里自己实现拖动（mouseDown/Dragged/Up + setFrameOrigin）。
  var startX = 0, startY = 0, oX = 0, oY = 0, dragging = false;
  ObjC.registerSubclass({ name: 'DWGrip', superclass: 'NSView', methods: {
    'mouseDownCanMoveWindow': function () { return false; },
    'drawRect:': function (rect) {
      img.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, W, H), $.NSZeroRect, $.NSCompositeSourceOver, 1);
    },
    'mouseDown:': function (e) {
      var p = e.locationInWindow;
      if (p.x > W - 38 && p.y > H - 38) {   // 右上角 ✕ 区域
        $.NSString.stringWithString('1').writeToFileAtomicallyEncodingError(closeFile, true, $.NSUTF8StringEncoding, $());
        win.orderOut($());
        $.NSApplication.sharedApplication.terminate($());   // 彻底退出，窗口消失
        return;
      }
      var m = $.NSEvent.mouseLocation;
      startX = m.x; startY = m.y;
      var f = win.frame;
      oX = f.origin.x; oY = f.origin.y;
      dragging = true;
    },
    'mouseDragged:': function (e) {
      if (!dragging) return;
      var m = $.NSEvent.mouseLocation;
      win.setFrameOrigin($.NSMakePoint(oX + (m.x - startX), oY + (m.y - startY)));
    },
    'mouseUp:': function (e) { dragging = false; }
  }});
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
function stopPet() {
  if (petChild) { try { petChild.kill(); } catch {} petChild = null; }
}
function startPet() {
  stopPet();
  if (!isMac || !CFG.petEnabled) return;
  const closeFile = path.join(ROOT, 'pet-closed');
  if (fs.existsSync(closeFile)) { console.log('[companion] 小窗已被关闭（点 ✕），重启伴侣后恢复'); return; }
  const words = loadWords(CFG.library);
  const picked = pickForDate(words, CFG.wordsPerGroup || 6, dateKey(new Date()), 'random');
  const theme = THEMES[CFG.theme] || THEMES.cream;
  const W = 320;
  const H = Math.min(560, 90 + (CFG.wordsPerGroup || 6) * 46 + (CFG.reminders && CFG.reminders.length ? 90 : 0));
  const svg = buildPetSVG(picked, CFG.reminders || [], theme, W, H);
  // remember where the user last dragged the pet window
  const posFile = path.join(ROOT, 'pet-position.json');
  let savedPos = '';
  try {
    const p = JSON.parse(fs.readFileSync(posFile, 'utf8'));
    if (p && typeof p.x === 'number' && typeof p.y === 'number') savedPos = JSON.stringify({ x: p.x, y: p.y });
  } catch {}
  const pngPath = path.join(os.tmpdir(), 'dw_pet.png');
  rasterizeSVG(svg, pngPath, W * 2, H * 2, (err) => {
    if (err) { console.error('[companion] pet render failed:', err.message); return; }
    const jxa = buildPetJXA(W, H);
    const scriptPath = path.join(os.tmpdir(), 'dw_pet.jxa.js');
    fs.writeFileSync(scriptPath, jxa);
    const { spawn } = require('child_process');
    petChild = spawn('osascript', ['-l', 'JavaScript', scriptPath, pngPath, CFG.petCorner || 'top-right', posFile, savedPos, closeFile], { stdio: 'ignore' });
    petChild.on('error', () => { petChild = null; });
    petChild.unref();
    console.log(`[companion] 桌面宠物已显示（按住可拖动，右上角 ✕ 关闭；每 ${Math.max(5, CFG.intervalMinutes)} 分钟刷新）`);
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
  const picked = pickForDate(words, count, today + '#' + rotationBucket(), 'random');
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

  // status endpoint
  if (url === '/status.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ mac: isMac, config: CFG }));
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
      const cleanup = () => { stopPet(); process.exit(0); };
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    }
  } else {
    console.log('  （非 macOS：只提供网站，不改桌面壁纸 / 不做 OCR）');
  }
});
