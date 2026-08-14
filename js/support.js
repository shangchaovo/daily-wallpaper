/* support.js — a small first-class Support & Feedback view. */
(function () {
  'use strict';

  const workspace = document.getElementById('workspace-view');
  const support = document.getElementById('support-view');
  const open = document.getElementById('btn-open-support');
  const close = document.getElementById('btn-close-support');
  const toast = document.getElementById('toast');

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setSupportVisible(visible) {
    workspace.hidden = visible;
    support.hidden = !visible;
    open.classList.toggle('on', visible);
    open.setAttribute('aria-pressed', visible ? 'true' : 'false');
    open.textContent = visible ? '♡ 正在支持与反馈' : '♡ 支持与反馈';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  open.addEventListener('click', () => setSupportVisible(true));
  close.addEventListener('click', () => setSupportVisible(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !support.hidden) setSupportVisible(false);
  });

  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const value = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
        showToast(button.dataset.copyLabel);
      } catch (_) {
        window.prompt('请复制：', value);
      }
    });
  });
})();
