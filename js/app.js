/* app.js — UI wiring: settings panel, preview, download, live mode, desktop
 * companion. Editorial workbench UI. IIFE -> `App`. */
(function () {
  'use strict';

  const SIZES = {
    'phone-1080x2400': { w: 1080, h: 2400, label: '手机 · 1080×2400' },
    'phone-1170x2532': { w: 1170, h: 2532, label: 'iPhone · 1170×2532' },
    'phone-1080x1920': { w: 1080, h: 1920, label: '手机 · 1080×1920' },
    'desktop-1920x1080': { w: 1920, h: 1080, label: '电脑 · 1920×1080' },
    'desktop-2560x1440': { w: 2560, h: 1440, label: '电脑 · 2560×1440 (2K)' },
    'desktop-3840x2160': { w: 3840, h: 2160, label: '电脑 · 3840×2160 (4K)' },
    'pad-2048x2732': { w: 2048, h: 2732, label: '平板 · 2048×2732' },
    'custom': { w: 1080, h: 1920, label: '自定义尺寸' },
  };

  const THEMES = {
    cream:  { name: '奶油', bg: '#fff6ea', bg2: '#ffe9d0', ink: '#4a3b2e', sub: '#a68e75', accent: '#ff9d5c', accentSoft: '#ffe0c2', line: 'rgba(74,59,46,0.10)', patternInk: '#eec9a3', blob: true },
    mint:   { name: '薄荷', bg: '#effcf4', bg2: '#dcf6e6', ink: '#1f4536', sub: '#74a08c', accent: '#41c189', accentSoft: '#cdf0de', line: 'rgba(31,69,54,0.10)', patternInk: '#abe3c6', blob: true },
    sky:    { name: '天空', bg: '#eef7fe', bg2: '#dcedfc', ink: '#1e3a52', sub: '#7490a8', accent: '#4f9fe0', accentSoft: '#cfe7fa', line: 'rgba(30,58,82,0.10)', patternInk: '#b0d6f0', blob: true },
    sakura: { name: '樱花', bg: '#fff1f5', bg2: '#fde3ea', ink: '#57222f', sub: '#ae7d8b', accent: '#f1789b', accentSoft: '#fad3de', line: 'rgba(87,34,47,0.10)', patternInk: '#f3b6c7', blob: true },
    liquid: { name: '玻璃', bg: '#f8fbff', bg2: '#dce7f0', ink: '#223242', sub: '#6a7f92', accent: '#7299b8', accentSoft: '#dbe8f2', line: 'rgba(53,79,101,0.12)', patternInk: '#bfd2e0', blob: false, liquid: true },
    pearl:  { name: '珍珠', bg: '#ffffff', bg2: '#f1f1f4', ink: '#2b2b30', sub: '#9a9aa2', accent: '#8e8e93', accentSoft: '#ececf0', line: 'rgba(43,43,48,0.10)', patternInk: '#d6d6db', blob: false, liquid: true },
    night:  { name: '夜空', bg: '#151a2e', bg2: '#1f2745', ink: '#eef1f8', sub: '#8b95b3', accent: '#7aa2f7', accentSoft: '#2a3358', line: 'rgba(238,241,248,0.14)', patternInk: '#3a4670', blob: true },
    forest: { name: '森林', bg: '#12211c', bg2: '#1c332a', ink: '#e8f0ea', sub: '#8fae9f', accent: '#5ec99a', accentSoft: '#234534', line: 'rgba(232,240,234,0.12)', patternInk: '#2e5040', blob: true },
  };

  const LIBRARIES = [
    { id: 'jlpt_n5', icon: 'あ', name: '日语 JLPT N5', desc: '入门核心词', file: 'words_jlpt_n5.json', source: 'JLPT N5 分级 · 开放词表整理' },
    { id: 'jlpt_n4', icon: '日', name: '日语 JLPT N4', desc: '初级进阶词', file: 'words_jlpt_n4.json', source: 'JLPT N4 分级 · 开放词表整理' },
    { id: 'chuzhong', icon: '初', name: '初中', desc: '中考核心词', file: 'words_chuzhong.json', source: 'ECDICT 中考核心' },
    { id: 'gaozhong', icon: '高', name: '高中', desc: '高考核心词', file: 'words_gaozhong.json', source: 'ECDICT 高考核心' },
    { id: 'cet4', icon: '四', name: '四级', desc: 'CET4 核心词', file: 'words_cet4.json' },
    { id: 'cet6', icon: '六', name: '六级', desc: 'CET6 核心词', file: 'words_cet6.json' },
    { id: 'kaoyan', icon: '研', name: '考研', desc: '考研核心词', file: 'words_kaoyan.json' },
    { id: 'ielts', icon: '雅', name: '雅思', desc: 'IELTS 核心词', file: 'words_ielts.json' },
    { id: 'toefl', icon: '托', name: '托福', desc: 'TOEFL 核心词', file: 'words_toefl.json' },
    { id: 'gre', icon: 'G', name: 'GRE', desc: 'GRE 核心词', file: 'words_gre.json' },
    { id: 'custom', icon: '自', name: '我的词库', desc: '自己导入的词', file: null },
  ];

  const BG_PATTERNS = [
    { id: 'soft', name: '柔光', icon: '☼' },
    { id: 'blobs', name: '光斑', icon: '○' },
    { id: 'dots', name: '圆点', icon: '●' },
    { id: 'grid', name: '方格', icon: '□' },
    { id: 'diag', name: '斜纹', icon: '◹' },
    { id: 'waves', name: '波浪', icon: '∿' },
    { id: 'none', name: '纯色', icon: '■' },
  ];

  let settings = null;
  const UI_THEMES = new Set(['anime', 'editorial', 'liquid']);
  let companionAction = 'start'; // 'start' | 'control' | 'download' | 'switch-account'
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
  let moduleEditing = false;
  let draggedModule = null;
  let liquidTransitionTimer = null;
  const MODULE_DEFAULTS = {
    left: ['module-library', 'module-reminders', 'module-srs', 'module-automation'],
    right: ['module-appearance', 'module-custom'],
  };

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function loadSettings() {
    settings = window.Store.getSettings();
    settings.uiTheme = UI_THEMES.has(settings.uiTheme) ? settings.uiTheme : 'editorial';
    document.documentElement.dataset.uiTheme = settings.uiTheme;
    // 初中/高中词书已恢复为独立 ECDICT 词库,无需再映射到 JLPT。
  }
  function saveSettings() { window.Store.saveSettings(settings); }

  /* ---------- settings -> UI ---------- */
  function applySettingsToUI() {
    applyUITheme(settings.uiTheme, false);
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

  function applyUITheme(theme, persist) {
    const next = UI_THEMES.has(theme) ? theme : 'editorial';
    const root = document.documentElement;
    settings.uiTheme = next;
    root.dataset.uiTheme = next;
    clearTimeout(liquidTransitionTimer);
    root.classList.remove('liquid-materializing');
    if (persist && next === 'liquid' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Apple-style materialisation: the edge light resolves into place instead
      // of treating the theme as a flat colour fade.
      void root.offsetWidth;
      root.classList.add('liquid-materializing');
      liquidTransitionTimer = setTimeout(() => root.classList.remove('liquid-materializing'), 680);
    }
    $$('.ui-theme-option').forEach(button => {
      const active = button.dataset.uiTheme === next;
      button.classList.toggle('on', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (persist) {
      // Liquid is a whole-page visual mode. Enter it with the matching clean
      // wallpaper palette so the proof does not remain a dark/starry island.
      if (next === 'liquid') {
        settings.theme = 'pearl';
        settings.bgPattern = 'none';
        renderThemeSwatches();
        renderPatternPicker();
      }
      window.Store.setUITheme(next);
      saveSettings();
      refresh(false);
      // 界面主题同时驱动桌面小词灵；伴侣未运行时保持静默降级。
      syncCompanionLearningContext();
    }
    document.dispatchEvent(new CustomEvent('wordpaper:ui-theme-change', { detail: { theme: next } }));
  }

  /* Liquid Glass progressive enhancement. The rounded-rect SDF keeps the
   * content stable and refracts only the optical rim. Three sub-pixel RGB
   * samples add restrained dispersion in Chromium; Safari and Firefox retain
   * the same white material, highlight and depth without SVG displacement. */
  function bindLiquidGlassMotion() {
    const opticalSelector = '.top-actions.layout-actions, .meta-actions, .pet-dock, .stage, .modal-card';
    const interactiveSelector = 'button, .btn, .chip, .pattern-chip, .seg-btn, .ui-theme-option';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const supportsBackdrop = CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
    const supportsSvgBackdrop = supportsBackdrop
      && CSS.supports('backdrop-filter', 'url("#wp-liquid-probe") blur(1px)')
      && /(?:Chrome|Chromium|Edg)\//.test(navigator.userAgent)
      && !reducedTransparency.matches;
    const ns = 'http://www.w3.org/2000/svg';
    const opticalState = new WeakMap();
    const motionState = new Map();
    const displacementCache = new Map();
    let opticalSeq = 0;
    let motionFrame = 0;

    const svgNode = (name, attrs) => {
      const node = document.createElementNS(ns, name);
      Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
      return node;
    };

    let opticalDefs = null;
    if (supportsSvgBackdrop) {
      const svg = svgNode('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
      svg.id = 'wp-liquid-optics';
      svg.style.cssText = 'position:fixed;inset:0;width:0;height:0;pointer-events:none;overflow:hidden';
      opticalDefs = svgNode('defs');
      svg.appendChild(opticalDefs);
      document.body.appendChild(svg);
    }

    function smoothStep(a, b, value) {
      const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }

    function roundedRectSDF(x, y, halfWidth, halfHeight, radius) {
      const qx = Math.abs(x) - halfWidth + radius;
      const qy = Math.abs(y) - halfHeight + radius;
      return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
    }

    function displacementMap(width, height, cssRadius) {
      const ratio = Math.min(.55, 240 / Math.max(width, height));
      const w = Math.max(40, Math.round(width * ratio));
      const h = Math.max(40, Math.round(height * ratio));
      const radius = Math.max(2, Math.min(cssRadius * ratio, w / 2 - 1, h / 2 - 1));
      const key = `${w}x${h}@${Math.round(radius)}`;
      if (displacementCache.has(key)) return displacementCache.get(key);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const context = canvas.getContext('2d', { willReadFrequently: false });
      const image = context.createImageData(w, h);
      const halfWidth = w / 2 - 1;
      const halfHeight = h / 2 - 1;
      const edgeWidth = Math.min(38, Math.max(10, Math.min(w, h) * .24));
      const sdf = (x, y) => roundedRectSDF(x, y, halfWidth, halfHeight, radius);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const px = x + .5 - w / 2;
          const py = y + .5 - h / 2;
          const distance = sdf(px, py);
          let strength = 0, normalX = 0, normalY = 0;
          if (distance < 0 && distance > -edgeWidth) {
            strength = smoothStep(-edgeWidth, -1.4, distance);
            if (distance > -1.8) strength *= Math.max(0, -distance / 1.8);
            const gradientX = sdf(px + .75, py) - sdf(px - .75, py);
            const gradientY = sdf(px, py + .75) - sdf(px, py - .75);
            const length = Math.max(.001, Math.hypot(gradientX, gradientY));
            normalX = gradientX / length;
            normalY = gradientY / length;
          }
          image.data[i] = Math.round(128 + normalX * strength * 74);
          image.data[i + 1] = Math.round(128 + normalY * strength * 74);
          image.data[i + 2] = 128;
          image.data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      const result = canvas.toDataURL('image/png');
      if (displacementCache.size >= 24) displacementCache.delete(displacementCache.keys().next().value);
      displacementCache.set(key, result);
      return result;
    }

    function rebuildOptic(surface, entry) {
      const rect = surface.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const radius = Math.max(0, Math.round(parseFloat(getComputedStyle(surface).borderRadius) || 0));
      if (width < 16 || height < 16 || (entry.width === width && entry.height === height && entry.radius === radius)) return;
      entry.width = width; entry.height = height; entry.radius = radius;
      entry.filter.setAttribute('width', width);
      entry.filter.setAttribute('height', height);
      entry.image.setAttribute('width', width);
      entry.image.setAttribute('height', height);
      entry.image.setAttribute('href', displacementMap(width, height, radius));
      const optic = surface.dataset.liquidOptic;
      const scale = optic === 'deep' ? 22 : optic === 'thick' ? 17 : height < 90 ? 15 : 13;
      entry.displaces.forEach((node, index) => node.setAttribute('scale', scale + (index === 0 ? 1.15 : index === 2 ? -1.15 : 0)));
      surface.style.setProperty('--liquid-refraction', `url(#${entry.id})`);
      surface.classList.add('liquid-refraction-ready');
    }

    const resizeObserver = supportsSvgBackdrop ? new ResizeObserver(entries => {
      if (document.documentElement.dataset.uiTheme !== 'liquid') return;
      entries.forEach(({ target }) => {
        const entry = opticalState.get(target);
        if (!entry) return;
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => rebuildOptic(target, entry), 80);
      });
    }) : null;

    function ensureOptic(surface) {
      if (!(surface instanceof HTMLElement)) return;
      surface.dataset.liquidOptic = surface.matches('.stage, .modal-card')
        ? 'deep'
        : surface.matches('.pet-dock') ? 'thick' : 'regular';
      const existing = opticalState.get(surface);
      if (existing) { rebuildOptic(surface, existing); return; }
      if (!supportsSvgBackdrop) return;

      const id = `wp-liquid-refraction-${++opticalSeq}`;
      const filter = svgNode('filter', {
        id, x: 0, y: 0, width: 1, height: 1,
        filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
        'color-interpolation-filters': 'sRGB',
      });
      const image = svgNode('feImage', { x: 0, y: 0, width: 1, height: 1, result: 'map', preserveAspectRatio: 'none' });
      const channels = [
        ['red-shift', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
        ['green-shift', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
        ['blue-shift', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'],
      ];
      const displaces = [];
      const isolated = [];
      filter.appendChild(image);
      channels.forEach(([result, values], index) => {
        const displace = svgNode('feDisplacementMap', {
          in: 'SourceGraphic', in2: 'map', scale: 10,
          xChannelSelector: 'R', yChannelSelector: 'G', result,
        });
        const channel = svgNode('feColorMatrix', { in: result, type: 'matrix', values, result: `channel-${index}` });
        displaces.push(displace);
        isolated.push(channel);
        filter.append(displace, channel);
      });
      const redGreen = svgNode('feBlend', { in: 'channel-0', in2: 'channel-1', mode: 'screen', result: 'red-green' });
      const rgb = svgNode('feBlend', { in: 'red-green', in2: 'channel-2', mode: 'screen' });
      filter.append(redGreen, rgb);
      opticalDefs.appendChild(filter);
      const entry = { id, filter, image, displaces, width: 0, height: 0, radius: -1, timer: 0 };
      opticalState.set(surface, entry);
      resizeObserver.observe(surface);
      rebuildOptic(surface, entry);
    }

    function activateOptics() {
      if (document.documentElement.dataset.uiTheme !== 'liquid') return;
      document.querySelectorAll(opticalSelector).forEach(ensureOptic);
    }

    function getMotion(surface) {
      let state = motionState.get(surface);
      if (state) return state;
      const rect = surface.getBoundingClientRect();
      // 大面板静态高光:光标不驱动 --glass-x/y(否则每帧重绘整块大玻璃背景,卡顿),
      // 只在小控件上跟手。大面板仍点亮(illuminated),但高光位置固定。
      const staticSheen = surface.matches('.stage, .modal-card');
      state = {
        x: rect.width / 2, y: rect.height / 2,
        targetX: rect.width / 2, targetY: rect.height / 2,
        tiltX: 0, tiltY: 0, targetTiltX: 0, targetTiltY: 0,
        // 大面板(.stage/.modal-card)不倾斜:倾斜每帧改变 backdrop 内容,触发整面
        // 玻璃的折射+模糊重采样,是大屏卡顿主因。小控件面积小,保留倾斜代价可忽略。
        tiltStrength: staticSheen ? 0 : .72,
        staticSheen,
        active: false,
      };
      motionState.set(surface, state);
      return state;
    }

    function animateMotion() {
      motionFrame = 0;
      const motionAllowed = document.documentElement.dataset.uiTheme === 'liquid' && !reducedMotion.matches;
      let needsFrame = false;
      motionState.forEach((state, surface) => {
        if (!surface.isConnected) { motionState.delete(surface); return; }
        const ease = state.active ? .24 : .14;
        state.x += (state.targetX - state.x) * ease;
        state.y += (state.targetY - state.y) * ease;
        state.tiltX += (state.targetTiltX - state.tiltX) * ease;
        state.tiltY += (state.targetTiltY - state.tiltY) * ease;
        if (!state.staticSheen) {
          surface.style.setProperty('--glass-x', `${state.x.toFixed(1)}px`);
          surface.style.setProperty('--glass-y', `${state.y.toFixed(1)}px`);
        }
        surface.style.setProperty('--glass-tilt-x', motionAllowed ? `${state.tiltX.toFixed(3)}deg` : '0deg');
        surface.style.setProperty('--glass-tilt-y', motionAllowed ? `${state.tiltY.toFixed(3)}deg` : '0deg');
        const delta = Math.abs(state.targetX - state.x) + Math.abs(state.targetY - state.y)
          + Math.abs(state.targetTiltX - state.tiltX) * 8 + Math.abs(state.targetTiltY - state.tiltY) * 8;
        if (delta > .08) needsFrame = true;
      });
      if (needsFrame) motionFrame = requestAnimationFrame(animateMotion);
    }

    function scheduleMotion() {
      if (!motionFrame) motionFrame = requestAnimationFrame(animateMotion);
    }

    function resetSurface(surface) {
      const state = motionState.get(surface);
      if (!state) return;
      const rect = surface.getBoundingClientRect();
      state.active = false;
      state.targetX = rect.width / 2;
      state.targetY = rect.height / 2;
      state.targetTiltX = 0;
      state.targetTiltY = 0;
      surface.classList.remove('liquid-illuminated', 'liquid-pressed');
      scheduleMotion();
    }

    activateOptics();
    document.addEventListener('wordpaper:ui-theme-change', event => {
      if (event.detail && event.detail.theme === 'liquid') activateOptics();
      else motionState.forEach((_, surface) => resetSurface(surface));
    });
    document.addEventListener('pointerover', event => {
      if (document.documentElement.dataset.uiTheme !== 'liquid' || reducedMotion.matches || !(event.target instanceof Element)) return;
      const surface = event.target.closest(opticalSelector);
      if (!surface) return;
      ensureOptic(surface);
      getMotion(surface).active = true;
      surface.classList.add('liquid-illuminated');
    }, { passive: true });
    document.addEventListener('pointerout', event => {
      if (!(event.target instanceof Element)) return;
      const surface = event.target.closest(opticalSelector);
      if (!surface || (event.relatedTarget instanceof Node && surface.contains(event.relatedTarget))) return;
      resetSurface(surface);
    }, { passive: true });
    document.addEventListener('pointermove', event => {
      if (document.documentElement.dataset.uiTheme !== 'liquid' || reducedMotion.matches || event.pointerType === 'touch' || !(event.target instanceof Element)) return;
      const surface = event.target.closest(opticalSelector);
      if (!surface) return;
      // 环境光偏移只在确实有目标面板时更新(原先在任何 move 上都写文档级变量并触发
      // 全面板 scheduleMotion + getBoundingClientRect,空挥鼠标也跑一整轮,纯属浪费)。
      const ambientX = ((event.clientX / Math.max(1, window.innerWidth)) - .5) * 18;
      const ambientY = ((event.clientY / Math.max(1, window.innerHeight)) - .5) * 14;
      document.documentElement.style.setProperty('--liquid-ambient-x', `${ambientX.toFixed(2)}px`);
      document.documentElement.style.setProperty('--liquid-ambient-y', `${ambientY.toFixed(2)}px`);
      const rect = surface.getBoundingClientRect();
      const state = getMotion(surface);
      state.active = true;
      // 大面板静态高光/不倾斜:不更新 targetX/Y/tilt,只点亮,避免每帧背景重绘。
      if (!state.staticSheen) {
        const localX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const localY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
        const nx = rect.width ? localX / rect.width - .5 : 0;
        const ny = rect.height ? localY / rect.height - .5 : 0;
        state.targetX = localX;
        state.targetY = localY;
        state.targetTiltX = -ny * state.tiltStrength;
        state.targetTiltY = nx * state.tiltStrength * 1.15;
      }
      surface.classList.add('liquid-illuminated');
      const control = event.target.closest(interactiveSelector);
      if (control && surface.contains(control)) {
        const controlRect = control.getBoundingClientRect();
        control.style.setProperty('--liquid-control-x', `${Math.max(0, Math.min(controlRect.width, event.clientX - controlRect.left)).toFixed(1)}px`);
        control.style.setProperty('--liquid-control-y', `${Math.max(0, Math.min(controlRect.height, event.clientY - controlRect.top)).toFixed(1)}px`);
      }
      scheduleMotion();
    }, { passive: true });
    document.addEventListener('pointerdown', event => {
      if (document.documentElement.dataset.uiTheme !== 'liquid' || reducedMotion.matches || !(event.target instanceof Element)) return;
      const control = event.target.closest(interactiveSelector);
      if (!control) return;
      control.classList.add('liquid-control-pressed');
      const surface = control.closest(opticalSelector);
      if (surface) surface.classList.add('liquid-pressed', 'liquid-illuminated');
    }, { passive: true });
    const releasePressed = () => {
      document.querySelectorAll('.liquid-pressed').forEach(surface => surface.classList.remove('liquid-pressed'));
      document.querySelectorAll('.liquid-control-pressed').forEach(control => control.classList.remove('liquid-control-pressed'));
    };
    document.addEventListener('pointerup', releasePressed, { passive: true });
    document.addEventListener('pointercancel', releasePressed, { passive: true });
    window.addEventListener('blur', releasePressed);
    reducedMotion.addEventListener('change', () => {
      motionState.forEach((_, surface) => resetSurface(surface));
    });
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
    $$('.ui-theme-option').forEach(button => button.addEventListener('click', () => {
      applyUITheme(button.dataset.uiTheme, true);
      toast(`界面已切换为${button.textContent.trim()}主题`);
    }));
    $('#sel-size').addEventListener('change', e => { settings.size = e.target.value; $('#custom-size-row').hidden = settings.size !== 'custom'; commit(); });
    $('#inp-cw').addEventListener('change', e => { settings.customW = clampInt(e.target.value, 100, 8000, 1080); commit(); });
    $('#inp-ch').addEventListener('change', e => { settings.customH = clampInt(e.target.value, 100, 8000, 1920); commit(); });
    $('#sel-order').addEventListener('change', e => { settings.order = e.target.value; commit(); });
    $('#inp-count').addEventListener('input', e => {
      if (e.target.value === '') return;
      settings.wordsPerGroup = normalizeWordCount(e.target.value);
      e.target.value = settings.wordsPerGroup;
      updateTypoLabels(); commit(true); syncCompanionLearningContext();
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
    if (chkSrs) chkSrs.addEventListener('change', e => {
      settings.srsEnabled = e.target.checked;
      updateSrsUI(); commit();
      if (e.target.checked) syncPetMemoryEvents();
    });
    const memoryBtn = $('#btn-open-memory');
    if (memoryBtn) memoryBtn.addEventListener('click', openMemoryNotebook);
    const petMemoryBtn = $('#btn-pet-memory');
    if (petMemoryBtn) petMemoryBtn.addEventListener('click', openMemoryNotebook);
    const noticeBtn = $('#btn-enable-srs-notice');
    if (noticeBtn) noticeBtn.addEventListener('click', enableSrsNotifications);
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

    const refreshTop = $('#btn-refresh'); if (refreshTop) refreshTop.addEventListener('click', async () => { await refresh(true); toast('已换一组新单词'); });
    const downloadTop = $('#btn-download'); if (downloadTop) downloadTop.addEventListener('click', downloadPNG);
    $('#btn-live').addEventListener('click', enterLive);
    $('#btn-exit-live').addEventListener('click', exitLive);
    const wallpaperTop = $('#btn-set-wallpaper'); if (wallpaperTop) wallpaperTop.addEventListener('click', setDesktopWallpaper);
    // preview meta-bar duplicates (快速出壁纸，滚到中部也能直接操作)
    const r2 = $('#btn-refresh2'); if (r2) r2.addEventListener('click', async () => { await refresh(true); toast('已换一组新单词'); });
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
    const memoryModal = $('#memory-modal');
    const closeMemory = $('#btn-close-memory');
    if (closeMemory) closeMemory.addEventListener('click', closeMemoryNotebook);
    if (memoryModal) memoryModal.addEventListener('click', e => { if (e.target === memoryModal) closeMemoryNotebook(); });
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
      if (memoryModal && !memoryModal.hidden) closeMemoryNotebook();
    });
    $('#btn-companion').addEventListener('click', handleCompanionAction);
    // 换词特效下拉:选中即存 localStorage 并触发 pet-sync,下次换词生效。
    const petFx = $('#sel-pet-transition');
    if (petFx) {
      petFx.value = window.Store.read('petTransition', 'dissolve-pop');
      petFx.addEventListener('change', () => {
        window.Store.write('petTransition', petFx.value);
        syncCompanionLearningContext();
        toast('换词特效：' + petFx.options[petFx.selectedIndex].text);
      });
    }
    const companionTop = $('#btn-companion-top');
    if (companionTop) companionTop.addEventListener('click', enableCompanion);
    // 词书搜索框:输入即过滤词库卡片。
    const libFilter = $('#library-filter');
    if (libFilter) libFilter.addEventListener('input', renderLibraryCards);
    const petBtn = $('#btn-pet-toggle');
    if (petBtn) petBtn.addEventListener('click', togglePet);
    const dl = $('#btn-companion-dl');
    if (dl) dl.addEventListener('click', e => { e.preventDefault(); downloadCompanion(); });
    const petDock = $('#btn-pet-dock');
    // 入口始终留在 8770 工作台；根据本机状态分发为启动、召唤/隐藏或下载。
    if (petDock) petDock.addEventListener('click', handleCompanionAction);

    syncCompanionButton();

    bindImport();
    bindReminders();
    bindBgPhoto();
    bindWordInspector();
    bindDrag();
  }

  /* ---------- ordered module layout ---------- */
  function moduleColumns() { return { left: $('.panel-left .panel-col'), right: $('.panel-right .panel-col') }; }
  function normalizeModuleLayout(saved) {
    const valid = new Set(MODULE_DEFAULTS.left.concat(MODULE_DEFAULTS.right));
    const result = { left: [], right: [] }, used = new Set();
    ['left', 'right'].forEach(side => {
      (saved && Array.isArray(saved[side]) ? saved[side] : []).forEach(id => {
        if (valid.has(id) && !used.has(id)) { result[side].push(id); used.add(id); }
      });
    });
    ['left', 'right'].forEach(side => MODULE_DEFAULTS[side].forEach(id => {
      if (!used.has(id)) { result[side].push(id); used.add(id); }
    }));
    return result;
  }
  function applyModuleLayout(saved) {
    const columns = moduleColumns(), layout = normalizeModuleLayout(saved);
    ['left', 'right'].forEach(side => layout[side].forEach(id => {
      const card = document.getElementById(id); if (card && columns[side]) columns[side].appendChild(card);
    }));
  }
  function saveModuleLayout() {
    const columns = moduleColumns(), layout = { left: [], right: [] };
    ['left', 'right'].forEach(side => {
      if (!columns[side]) return;
      layout[side] = Array.from(columns[side].querySelectorAll(':scope > .module-card')).map(card => card.id);
    });
    window.Store.write('moduleLayout', layout);
  }
  function toggleModuleEditing(force) {
    moduleEditing = force == null ? !moduleEditing : !!force;
    document.body.classList.toggle('layout-editing', moduleEditing);
    const edit = $('#btn-layout-edit'), reset = $('#btn-layout-reset');
    if (edit) edit.textContent = moduleEditing ? '✓ 完成摆放' : '↕️ 整理模块';
    if (reset) reset.hidden = !moduleEditing;
    if (!moduleEditing) saveModuleLayout();
  }
  function setModuleDropTarget(container, clientY) {
    if (!draggedModule || !container) return;
    const cards = Array.from(container.querySelectorAll(':scope > .module-card')).filter(card => card !== draggedModule);
    const before = cards.find(card => clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2);
    if (before) container.insertBefore(draggedModule, before); else container.appendChild(draggedModule);
  }
  function moduleColumnAt(clientX, clientY) {
    return document.elementsFromPoint(clientX, clientY)
      .map(node => node.closest && node.closest('.panel-col'))
      .find(Boolean) || null;
  }
  function finishModuleDrag() {
    if (!draggedModule) return;
    draggedModule.classList.remove('layout-dragging');
    draggedModule = null;
    $$('.panel-col').forEach(col => col.classList.remove('layout-drop-target'));
    saveModuleLayout();
  }
  function initModuleLayout() {
    applyModuleLayout(window.Store.read('moduleLayout', null));
    const movable = new Set(MODULE_DEFAULTS.left.concat(MODULE_DEFAULTS.right));
    $$('.module-card').filter(card => movable.has(card.id)).forEach(card => {
      const grip = document.createElement('button');
      grip.type = 'button'; grip.className = 'module-grip'; grip.title = '按住拖动整理此模块'; grip.setAttribute('aria-label', '按住拖动整理模块'); grip.textContent = '⠿';
      const beginDrag = (event, isTouch) => {
        if (!moduleEditing || (!isTouch && event.button !== 0)) return;
        event.preventDefault(); event.stopPropagation();
        draggedModule = card; card.classList.add('layout-dragging');
        const move = moveEvent => {
          const point = isTouch ? moveEvent.touches[0] : moveEvent;
          if (!point) return;
          const column = moduleColumnAt(point.clientX, point.clientY);
          if (!column) return;
          $$('.panel-col').forEach(col => col.classList.toggle('layout-drop-target', col === column));
          setModuleDropTarget(column, point.clientY);
        };
        const end = () => {
          document.removeEventListener(isTouch ? 'touchmove' : 'mousemove', move);
          finishModuleDrag();
        };
        document.addEventListener(isTouch ? 'touchmove' : 'mousemove', move, { passive: false });
        document.addEventListener(isTouch ? 'touchend' : 'mouseup', end, { once: true });
        if (isTouch) document.addEventListener('touchcancel', end, { once: true });
      };
      // 使用 document 级 mousemove，避免浏览器在离开小把手后丢失拖动事件；触控也可用。
      grip.addEventListener('mousedown', event => beginDrag(event, false));
      grip.addEventListener('touchstart', event => beginDrag(event, true), { passive: false });
      // closed <details> 会隐藏 summary 以外的子元素，把把手放入 summary 才能始终可抓。
      const summary = card.tagName === 'DETAILS' ? card.querySelector('summary') : null;
      if (summary) {
        grip.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
        summary.appendChild(grip);
      } else card.appendChild(grip);
    });
    const edit = $('#btn-layout-edit'), reset = $('#btn-layout-reset');
    if (edit) edit.addEventListener('click', () => toggleModuleEditing());
    if (reset) reset.addEventListener('click', () => { applyModuleLayout(MODULE_DEFAULTS); saveModuleLayout(); toast('已恢复默认模块布局'); });
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
    // 词书搜索:按名称/描述/来源模糊过滤(中/英/拼音首字母皆可)。
    const query = ($('#library-filter') && $('#library-filter').value || '').trim().toLowerCase();
    const visible = LIBRARIES.filter(lib => {
      if (!query) return true;
      const hay = `${lib.name} ${lib.desc} ${lib.source || ''} ${lib.id}`.toLowerCase();
      return query.split(/\s+/).every(term => hay.includes(term));
    });
    if (!visible.length) {
      box.innerHTML = '<div class="lib-empty">没有匹配「' + escapeHTML(query) + '」的词书；试试别的关键词。</div>';
      return;
    }
    visible.forEach(lib => {
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
        syncCompanionLearningContext();
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
        syncCompanionLearningContext();
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
    syncCompanionLearningContext();
    toast(`已筛除 ${visible.length} 个已掌握词`);
  }

  function clearLibraryScreening() {
    if (!activeLibraryBrowser) return;
    window.Store.clearKnownWords(activeLibraryBrowser.id);
    refresh(false);
    renderLibraryCards();
    renderLibraryWordList();
    syncCompanionLearningContext();
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
      b.addEventListener('click', () => {
        settings.theme = key;
        // The Liquid wallpaper opens as a clean material. Patterns remain
        // available and can still be deliberately selected afterwards.
        if (key === 'liquid') {
          settings.bgPattern = 'none';
          renderPatternPicker();
        }
        renderThemeSwatches();
        commit();
      });
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
    const plus = document.createElement('span'); plus.textContent = '色';
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
      commit(); syncCompanionLearningContext();
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
    syncCompanionLearningContext();
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
        // 壁纸预览只负责选中并调整整组样式；“记住”只在桌面小词灵词卡发生。
        selectWord(wordIndex);
        e.preventDefault();
        return;
      }
      // Shift 是明确的“移动单词组”手势，即使从词卡上按下也继续进入拖动逻辑。
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
  }

  /* 正式检测只在记忆本进行；普通壁纸始终展示新词，避免提前泄露到期词的中文答案。 */
  function mixReviews(sel) {
    return sel.words || [];
  }

  /* Scale the preview to fill the stage width normally; while dragging, shrink
   * it to fit the viewport so the WHOLE wallpaper stays visible as the block
   * moves anywhere on a tall canvas. */
  function applyDisplaySize(disp, canvas, fitToScreen) {
    const stage = $('#preview-stage');
    let s = Math.min(1, (stage.clientWidth - 24) / canvas.width);
    // 也让预览高度适配视口：整页一屏看全，不用上下滚动
    const dock = $('#pet-dock');
    const dockH = dock && !dock.hidden ? dock.getBoundingClientRect().height + 10 : 0;
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
  let lastSel = null;          // 最近渲染的选择（点词记住 / 整组确认都要拿当前词）
  let srsTimer = null;         // 倒计时 / 到期闹钟 ticker
  const srsDueKeysByLibrary = Object.create(null); // 每个词库分别记录已提醒的到期词
  let petMemorySyncing = false;

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
    const enabled = !!settings.srsEnabled;
    const openBtn = $('#btn-open-memory'); if (openBtn) openBtn.disabled = false;
    const petOpenBtn = $('#btn-pet-memory'); if (petOpenBtn) petOpenBtn.disabled = false;
    const st = window.Review.stats(settings.library);
    $('#srs-status').innerHTML = enabled
      ? `首轮 <b>${st.total}</b> 词 · 复习中 <b>${st.pending}</b> 词 · 已巩固 <b>${st.done}</b> 词${st.failures ? ` · 遗忘 <b>${st.failures}</b> 次` : ''}`
      : '已关闭记忆轮换';
    renderSrsRecords(enabled);
    const cd = $('#srs-countdown');
    const petBadge = $('#pet-memory-badge');
    if (!enabled) { cd.hidden = true; if (petBadge) petBadge.hidden = true; return 0; }
    const due = window.Review.dueWords(settings.library);
    if (petBadge) {
      petBadge.textContent = String(due.length);
      petBadge.hidden = !due.length;
      petBadge.setAttribute('aria-label', `${due.length} 个词到期`);
    }
    const previousDue = srsDueKeysByLibrary[settings.library] || new Set();
    const currentDue = new Set(due.map(item => window.Review.wordKey(item.word)));
    const newlyDue = due.filter(item => !previousDue.has(window.Review.wordKey(item.word))).length;
    srsDueKeysByLibrary[settings.library] = currentDue;
    const soonest = window.Review.soonestDue(settings.library);
    if (due.length) {
      cd.hidden = false; cd.classList.add('due');
      $('#srs-cd-time').textContent = `${due.length} 个词到点，打开记忆本复习`;
      if (newlyDue) notifySrsDue(newlyDue);
    } else {
      if (soonest) {
        cd.hidden = false; cd.classList.remove('due');
        $('#srs-cd-time').textContent = fmtCountdown(soonest - Date.now());
      } else {
        cd.hidden = true;
      }
    }
    return newlyDue;
  }

  function renderSrsRecords(enabled) {
    const box = $('#srs-records'); if (!box || !window.Review) return;
    box.innerHTML = '';
    if (!enabled) return;
    const records = window.Review.recentWords(settings.library, 4);
    if (!records.length) { box.innerHTML = '<div class="srs-record empty">在桌面小词灵点词卡完成首轮后，单词会进入这里的复习周期。</div>'; return; }
    records.forEach(item => {
      const row = document.createElement('div'); row.className = 'srs-record';
      const word = document.createElement('b'); word.textContent = item.word.word;
      const stage = document.createElement('em'); stage.textContent = item.stage >= window.Review.INTERVALS_MIN.length ? '已巩固' : `第 ${item.stage + 1} 轮${item.failCount ? ` · 遗忘 ${item.failCount}` : ''}`;
      const due = document.createElement('span'); due.textContent = item.due ? fmtCountdown(item.due - Date.now()) : '完成';
      row.append(word, stage, due); box.appendChild(row);
    });
  }

  function openMemoryNotebook() {
    if (!window.Review) return;
    if (!settings.srsEnabled) {
      settings.srsEnabled = true;
      const toggle = $('#chk-srs'); if (toggle) toggle.checked = true;
      saveSettings(); updateSrsUI(); syncPetMemoryEvents();
      toast('已开启艾宾浩斯记忆复习');
    }
    const modal = $('#memory-modal'); if (!modal) return;
    renderMemoryNotebook(); modal.hidden = false;
  }
  function closeMemoryNotebook() { const modal = $('#memory-modal'); if (modal) modal.hidden = true; }

  function openRequestedMemoryNotebook() {
    const url = new URL(window.location.href);
    if (url.searchParams.get('openMemory') !== '1') return;
    url.searchParams.delete('openMemory');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    openMemoryNotebook();
  }
  function renderMemoryNotebook() {
    const list = $('#memory-notebook-list'), summary = $('#memory-summary');
    if (!list || !summary || !window.Review) return;
    const active = window.Review.activeWords(settings.library);
    const mastered = window.Review.masteredWords(settings.library);
    const all = active.concat(mastered);
    const now = Date.now();
    const due = active.filter(item => item.due && item.due <= now);
    const st = window.Review.stats(settings.library);
    summary.innerHTML = `<span class="memory-pill">本轮到期 <b>${due.length}</b> 词</span><span class="memory-pill">复习中 <b>${st.pending}</b> 词</span><span class="memory-pill">已巩固 <b>${st.done}</b> 词</span><span class="memory-pill memory-pill-forgot">遗忘记录 <b>${st.failures}</b> 次</span>`;
    list.innerHTML = '';
    if (!all.length) { list.innerHTML = '<div class="memory-empty">还没有记忆记录。先在桌面小词灵点击词卡完成首轮学习，再回到这里复习。</div>'; return; }
    all.sort((a, b) => (a.stage >= window.Review.INTERVALS_MIN.length) - (b.stage >= window.Review.INTERVALS_MIN.length) || (a.due || Infinity) - (b.due || Infinity)).forEach(item => {
      const isMastered = item.stage >= window.Review.INTERVALS_MIN.length;
      const isDue = !!(item.due && item.due <= now);
      const card = document.createElement('article');
      card.className = 'memory-entry' + (isDue ? ' due' : '') + (isMastered ? ' mastered' : '');
      const stage = isMastered ? `已完成全部周期 · 共复习 ${item.reviewCount || 0} 次` : `第 ${item.stage + 1} 轮${isDue ? ' · 先回想，再选择结果' : ' · ' + fmtCountdown(item.due - now)}`;
      const meaningClass = isMastered ? 'memory-meaning' : 'memory-meaning locked';
      const meaningText = isMastered ? escapeHTML((item.word.pos ? item.word.pos + ' ' : '') + (item.word.meaning || '')) : '中文释义已遮盖';
      card.innerHTML = `<b>${escapeHTML(item.word.word)}</b><span class="memory-meta">${stage}</span><span class="${meaningClass}" aria-label="${isMastered ? '已巩固释义' : '作答后显示中文释义'}">${meaningText}</span>`;
      if (isDue) {
        const actions = document.createElement('div'); actions.className = 'memory-actions';
        actions.innerHTML = '<button type="button" class="memory-answer forgot">还没记住</button><button type="button" class="memory-answer remembered">记住了</button>';
        actions.querySelector('.forgot').addEventListener('click', () => answerNotebookWord(item, card, false));
        actions.querySelector('.remembered').addEventListener('click', () => answerNotebookWord(item, card, true));
        card.appendChild(actions);
      }
      list.appendChild(card);
    });
  }
  function answerNotebookWord(item, card, remembered) {
    card.querySelectorAll('.memory-answer').forEach(button => { button.disabled = true; });
    const result = window.Review.reviewWord(settings.library, item.word, remembered);
    if (!result || result.action === 'missing' || result.action === 'early') { toast('这张词卡还没到复习时间'); renderMemoryNotebook(); return; }
    const meaning = card.querySelector('.memory-meaning');
    if (meaning) { meaning.classList.remove('locked'); meaning.textContent = (item.word.pos ? item.word.pos + ' ' : '') + (item.word.meaning || ''); }
    card.classList.remove('due'); card.classList.add('answered', remembered ? 'remembered' : 'forgotten');
    const actions = card.querySelector('.memory-actions'); if (actions) actions.remove();
    const meta = card.querySelector('.memory-meta');
    if (meta) meta.textContent = result.action === 'mastered' ? '全部周期完成 · 已真正记住' : (remembered ? '本轮通过 · 已安排下一周期' : '已记录没记住 · 20 分钟后重新检测');
    const resultTag = document.createElement('span'); resultTag.className = 'memory-result'; resultTag.textContent = remembered ? '✓ 记住了' : '↺ 还没记住'; card.appendChild(resultTag);
    // 防误触:作答后可撤销,恢复到点击前状态。
    const undoBtn = document.createElement('button'); undoBtn.type = 'button'; undoBtn.className = 'memory-undo'; undoBtn.textContent = '撤销';
    undoBtn.addEventListener('click', () => undoNotebookWord(item, card));
    card.appendChild(undoBtn);
    toast(remembered ? `${item.word.word}：本轮通过，中文释义已显示` : `${item.word.word}：已记录遗忘，从第一周期重新开始`);
    updateSrsUI();
    // 作答后的中文一直保留，直到用户关闭或重新打开记忆本；不再定时遮回去。
  }
  function undoNotebookWord(item, card) {
    const result = window.Review.undoReview(settings.library, item.word);
    if (!result || result.action !== 'undo') { toast('没有可撤销的操作'); return; }
    toast(`${item.word.word}：已撤销，恢复到作答前`);
    renderMemoryNotebook();
    updateSrsUI();
  }

  function escapeHTML(value) { const n = document.createElement('span'); n.textContent = value || ''; return n.innerHTML; }


  async function enableSrsNotifications() {
    if (!('Notification' in window)) { toast('当前浏览器不支持系统提醒，会继续使用页面弹提醒'); return; }
    if (Notification.permission === 'granted') { toast('系统复习提醒已开启'); return; }
    if (Notification.permission === 'denied') { toast('系统提醒已被浏览器关闭，请在浏览器网站设置中允许通知'); return; }
    const permission = await Notification.requestPermission();
    toast(permission === 'granted' ? '系统复习提醒已开启 ✓' : '未允许系统提醒，仍会在页面内提醒');
  }

  function notifySrsDue(count) {
    const message = `有 ${count} 个单词到复习时间了，点击词卡确认本轮记忆。`;
    toast('复习 · ' + message);
    if ('Notification' in window && Notification.permission === 'granted') new Notification('WordPaper · 复习提醒', { body: message });
  }

  function startSrsTicker() {
    clearInterval(srsTimer);
    srsTimer = setInterval(() => {
      if (!settings.srsEnabled) return;
      const newlyDue = updateSrsUI();
      // 每一批新增到期词都重绘一次；不再用同一 tick 内两个必然相等的计数比较。
      if (newlyDue > 0) refresh(false);
    }, 30000);
    setInterval(syncPetMemoryEvents, 15000);
  }

  async function syncPetMemoryEvents() {
    if (petMemorySyncing || !window.Review || !settings || !settings.srsEnabled) return;
    petMemorySyncing = true;
    const storedCursor = window.Store.read('petMemoryCursor', {});
    const cursor = storedCursor && typeof storedCursor === 'object' ? storedCursor : { streamId: '', lastId: Number(storedCursor) || 0 };
    try {
      const r = await fetch(`pet-memory-events.json?after=${Number(cursor.lastId) || 0}&stream=${encodeURIComponent(cursor.streamId || '')}`, { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json(); const events = Array.isArray(data.events) ? data.events : [];
      const snapshot = data.reset && Array.isArray(data.snapshot) ? data.snapshot : [];
      snapshot.concat(events).forEach(event => {
        if (event.word && event.library) window.Review.rememberWord(event.library, event.word);
      });
      window.Store.write('petMemoryCursor', { streamId: String(data.streamId || ''), lastId: Number(data.lastId) || 0 });
      if (events.length || snapshot.length) {
        updateSrsUI(); if ($('#memory-modal') && !$('#memory-modal').hidden) renderMemoryNotebook();
        toast(data.reset ? `已从小词灵恢复 ${snapshot.length} 个首轮记录` : `小词灵已记录 ${events.length} 个首轮词并自动补位`);
      }
    } catch (e) { /* 独立网页或伴侣未运行时静默跳过 */ }
    finally { petMemorySyncing = false; }
  }

  let petContextTimer = null;
  function syncCompanionLearningContext() {
    clearTimeout(petContextTimer);
    petContextTimer = setTimeout(async () => {
      if (!settings) return;
      try {
        await fetch('pet-sync.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            library: settings.library, wordsPerGroup: settings.wordsPerGroup,
            uiTheme: settings.uiTheme,
            wallpaperTheme: settings.theme,
            bgPattern: settings.bgPattern,
            petTransition: window.Store.read('petTransition', 'dissolve-pop'),
            webOrigin: window.location.origin,
            knownWords: Array.from(window.Store.getKnownWords(settings.library)),
            customWords: settings.library === 'custom' ? window.Store.getCustomWords() : undefined,
          }),
        });
      } catch (e) { /* 伴侣未运行时静默跳过 */ }
    }, 180);
  }

  function downloadPNG() {
    if (!currentCanvas) return;
    const { w, h } = getSize();
    const a = document.createElement('a');
    a.download = `wallpaper-${settings.layout}-${w}x${h}-${window.Words.dateKey(new Date())}.png`;
    a.href = window.Render.toPNG(currentCanvas);
    document.body.appendChild(a); a.click(); a.remove();
    toast('PNG 已下载，可以设为壁纸了');
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

  function setPetDockState(state, status, label, disabled) {
    const dock = $('#pet-dock');
    const dockBtn = $('#btn-pet-dock');
    const dockStatus = $('#pet-dock-status');
    // 小词灵是工作台能力，不因公网模式或账号归属冲突而从界面消失。
    if (dock) {
      dock.hidden = false;
      dock.dataset.state = state;
    }
    if (dockStatus) dockStatus.textContent = status;
    if (dockBtn) {
      dockBtn.textContent = label;
      dockBtn.disabled = Boolean(disabled);
      dockBtn.dataset.action = companionAction;
      dockBtn.setAttribute('aria-pressed', state === 'active' ? 'true' : 'false');
    }
  }

  function handleCompanionAction() {
    if (companionAction === 'control') return togglePet();
    if (companionAction === 'download') return downloadCompanion();
    if (companionAction === 'switch-account') return window.Store.logout();
    return enableCompanion();
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
      await syncCompanionButton();
      syncCompanionLearningContext();
    } catch (e) {
      toast('启动失败：' + e.message + '（请用 node server.js 打开本站）');
    } finally {
      [btn, topBtn, dockBtn].filter(Boolean).forEach(b => {
        if (!b.textContent.includes('运行中') && !b.textContent.includes('已开启')) b.disabled = false;
      });
    }
  }

  async function syncCompanionButton() {
    const btn = $('#btn-companion');
    setPetDockState('checking', '正在检查这台 Mac 上的小词灵…', '检查中…', true);
    try {
      const response = await fetch('status.json');
      if (!response.ok) throw new Error('status unavailable');
      const j = await response.json();
      if (j && j.available === false) {
        petOn = false;
        const isPublic = j.mode === 'public';
        companionAction = isPublic ? 'download' : 'switch-account';
        if (btn) {
          btn.textContent = isPublic ? '下载 Mac 桌面伴侣' : '切换到绑定账号';
          btn.disabled = false;
        }
        setPetDockState(
          'unavailable',
          isPublic
            ? '网页端已保留小词灵入口；下载 Mac 独立版后即可常驻桌面'
            : '本机小词灵已绑定另一个账号；切换到绑定账号即可安全召唤',
          isPublic ? '下载 Mac 版 ↓' : '切换账号 →',
          false
        );
        const hint = $('#pet-hint');
        if (hint) hint.textContent = isPublic
          ? '公网服务只同步账号数据；桌面伴侣需安装在自己的 Mac 上。'
          : '为保护不同账号的学习记录，当前账号不能直接控制已绑定的小词灵。';
        return;
      }
      // 伴侣页（8771）给 config；主 server（8770）探测到伴侣后给 companion:true
      const running = !!(j && (j.config || j.companion));
      companionAction = running ? 'control' : 'start';
      if (running) {
        if (btn) { btn.textContent = '桌面伴侣运行中'; btn.disabled = true; }
        const topBtn = $('#btn-companion-top');
        if (topBtn) { topBtn.textContent = '桌面宠物已开启'; topBtn.disabled = true; }
        syncPetControls(j);
        // 伴侣在线即把当前特效同步过去:特效值变了 companion 会重建小窗,无需手动刷新。
        syncCompanionLearningContext();
      } else {
        petOn = false;
        if (btn) { btn.textContent = '一键启用桌面伴侣'; btn.disabled = false; }
        setPetDockState('ready', '已整合到工作台，点一下把今日单词带到 Mac 桌面', '启动小词灵 ↗', false);
      }
    } catch (_) {
      companionAction = 'start';
      if (btn) { btn.textContent = '一键启用桌面伴侣'; btn.disabled = false; }
      setPetDockState('ready', '暂未连接桌面伴侣，点一下即可重新启动', '启动小词灵 ↗', false);
    }
  }

  let petOn = false;
  function syncPetControls(j) {
    const box = $('#pet-controls');
    if (!box) return;
    box.style.display = 'block';
    petOn = !!(j && j.pet);
    companionAction = 'control';
    const btn = $('#btn-pet-toggle');
    if (btn) btn.textContent = petOn ? '隐藏宠物' : '召唤宠物';
    setPetDockState(
      petOn ? 'active' : 'ready',
      petOn ? '小词灵正在桌面陪你背词，点这里可以收起它' : '桌面伴侣已经开启，点这里让小词灵出现',
      petOn ? '隐藏小词灵' : '召唤小词灵 ↗',
      false
    );
    const hint = $('#pet-hint');
    if (hint) hint.textContent = '点击词卡＝记住 · 按住空白处拖动 · 拖右下角 ⤡ 调大小';
  }

  async function togglePet() {
    const btn = $('#btn-pet-toggle');
    const dockBtn = $('#btn-pet-dock');
    [btn, dockBtn].filter(Boolean).forEach(button => { button.disabled = true; });
    try {
      const action = petOn ? 'close' : 'open';
      const r = await fetch('pet.php?action=' + action, { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || '桌面伴侣没有响应');
      petOn = !!j.pet;
      if (btn) btn.textContent = petOn ? '隐藏宠物' : '召唤宠物';
      setPetDockState(
        petOn ? 'active' : 'ready',
        petOn ? '小词灵正在桌面陪你背词，点这里可以收起它' : '桌面伴侣已经开启，点这里让小词灵出现',
        petOn ? '隐藏小词灵' : '召唤小词灵 ↗',
        false
      );
      toast(petOn ? '小词灵已召唤 ✓（点击单词即可记住）' : '小词灵已隐藏');
    } catch (e) {
      toast('操作失败：' + e.message);
      await syncCompanionButton();
    }
    [btn, dockBtn].filter(Boolean).forEach(button => { button.disabled = false; });
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

  function bindPersistenceUI() {
    const status = $('#sync-status');
    const accountName = $('#account-name');
    const legacyButton = $('#btn-import-legacy');
    const setStatus = detail => {
      if (!status) return;
      const state = detail && detail.state || 'saved';
      status.dataset.state = state;
      status.textContent = state === 'saving' ? '保存中…'
        : state === 'error' ? '未保存'
        : state === 'conflict' ? '有冲突'
        : '已同步';
      if (detail && detail.message) status.title = detail.message;
    };
    window.addEventListener('wordpaper:sync-status', event => {
      setStatus(event.detail);
      if (event.detail && event.detail.message) toast(event.detail.message);
    });
    window.addEventListener('wordpaper:storage-warning', event => {
      if (event.detail && event.detail.message) toast(event.detail.message);
    });
    window.addEventListener('wordpaper:legacy-available', () => {
      if (legacyButton) legacyButton.hidden = false;
    });
    if (legacyButton) legacyButton.addEventListener('click', async () => {
      if (!window.confirm('把这个浏览器里检测到的旧版 WordPaper 数据导入当前账号吗？当前账号中的同类数据会被替换。')) return;
      legacyButton.disabled = true;
      const imported = await window.Store.importLegacy();
      if (imported) location.reload();
      else { legacyButton.disabled = false; toast('旧数据尚未导入，请检查同步状态后重试'); }
    });
    const logout = $('#btn-logout');
    if (logout) logout.addEventListener('click', () => window.Store.logout());
    return () => {
      const user = window.Store.currentUser();
      if (accountName && user) accountName.textContent = user.username;
      setStatus({ state: 'saved' });
    };
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

  /* Liquid 主题的滑块进度条：按当前值更新 --pct，WebKit 轨道据此填充蓝色进度。 */
  function syncRangeFill(input) {
    const min = parseFloat(input.min) || 0, max = parseFloat(input.max) || 100, val = parseFloat(input.value);
    input.style.setProperty('--pct', (((val - min) / (max - min)) * 100) + '%');
  }
  document.addEventListener('input', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'range') syncRangeFill(e.target);
  }, { passive: true });

  async function init() {
    const showAccount = bindPersistenceUI();
    await window.Store.init();
    showAccount();
    loadSettings();
    seedOnce();
    fillSizeSelect();
    applySettingsToUI();
    $$('input[type="range"]').forEach(syncRangeFill);
    bindControls();
    bindLiquidGlassMotion();
    initModuleLayout();
    renderReminderUI();
    loadLibraryCounts();
    loadBgImage();
    await refresh(false);
    openRequestedMemoryNotebook();
    startSrsTicker();
    syncPetMemoryEvents();
    syncCompanionLearningContext();
    window.Engine.markDay();
    if (!window.Store.read('dragHint', false)) {
      setTimeout(() => toast('按住预览里的单词块 / 提醒块 / 自定义文字，可以直接拖到任意位置'), 1500);
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
