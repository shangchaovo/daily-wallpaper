/* reminders.js — today's reminder list + preset templates. IIFE -> `Reminders`. */
(function () {
  'use strict';

  const PRESETS = [
    { text: '背单词 30 分钟', time: '' },
    { text: '喝水 8 杯', time: '' },
    { text: '起身活动 / 拉伸', time: '' },
    { text: '阅读 20 分钟', time: '' },
    { text: '运动 / 健身', time: '' },
    { text: '冥想 10 分钟', time: '' },
    { text: '复习错题 / 笔记', time: '' },
    { text: '写日记 / 复盘', time: '' },
    { text: '不熬夜 / 23:00 前睡', time: '23:00' },
    { text: '记得吃水果', time: '' },
  ];

  function list() {
    return window.Store.getReminders();
  }

  function save(items) {
    window.Store.saveReminders(items);
  }

  function add(text, time) {
    const items = list();
    const t = (text || '').trim();
    if (!t) return items;
    items.push({
      id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
      text: t,
      time: time || '',
      done: false,
    });
    save(items);
    return items;
  }

  function remove(id) {
    const items = list().filter(r => r.id !== id);
    save(items);
    return items;
  }

  function toggle(id) {
    const items = list();
    const it = items.find(r => r.id === id);
    if (it) it.done = !it.done;
    save(items);
    return items;
  }

  function addPreset(preset) {
    return add(preset.text, preset.time);
  }

  function clearDone() {
    const items = list().filter(r => !r.done);
    save(items);
    return items;
  }

  /* Minutes until a "HH:MM" reminder today (for countdown display). Negative
   * when the time has passed. */
  function minutesUntil(time) {
    if (!time) return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!m) return null;
    const now = new Date();
    const target = new Date(now);
    target.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return Math.round((target.getTime() - now.getTime()) / 60000);
  }

  window.Reminders = { PRESETS, list, save, add, remove, toggle, addPreset, clearDone, minutesUntil };
})();
