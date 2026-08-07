/* app.js — UI wiring: settings panel, preview, download, live mode, desktop
 * companion. Friendly/cartoon UI. IIFE -> `App`. */
(function () {
  'use strict';

  const SIZES = {
    'phone-1080x2400': { w: 1080, h: 2400, label: '📱 手机 · 1080×2400' },
    'phone-1170x2532': { w: 1170, h: 2532, label: '📱 iPhone · 1170×2532' },
    'phone-1080x1920': { w: 1080, h: 1920, label: '📱 手机 · 1080×1920' },
    'desktop-1920x1080': { w: 1920, h: 1080, label: '🖥️ 电脑 · 1920×1080' },
    'desktop-2560x1440': { w: 2560, h: 1440, label: '🖥️ 电脑 · 2560×1440 (2K)' },
    'desktop-3840x2160': { w: 3840, h: 2160, label: '🖥️ 电脑 · 3840×2160 (4K)' },
    'pad-2048x2732': { w: 2048, h: 2732, label: '📲 平板 · 2048×2732' },
    'custom': { w: 1080, h: 1920, label: '✏️ 自定义尺寸' },
  };

  const THEMES = {
    cream:  { name: '奶油', bg: '#fdf6ec', bg2: '#f7e8d4', ink: '#4a3b2e', sub: '#a08a73', accent: '#e8834a', accentSoft: '#fbe0c8', line: 'rgba(74,59,46,0.12)', patternInk: '#d9b48f', blob: true },
    mint:   { name: '薄荷', bg: '#eafaf1', bg2: '#d3f2e0', ink: '#1f4536', sub: '#6f9a87', accent: '#2fae7d', accentSoft: '#c0ecd8', line: 'rgba(31,69,54,0.12)', patternInk: '#9ed9bd', blob: true },
    sky:    { name: '天空', bg: '#e8f4fd', bg2: '#d3e9fb', ink: '#1e3a52', sub: '#6f8ba3', accent: '#3b8fd9', accentSoft: '#c2e0f7', line: 'rgba(30,58,82,0.12)', patternInk: '#a4cdec', blob: true },
    sakura: { name: '樱花', bg: '#fdeef2', bg2: '#fadde6', ink: '#57222f', sub: '#a97584', accent: '#e2678a', accentSoft: '#f7c9d8', line: 'rgba(87,34,47,0.12)', patternInk: '#efadC0', blob: true },
    night:  { name: '夜空', bg: '#151a2e', bg2: '#1f2745', ink: '#eef1f8', sub: '#8b95b3', accent: '#7aa2f7', accentSoft: '#2a3358', line: 'rgba(238,241,248,0.14)', patternInk: '#3a4670', blob: true },
    forest: { name: '森林', bg: '#12211c', bg2: '#1c332a', ink: '#e8f0ea', sub: '#8fae9f', accent: '#5ec99a', accentSoft: '#234534', line: 'rgba(232,240,234,0.12)', patternInk: '#2e5040', blob: true },
  };

  const LIBRARIES = [
    { id: 'chuzhong', icon: '🎒', name: '初中', desc: '中考核心词汇', file: 'words_chuzhong.json' },
    { id: 'gaozhong', icon: '✏️', name: '高中', desc: '高考核心词汇', file: 'words_gaozhong.json' },
    { id: 'cet4', icon: '📗', name: '四级 CET4', desc: '大学英语四级', file: 'words_cet4.json' },
    { id: 'cet6', icon: '📘', name: '六级 CET6', desc: '大学英语六级', file: 'words_cet6.json' },
    { id: 'kaoyan', icon: '📕', name: '考研', desc: '考研英语核心', file: 'words_kaoyan.json' },
    { id: 'ielts', icon: '🎓', name: '雅思 IELTS', desc: '出国考试核心词', file: 'words_ielts.json' },
    { id: 'toefl', icon: '🌍', name: '托福 TOEFL', desc: '托福核心词汇', file: 'words_toefl.json' },
    { id: 'gre', icon: '🗽', name: 'GRE', desc: '出国读研核心', file: 'words_gre.json' },
    { id: 'custom', icon: '✨', name: '我的词库', desc: '自己导入的单词', file: null },
  ];

  const BG_PATTERNS = [
    { id: 'soft', name: '柔光', icon: '🌤️' },
    { id: 'blobs', name: '光斑', icon: '🫧' },
    { id: 'dots', name: '圆点', icon: '🟤' },
    { id: 'grid', name: '方格', icon: '🔲' },
    { id: 'diag', name: '斜纹', icon: '◹' },
    { id: 'waves', name: '波浪', icon: '〰️' },
    { id: 'none', name: '纯色', icon: '⬜' },
  ];

  let settings = null;
  let currentCanvas = null;
  let liveTimer = null;
  let clockTimer = null;
  let cycleTimer = null;
  let cyclePage = 'words';
  let libCounts = {};
  let bgImageEl = null; // decoded Image for settings.bgImage (dataURL), kept out of the settings object

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function loadSettings() { settings = window.Store.getSettings(); }
  function saveSettings() { window.Store.saveSettings(settings); }

  /* ---------- settings -> UI ---------- */
  function applySettingsToUI() {
    $('#sel-size').value = settings.size;
    $('#sel-order').value = settings.order;
    $('#inp-count').value = settings.wordsPerGroup;
    $('#inp-rotate-min').value = settings.rotateMinutes;
    $('#inp-cycle-sec').value = settings.cycleSeconds;
    $('#inp-anti-ms').value = settings.antiTouchMs;
    $('#chk-daily').checked = settings.autoRefreshDaily;
    $('#chk-rotate').checked = settings.rotateEnabled;
    $('#chk-cycle').checked = settings.cycleEnabled;
    $('#chk-phonetic').checked = settings.showPhonetic;
    $('#chk-example').checked = settings.showExample;
    $('#chk-reminders').checked = settings.showReminders;
    $('#chk-antitouch').checked = settings.antiTouch;
    $('#chk-custom').checked = settings.custom.enabled;
    $('#inp-custom-title').value = settings.custom.title;
    $('#inp-custom-footer').value = settings.custom.footer;
    settings.custom.pos = settings.custom.pos || {};
    // typography
    $('#rng-fontscale').value = settings.fontScale;
    $('#sel-weight').value = settings.fontWeight;
    $('#sel-fontstyle').value = settings.fontStyle || 'hei';
    $('#rng-spacing').value = settings.letterSpacing;
    $('#rng-lineheight').value = settings.lineHeight;
    updateTypoLabels();
    renderInkPicker();
    applyBgPhotoUI();
    // anchors
    $$('#anchor-words .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.anchor === settings.anchorWords));
    $$('#anchor-reminders .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.anchor === settings.anchorReminders));
    $('#custom-size-row').hidden = settings.size !== 'custom';
    if (settings.size === 'custom') { $('#inp-cw').value = settings.customW || 1080; $('#inp-ch').value = settings.customH || 1920; }
    $$('#layout-switch .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.layout === settings.layout));
    renderLibraryCards();
    renderThemeSwatches();
    renderPatternPicker();
    syncDependentUI();
  }

  function updateTypoLabels() {
    $('#fontscale-val').textContent = Math.round(settings.fontScale * 100) + '%';
    $('#spacing-val').textContent = settings.letterSpacing + 'px';
    $('#lineheight-val').textContent = Math.round(settings.lineHeight * 100) + '%';
  }

  function syncDependentUI() {
    $('#count-row').style.display = settings.layout === 'poster' ? 'none' : '';
    $('#rotate-min-row').style.display = settings.rotateEnabled ? '' : 'none';
    $('#cycle-sec-row').style.display = settings.cycleEnabled ? '' : 'none';
    $('#anti-ms-row').style.display = settings.antiTouch ? '' : 'none';
    $('#custom-fields').style.display = settings.custom.enabled ? '' : 'none';
  }

  function bindControls() {
    $('#sel-size').addEventListener('change', e => { settings.size = e.target.value; $('#custom-size-row').hidden = settings.size !== 'custom'; commit(); });
    $('#inp-cw').addEventListener('change', e => { settings.customW = clampInt(e.target.value, 100, 8000, 1080); commit(); });
    $('#inp-ch').addEventListener('change', e => { settings.customH = clampInt(e.target.value, 100, 8000, 1920); commit(); });
    $('#sel-order').addEventListener('change', e => { settings.order = e.target.value; commit(); });
    $('#inp-count').addEventListener('change', e => { settings.wordsPerGroup = clampInt(e.target.value, 1, 12, 6); commit(); });
    $('#chk-daily').addEventListener('change', e => { settings.autoRefreshDaily = e.target.checked; commit(); });
    $('#chk-rotate').addEventListener('change', e => { settings.rotateEnabled = e.target.checked; syncDependentUI(); commit(); });
    $('#inp-rotate-min').addEventListener('change', e => { settings.rotateMinutes = clampInt(e.target.value, 1, 720, 30); commit(); });
    $('#chk-cycle').addEventListener('change', e => { settings.cycleEnabled = e.target.checked; syncDependentUI(); commit(); });
    $('#inp-cycle-sec').addEventListener('change', e => { settings.cycleSeconds = clampInt(e.target.value, 5, 3600, 120); commit(); });
    $('#chk-phonetic').addEventListener('change', e => { settings.showPhonetic = e.target.checked; commit(); });
    $('#chk-example').addEventListener('change', e => { settings.showExample = e.target.checked; commit(); });
    $('#chk-reminders').addEventListener('change', e => { settings.showReminders = e.target.checked; commit(); });
    $('#chk-antitouch').addEventListener('change', e => { settings.antiTouch = e.target.checked; syncDependentUI(); commit(); });
    $('#inp-anti-ms').addEventListener('change', e => { settings.antiTouchMs = clampInt(e.target.value, 300, 5000, 1200); commit(); });
    $('#chk-custom').addEventListener('change', e => { settings.custom.enabled = e.target.checked; syncDependentUI(); commit(); });
    $('#inp-custom-title').addEventListener('input', e => { settings.custom.title = e.target.value; commit(true); });
    $('#inp-custom-footer').addEventListener('input', e => { settings.custom.footer = e.target.value; commit(true); });

    // typography
    $('#rng-fontscale').addEventListener('input', e => { settings.fontScale = Number(e.target.value); updateTypoLabels(); commit(true); });
    $('#sel-weight').addEventListener('change', e => { settings.fontWeight = Number(e.target.value); commit(); });
    $('#sel-fontstyle').addEventListener('change', e => { settings.fontStyle = e.target.value; commit(); });
    $('#rng-spacing').addEventListener('input', e => { settings.letterSpacing = Number(e.target.value); updateTypoLabels(); commit(true); });
    $('#rng-lineheight').addEventListener('input', e => { settings.lineHeight = Number(e.target.value); updateTypoLabels(); commit(true); });

    // anchors
    $$('#anchor-words .seg-btn').forEach(b => b.addEventListener('click', () => { settings.anchorWords = b.dataset.anchor; $$('#anchor-words .seg-btn').forEach(x => x.classList.toggle('on', x === b)); commit(); }));
    $$('#anchor-reminders .seg-btn').forEach(b => b.addEventListener('click', () => { settings.anchorReminders = b.dataset.anchor; $$('#anchor-reminders .seg-btn').forEach(x => x.classList.toggle('on', x === b)); commit(); }));
    $('#btn-reset-layout').addEventListener('click', () => {
      settings.offWords = { x: 0, y: 0 }; settings.offReminders = { x: 0, y: 0 };
      settings.anchorWords = 'center'; settings.anchorReminders = 'bottom';
      settings.custom.pos = {};
      applySettingsToUI(); commit(); toast('布局已复位');
    });

    $$('#layout-switch .seg-btn').forEach(b => b.addEventListener('click', () => {
      settings.layout = b.dataset.layout;
      $$('#layout-switch .seg-btn').forEach(x => x.classList.toggle('on', x === b));
      syncDependentUI(); commit();
    }));

    $('#btn-refresh').addEventListener('click', async () => { await refresh(true); toast('换了一组新单词 ✨'); });
    $('#btn-download').addEventListener('click', downloadPNG);
    $('#btn-live').addEventListener('click', enterLive);
    $('#btn-exit-live').addEventListener('click', exitLive);
    $('#btn-set-wallpaper').addEventListener('click', setDesktopWallpaper);
    $('#btn-companion').addEventListener('click', enableCompanion);
    const dl = $('#btn-companion-dl');
    if (dl) dl.addEventListener('click', e => { e.preventDefault(); downloadCompanion(); });

    syncCompanionButton();

    bindImport();
    bindReminders();
    bindBgPhoto();
    bindDrag();
  }

  function clampInt(v, min, max, dflt) { const n = parseInt(v, 10); return isNaN(n) ? dflt : Math.max(min, Math.min(max, n)); }

  let commitTimer = null;
  function commit(light) {
    saveSettings();
    if (light) { clearTimeout(commitTimer); commitTimer = setTimeout(() => refresh(false), 200); }
    else refresh(false);
  }

  /* ---------- library cards ---------- */
  function renderLibraryCards() {
    const box = $('#library-cards');
    box.innerHTML = '';
    LIBRARIES.forEach(lib => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'lib-card' + (lib.id === settings.library ? ' on' : '');
      const count = lib.id === 'custom' ? window.Store.getCustomWords().length : (libCounts[lib.id] || '…');
      card.innerHTML = `<span class="lib-icon">${lib.icon}</span>
        <span class="lib-body"><b>${lib.name}</b><i>${lib.desc}</i></span>
        <span class="lib-count">${count}词</span>`;
      card.addEventListener('click', () => {
        settings.library = lib.id;
        renderLibraryCards();
        syncDependentUI();
        commit();
      });
      box.appendChild(card);
    });
  }

  function loadLibraryCounts() {
    LIBRARIES.filter(l => l.file).forEach(lib => {
      fetch('data/' + lib.file).then(r => r.json()).then(a => {
        libCounts[lib.id] = a.length;
        if (settings.library === lib.id || true) renderLibraryCards();
      }).catch(() => { libCounts[lib.id] = '?'; });
    });
  }

  /* ---------- theme + pattern pickers ---------- */
  function renderThemeSwatches() {
    const box = $('#theme-swatches');
    box.innerHTML = '';
    Object.entries(THEMES).forEach(([key, t]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (key === settings.theme ? ' on' : '');
      b.title = t.name;
      b.style.background = `linear-gradient(135deg, ${t.bg} 0%, ${t.accentSoft} 60%, ${t.accent} 100%)`;
      b.innerHTML = `<span>${t.name}</span>`;
      b.addEventListener('click', () => { settings.theme = key; renderThemeSwatches(); commit(); });
      box.appendChild(b);
    });
  }

  function renderPatternPicker() {
    const box = $('#pattern-picker');
    box.innerHTML = '';
    BG_PATTERNS.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pattern-chip' + (p.id === settings.bgPattern ? ' on' : '');
      b.innerHTML = `${p.icon} ${p.name}`;
      b.addEventListener('click', () => { settings.bgPattern = p.id; renderPatternPicker(); commit(); });
      box.appendChild(b);
    });
  }

  /* ---------- ink (text color) picker ---------- */
  const INK_SWATCHES = ['#4a3b2e', '#1e3a52', '#57222f', '#1f4536', '#2b2b2b', '#5a4a68', '#8a5a2b', '#ffffff'];
  function renderInkPicker() {
    const box = $('#ink-picker');
    if (!box) return;
    box.innerHTML = '';
    // "follow theme" chip
    const auto = document.createElement('button');
    auto.type = 'button';
    auto.className = 'ink-chip auto' + (!settings.inkOverride ? ' on' : '');
    auto.textContent = '跟随主题';
    auto.title = '文字颜色跟随当前主题';
    auto.addEventListener('click', () => { settings.inkOverride = ''; renderInkPicker(); commit(); });
    box.appendChild(auto);
    INK_SWATCHES.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ink-chip sw' + (settings.inkOverride === c ? ' on' : '');
      b.style.background = c;
      b.title = c;
      b.addEventListener('click', () => { settings.inkOverride = c; renderInkPicker(); commit(); });
      box.appendChild(b);
    });
    // free color input
    const wrap = document.createElement('label');
    wrap.className = 'ink-chip custom' + (settings.inkOverride && !INK_SWATCHES.includes(settings.inkOverride) ? ' on' : '');
    wrap.title = '自定义颜色';
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = /^#[0-9a-fA-F]{6}$/.test(settings.inkOverride || '') ? settings.inkOverride : '#4a3b2e';
    inp.addEventListener('input', e => { settings.inkOverride = e.target.value; commit(true); });
    inp.addEventListener('change', () => renderInkPicker());
    wrap.appendChild(inp);
    const plus = document.createElement('span'); plus.textContent = '🎨';
    wrap.appendChild(plus);
    box.appendChild(wrap);
  }

  /* ---------- custom background photo ---------- */
  function bindBgPhoto() {
    const file = $('#file-bgphoto');
    if (!file) return;
    file.addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { setBgImage(reader.result); };
      reader.onerror = () => toast('读取照片失败');
      reader.readAsDataURL(f);
      file.value = '';
    });
    $('#btn-bgphoto-clear').addEventListener('click', () => { setBgImage(null); toast('已换回主题背景'); });
    $('#rng-bgscrim').addEventListener('input', e => {
      settings.bgScrim = Number(e.target.value);
      $('#bgscrim-val').textContent = Math.round(settings.bgScrim * 100) + '%';
      commit(true);
    });
  }
  function setBgImage(dataUrl) {
    if (!dataUrl) { settings.bgImage = null; bgImageEl = null; applyBgPhotoUI(); commit(); return; }
    const img = new Image();
    img.onload = () => { settings.bgImage = dataUrl; bgImageEl = img; applyBgPhotoUI(); commit(); toast('背景照片已应用 🖼️'); };
    img.onerror = () => toast('这张照片读不出来，换一张试试');
    img.src = dataUrl;
  }
  function applyBgPhotoUI() {
    const has = !!settings.bgImage;
    $('#bgphoto-preview').hidden = !has;
    $('#bgscrim-row').hidden = !has;
    if (has) {
      $('#bgphoto-thumb').src = settings.bgImage;
      $('#rng-bgscrim').value = (settings.bgScrim == null ? 0.42 : settings.bgScrim);
      $('#bgscrim-val').textContent = Math.round((settings.bgScrim == null ? 0.42 : settings.bgScrim) * 100) + '%';
    }
  }
  // Rehydrate the decoded Image on load (settings.bgImage is a dataURL string).
  function loadBgImage() {
    bgImageEl = null;
    if (!settings.bgImage) return;
    const img = new Image();
    img.onload = () => { bgImageEl = img; refresh(false); };
    img.src = settings.bgImage;
  }

  /* ---------- import ---------- */
  function bindImport() {
    const file = $('#file-import');
    file.addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const isImage = /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(f.name) || f.type.startsWith('image/');
      if (isImage) { await importFromImage(f); file.value = ''; return; }
      let words = [];
      try {
        if (ext === 'xlsx' || ext === 'xls') {
          words = window.Importer.parseExcel(await f.arrayBuffer());
        } else {
          const text = await f.text();
          words = ext === 'csv' ? window.Importer.parseCSV(text) : window.Importer.parseText(text);
        }
      } catch (err) { toast('解析失败：' + err.message); }
      if (words.length) addImportedWords(words, '文件'); else toast('没识别到单词，换种格式试试');
      file.value = '';
    });

    // dedicated screenshot/photo button (same pipeline, clearer affordance)
    const shot = $('#file-screenshot');
    shot.addEventListener('change', async e => {
      const f = e.target.files[0];
      if (f) await importFromImage(f);
      shot.value = '';
    });

    $('#btn-paste-import').addEventListener('click', () => {
      const words = window.Importer.parseText($('#txt-paste').value);
      if (!words.length) { toast('没识别到单词'); return; }
      addImportedWords(words, '粘贴');
      $('#txt-paste').value = '';
    });

    $('#btn-add-word').addEventListener('click', () => {
      const row = window.Importer.normalizeRow([$('#nw-word').value, $('#nw-phonetic').value, $('#nw-pos').value, $('#nw-meaning').value, $('#nw-example').value]);
      if (!row) { toast('先输入单词'); return; }
      const { merged, added } = window.Importer.merge(window.Store.getCustomWords(), [row]);
      window.Store.saveCustomWords(merged);
      switchToCustom();
      toast(added ? '添加成功 ✓' : '这个词已经在了');
      ['#nw-word', '#nw-phonetic', '#nw-pos', '#nw-meaning', '#nw-example'].forEach(s => { $(s).value = ''; });
      commit();
    });

    $('#btn-clear-custom').addEventListener('click', () => {
      if (!confirm('清空「我的词库」里所有导入的单词？')) return;
      window.Store.saveCustomWords([]);
      renderLibraryCards();
      toast('已清空');
      commit();
    });

    // ready-made pack downloads (sample CSV templates)
    $$('[data-pack]').forEach(btn => btn.addEventListener('click', () => downloadPack(btn.dataset.pack)));
  }

  async function importFromImage(file) {
    toast('正在识别图片里的单词…');
    try {
      const ok = await window.OCR.available();
      if (!ok) { toast('OCR 需要在 Mac 上用桌面伴侣打开本站'); return; }
      const text = await window.OCR.recognize(file);
      const words = window.OCR.textToWords(text);
      if (!words.length) { toast('图片里没认出单词，试试更清晰的截图'); return; }
      addImportedWords(words, '截图');
    } catch (e) {
      toast('识别失败：' + e.message);
    }
  }

  function addImportedWords(words, srcLabel) {
    const { merged, added } = window.Importer.merge(window.Store.getCustomWords(), words);
    window.Store.saveCustomWords(merged);
    switchToCustom();
    toast(`从${srcLabel}导入 ${added} 个单词 ✓（共 ${merged.length}）`);
    commit();
  }

  function switchToCustom() {
    settings.library = 'custom';
    renderLibraryCards();
    syncDependentUI();
  }

  /* sample CSV packs for users to download, fill in, and re-import */
  function downloadPack(kind) {
    let csv = 'word,phonetic,pos,meaning,example\n';
    const samples = {
      template: [['abandon', '/əˈbændən/', 'v.', '放弃；抛弃', 'They had to abandon the plan.'], ['eager', '/ˈiːɡə/', 'adj.', '渴望的；热切的', 'She is eager to learn.']],
      ielts: [['coherent', '/kəʊˈhɪərənt/', 'adj.', '连贯的；条理清楚的', 'He gave a coherent answer.'], ['diverse', '/daɪˈvɜːs/', 'adj.', '多种多样的', 'a diverse range of topics']],
    };
    (samples[kind] || samples.template).forEach(r => { csv += r.join(',') + '\n'; });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (kind === 'ielts' ? 'ielts-sample' : 'word-template') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    toast('模板已下载，填好后拖回来导入');
  }

  /* ---------- reminders ---------- */
  function bindReminders() {
    $('#btn-add-reminder').addEventListener('click', () => {
      window.Reminders.add($('#inp-reminder').value, $('#inp-reminder-time').value);
      $('#inp-reminder').value = ''; $('#inp-reminder-time').value = '';
      renderReminderUI(); commit(true);
    });
    $('#btn-clear-done').addEventListener('click', () => { window.Reminders.clearDone(); renderReminderUI(); commit(true); });
    const presetBox = $('#preset-reminders');
    window.Reminders.PRESETS.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.textContent = '+ ' + p.text;
      chip.addEventListener('click', () => { window.Reminders.addPreset(p); renderReminderUI(); commit(true); });
      presetBox.appendChild(chip);
    });
  }

  function renderReminderUI() {
    const list = window.Reminders.list();
    const box = $('#reminder-list');
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="muted">还没有提醒，点上面的常用项加一条吧～</div>'; return; }
    list.forEach(r => {
      const row = document.createElement('div');
      row.className = 'rem-row' + (r.done ? ' done' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = !!r.done;
      cb.addEventListener('change', () => { window.Reminders.toggle(r.id); renderReminderUI(); commit(true); });
      const label = document.createElement('span');
      label.className = 'rem-text';
      label.textContent = r.text + (r.time ? ' · ' + r.time : '');
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'rem-del'; del.textContent = '×';
      del.addEventListener('click', () => { window.Reminders.remove(r.id); renderReminderUI(); commit(true); });
      row.appendChild(cb); row.appendChild(label); row.appendChild(del);
      box.appendChild(row);
    });
  }

  /* ---------- drag-to-move on preview (free, both axes) ----------
   * Grab the words block, the reminders block, or a custom text block and
   * drag it anywhere. Offsets are stored as fractions of W/H so they survive
   * size changes. Words/reminders use offWords/offReminders (a nudge on top
   * of the chosen anchor); custom text blocks store an absolute pos {x,y}. */
  function bindDrag() {
    const disp = $('#preview-canvas');
    let drag = null; // { kind:'words'|'reminders'|'custom', key?, startX,startY, origX,origY }
    disp.style.touchAction = 'none';
    disp.addEventListener('pointerdown', e => {
      const rect = disp.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const hit = hitTestBlock(fx, fy);
      if (!hit) return;
      drag = { kind: hit.kind, key: hit.key, startX: fx, startY: fy, origX: hit.x, origY: hit.y };
      disp.setPointerCapture(e.pointerId);
      disp.classList.add('grabbing');
      e.preventDefault();
    });
    disp.addEventListener('pointermove', e => {
      if (!drag) return;
      const rect = disp.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const dx = fx - drag.startX, dy = fy - drag.startY;
      if (drag.kind === 'custom') {
        const pos = settings.custom.pos[drag.key] = settings.custom.pos[drag.key] || {};
        pos.x = clamp(drag.origX + dx, 0.02, 0.98);
        pos.y = clamp(drag.origY + dy, 0.02, 0.98);
      } else {
        const off = drag.kind === 'reminders' ? settings.offReminders : settings.offWords;
        off.x = clamp(drag.origX + dx, -0.5, 0.5);
        off.y = clamp(drag.origY + dy, -0.5, 0.5);
      }
      refresh(false);
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      disp.classList.remove('grabbing');
      saveSettings();
      toast('位置已调整，点「复位布局」可还原');
    };
    disp.addEventListener('pointerup', end);
    disp.addEventListener('pointercancel', end);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* Which block (if any) is under the pointer? Returns its kind + current
   * fractional origin so the drag can compute a delta. Mirrors the
   * renderer's band math so the grab feels accurate. */
  function hitTestBlock(fx, fy) {
    // custom text blocks win (they're small and on top)
    if (settings.custom && settings.custom.enabled) {
      const defs = [['title', 0.06], ['footer', 0.9]];
      for (const [key, defY] of defs) {
        const text = settings.custom[key];
        if (!text) continue;
        const pos = (settings.custom.pos && settings.custom.pos[key]) || {};
        const cx = (pos.x != null ? pos.x : 0.5);
        const cy = (pos.y != null ? pos.y : defY);
        if (Math.abs(fx - cx) < 0.16 && Math.abs(fy - cy) < 0.045) return { kind: 'custom', key, x: cx, y: cy };
      }
    }
    const split = remindersSplitY();
    if (fy >= split && window.Reminders.list().length && settings.showReminders) {
      return { kind: 'reminders', x: settings.offReminders.x || 0, y: settings.offReminders.y || 0 };
    }
    return { kind: 'words', x: settings.offWords.x || 0, y: settings.offWords.y || 0 };
  }
  /* Roughly where the reminders block starts (fraction of H), matching the
   * renderer's anchor + nudge so the words/reminders grab split is sensible. */
  function remindersSplitY() {
    const a = settings.anchorReminders || 'bottom';
    const base = a === 'top' ? 0.0 : a === 'center' ? 0.5 : 0.78;
    return clamp(base + (settings.offReminders.y || 0) - 0.06, 0, 1);
  }

  /* ---------- rendering ---------- */
  function getSize() {
    if (settings.size === 'custom') return { w: settings.customW || 1080, h: settings.customH || 1920 };
    const s = SIZES[settings.size] || SIZES['phone-1080x2400'];
    return { w: s.w, h: s.h };
  }

  async function refresh(manual, page) {
    const sel = manual ? await window.Engine.reshuffle(settings) : await window.Engine.current(settings);
    paintSelection(sel, page || 'words', '#preview-canvas');
    if (liveActive) paintLive(page || cyclePage);
    updateMeta(sel);
  }

  function paintSelection(sel, page, canvasSel) {
    const { w, h } = getSize();
    const theme = THEMES[settings.theme] || THEMES.cream;
    const renderSettings = Object.assign({}, settings, { bgImage: bgImageEl });
    currentCanvas = window.Render.render({
      width: w, height: h, layout: settings.layout, page, theme,
      words: sel.words, reminders: window.Reminders.list(), settings: renderSettings, dateStr: sel.dateStr,
      minutesUntil: t => window.Reminders.minutesUntil(t),
    });
    const disp = $(canvasSel);
    const ctx = disp.getContext('2d');
    disp.width = currentCanvas.width; disp.height = currentCanvas.height;
    ctx.drawImage(currentCanvas, 0, 0);
    const stage = $('#preview-stage');
    const stageW = stage.clientWidth - 24;
    const scale = Math.min(1, stageW / currentCanvas.width);
    disp.style.width = Math.round(currentCanvas.width * scale) + 'px';
    disp.style.height = Math.round(currentCanvas.height * scale) + 'px';
  }

  function updateMeta(sel) {
    const lib = LIBRARIES.find(l => l.id === sel.library);
    const libLabel = lib ? lib.name.replace(/\s.*/, '') : sel.library;
    const { w, h } = getSize();
    $('#meta').textContent = `${sel.dateStr} · ${libLabel} · ${sel.words.length} 个词 · ${w}×${h}`;
  }

  function downloadPNG() {
    if (!currentCanvas) return;
    const { w, h } = getSize();
    const a = document.createElement('a');
    a.download = `wallpaper-${settings.layout}-${w}x${h}-${window.Words.dateKey(new Date())}.png`;
    a.href = window.Render.toPNG(currentCanvas);
    document.body.appendChild(a); a.click(); a.remove();
    toast('PNG 已下载，去设为壁纸吧 🖼️');
  }

  /* ---------- desktop companion ---------- */
  async function setDesktopWallpaper() {
    try {
      const r = await fetch('set-wallpaper.php', { method: 'HEAD' });
      if (!r.ok) throw new Error('no');
    } catch { toast('需要用桌面伴侣打开本站才能直改壁纸'); return; }
    if (!currentCanvas) return;
    toast('正在把当前壁纸设到桌面…');
    const blob = await new Promise(res => currentCanvas.toBlob(res, 'image/png'));
    const fd = new FormData();
    fd.append('image', blob, 'wallpaper.png');
    const resp = await fetch('set-wallpaper.php', { method: 'POST', body: fd });
    if (resp.ok) toast('已设为 Mac 桌面壁纸 ✓'); else toast('设置失败');
  }

  function downloadCompanion() {
    // fallback for when the site isn't running on the user's own Mac: a zip with
    // a double-clickable launcher. 解压 → 双击「启动伴侣.command」。
    toast('正在打包… 解压后双击「启动伴侣.command」就能用');
    window.location.href = 'companion.zip';
  }

  /* 一键启用：告诉本机 server 直接把桌面伴侣拉起来（零下载、零解压、零双击）。
   * 如果页面本身由 companion 提供（说明它已在跑），或 /companion/start 探测到它，
   * 按钮就只显示"运行中"。*/
  async function enableCompanion() {
    const btn = $('#btn-companion');
    btn.disabled = true;
    try {
      const resp = await fetch('companion/start', { method: 'POST' });
      const j = await resp.json();
      if (!j.ok) { toast('启动失败：' + (j.error || '未知错误')); return; }
      if (j.already) toast('桌面伴侣已在运行 ✓');
      else toast('桌面伴侣已启动 ✓ 桌面壁纸已换好，角落的小窗也开了');
      syncCompanionButton();
    } catch (e) {
      toast('启动失败：' + e.message + '（请用 node server.js 打开本站）');
    } finally {
      btn.disabled = false;
    }
  }

  function syncCompanionButton() {
    const btn = $('#btn-companion');
    fetch('status.json').then(r => r.ok ? r.json() : Promise.reject()).then(j => {
      if (j && j.config) { btn.textContent = '✅ 桌面伴侣运行中'; btn.disabled = true; }
    }).catch(() => {});
  }

  /* ---------- live (interactive) mode ---------- */
  let liveActive = false;
  function enterLive() {
    liveActive = true;
    cyclePage = 'words';
    document.body.classList.add('live');
    $('#live-overlay').hidden = false;
    paintLive('words');
    scheduleLiveRefresh();
    startClock();
    setupAntiTouch();
    setupCycle();
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }
  function exitLive() {
    liveActive = false;
    document.body.classList.remove('live');
    $('#live-overlay').hidden = true;
    clearTimeout(liveTimer); clearInterval(clockTimer); clearInterval(cycleTimer);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  function paintLive(page) {
    const live = $('#live-canvas');
    if (!currentCanvas) { if (!liveActive) return; }
    const { w, h } = getSize();
    const theme = THEMES[settings.theme] || THEMES.cream;
    window.Engine.current(settings).then(sel => {
      const renderSettings = Object.assign({}, settings, { bgImage: bgImageEl });
      const c = window.Render.render({
        width: w, height: h, layout: settings.layout, page, theme,
        words: sel.words, reminders: window.Reminders.list(), settings: renderSettings, dateStr: sel.dateStr,
        minutesUntil: t => window.Reminders.minutesUntil(t),
      });
      live.width = c.width; live.height = c.height;
      live.getContext('2d').drawImage(c, 0, 0);
      const vw = window.innerWidth, vh = window.innerHeight;
      const scale = Math.max(vw / live.width, vh / live.height);
      live.style.width = Math.round(live.width * scale) + 'px';
      live.style.height = Math.round(live.height * scale) + 'px';
      // fade transition
      live.classList.remove('fade'); void live.offsetWidth; live.classList.add('fade');
    });
  }

  function setupCycle() {
    clearInterval(cycleTimer);
    if (!settings.cycleEnabled) return;
    cycleTimer = setInterval(() => {
      cyclePage = cyclePage === 'words' ? 'reminders' : 'words';
      paintLive(cyclePage);
    }, Math.max(5, settings.cycleSeconds) * 1000);
  }

  function scheduleLiveRefresh() {
    clearTimeout(liveTimer);
    if (settings.rotateEnabled) liveTimer = setTimeout(() => { refresh(false); scheduleLiveRefresh(); }, Math.max(1, settings.rotateMinutes) * 60000);
    const now = new Date(); const next = new Date(now);
    next.setHours(24, 0, 5, 0);
    setTimeout(() => { if (liveActive) { refresh(false); scheduleLiveRefresh(); } }, next.getTime() - now.getTime());
  }

  function startClock() {
    clearInterval(clockTimer);
    clockTimer = setInterval(() => { if (cyclePage === 'words') paintLive('words'); }, 30000);
  }

  function setupAntiTouch() {
    const overlay = $('#live-overlay');
    const peek = $('#live-peek');
    let pressTimer = null;
    function showPeek() {
      const list = window.Reminders.list().filter(r => !r.done);
      peek.innerHTML = '<div class="peek-title">今日提醒</div>' +
        (list.length ? list.map(r => `<div class="peek-item">· ${escapeHtml(r.text)}${r.time ? ' · ' + r.time : ''}</div>`).join('') : '<div class="peek-item muted">无</div>');
      peek.hidden = false;
      clearTimeout(peek._t);
      peek._t = setTimeout(() => { peek.hidden = true; }, 3500);
    }
    overlay.onpointerdown = e => {
      if (e.target.id === 'btn-exit-live') return;
      if (!settings.antiTouch) { showPeek(); return; }
      showUnlockProgress(true);
      pressTimer = setTimeout(() => { showUnlockProgress(false); showPeek(); }, settings.antiTouchMs);
    };
    overlay.onpointerup = overlay.onpointercancel = overlay.onpointerleave = () => { clearTimeout(pressTimer); showUnlockProgress(false); };
    $('#btn-exit-live').onclick = exitLive;
  }

  function showUnlockProgress(on) {
    const ring = $('#unlock-ring');
    ring.hidden = !on;
    if (on) { ring.classList.remove('anim'); void ring.offsetWidth; ring.style.setProperty('--ms', settings.antiTouchMs + 'ms'); ring.classList.add('anim'); }
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function seedOnce() {
    if (window.Store.getSeeded()) return;
    window.Reminders.save([
      { id: 'r1', text: '背单词 30 分钟', time: '08:00', done: false },
      { id: 'r2', text: '喝水 8 杯', time: '', done: false },
      { id: 'r3', text: '23:00 前睡觉', time: '23:00', done: false },
    ]);
    window.Store.setSeeded();
  }

  function fillSizeSelect() {
    const sel = $('#sel-size');
    Object.entries(SIZES).forEach(([key, s]) => {
      const o = document.createElement('option');
      o.value = key; o.textContent = s.label;
      sel.appendChild(o);
    });
  }

  async function init() {
    loadSettings();
    seedOnce();
    fillSizeSelect();
    applySettingsToUI();
    bindControls();
    renderReminderUI();
    loadLibraryCounts();
    loadBgImage();
    await refresh(false);
    window.Engine.markDay();
    window.addEventListener('resize', () => { if (!liveActive) paintSelectionDebounced(); else paintLive(cyclePage); });
    setInterval(async () => {
      if (settings.autoRefreshDaily && window.Engine.isNewDay()) { await refresh(false); window.Engine.markDay(); }
    }, 60000);
  }
  let resizeT = null;
  function paintSelectionDebounced() { clearTimeout(resizeT); resizeT = setTimeout(() => refresh(false), 150); }

  window.App = { init, refresh, SIZES, THEMES, LIBRARIES };
  document.addEventListener('DOMContentLoaded', init);
})();
