/* words.js — loads word libraries, deterministic daily selection. IIFE -> `Words`. */
(function () {
  'use strict';

  const cache = {}; // library id -> Promise<array>

  function loadLibrary(id) {
    if (id === 'custom') {
      return Promise.resolve(window.Store.getCustomWords());
    }
    if (!cache[id]) {
      cache[id] = fetch('data/words_' + id + '.json')
        .then(r => {
          if (!r.ok) throw new Error('load ' + id + ' failed: ' + r.status);
          return r.json();
        })
        .catch(() => []);
    }
    return cache[id];
  }

  // Deterministic 32-bit hash of a string (FNV-1a-ish) for seeding.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Mulberry32 PRNG — deterministic from a seed, so the same date always
  // yields the same daily group regardless of device/reload.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /* Pick `count` words for a given date. Sequential order walks the library
   * day by day; random order draws a seeded shuffle each day. Either way the
   * result is stable for the whole calendar day. */
  function pickForDate(list, count, dateStr, order) {
    if (!list || list.length === 0) return [];
    const n = Math.max(1, Math.min(count, list.length));
    const seed = hash(dateStr + '|' + order);
    if (order === 'random') {
      const rand = rng(seed);
      const idx = list.map((_, i) => i);
      // Fisher–Yates, take first n
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      return idx.slice(0, n).map(i => list[i]);
    }
    // sequential: day-of-epoch offset into the library
    const dayIndex = Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 86400000);
    const start = (dayIndex * n + (seed % 7)) % list.length;
    const out = [];
    for (let i = 0; i < n; i++) out.push(list[(start + i) % list.length]);
    return out;
  }

  window.Words = { loadLibrary, pickForDate, dateKey, hash };
})();
