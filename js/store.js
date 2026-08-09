/* store.js — localStorage persistence, namespaced `wp:`. IIFE -> global `Store`. */
(function () {
  'use strict';
  const NS = 'wp:';

  const DEFAULT_SETTINGS = {
    library: 'ielts',          // see LIBRARIES in app.js (chuzhong/gaozhong/cet4/.../custom)
    layout: 'group',           // 'group' | 'poster'
    size: 'phone-1080x2400',   // see SIZES in app.js
    theme: 'cream',            // theme key, see THEMES in app.js
    bgPattern: 'soft',         // 'none'|'soft'|'dots'|'grid'|'diag'|'waves'|'blobs'
    wordsPerGroup: 6,          // words shown in 'group' layout
    order: 'sequential',       // 'sequential' | 'random'
    // typography
    fontScale: 1.0,            // 0.7 – 1.6 multiplier on word sizes
    fontWeight: 700,           // word weight 400–800
    fontStyle: 'yuan',         // 'hei'|'song'|'kai'|'yuan'|'heiti' (system font stacks)
    inkOverride: '',           // '' = use theme.ink; else a css color for ALL text
    letterSpacing: 0,          // px letter spacing on the word (group + poster)
    lineHeight: 1.0,           // multiplier on row/line gaps (group + poster)
    // background
    bgImage: null,             // dataURL string of a user-uploaded photo (or null)
    bgScrim: 0.42,             // 0..1 light overlay over bgImage for legibility
    // layout anchors + free nudge offsets (fractions of W/H, -1..1)
    anchorWords: 'center',     // 'top'|'center'|'bottom'
    anchorReminders: 'bottom', // 'top'|'center'|'bottom'
    offWords: { x: 0, y: 0 },  // drag nudge, fraction of W/H
    offReminders: { x: 0, y: 0 },
    // refresh
    autoRefreshDaily: true,    // new group each calendar day
    rotateEnabled: false,      // timed rotation (live mode)
    rotateMinutes: 30,         // rotation interval
    cycleEnabled: false,       // whole-page cycling words<->reminders in live mode
    cycleSeconds: 120,         // page cycle interval
    showPhonetic: true,
    showExample: true,
    showReminders: true,
    srsEnabled: true,          // 艾宾浩斯记忆轮换：到期的旧单词组混回壁纸复习
    antiTouch: true,           // require long-press to interact (live mode)
    antiTouchMs: 1200,         // long-press duration to unlock
    custom: {                  // custom text overlay (free-floating blocks)
      enabled: false,
      title: '',
      footer: '',
      pos: {},                 // { title:{x,y,scale}, footer:{x,y,scale} } fractions 0..1
    },
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch (e) {
      /* QuotaExceededError — caller may surface a backup hint */
    }
  }

  const Store = {
    getSettings() {
      const s = read('settings', {});
      // Merge over defaults so new keys appear on upgrade.
      const merged = Object.assign({}, DEFAULT_SETTINGS, s);
      merged.custom = Object.assign({}, DEFAULT_SETTINGS.custom, s.custom || {});
      merged.custom.pos = Object.assign({}, (s.custom && s.custom.pos) || {});
      merged.offWords = Object.assign({}, DEFAULT_SETTINGS.offWords, s.offWords || {});
      merged.offReminders = Object.assign({}, DEFAULT_SETTINGS.offReminders, s.offReminders || {});
      return merged;
    },
    saveSettings(settings) {
      write('settings', settings);
    },

    // Custom / imported words (user's own library). Array of word objects.
    getCustomWords() {
      const w = read('customWords', []);
      return Array.isArray(w) ? w : [];
    },
    saveCustomWords(words) {
      write('customWords', words);
    },

    // Reminders for "today". Array of {id,text,time?,done?,kind}
    getReminders() {
      const r = read('reminders', []);
      return Array.isArray(r) ? r : [];
    },
    saveReminders(list) {
      write('reminders', list);
    },

    // Rotation/refresh engine state (last date served, cursor position, etc.)
    getEngine() {
      return read('engine', {});
    },
    saveEngine(obj) {
      write('engine', obj);
    },

    // SRS (艾宾浩斯) review state, per library:
    // { [libId]: { cursor: n,
    //   groups: { [groupKey]: { words:[], learnedAt, stage, due, learnedCount, learnedLog:[] } } } }
    getReview() {
      const r = read('review', {});
      return (r && typeof r === 'object') ? r : {};
    },
    saveReview(obj) {
      write('review', obj);
    },

    getSeeded() {
      return read('seeded', false);
    },
    setSeeded() {
      write('seeded', true);
    },

    // Generic helpers for one-off keys (e.g. live-mode UI prefs)
    read,
    write,
    NS,
  };

  window.Store = Store;
})();
