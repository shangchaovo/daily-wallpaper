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
    cream:  { name: '奶油', bg: '#fff6ea', bg2: '#ffe9d0', ink: '#4a3b2e', sub: '#a68e75', accent: '#ff9d5c', accentSoft: '#ffe0c2', line: 'rgba(74,59,46,0.10)', patternInk: '#eec9a3', blob: true },
    mint:   { name: '薄荷', bg: '#effcf4', bg2: '#dcf6e6', ink: '#1f4536', sub: '#74a08c', accent: '#41c189', accentSoft: '#cdf0de', line: 'rgba(31,69,54,0.10)', patternInk: '#abe3c6', blob: true },
    sky:    { name: '天空', bg: '#eef7fe', bg2: '#dcedfc', ink: '#1e3a52', sub: '#7490a8', accent: '#4f9fe0', accentSoft: '#cfe7fa', line: 'rgba(30,58,82,0.10)', patternInk: '#b0d6f0', blob: true },
    sakura: { name: '樱花', bg: '#fff1f5', bg2: '#fde3ea', ink: '#57222f', sub: '#ae7d8b', accent: '#f1789b', accentSoft: '#fad3de', line: 'rgba(87,34,47,0.10)', patternInk: '#f3b6c7', blob: true },
    night:  { name: '夜空', bg: '#151a2e', bg2: '#1f2745', ink: '#eef1f8', sub: '#8b95b3', accent: '#7aa2f7', accentSoft: '#2a3358', line: 'rgba(238,241,248,0.14)', patternInk: '#3a4670', blob: true },
    forest: { name: '森林', bg: '#12211c', bg2: '#1c332a', ink: '#e8f0ea', sub: '#8fae9f', accent: '#5ec99a', accentSoft: '#234534', line: 'rgba(232,240,234,0.12)', patternInk: '#2e5040', blob: true },
  };

  const LIBRARIES = [
    { id: 'jlpt_n5', icon: 'あ', name: '日语 JLPT N5', desc: '入门核心词（718）', file: 'words_jlpt_n5.json', source: 'JLPT N5 分级 · 开放词表整理' },
    { id: 'jlpt_n4', icon: '日', name: '日语 JLPT N4', desc: '初级进阶词（668）', file: 'words_jlpt_n4.json', source: 'JLPT N4 分级 · 开放词表整理' },
    { id: 'cet4', icon: '📗', name: '四级', desc: 'CET4 核心词', file: 'words_cet4.json' },
    { id: 'cet6', icon: '📘', name: '六级', desc: 'CET6 核心词', file: 'words_cet6.json' },
    { id: 'kaoyan', icon: '📕', name: '考研', desc: '考研核心词', file: 'words_kaoyan.json' },
    { id: 'ielts', icon: '🎓', name: '雅思', desc: 'IELTS 核心词', file: 'words_ielts.json' },
    { id: 'toefl', icon: '🌍', name: '托福', desc: 'TOEFL 核心词', file: 'words_toefl.json' },
    { id: 'gre', icon: '🗽', name: 'GRE', desc: 'GRE 核心词', file: 'words_gre.json' },
    { id: 'custom', icon: '✨', name: '我的词库', desc: '自己导入的词', file: null },
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
  let dragHl = null;    // {kind:'words'|'reminders'|'custom', key?} while dragging — render.js draws an outline
  let dragFrame = null; // rAF handle: coalesce drag re-renders to one per frame
  let selectedWordIndex = null;
  let wordCells = [];   // renderer 返回的精确单词格，用于“点词即编辑”
  let activeLibraryBrowser = null;
  let activeLibraryWords = [];

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function loadSettings() {
    settings = window.Store.getSettings();
    // Existing users keep a valid library after 初中/高中词书升级为 JLPT 词书。
    if (settings.library === 'chuzhong') settings.library = 'jlpt_n5';
    if (settings.library === 'gaozhong') settings.library = 'jlpt_n4';
  }
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
    if ($('#chk-srs')) $('#chk-srs').checked = settings.srsEnabled !== false;
    $('#chk-antitouch').checked = settings.antiTouch;
    $('#chk-custom').checked = settings.custom.enabled;
    $('#inp-custom-title').value = settings.custom.title;
    $('#inp-custom-footer').value = settings.custom.footer;
    settings.custom.pos = settings.custom.pos || {};
    // typography
    $('#rng-fontscale').value = settings.fontScale;
    $('#inp-fontscale').value = Math.round(settings.fontScale * 100);
    $('#sel-weight').value = settings.fontWeight;
    $('#sel-fontstyle').value = settings.fontStyle || 'hei';
    $('#rng-spacing').value = settings.letterSpacing;
    $('#rng-lineheight').value = settings.lineHeight;
    updateTypoLabels();
    renderInkPicker();
    applyBgPhotoUI();
    // （位置布局预设已移除，拖拽即可）
    $('#custom-size-row').hidden = settings.size !== 'custom';
    if (settings.size === 'custom') { $('#inp-cw').value = settings.customW || 1080; $('#inp-ch').value = settings.customH || 1920; }
    $$('#layout-switch .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.layout === settings.layout));
    renderLibraryCards();
    renderThemeSwatches();
    renderPatternPicker();
    syncDependentUI();
  }

  function updateTypoLabels() {
    const fs = $('#inp-fontscale'); if (fs) fs.value = Math.round(settings.fontScale * 100);
    $('#spacing-val').textContent = settings.letterSpacing + 'px';
    $('#lineheight-val').textContent = Math.round(settings.lineHeight * 100) + '%';
    const cv = $('#count-val'); if (cv) cv.textContent = settings.wordsPerGroup + ' 词';
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
    $('#inp-count').addEventListener('input', e => {
      if (e.target.value === '') return;
      settings.wordsPerGroup = normalizeWordCount(e.target.value);
      e.target.value = settings.wordsPerGroup;
      updateTypoLabels(); commit(true);
    });
    $('#inp-count').addEventListener('change', e => {
      if (e.target.value !== '') return;
      e.target.value = settings.wordsPerGroup;
    });
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
    // 记忆复习 (SRS)
    const chkSrs = $('#chk-srs');
    if (chkSrs) chkSrs.addEventListener('change', e => { settings.srsEnabled = e.target.checked; updateSrsUI(); commit(); });
    const btnLearned = $('#btn-learned');
    if (btnLearned) btnLearned.addEventListener('click', onLearned);
    $('#inp-custom-title').addEventListener('input', e => { settings.custom.title = e.target.value; commit(true); });
    $('#inp-custom-footer').addEventListener('input', e => { settings.custom.footer = e.target.value; commit(true); });

    // typography
    const setFontScale = value => {
      settings.fontScale = clampNumber(value, 0.7, 1.7, 1);
      $('#rng-fontscale').value = settings.fontScale;
      updateTypoLabels(); commit(true);
    };
    $('#rng-fontscale').addEventListener('input', e => setFontScale(Number(e.target.value)));
    $('#inp-fontscale').addEventListener('input', e => {
      if (e.target.value !== '') setFontScale(Number(e.target.value) / 100);
    });
    $('#inp-fontscale').addEventListener('change', e => {
      if (e.target.value === '') e.target.value = Math.round(settings.fontScale * 100);
    });
    $('#sel-weight').addEventListener('change', e => { settings.fontWeight = Number(e.target.value); commit(); });
    $('#sel-fontstyle').addEventListener('change', e => { settings.fontStyle = e.target.value; commit(); });
    $('#rng-spacing').addEventListener('input', e => { settings.letterSpacing = Number(e.target.value); updateTypoLabels(); commit(true); });
    $('#rng-lineheight').addEventListener('input', e => { settings.lineHeight = Number(e.target.value); updateTypoLabels(); commit(true); });

    // （位置布局预设已移除，拖拽即可）

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
    // preview meta-bar duplicates (快速出壁纸，滚到中部也能直接操作)
    const r2 = $('#btn-refresh2'); if (r2) r2.addEventListener('click', async () => { await refresh(true); toast('换了一组新单词 ✨'); });
    const d2 = $('#btn-download2'); if (d2) d2.addEventListener('click', downloadPNG);
    const w2 = $('#btn-set-wallpaper2'); if (w2) w2.addEventListener('click', setDesktopWallpaper);
    // import modal (button-triggered popup)
    const modal = $('#import-modal');
    const openImport = $('#btn-open-import');
    if (openImport && modal) openImport.addEventListener('click', () => { modal.hidden = false; });
    const closeImport = $('#btn-close-import');
    if (closeImport && modal) closeImport.addEventListener('click', () => { modal.hidden = true; });
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
    const libraryModal = $('#library-modal');
    const closeLibrary = $('#btn-close-library');
    if (closeLibrary && libraryModal) closeLibrary.addEventListener('click', closeLibraryBrowser);
    if (libraryModal) libraryModal.addEventListener('click', e => { if (e.target === libraryModal) closeLibraryBrowser(); });
    const librarySearch = $('#library-search');
    if (librarySearch) librarySearch.addEventListener('input', renderLibraryWordList);
    const markVisibleKnown = $('#btn-mark-visible-known');
    if (markVisibleKnown) markVisibleKnown.addEventListener('click', markVisibleWordsKnown);
    const clearKnown = $('#btn-clear-known');
    if (clearKnown) clearKnown.addEventListener('click', clearLibraryScreening);
    const browseSelected = $('#btn-browse-selected-library');
    if (browseSelected) browseSelected.addEventListener('click', () => {
      const lib = LIBRARIES.find(item => item.id === settings.library);
      if (lib) openLibraryBrowser(lib);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (modal && !modal.hidden) modal.hidden = true;
      if (libraryModal && !libraryModal.hidden) closeLibraryBrowser();
    });
    $('#btn-companion').addEventListener('click', enableCompanion);
    const companionTop = $('#btn-companion-top');
    if (companionTop) companionTop.addEventListener('click', enableCompanion);
    const petBtn = $('#btn-pet-toggle');
    if (petBtn) petBtn.addEventListener('click', togglePet);
    const petPrev = $('#btn-pet-prev');
    if (petPrev) petPrev.addEventListener('click', () => petSwitch(-1));
    const petNext = $('#btn-pet-next');
    if (petNext) petNext.addEventListener('click', () => petSwitch(1));
    const dl = $('#btn-companion-dl');
    if (dl) dl.addEventListener('click', e => { e.preventDefault(); downloadCompanion(); });
    const petDock = $('#btn-pet-dock');
    if (petDock) petDock.addEventListener('click', () => petOn ? togglePet() : enableCompanion());
    const petDockNext = $('#btn-pet-dock-next');
    if (petDockNext) petDockNext.addEventListener('click', () => petSwitch(1));

    syncCompanionButton();

    bindImport();
    bindReminders();
    bindBgPhoto();
    bindWordInspector();
    bindDrag();
  }

  function clampInt(v, min, max, dflt) { const n = parseInt(v, 10); return isNaN(n) ? dflt : Math.max(min, Math.min(max, n)); }
  function clampNumber(v, min, max, dflt) { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt; }
  // 多词采用双列时，偶数能保证每行两张卡、左右列完全均分。
  function normalizeWordCount(v) {
    const count = clampInt(v, 1, 36, 6);
    return count >= 8 && count % 2 ? count - 1 : count;
  }

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
    const selected = LIBRARIES.find(lib => lib.id === settings.library) || LIBRARIES[0];
    const selectedLabel = $('#selected-library-label');
    if (selectedLabel && selected) selectedLabel.textContent = '已选：' + selected.name;
    LIBRARIES.forEach(lib => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'lib-card' + (lib.id === settings.library ? ' on' : '');
      const count = lib.id === 'custom' ? window.Store.getCustomWords().length : (libCounts[lib.id] || '…');
      const countTxt = (typeof count === 'number') ? count.toLocaleString() : count;
      card.innerHTML = `<span class="lib-icon">${lib.icon}</span>
        <span class="lib-body"><b>${lib.name}</b><i>${lib.desc}</i></span>
        <span class="lib-count">${countTxt}词</span>`;
      card.addEventListener('click', () => {
        settings.library = lib.id;
        renderLibraryCards();
        syncDependentUI();
        commit();
        toast('已选中「' + lib.name + '」；可点击“浏览并初筛”查看全部词条');
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

  /* ---------- library browsing + first-pass screening ---------- */
  async function openLibraryBrowser(lib) {
    const modal = $('#library-modal');
    if (!modal) return;
    activeLibraryBrowser = lib;
    activeLibraryWords = [];
    $('#library-modal-title').textContent = lib.name + ' · 全部词条';
    $('#library-modal-source').textContent = lib.source || lib.desc;
    $('#library-search').value = '';
    $('#library-progress').textContent = '正在加载词书…';
    $('#library-word-list').innerHTML = '';
    modal.hidden = false;
    try {
      activeLibraryWords = await window.Words.loadLibrary(lib.id);
      renderLibraryWordList();
      $('#library-search').focus();
    } catch (e) {
      $('#library-progress').textContent = '词书加载失败';
      $('#library-word-list').textContent = '请检查网络或刷新页面后重试。';
    }
  }

  function closeLibraryBrowser() {
    const modal = $('#library-modal');
    if (modal) modal.hidden = true;
  }

  function visibleLibraryWords() {
    const q = ($('#library-search') && $('#library-search').value || '').trim().toLocaleLowerCase();
    if (!q) return activeLibraryWords;
    return activeLibraryWords.filter(word =>
      [word.word, word.phonetic, word.pos, word.meaning, word.example]
        .filter(Boolean).join(' ').toLocaleLowerCase().includes(q)
    );
  }

  function renderLibraryWordList() {
    if (!activeLibraryBrowser) return;
    const box = $('#library-word-list');
    const visible = visibleLibraryWords();
    const known = window.Store.getKnownWords(activeLibraryBrowser.id);
    const remaining = Math.max(0, activeLibraryWords.length - known.size);
    $('#library-progress').textContent = `共 ${activeLibraryWords.length} · 已掌握 ${known.size} · 待学 ${remaining}`;
    box.innerHTML = '';
    if (!visible.length) {
      box.innerHTML = '<p class="empty-library">没有匹配的词条，换个关键词试试。</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    visible.forEach(word => {
      const key = window.Words.wordKey(word);
      const isKnown = known.has(key);
      const item = document.createElement('article');
      item.className = 'library-word' + (isKnown ? ' known' : '');
      const main = document.createElement('div');
      main.className = 'library-word-main';
      const title = document.createElement('b');
      title.textContent = [word.word, word.phonetic].filter(Boolean).join(' ');
      const detail = document.createElement('small');
      detail.textContent = [word.pos, word.meaning].filter(Boolean).join(' · ');
      main.append(title, detail);
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.checked = isKnown;
      checkbox.setAttribute('aria-label', `标记 ${word.word} 为已掌握`);
      checkbox.addEventListener('change', () => {
        window.Store.setKnownWord(activeLibraryBrowser.id, key, checkbox.checked);
        refresh(false);
        renderLibraryCards();
        renderLibraryWordList();
      });
      label.append(checkbox, document.createTextNode('已掌握'));
      item.append(main, label);
      fragment.appendChild(item);
    });
    box.appendChild(fragment);
  }

  function markVisibleWordsKnown() {
    if (!activeLibraryBrowser) return;
    const visible = visibleLibraryWords();
    if (!visible.length) return;
    visible.forEach(word => window.Store.setKnownWord(activeLibraryBrowser.id, window.Words.wordKey(word), true));
    refresh(false);
    renderLibraryCards();
    renderLibraryWordList();
    toast(`已筛除 ${visible.length} 个已掌握词`);
  }

  function clearLibraryScreening() {
    if (!activeLibraryBrowser) return;
    window.Store.clearKnownWords(activeLibraryBrowser.id);
    refresh(false);
    renderLibraryCards();
    renderLibraryWordList();
    toast('已恢复该词书的全部词条');
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
  }
  function setBgImage(dataUrl) {
    if (!dataUrl) { settings.bgImage = null; bgImageEl = null; settings.bgImagePos = { x: 0, y: 0 }; settings.bgImageZoom = 1.14; applyBgPhotoUI(); commit(); return; }
    const img = new Image();
    img.onload = () => { settings.bgImage = dataUrl; settings.bgImagePos = { x: 0, y: 0 }; settings.bgImageZoom = 1.14; bgImageEl = img; applyBgPhotoUI(); commit(); toast('背景照片已应用 · 可向任意方向拖动调整取景'); };
    img.onerror = () => { bgImageEl = null; toast('这张照片读不出来，换一张 PNG、JPG 或 WebP 试试'); };
    img.src = dataUrl;
  }
  function applyBgPhotoUI() {
    const has = !!settings.bgImage;
    $('#bgphoto-preview').hidden = !has;
    const legend = $('#drag-legend'); if (legend) legend.hidden = !has;
    if (has) $('#bgphoto-thumb').src = settings.bgImage;
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
      const rect0 = disp.getBoundingClientRect();
      const fx = (e.clientX - rect0.left) / rect0.width;
      const fy = (e.clientY - rect0.top) / rect0.height;
      const wordIndex = hitTestWord(fx, fy);
      if (wordIndex != null && !e.shiftKey) {
        selectWord(wordIndex);
        e.preventDefault();
        return;
      }
      // 使用照片时，拖动预览空白处调整 cover 裁切位置；按住 Shift 仍可拖动文字/提醒块。
      if (settings.bgImage && bgImageEl && !e.shiftKey) {
        drag = { kind: 'background', startX: fx, startY: fy,
          origX: (settings.bgImagePos && settings.bgImagePos.x) || 0,
          origY: (settings.bgImagePos && settings.bgImagePos.y) || 0 };
        dragHl = { kind: 'background' };
        setDragState('正在移动背景取景');
        disp.setPointerCapture(e.pointerId);
        disp.classList.add('grabbing');
        refresh(false);
        e.preventDefault();
        return;
      }
      const hit = hitTestBlock(fx, fy);
      if (!hit) return;
      dragHl = { kind: hit.kind, key: hit.key };
      setDragState(hit.kind === 'reminders' ? '正在移动提醒' : hit.kind === 'custom' ? '正在移动自定义文字' : '正在移动单词组');
      applyDisplaySize(disp, disp, true); // fit the whole wallpaper into view while dragging
      const rect = disp.getBoundingClientRect();
      drag = { kind: hit.kind, key: hit.key, startX: (e.clientX - rect.left) / rect.width, startY: (e.clientY - rect.top) / rect.height, origX: hit.x, origY: hit.y };
      disp.setPointerCapture(e.pointerId);
      disp.classList.add('grabbing');
      refresh(false);
      e.preventDefault();
    });
    disp.addEventListener('pointermove', e => {
      if (!drag) {
        const rect = disp.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
        const overWord = hitTestWord(fx, fy) != null;
        disp.classList.toggle('drag-photo-ready', !!(settings.bgImage && bgImageEl && !overWord && !e.shiftKey));
        disp.classList.toggle('drag-word-ready', !!e.shiftKey);
        return;
      }
      const rect = disp.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const dx = fx - drag.startX, dy = fy - drag.startY;
      if (drag.kind === 'background') {
        settings.bgImagePos = settings.bgImagePos || { x: 0, y: 0 };
        settings.bgImagePos.x = clamp(drag.origX + dx * 2, -1, 1);
        settings.bgImagePos.y = clamp(drag.origY + dy * 2, -1, 1);
      } else if (drag.kind === 'custom') {
        const pos = settings.custom.pos[drag.key] = settings.custom.pos[drag.key] || {};
        pos.x = clamp(drag.origX + dx, 0.02, 0.98);
        pos.y = clamp(drag.origY + dy, 0.02, 0.98);
      } else {
        const off = drag.kind === 'reminders' ? settings.offReminders : settings.offWords;
        off.x = clamp(drag.origX + dx, -0.5, 0.5);
        off.y = clamp(drag.origY + dy, -1.0, 1.0);
      }
      // coalesce renders to one per animation frame so the drag stays smooth
      if (!dragFrame) dragFrame = requestAnimationFrame(() => { dragFrame = null; refresh(false); });
    });
    const end = () => {
      if (!drag) return;
      const finishedKind = drag.kind;
      drag = null; dragHl = null;
      setDragState('');
      if (dragFrame) { cancelAnimationFrame(dragFrame); dragFrame = null; }
      disp.classList.remove('grabbing');
      refresh(false);
      saveSettings();
      toast(finishedKind === 'background' ? '背景取景已调整' : '位置已调整，点「复位布局」可还原');
    };
    disp.addEventListener('pointerup', end);
    disp.addEventListener('pointercancel', end);
  }
  function setDragState(label) {
    const state = $('#drag-state');
    if (!state) return;
    state.hidden = !label;
    state.textContent = label || '';
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function hitTestWord(fx, fy) {
    for (const cell of wordCells) {
      if (fx >= cell.x && fx <= cell.x + cell.w && fy >= cell.y && fy <= cell.y + cell.h) return cell.index;
    }
    return null;
  }

  function bindWordInspector() {
    const inspector = $('#word-inspector');
    if (!inspector) return;
    const set = (key, value) => updateSelectedWordStyle({ [key]: value });
    const syncScale = e => set('scale', Number(e.target.value));
    // input 用于拖动中的实时反馈；change 兜底部分浏览器只在松手时派发的情况。
    $('#sel-word-scale').addEventListener('input', syncScale);
    $('#sel-word-scale').addEventListener('change', syncScale);
    $('#sel-word-scale-number').addEventListener('input', e => {
      if (e.target.value !== '') set('scale', Math.max(.7, Math.min(1.7, Number(e.target.value) / 100)));
    });
    $('#sel-word-weight').addEventListener('change', e => set('weight', Number(e.target.value)));
    $('#sel-word-font').addEventListener('change', e => set('fontStyle', e.target.value));
    $('#sel-word-color').addEventListener('input', e => set('color', e.target.value));
    $('#btn-reset-word-style').addEventListener('click', () => {
      if (selectedWordIndex == null) return;
      settings.fontScale = 1; settings.fontWeight = 700; settings.fontStyle = 'yuan'; settings.inkOverride = '';
      selectWord(selectedWordIndex); saveSettings(); refresh(false);
    });
  }

  function selectWord(index) {
    if (!lastSel || !lastSel.words || !lastSel.words[index]) return;
    selectedWordIndex = index;
    const word = lastSel.words[index];
    const theme = THEMES[settings.theme] || THEMES.cream;
    $('#word-inspector').hidden = false;
    syncWordScaleAvailability();
    $('#selected-word-label').textContent = word.word;
    $('#sel-word-scale').value = settings.fontScale || 1;
    $('#sel-word-scale-number').value = Math.round((settings.fontScale || 1) * 100);
    $('#sel-word-weight').value = settings.fontWeight || 700;
    $('#sel-word-font').value = settings.fontStyle || 'yuan';
    $('#sel-word-color').value = settings.inkOverride || theme.ink;
    refresh(false);
  }

  // 只有 1–5 个词可以自由强调字号；6 词起由渲染器自动适配。
  // 组数变化时也要即时同步，不能等用户再点一次单词。
  function syncWordScaleAvailability() {
    const inspector = $('#word-inspector');
    if (!inspector || inspector.hidden || !lastSel || !lastSel.words) return;
    const canScaleWords = lastSel.words.length < 6;
    $('#word-scale-control').hidden = !canScaleWords;
    $('#multi-word-scale-note').hidden = canScaleWords;
  }

  function updateSelectedWordStyle(patch) {
    if (selectedWordIndex == null) return;
    // 多词模式采用固定的自动字号；即使有旧滑条事件在队列中，也不能覆盖它。
    if (patch.scale != null && lastSel && lastSel.words && lastSel.words.length >= 6) delete patch.scale;
    if (!Object.keys(patch).length) return;
    if (patch.scale != null) settings.fontScale = patch.scale;
    if (patch.weight != null) settings.fontWeight = patch.weight;
    if (patch.fontStyle != null) settings.fontStyle = patch.fontStyle;
    if (patch.color != null) settings.inkOverride = patch.color;
    if (patch.scale != null) {
      $('#sel-word-scale').value = patch.scale;
      $('#sel-word-scale-number').value = Math.round(patch.scale * 100);
      $('#rng-fontscale').value = patch.scale;
      $('#inp-fontscale').value = Math.round(patch.scale * 100);
    }
    if (patch.weight != null) $('#sel-weight').value = patch.weight;
    if (patch.fontStyle != null) $('#sel-fontstyle').value = patch.fontStyle;
    // 直接编辑画布时不等待侧栏的 200ms 防抖，拖动滑条每一步都立刻重画。
    saveSettings(); refresh(false);
  }

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
    sel.words = mixReviews(sel);
    paintSelection(sel, page || 'words', '#preview-canvas');
    if (liveActive) paintLive(page || cyclePage);
    updateMeta(sel);
    lastSel = sel;
    syncWordScaleAvailability();
    updateSrsUI();
    // 复习组这次被「看过了」→ 推进到下一阶段（下次到期按更长间隔）
    if (sel.words && sel.words._reviewKeys && window.Review) {
      sel.words._reviewKeys.forEach(k => window.Review.advanceStage(settings.library, k));
    }
  }

  /* 把「到期的复习组」混进当前壁纸单词：到期组排前面，新词补足数量。 */
  function mixReviews(sel) {
    if (!settings.srsEnabled || !window.Review) return sel.words;
    const fresh = sel.words || [];
    if (settings.library === 'custom') return fresh;   // 我的词库不排复习
    const count = settings.layout === 'poster' ? 1 : settings.wordsPerGroup;
    let due = window.Review.dueGroups(settings.library).map(g => g.words);
    if (!due.length) return fresh;
    const freshKeys = new Set(fresh.map(w => window.Review.wordKey(w)));
    const known = window.Store.getKnownWords(settings.library);
    const dueWords = [];
    due.forEach(words => words.forEach(w => {
      if (!freshKeys.has(window.Review.wordKey(w)) && !known.has(window.Words.wordKey(w))) dueWords.push(w);
    }));
    if (!dueWords.length) return fresh;
    const mixed = dueWords.slice(0, count);
    mixed._reviewKeys = due.map(ws => window.Review.groupKeyFor(ws));   // 这些组「刚被复习」
    for (const w of fresh) { if (mixed.length >= count) break; mixed.push(w); }
    return mixed;
  }

  /* Scale the preview to fill the stage width normally; while dragging, shrink
   * it to fit the viewport so the WHOLE wallpaper stays visible as the block
   * moves anywhere on a tall canvas. */
  function applyDisplaySize(disp, canvas, fitToScreen) {
    const stage = $('#preview-stage');
    let s = Math.min(1, (stage.clientWidth - 24) / canvas.width);
    // 也让预览高度适配视口：整页一屏看全，不用上下滚动
    const dockH = $('#pet-dock') ? 78 : 0;
    const availH = window.innerHeight - (fitToScreen ? 150 : 195) - dockH;
    if (availH > 120) s = Math.min(s, Math.max(0.14, availH / canvas.height));
    disp.style.width = Math.round(canvas.width * s) + 'px';
    disp.style.height = Math.round(canvas.height * s) + 'px';
    return s;
  }

  function paintSelection(sel, page, canvasSel) {
    const { w, h } = getSize();
    const theme = THEMES[settings.theme] || THEMES.cream;
    const renderSettings = Object.assign({}, settings, { bgImage: bgImageEl, hl: dragHl, selectedWordIndex });
    currentCanvas = window.Render.render({
      width: w, height: h, layout: settings.layout, page, theme,
      words: sel.words, reminders: window.Reminders.list(), settings: renderSettings, dateStr: sel.dateStr,
      minutesUntil: t => window.Reminders.minutesUntil(t),
    });
    wordCells = renderSettings.wordCells || [];
    const disp = $(canvasSel);
    const ctx = disp.getContext('2d');
    disp.width = currentCanvas.width; disp.height = currentCanvas.height;
    ctx.drawImage(currentCanvas, 0, 0);
    applyDisplaySize(disp, currentCanvas, !!dragHl);
  }

  function updateMeta(sel) {
    const lib = LIBRARIES.find(l => l.id === sel.library);
    const libLabel = lib ? lib.name.replace(/\s.*/, '') : sel.library;
    const { w, h } = getSize();
    $('#meta').textContent = `${sel.dateStr} · ${libLabel} · ${sel.words.length} 个词 · ${w}×${h}`;
  }

  /* ---------- 记忆复习 (SRS) ---------- */
  let lastSel = null;          // 最近渲染的选择（「记好了」要拿当前这组词）
  let srsTimer = null;         // 倒计时 / 到期闹钟 ticker
  let srsWasDue = false;       // 上次是否处于「到期」状态（用于到期瞬间提醒一次）

  function fmtCountdown(ms) {
    if (ms <= 0) return '到点了';
    const m = Math.floor(ms / 60000);
    if (m < 1) return '<1 分钟';
    if (m < 60) return m + ' 分钟后';
    const h = Math.floor(m / 60), rm = m % 60;
    if (h < 24) return rm ? `${h} 小时 ${rm} 分后` : `${h} 小时后`;
    const d = Math.floor(h / 24), rh = h % 24;
    return rh ? `${d} 天 ${rh} 小时后` : `${d} 天后`;
  }

  function updateSrsUI() {
    const card = $('.srs-card'); if (!card || !window.Review) return;
    const enabled = !!settings.srsEnabled && settings.library !== 'custom';
    $('#btn-learned').disabled = !enabled;
    const st = window.Review.stats(settings.library);
    $('#srs-status').innerHTML = enabled
      ? `已记 <b>${st.total}</b> 组 · 待复习 <b>${st.pending}</b> 组 · 记牢 <b>${st.done}</b> 组`
      : (settings.library === 'custom' ? '我的词库不参与记忆轮换' : '已关闭记忆轮换');
    const cd = $('#srs-countdown');
    if (!enabled) { cd.hidden = true; return; }
    const due = window.Review.dueGroups(settings.library);
    const soonest = window.Review.soonestDue(settings.library);
    if (due.length) {
      cd.hidden = false; cd.classList.add('due');
      $('#srs-cd-time').textContent = `${due.length} 组到点，正在复习`;
      if (!srsWasDue) { srsWasDue = true; toast(`⏰ 复习时间到！${due.length} 组单词回来复习啦`); }
    } else {
      srsWasDue = false;
      if (soonest) {
        cd.hidden = false; cd.classList.remove('due');
        $('#srs-cd-time').textContent = fmtCountdown(soonest - Date.now());
      } else {
        cd.hidden = true;
      }
    }
  }

  async function onLearned() {
    if (!window.Review || !settings.srsEnabled) return;
    if (settings.library === 'custom') { toast('我的词库不参与记忆轮换'); return; }
    const words = (lastSel && lastSel.words) || [];
    if (!words.length) { toast('当前没有单词可记'); return; }
    const { cursor } = window.Review.learn(settings.library, words);
    // 轮换：推进游标后重洗一组新词；同时尽力把桌面宠物也切到下一组
    await refresh(true);
    try { fetch('next.php', { method: 'POST' }).catch(() => {}); } catch (e) {}
    const st = window.Review.stats(settings.library);
    toast(`✅ 已记下这组（共 ${st.total} 组）· 20 分钟后回来复习`);
    updateSrsUI();
  }

  function startSrsTicker() {
    clearInterval(srsTimer);
    srsTimer = setInterval(() => {
      if (!settings.srsEnabled) return;
      const beforeDue = window.Review ? window.Review.dueGroups(settings.library).length : 0;
      updateSrsUI();
      const afterDue = window.Review ? window.Review.dueGroups(settings.library).length : 0;
      // 有新到期：重绘壁纸把复习组顶上来（闹钟提醒已在 updateSrsUI 里弹）
      if (afterDue > 0 && beforeDue === 0) refresh(false);
    }, 30000);
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
    const topBtn = $('#btn-companion-top');
    const dockBtn = $('#btn-pet-dock');
    [btn, topBtn, dockBtn].filter(Boolean).forEach(b => { b.disabled = true; });
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
      [btn, topBtn, dockBtn].filter(Boolean).forEach(b => {
        if (!b.textContent.includes('运行中') && !b.textContent.includes('已开启')) b.disabled = false;
      });
    }
  }

  function syncCompanionButton() {
    const btn = $('#btn-companion');
    fetch('status.json').then(r => r.ok ? r.json() : Promise.reject()).then(j => {
      // 伴侣页（8771）给 config；主 server（8770）探测到伴侣后给 companion:true
      const running = !!(j && (j.config || j.companion));
      if (running) {
        btn.textContent = '✅ 桌面伴侣运行中';
        btn.disabled = true;
        const topBtn = $('#btn-companion-top');
        if (topBtn) { topBtn.textContent = '✅ 桌面宠物已开启'; topBtn.disabled = true; }
        const dockBtn = $('#btn-pet-dock');
        if (dockBtn) { dockBtn.textContent = j.pet ? '🙈 隐藏小词灵' : '🐾 召唤小词灵'; dockBtn.disabled = false; }
        const dockStatus = $('#pet-dock-status');
        if (dockStatus) dockStatus.textContent = j.pet ? '小词灵正在桌面陪你背词，点这里可以收起它' : '桌面伴侣已经开启，点这里让小词灵出现';
        const dockNext = $('#btn-pet-dock-next'); if (dockNext) dockNext.hidden = false;
        syncPetControls(j);
      }
    }).catch(() => {});
  }

  let petOn = false;
  function syncPetControls(j) {
    const box = $('#pet-controls');
    if (!box) return;
    box.style.display = 'block';
    petOn = !!(j && j.pet);
    const btn = $('#btn-pet-toggle');
    if (btn) btn.textContent = petOn ? '🙈 隐藏宠物' : '🐾 召唤宠物';
    const dockBtn = $('#btn-pet-dock');
    if (dockBtn) dockBtn.textContent = petOn ? '🙈 隐藏小词灵' : '🐾 召唤小词灵';
    const hint = $('#pet-hint');
    if (hint) hint.textContent = '摸摸词灵换一组 · Shift＋单击回退 · 按住拖动 · 拖右下角 ⤡ 调大小';
  }

  async function petSwitch(dir) {
    try {
      const r = await fetch((dir > 0 ? 'next' : 'prev') + '.php', { method: 'POST' });
      const j = await r.json();
      if (j && j.ok) toast(dir > 0 ? '切到下一组词 ✓' : '回到上一组词 ✓');
      else toast('切换失败');
    } catch (e) { toast('切换失败：' + e.message); }
  }

  async function togglePet() {
    const btn = $('#btn-pet-toggle');
    if (!btn) return;
    btn.disabled = true;
    try {
      const action = petOn ? 'close' : 'open';
      const r = await fetch('pet.php?action=' + action, { method: 'POST' });
      const j = await r.json();
      petOn = !!j.pet;
      btn.textContent = petOn ? '🙈 隐藏宠物' : '🐾 召唤宠物';
      const dockBtn = $('#btn-pet-dock');
      if (dockBtn) dockBtn.textContent = petOn ? '🙈 隐藏小词灵' : '🐾 召唤小词灵';
      const dockStatus = $('#pet-dock-status');
      if (dockStatus) dockStatus.textContent = petOn ? '小词灵正在桌面陪你背词，点这里可以收起它' : '桌面伴侣已经开启，点这里让小词灵出现';
      toast(petOn ? '小词灵已召唤 ✓（单击换词，Shift+单击回退）' : '小词灵已隐藏');
    } catch (e) { toast('操作失败：' + e.message); }
    btn.disabled = false;
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
      const renderSettings = Object.assign({}, settings, { bgImage: bgImageEl, hl: dragHl });
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
    startSrsTicker();
    window.Engine.markDay();
    if (!window.Store.read('dragHint', false)) {
      setTimeout(() => toast('💡 按住预览里的单词块 / 提醒块 / 自定义文字，可以直接拖到任意位置'), 1500);
      window.Store.write('dragHint', true);
    }
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
