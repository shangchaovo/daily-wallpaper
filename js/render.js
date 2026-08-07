/* render.js — canvas wallpaper renderer. Shared by the browser app AND the
 * Node desktop companion (loaded there verbatim). No DOM access at module
 * scope; every drawing takes an explicit 2D context. Exposes `Render`.
 *
 * v3:
 *  - date/clock header REMOVED (cleaner, calmer wallpaper).
 *  - anchors (靠上/居中/靠下) now move the block across the FULL free height.
 *  - custom title/footer are free-floating blocks (positionable), not pinned.
 *  - fontStyle (system font families) + inkOverride (text color) support.
 *  - background can be a custom photo (bgImage) with a soft legibility scrim.
 */
(function (global) {
  'use strict';

  var FONT_STACKS = {
    hei:    '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",-apple-system,Segoe UI,Arial,sans-serif',
    song:   '"Songti SC","STSong","SimSun","Noto Serif CJK SC","Source Han Serif SC",serif',
    kai:    '"Kaiti SC","STKaiti","KaiTi","楷体",cursive',
    yuan:   '"Yuanti SC","YouYuan","幼圆","PingFang SC","Microsoft YaHei",sans-serif',
    heiti:  '"Heiti SC","STHeiti","SimHei","黑体","PingFang SC",sans-serif',
  };
  function fontStack(settings) {
    var key = (settings && settings.fontStyle) || 'hei';
    return FONT_STACKS[key] || FONT_STACKS.hei;
  }

  /* ---------- text helpers ---------- */
  function wrap(ctx, text, maxWidth) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function wrapMixed(ctx, text, maxWidth) {
    var s = String(text || '');
    if (!/\s/.test(s) && /[一-鿿]/.test(s)) {
      var lines = [], line = '';
      for (var i = 0; i < s.length; i++) {
        var test = line + s[i];
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = s[i]; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    }
    return wrap(ctx, s, maxWidth);
  }

  /* ---------- colors ---------- */
  // Resolve the main text ink. settings.inkOverride wins over theme.ink.
  function ink(theme, settings) { return (settings && settings.inkOverride) || theme.ink; }
  function subInk(theme, settings) {
    // secondary text stays a softened version of the ink
    if (settings && settings.inkOverride) return settings.inkOverride;
    return theme.sub;
  }

  /* ---------- background: photo OR gradient+pattern ---------- */
  function drawBackground(ctx, W, H, theme, settings) {
    if (settings && settings.bgImage) {
      var img = settings.bgImage;
      // cover-fit
      var ir = img.width / img.height, cr = W / H;
      var dw, dh, dx, dy;
      if (ir > cr) { dh = H; dw = Math.round(H * ir); dx = Math.round((W - dw) / 2); dy = 0; }
      else { dw = W; dh = Math.round(W / ir); dx = 0; dy = Math.round((H - dh) / 2); }
      try { ctx.drawImage(img, dx, dy, dw, dh); } catch (e) {}
      // soft scrim so text stays readable but the photo shows through
      var scrim = (settings.bgScrim == null ? 0.42 : settings.bgScrim);
      ctx.fillStyle = 'rgba(255,252,247,' + scrim + ')';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, theme.bg);
    g.addColorStop(1, theme.bg2 || theme.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var pattern = (settings && settings.bgPattern) || 'soft';
    if (pattern === 'none') return;
    ctx.save();
    if (pattern === 'soft' || pattern === 'blobs') drawBlobs(ctx, W, H, theme, pattern === 'blobs' ? 3 : 1);
    if (pattern === 'dots') drawDots(ctx, W, H, theme);
    if (pattern === 'grid') drawGrid(ctx, W, H, theme);
    if (pattern === 'diag') drawDiag(ctx, W, H, theme);
    if (pattern === 'waves') drawWaves(ctx, W, H, theme);
    ctx.restore();
  }
  function drawBlobs(ctx, W, H, theme, count) {
    var spots = [[0.85, 0.12, 0.6], [0.1, 0.85, 0.5], [0.5, 0.5, 0.7]];
    for (var i = 0; i < count && i < spots.length; i++) {
      var s = spots[i];
      ctx.globalAlpha = 0.5;
      var rg = ctx.createRadialGradient(W * s[0], H * s[1], 0, W * s[0], H * s[1], W * s[2]);
      rg.addColorStop(0, theme.accentSoft || theme.accent);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }
  function drawDots(ctx, W, H, theme) {
    ctx.fillStyle = theme.patternInk || theme.sub;
    ctx.globalAlpha = 0.10;
    var step = Math.round(W * 0.05);
    var r = Math.max(1.5, W * 0.0035);
    for (var y = step; y < H; y += step)
      for (var x = step; x < W; x += step) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    ctx.globalAlpha = 1;
  }
  function drawGrid(ctx, W, H, theme) {
    ctx.strokeStyle = theme.patternInk || theme.sub;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1;
    var step = Math.round(W * 0.055);
    for (var x = step; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = step; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function drawDiag(ctx, W, H, theme) {
    ctx.strokeStyle = theme.patternInk || theme.sub;
    ctx.globalAlpha = 0.06;
    ctx.lineWidth = Math.max(1, W * 0.0012);
    var step = Math.round(W * 0.045);
    for (var o = -H; o < W; o += step) {
      ctx.beginPath(); ctx.moveTo(o, 0); ctx.lineTo(o + H, H); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawWaves(ctx, W, H, theme) {
    ctx.strokeStyle = theme.patternInk || theme.sub;
    ctx.globalAlpha = 0.10;
    ctx.lineWidth = Math.max(1.5, W * 0.0015);
    var rows = 5, amp = W * 0.02, wl = W * 0.35;
    for (var r = 0; r < rows; r++) {
      var baseY = H * (0.18 + r * 0.16);
      ctx.beginPath();
      for (var x = 0; x <= W; x += 8) {
        var y = baseY + Math.sin((x / wl) * Math.PI * 2 + r) * amp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- reminders block ---------- */
  function remindersHeight(ctx, W, reminders, settings) {
    if (!settings.showReminders || !reminders || !reminders.length) return 0;
    var fs = Math.round(W * 0.020);
    var lh = Math.round(fs * 1.8);
    return Math.round(lh * 1.15) + Math.min(reminders.length, 6) * lh;
  }
  function drawReminders(ctx, W, H, theme, reminders, settings, margin, startY, minutesUntilFn) {
    if (!settings.showReminders || !reminders || !reminders.length) return startY;
    var F = fontStack(settings);
    var fs = Math.round(W * 0.020);
    var lh = Math.round(fs * 1.8);
    var y = startY;
    ctx.textBaseline = 'top';
    ctx.font = '600 ' + fs + 'px ' + F;
    ctx.fillStyle = theme.accent;
    ctx.fillText('今日提醒', margin, y);
    y += Math.round(lh * 1.15);
    var shown = reminders.filter(r => !r.done).concat(reminders.filter(r => r.done)).slice(0, 6);
    ctx.font = '400 ' + fs + 'px ' + F;
    for (var i = 0; i < shown.length; i++) {
      var r = shown[i];
      var box = Math.round(fs * 0.92);
      ctx.strokeStyle = subInk(theme, settings); ctx.lineWidth = Math.max(1, W * 0.0012);
      ctx.strokeRect(margin, y + Math.round(fs * 0.18), box, box);
      if (r.done) {
        ctx.strokeStyle = theme.accent;
        ctx.beginPath();
        ctx.moveTo(margin + box * 0.15, y + fs * 0.18 + box * 0.5);
        ctx.lineTo(margin + box * 0.42, y + fs * 0.18 + box * 0.78);
        ctx.lineTo(margin + box * 0.88, y + fs * 0.18 + box * 0.18);
        ctx.stroke();
      }
      ctx.fillStyle = r.done ? subInk(theme, settings) : ink(theme, settings);
      var label = r.text;
      if (r.time) {
        var mins = minutesUntilFn ? minutesUntilFn(r.time) : null;
        label += ' · ' + r.time;
        if (mins != null && mins >= 0) label += ' (' + mins + '分钟后)';
      }
      var tx = margin + box + Math.round(fs * 0.65);
      ctx.fillText(label, tx, y, W - tx - margin);
      y += lh;
    }
    return y;
  }

  /* vertical start position from an anchor, across the FULL free band. */
  function anchorY(anchor, availTop, availBottom, blockH, bias) {
    var span = Math.max(0, availBottom - availTop - blockH);
    if (anchor === 'top') return availTop;
    if (anchor === 'bottom') return availBottom - blockH;
    return availTop + Math.round(span * (bias == null ? 0.5 : bias)); // center
  }

  /* Resolve a block's top Y given anchor + fractional offset, over a band.
   * The anchor baseline comes from the band, but an explicit drag offset may
   * take the block anywhere on the canvas (even over the other block) — so we
   * only clamp to keep it at least partly visible. */
  function blockTopFor(anchor, offY, availTop, availBottom, blockH, H) {
    var base = anchorY(anchor, availTop, availBottom, blockH, 0.5);
    var y = base + Math.round((offY || 0) * H);
    var pad = Math.round(H * 0.03);
    return Math.max(pad - blockH, Math.min(H - pad, y));
  }

  /* ---------- free custom text blocks (title / footer) ---------- */
  function drawCustomBlocks(ctx, W, H, theme, settings, margin) {
    if (!(settings.custom && settings.custom.enabled)) return;
    var F = fontStack(settings);
    var blocks = [];
    if (settings.custom.title) blocks.push({ text: settings.custom.title, key: 'title', defY: 0.06 });
    if (settings.custom.footer) blocks.push({ text: settings.custom.footer, key: 'footer', defY: 0.9 });
    blocks.forEach(function (b) {
      var pos = (settings.custom.pos && settings.custom.pos[b.key]) || {};
      var fs = Math.round(W * 0.02 * (pos.scale || 1));
      ctx.font = '500 ' + fs + 'px ' + F;
      ctx.fillStyle = b.key === 'title' ? ink(theme, settings) : subInk(theme, settings);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      var cx = Math.round(W * (pos.x != null ? pos.x : 0.5));
      var cy = Math.round(H * (pos.y != null ? pos.y : b.defY));
      ctx.fillText(b.text, cx, cy);
      ctx.textAlign = 'left';
    });
    ctx.textBaseline = 'alphabetic';
  }

  /* ---------- GROUP layout ---------- */
  function renderGroup(ctx, W, H, theme, words, reminders, settings, dateStr, minutesUntilFn) {
    var margin = Math.round(W * 0.06);
    var scale = settings.fontScale || 1;
    var weight = settings.fontWeight || 700;
    var F = fontStack(settings);
    drawBackground(ctx, W, H, theme, settings);
    drawCustomBlocks(ctx, W, H, theme, settings, margin);

    // free vertical band is now the whole height (no date header, no footer pin)
    var topBand = Math.round(margin * 1.1);
    var bottomBand = H - Math.round(margin * 1.1);

    var remH = remindersHeight(ctx, W, reminders, settings);
    var remAnchor = settings.anchorReminders || 'bottom';
    var remTop = blockTopFor(remAnchor, settings.offReminders.y, topBand, bottomBand, remH, H);

    var n = Math.max(1, words.length);
    var wordsTop = topBand, wordsBottom = bottomBand;
    // keep words out of the reminders zone unless the user dragged them there
    if (remH && remAnchor === 'top') wordsTop = Math.max(wordsTop, remTop + remH + Math.round(H * 0.02));
    if (remH && remAnchor === 'bottom') wordsBottom = Math.min(wordsBottom, remTop - Math.round(H * 0.02));

    // Row height is sized to the CONTENT (word font), not forced to fill the
    // band — so the block is smaller than the free space and the anchor
    // (靠上/居中/靠下) can actually move it. Cap the fill so very few words on
    // a tall canvas don't become absurdly sparse.
    var avail = Math.max(1, wordsBottom - wordsTop);
    var wordFs = Math.max(Math.round(W * 0.018), Math.round(W * 0.052 * scale));
    var rowH = Math.round(wordFs * 3.0);
    var maxFillRowH = Math.floor(avail / n);
    rowH = Math.min(rowH, maxFillRowH);
    // if the band is tight, shrink the font so rows still breathe
    wordFs = Math.max(Math.round(W * 0.016), Math.min(wordFs, Math.round(rowH * 0.34)));
    var blockH = rowH * n;
    var blockTop = blockTopFor(settings.anchorWords || 'center', settings.offWords.y, wordsTop, wordsBottom, blockH, H);
    var xNudge = Math.round((settings.offWords.x || 0) * W);

    words.forEach(function (w, i) {
      var cy = blockTop + i * rowH;
      ctx.textBaseline = 'middle';
      var midY = cy + rowH / 2;
      var m = margin + xNudge;
      ctx.fillStyle = subInk(theme, settings);
      ctx.font = '500 ' + Math.round(wordFs * 0.5) + 'px ' + F;
      ctx.fillText(String(i + 1).padStart(2, '0'), m, midY);
      var ix = m + Math.round(W * 0.075);
      var meaning = (w.pos ? w.pos + ' ' : '') + (w.meaning || '');
      var stacked = rowH >= wordFs * 2.4;
      if (stacked) {
        ctx.fillStyle = ink(theme, settings);
        ctx.font = weight + ' ' + wordFs + 'px ' + F;
        ctx.fillText(w.word, ix, midY - rowH * 0.16, W - ix - margin);
        var ww = ctx.measureText(w.word).width;
        if (settings.showPhonetic && w.phonetic) {
          ctx.fillStyle = subInk(theme, settings);
          ctx.font = '400 ' + Math.round(wordFs * 0.48) + 'px ' + F;
          ctx.fillText(w.phonetic, ix + ww + Math.round(W * 0.015), midY - rowH * 0.16, W - ix - ww - margin - Math.round(W * 0.015));
        }
        ctx.fillStyle = subInk(theme, settings);
        ctx.font = '400 ' + Math.round(wordFs * 0.54) + 'px ' + F;
        ctx.fillText(meaning, ix, midY + rowH * 0.22, W - ix - margin);
      } else {
        ctx.fillStyle = ink(theme, settings);
        ctx.font = weight + ' ' + wordFs + 'px ' + F;
        ctx.fillText(w.word, ix, midY, W * 0.42);
        var tx = ix + ctx.measureText(w.word).width + Math.round(W * 0.014);
        if (settings.showPhonetic && w.phonetic) {
          ctx.fillStyle = subInk(theme, settings);
          ctx.font = '400 ' + Math.round(wordFs * 0.48) + 'px ' + F;
          ctx.fillText(w.phonetic, tx, midY, W * 0.2);
          tx += ctx.measureText(w.phonetic).width + Math.round(W * 0.014);
        }
        ctx.fillStyle = subInk(theme, settings);
        ctx.font = '400 ' + Math.round(wordFs * 0.5) + 'px ' + F;
        ctx.fillText(meaning, tx, midY, W - tx - margin);
      }
      if (i < n - 1) {
        ctx.strokeStyle = theme.line || 'rgba(128,128,128,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(margin + xNudge, cy + rowH); ctx.lineTo(W - margin + xNudge, cy + rowH); ctx.stroke();
      }
    });

    if (remH) drawReminders(ctx, W, H, theme, reminders, settings, margin + Math.round((settings.offReminders.x || 0) * W), remTop, minutesUntilFn);
  }

  /* ---------- POSTER layout ---------- */
  function renderPoster(ctx, W, H, theme, words, reminders, settings, dateStr, minutesUntilFn) {
    var margin = Math.round(W * 0.07);
    var scale = settings.fontScale || 1;
    var weight = Math.min(800, (settings.fontWeight || 700) + 100);
    var spacing = settings.letterSpacing || 0;
    var F = fontStack(settings);
    drawBackground(ctx, W, H, theme, settings);
    drawCustomBlocks(ctx, W, H, theme, settings, margin);
    var w = words[0] || { word: '', meaning: '' };

    var isPhone = H >= W;
    var fs = Math.round(W * (isPhone ? 0.17 : 0.11) * scale);
    ctx.font = weight + ' ' + fs + 'px ' + F;
    while (measureSpaced(ctx, w.word, spacing) > W - margin * 2 && fs > 20) {
      fs -= 2; ctx.font = weight + ' ' + fs + 'px ' + F;
    }
    var meaning = (w.pos ? w.pos + ' ' : '') + (w.meaning || '');
    ctx.font = '500 ' + Math.round(fs * 0.3) + 'px ' + F;
    var meaningLines = (w.pos || w.meaning) ? wrapMixed(ctx, meaning, W - margin * 2) : [];
    ctx.font = 'italic 400 ' + Math.round(fs * 0.26) + 'px ' + F;
    var exampleLines = (settings.showExample && w.example) ? wrap(ctx, w.example, W - margin * 2) : [];

    var lineHMul = settings.lineHeight || 1;
    var blockH = Math.round(fs * 1.18 * lineHMul);
    if (settings.showPhonetic && w.phonetic) blockH += Math.round(fs * 0.5 * lineHMul);
    if (meaningLines.length) blockH += meaningLines.length * Math.round(fs * 0.46 * lineHMul) + Math.round(fs * 0.1);
    if (exampleLines.length) blockH += exampleLines.length * Math.round(fs * 0.4 * lineHMul) + Math.round(fs * 0.28);

    var topBand = Math.round(margin * 1.1);
    var bottomBand = H - Math.round(margin * 1.1);
    var remH = remindersHeight(ctx, W, reminders, settings);
    var remAnchor = settings.anchorReminders || 'bottom';
    var remTop = blockTopFor(remAnchor, settings.offReminders.y, topBand, bottomBand, remH, H);

    var availTop = topBand, availBottom = bottomBand;
    if (remH && remAnchor === 'top') availTop = Math.max(availTop, remTop + remH + Math.round(H * 0.02));
    if (remH && remAnchor === 'bottom') availBottom = Math.min(availBottom, remTop - Math.round(H * 0.02));
    var y = anchorY(settings.anchorWords || 'center', availTop, availBottom, blockH, 0.42) + Math.round((settings.offWords.y || 0) * H);
    var xN = Math.round((settings.offWords.x || 0) * W);
    y = Math.max(topBand, y);

    ctx.textBaseline = 'top';
    ctx.fillStyle = theme.accent;
    ctx.fillRect(margin + xN, y, Math.round(W * 0.06), Math.max(4, Math.round(W * 0.008)));
    y += Math.round(W * 0.045);

    ctx.fillStyle = ink(theme, settings);
    ctx.font = weight + ' ' + fs + 'px ' + F;
    drawSpaced(ctx, w.word, margin + xN, y, spacing);
    y += Math.round(fs * 1.18 * lineHMul);

    if (settings.showPhonetic && w.phonetic) {
      ctx.fillStyle = theme.accent;
      ctx.font = '500 ' + Math.round(fs * 0.32) + 'px ' + F;
      ctx.fillText(w.phonetic, margin + xN, y);
      y += Math.round(fs * 0.5 * lineHMul);
    }
    if (meaningLines.length) {
      ctx.fillStyle = ink(theme, settings);
      ctx.font = '500 ' + Math.round(fs * 0.3) + 'px ' + F;
      for (var i = 0; i < meaningLines.length; i++) { ctx.fillText(meaningLines[i], margin + xN, y); y += Math.round(fs * 0.46 * lineHMul); }
      y += Math.round(fs * 0.1);
    }
    if (exampleLines.length) {
      y += Math.round(fs * 0.18);
      ctx.fillStyle = subInk(theme, settings);
      ctx.font = 'italic 400 ' + Math.round(fs * 0.26) + 'px ' + F;
      for (var j = 0; j < exampleLines.length; j++) { ctx.fillText(exampleLines[j], margin + xN, y); y += Math.round(fs * 0.4 * lineHMul); }
    }

    if (remH) drawReminders(ctx, W, H, theme, reminders, settings, margin + Math.round((settings.offReminders.x || 0) * W), remTop, minutesUntilFn);
  }

  /* letter-spacing helpers (canvas has no tracking, so draw per-char). */
  function measureSpaced(ctx, text, spacing) {
    if (!spacing) return ctx.measureText(text).width;
    var w = 0;
    for (var i = 0; i < text.length; i++) w += ctx.measureText(text[i]).width + spacing;
    return w - spacing;
  }
  function drawSpaced(ctx, text, x, y, spacing) {
    if (!spacing) { ctx.fillText(text, x, y); return; }
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text[i], cx, y);
      cx += ctx.measureText(text[i]).width + spacing;
    }
  }

  /* ---------- REMINDER PAGE (for whole-page cycling) ---------- */
  function renderReminderPage(ctx, W, H, theme, reminders, settings, dateStr, minutesUntilFn) {
    var margin = Math.round(W * 0.08);
    var F = fontStack(settings);
    drawBackground(ctx, W, H, theme, settings);
    drawCustomBlocks(ctx, W, H, theme, settings, margin);
    ctx.textBaseline = 'top';
    var titleFs = Math.round(W * 0.055);
    var y = Math.round(H * 0.14);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(margin, y, Math.round(W * 0.06), Math.max(4, Math.round(W * 0.008)));
    y += Math.round(W * 0.06);
    ctx.fillStyle = ink(theme, settings);
    ctx.font = '800 ' + titleFs + 'px ' + F;
    ctx.fillText('今日提醒', margin, y);
    y += Math.round(titleFs * 1.6);

    var list = (reminders || []).filter(r => !r.done).concat((reminders || []).filter(r => r.done));
    if (!list.length) {
      ctx.fillStyle = subInk(theme, settings);
      ctx.font = '400 ' + Math.round(W * 0.028) + 'px ' + F;
      ctx.fillText('今天还没有提醒事项', margin, y);
      return;
    }
    var fs = Math.round(W * 0.032);
    var lh = Math.round(fs * 1.9);
    var max = Math.min(list.length, Math.floor((H - y - margin * 2) / lh));
    for (var i = 0; i < max; i++) {
      var r = list[i];
      var box = Math.round(fs * 0.95);
      ctx.strokeStyle = subInk(theme, settings); ctx.lineWidth = Math.max(1.5, W * 0.0015);
      ctx.strokeRect(margin, y + Math.round(fs * 0.15), box, box);
      if (r.done) {
        ctx.strokeStyle = theme.accent;
        ctx.beginPath();
        ctx.moveTo(margin + box * 0.15, y + fs * 0.15 + box * 0.5);
        ctx.lineTo(margin + box * 0.42, y + fs * 0.15 + box * 0.78);
        ctx.lineTo(margin + box * 0.88, y + fs * 0.15 + box * 0.18);
        ctx.stroke();
      }
      ctx.fillStyle = r.done ? subInk(theme, settings) : ink(theme, settings);
      var label = r.text;
      if (r.time) {
        var mins = minutesUntilFn ? minutesUntilFn(r.time) : null;
        label += ' · ' + r.time;
        if (mins != null && mins >= 0) label += ' (' + mins + '分钟后)';
      }
      ctx.font = '500 ' + fs + 'px ' + F;
      ctx.fillText(label, margin + box + Math.round(fs * 0.7), y, W - margin * 2 - box);
      y += lh;
    }
  }

  /* Main dispatcher. page: 'words' | 'reminders'. layout applies to 'words'. */
  function draw(ctx, opts) {
    var page = opts.page || 'words';
    if (page === 'reminders') {
      renderReminderPage(ctx, opts.width, opts.height, opts.theme, opts.reminders, opts.settings, opts.dateStr, opts.minutesUntil);
    } else if (opts.layout === 'poster') {
      renderPoster(ctx, opts.width, opts.height, opts.theme, opts.words, opts.reminders, opts.settings, opts.dateStr, opts.minutesUntil);
    } else {
      renderGroup(ctx, opts.width, opts.height, opts.theme, opts.words, opts.reminders, opts.settings, opts.dateStr, opts.minutesUntil);
    }
  }

  /* Browser convenience: render to a canvas element. */
  function render(opts) {
    var canvas = document.createElement('canvas');
    canvas.width = opts.width; canvas.height = opts.height;
    draw(canvas.getContext('2d'), opts);
    return canvas;
  }
  function toPNG(canvas) { return canvas.toDataURL('image/png'); }

  var api = { draw: draw, render: render, toPNG: toPNG, FONT_STACK: FONT_STACKS.hei, FONT_STACKS: FONT_STACKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node companion
  global.Render = api;
})(typeof window !== 'undefined' ? window : globalThis);
