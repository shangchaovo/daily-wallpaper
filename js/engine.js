/* engine.js — decides which words are "current": daily auto-refresh + optional
 * timed rotation + manual reshuffle. IIFE -> `Engine`. */
(function () {
  'use strict';

  /* Compute the current selection for the active library & settings.
   * Returns {dateStr, words, library, rotated:boolean}. */
  async function current(settings) {
    const list = await window.Words.loadLibrary(settings.library);
    const today = window.Words.dateKey(new Date());
    const eng = window.Store.getEngine();

    let dateStr = today;
    let words;

    if (settings.rotateEnabled && settings.library !== 'custom-empty') {
      // Timed rotation: bucket the day into intervals of rotateMinutes and pick
      // a seeded group per bucket, so it advances on its own yet is stable
      // within an interval (no flicker on reload).
      const now = new Date();
      const minutesIntoDay = now.getHours() * 60 + now.getMinutes();
      const bucket = Math.floor(minutesIntoDay / Math.max(1, settings.rotateMinutes));
      const rotKey = today + '#r' + bucket;
      const count = settings.layout === 'poster' ? 1 : settings.wordsPerGroup;
      // Use a hash of the rotation key as the date seed for a fresh group.
      words = window.Words.pickForDate(list, count, rotKey, settings.order === 'random' ? 'random' : 'seq-rot');
      return { dateStr, words, library: settings.library, rotated: true, bucket };
    }

    if (settings.autoRefreshDaily) {
      const count = settings.layout === 'poster' ? 1 : settings.wordsPerGroup;
      words = window.Words.pickForDate(list, count, today, settings.order);
    } else {
      // Manual mode: keep whatever was last frozen in engine state, else today.
      const frozen = eng.frozen;
      if (frozen && frozen.library === settings.library && Array.isArray(frozen.words)) {
        words = frozen.words;
        dateStr = frozen.dateStr || today;
      } else {
        const count = settings.layout === 'poster' ? 1 : settings.wordsPerGroup;
        words = window.Words.pickForDate(list, count, today, settings.order);
        freeze(settings.library, dateStr, words);
      }
    }
    return { dateStr, words, library: settings.library, rotated: false };
  }

  function freeze(library, dateStr, words) {
    const eng = window.Store.getEngine();
    eng.frozen = { library, dateStr, words };
    window.Store.saveEngine(eng);
  }

  /* Manual reshuffle: draw a fresh group for today using a random salt, and
   * freeze it so reloads keep it until the next manual refresh or day change. */
  async function reshuffle(settings) {
    const list = await window.Words.loadLibrary(settings.library);
    const today = window.Words.dateKey(new Date());
    const count = settings.layout === 'poster' ? 1 : settings.wordsPerGroup;
    const salt = 'manual-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    const words = window.Words.pickForDate(list, count, salt, 'random');
    freeze(settings.library, today, words);
    return { dateStr: today, words, library: settings.library, rotated: false };
  }

  /* Should the daily view roll over? Compare stored day vs today. */
  function isNewDay() {
    const eng = window.Store.getEngine();
    return eng.lastDay !== window.Words.dateKey(new Date());
  }

  function markDay() {
    const eng = window.Store.getEngine();
    eng.lastDay = window.Words.dateKey(new Date());
    window.Store.saveEngine(eng);
  }

  window.Engine = { current, reshuffle, isNewDay, markDay, freeze };
})();
