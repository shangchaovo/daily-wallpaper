/* review.js — 艾宾浩斯遗忘曲线记忆轮换。把「记好了」的单词组按经典间隔
 * （20分钟 / 1小时 / 9小时 / 1天 / 2天 / 3天 / 6天 / 15天）排期，到期后混回壁纸复习。
 * 纯本地：状态存 localStorage（Store 的 `review` 键）。IIFE -> 全局 `Review`。 */
(function () {
  'use strict';

  // 经典艾宾浩斯复习间隔（分钟）。stage 索引到这条数组。
  var INTERVALS_MIN = [20, 60, 540, 1440, 2880, 4320, 8640, 17280];

  function nowMs() { return Date.now(); }

  /* 一个单词的稳定 key：用词本身 + 释义，足够区分同库里的词。 */
  function wordKey(w) {
    return (w && w.word ? String(w.word) : '') + '|' + (w && w.meaning ? String(w.meaning) : '');
  }

  /* 一组单词的稳定 key：把组内各词 key 排序后连接，顺序无关（同一组词任何排列同 key）。 */
  function groupKeyFor(words) {
    return (words || []).map(wordKey).sort().join(';;');
  }

  /* 取出某词库的复习状态（没有则给空壳）。 */
  function getLib(lib) {
    var all = window.Store.getReview();
    var L = all[lib];
    if (!L || typeof L !== 'object') L = { cursor: 0, groups: {} };
    if (!L.groups) L.groups = {};
    if (typeof L.cursor !== 'number') L.cursor = 0;
    return L;
  }
  function saveLib(lib, L) {
    var all = window.Store.getReview();
    all[lib] = L;
    window.Store.saveReview(all);
  }

  /* 当前壁纸这组词对应的 groupKey（供「记好了」标记 / 状态显示用）。 */
  function currentGroupKey(sel) {
    return sel && sel.words && sel.words.length ? groupKeyFor(sel.words) : '';
  }

  /* 该词库里「已学过、未到最终阶段」的复习组（按到期时间升序）。 */
  function activeGroups(lib) {
    var L = getLib(lib);
    var out = [];
    Object.keys(L.groups).forEach(function (k) {
      var g = L.groups[k];
      if (g && g.words && g.words.length && g.stage < INTERVALS_MIN.length) out.push(g);
    });
    out.sort(function (a, b) { return (a.due || 0) - (b.due || 0); });
    return out;
  }

  /* 到期的复习组（due <= now）。可能多个，全都要复习。 */
  function dueGroups(lib, now) {
    var t = (now == null ? nowMs() : now);
    return activeGroups(lib).filter(function (g) { return (g.due || 0) <= t; });
  }

  /* 下一次复习到期的毫秒时间戳；没有排期则 null。 */
  function soonestDue(lib) {
    var a = activeGroups(lib);
    return a.length ? (a[0].due || null) : null;
  }

  /* 把当前这组标记为「记好了」：登记进复习队列（stage=0，20 分钟后首次到期），
   * 并把游标前移到「下一组新词」。返回 { group, nextOffset }。 */
  function learn(lib, words) {
    var L = getLib(lib);
    var key = groupKeyFor(words);
    var t = nowMs();
    var g = L.groups[key];
    if (g) {
      // 已经学过：重新点亮复习（不丢历史，只把下次到期拉到第一档）。
      g.learnedCount = (g.learnedCount || 0) + 1;
      (g.learnedLog = g.learnedLog || []).push(t);
      // 若已全部复习完，重新从 0 开始一轮；否则保持当前 stage 重新计时。
      if (g.stage >= INTERVALS_MIN.length) g.stage = 0;
      g.due = t + INTERVALS_MIN[Math.min(g.stage, INTERVALS_MIN.length - 1)] * 60000;
    } else {
      g = L.groups[key] = {
        words: words,
        learnedAt: t,
        stage: 0,
        due: t + INTERVALS_MIN[0] * 60000,
        learnedCount: 1,
        learnedLog: [t],
      };
    }
    L.cursor = (L.cursor || 0) + 1;
    saveLib(lib, L);
    return { group: g, cursor: L.cursor };
  }

  /* 复习组被「又看了一遍」后推进到下一阶段（下次到期按更长间隔）。 */
  function advanceStage(lib, groupKey) {
    var L = getLib(lib);
    var g = L.groups[groupKey];
    if (!g) return null;
    g.stage = Math.min((g.stage || 0) + 1, INTERVALS_MIN.length);
    if (g.stage < INTERVALS_MIN.length) {
      g.due = nowMs() + INTERVALS_MIN[g.stage] * 60000;
    } else {
      g.due = null; // 已完成全部复习轮次
    }
    saveLib(lib, L);
    return g;
  }

  /* 统计：某词库已学组数 / 待复习组数 / 已彻底记住组数。 */
  function stats(lib) {
    var L = getLib(lib);
    var total = 0, pending = 0, done = 0;
    Object.keys(L.groups).forEach(function (k) {
      var g = L.groups[k]; if (!g) return;
      total++;
      if (g.stage >= INTERVALS_MIN.length) done++; else pending++;
    });
    return { total: total, pending: pending, done: done, cursor: L.cursor || 0 };
  }

  /* 清空某词库的记忆进度（换库重来时用）。 */
  function reset(lib) {
    var all = window.Store.getReview();
    delete all[lib];
    window.Store.saveReview(all);
  }

  window.Review = {
    INTERVALS_MIN: INTERVALS_MIN,
    wordKey: wordKey,
    groupKeyFor: groupKeyFor,
    currentGroupKey: currentGroupKey,
    getLib: getLib,
    activeGroups: activeGroups,
    dueGroups: dueGroups,
    soonestDue: soonestDue,
    learn: learn,
    advanceStage: advanceStage,
    stats: stats,
    reset: reset,
  };
})();
