#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

async function waitForServer(base) {
  for (let i = 0; i < 60; i++) {
    try { const response = await fetch(base + '/status.json'); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('test companion did not start');
}

async function json(base, url, options) {
  const response = await fetch(base + url, options);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wordpaper-companion-test-'));
  const statePath = path.join(temp, 'state.json');
  const configPath = path.join(temp, 'config.json');
  const customWordsPath = path.join(temp, 'custom-words.json');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'companion.js')], {
    cwd: path.join(__dirname, '..'), stdio: 'ignore',
    env: Object.assign({}, process.env, {
      WORDPAPER_TEST_MODE: '1', WORDPAPER_PORT: String(port),
      WORDPAPER_COMPANION_DATA_DIR: temp,
      WORDPAPER_STATE_PATH: statePath, WORDPAPER_CONFIG_PATH: configPath, WORDPAPER_CUSTOM_WORDS_PATH: customWordsPath,
    }),
  });
  try {
    await waitForServer(base);
    const sync = await json(base, '/pet-sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library: 'jlpt_n5', wordsPerGroup: 5, uiTheme: 'anime', knownWords: [] }),
    });
    assert.equal(sync.status, 200); assert.equal(sync.data.words, 6, 'odd pet counts must fill the final two-column slot');
    assert.equal(sync.data.uiTheme, 'anime');
    assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).uiTheme, 'anime', 'pet theme must persist atomically');
    await json(base, '/pet-render.php?w=320&h=360', { method: 'POST' });

    const stateBefore = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const pageBefore = stateBefore.petDecksByLibrary.jlpt_n5.pages[stateBefore.petDecksByLibrary.jlpt_n5.index];
    const themeOnlyKeys = pageBefore.words.map(word => `${word.word}|${word.meaning}`);
    const themeOnly = await json(base, '/pet-sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library: 'jlpt_n5', wordsPerGroup: 5, uiTheme: 'liquid', knownWords: [] }),
    });
    assert.equal(themeOnly.data.uiTheme, 'liquid');
    const afterThemeOnly = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.deepEqual(afterThemeOnly.petDecksByLibrary.jlpt_n5.pages[afterThemeOnly.petDecksByLibrary.jlpt_n5.index].words.map(word => `${word.word}|${word.meaning}`), themeOnlyKeys, 'theme switch must not replace the learning queue');
    const invalidTheme = await json(base, '/pet-sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library: 'jlpt_n5', wordsPerGroup: 5, uiTheme: 'neon', knownWords: [] }),
    });
    assert.equal(invalidTheme.data.uiTheme, 'liquid', 'invalid themes must preserve the current pet theme');
    const firstWord = pageBefore.words[0];
    const key = String(firstWord.word || '') + '|' + String(firstWord.meaning || '');
    const getMutation = await fetch(base + `/remember.php?i=0&key=${encodeURIComponent(key)}`);
    assert.equal(getMutation.status, 405, 'GET must never mutate learning state');
    const crossOrigin = await fetch(base + `/remember.php?i=0&key=${encodeURIComponent(key)}`, { method: 'POST', headers: { Origin: 'https://example.com' } });
    assert.equal(crossOrigin.status, 403, 'external origins must not mutate local learning state');

    const learned = await json(base, `/remember.php?i=0&key=${encodeURIComponent(key)}`, { method: 'POST' });
    assert.equal(learned.status, 200); assert.equal(learned.data.visibleWords, 6); assert.equal(learned.data.refilled, true);
    const staleRetry = await json(base, `/remember.php?i=0&key=${encodeURIComponent(key)}`, { method: 'POST' });
    assert.equal(staleRetry.status, 409, 'replayed click must not learn the replacement word');

    const afterFirst = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const currentPage = afterFirst.petDecksByLibrary.jlpt_n5.pages[afterFirst.petDecksByLibrary.jlpt_n5.index];
    const replacement = currentPage.words[0];
    const replacementKey = String(replacement.word || '') + '|' + String(replacement.meaning || '');
    assert.notEqual(replacementKey, key, 'the removed word slot must contain a different candidate');
    const learnedAgain = await json(base, `/remember.php?i=0&key=${encodeURIComponent(replacementKey)}`, { method: 'POST' });
    assert.equal(learnedAgain.status, 200); assert.equal(learnedAgain.data.visibleWords, 6, 'continuous learning must refill every click');

    const reset = await json(base, '/pet-memory-events.json?after=999999&stream=old-stream');
    assert.equal(reset.data.reset, true); assert.equal(reset.data.snapshot.length, 2, 'snapshot must recover truncated/reset streams');
    const stream = await json(base, `/pet-memory-events.json?after=0&stream=${encodeURIComponent(reset.data.streamId)}`);
    assert.equal(stream.data.events.length, 2);

    const next = await json(base, '/pet-page.php?dir=1', { method: 'POST' });
    const previous = await json(base, '/pet-page.php?dir=-1', { method: 'POST' });
    assert.equal(next.status, 200); assert(next.data.page >= 2); assert.equal(next.data.words, 6);
    assert.equal(previous.data.page, 1); assert.equal(previous.data.words, 6);

    await json(base, '/pet-sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library: 'cet6', wordsPerGroup: 4, uiTheme: 'editorial', knownWords: [] }),
    });
    await json(base, '/pet-render.php?w=320&h=360', { method: 'POST' });
    const stateCet6 = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert(stateCet6.petDecksByLibrary.jlpt_n5 && stateCet6.petDecksByLibrary.cet6, 'library decks must be isolated');
    assert(stateCet6.petLearnedByLibrary.jlpt_n5, 'first-pass learned state must be namespaced by library');

    const customWords = [
      { word: 'komorebi', phonetic: '/custom-1/', pos: 'n.', meaning: '叶隙间的阳光' },
      { word: 'sobremesa', phonetic: '/custom-2/', pos: 'n.', meaning: '餐后闲谈' },
    ];
    const customSync = await json(base, '/pet-sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library: 'custom', wordsPerGroup: 4, knownWords: [], customWords }),
    });
    assert.equal(customSync.status, 200); assert.equal(customSync.data.words, 2);
    assert.deepEqual(JSON.parse(fs.readFileSync(customWordsPath, 'utf8')).map(word => word.word), ['komorebi', 'sobremesa']);
    const stateCustom = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(stateCustom.petDecksByLibrary.custom.pages[0].words.length, 2, 'custom words must enter the pet deck');
    JSON.parse(fs.readFileSync(statePath, 'utf8'));
    console.log('PASS companion learning (6 continuous slots, theme sync, repeated refill, prev/next, custom library, POST/local-only, stale retry, stream snapshot, library isolation, atomic JSON)');
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
