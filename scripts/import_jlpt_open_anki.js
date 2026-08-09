#!/usr/bin/env node
/* Build the local JLPT N5/N4 vocabulary bundles from the MIT-licensed
 * jamsinclair/open-anki-jlpt-decks CSV source. The JLPT itself defines the
 * exam levels, but does not publish one prescribed vocabulary list; this
 * script intentionally preserves that provenance in the generated entries. */
'use strict';

const fs = require('fs');
const path = require('path');

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
    if (c === '"') { quoted = !quoted; continue; }
    if (!quoted && c === ',') { row.push(cell); cell = ''; continue; }
    if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; continue;
    }
    cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function build(input, output, level) {
  const rows = parseCsv(fs.readFileSync(input, 'utf8'));
  const seen = new Set();
  const entries = rows.slice(1).map(row => ({
    word: (row[0] || '').trim(), phonetic: (row[1] || '').trim(), meaning: (row[2] || '').trim(),
  })).filter(item => item.word && item.meaning).filter(item => {
    const key = item.word + '|' + item.phonetic;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(item => ({
    word: item.word,
    phonetic: item.phonetic ? '【' + item.phonetic + '】' : '',
    pos: 'JLPT ' + level,
    meaning: item.meaning,
    source: 'Open Anki JLPT Decks (MIT)',
  }));
  fs.writeFileSync(output, JSON.stringify(entries));
  return entries.length;
}

if (require.main === module) {
  const [n5, n4, out] = process.argv.slice(2);
  if (!n5 || !n4 || !out) throw new Error('usage: import_jlpt_open_anki.js N5.csv N4.csv output-dir');
  console.log('N5:', build(n5, path.join(out, 'words_jlpt_n5.json'), 'N5'));
  console.log('N4:', build(n4, path.join(out, 'words_jlpt_n4.json'), 'N4'));
}
