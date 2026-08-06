/* ocr.js — screenshot/photo word extraction via Apple Vision (zero-dep, macOS).
 * IIFE -> `OCR`. Falls back gracefully when off-Mac or off localhost. */
(function () {
  'use strict';

  function available() {
    // OCR is performed by the local companion server on macOS only.
    return fetch('ocr.php', { method: 'HEAD' })
      .then(r => r.ok)
      .catch(() => false);
  }
  function recognize(blob) {
    var fd = new FormData();
    fd.append('image', blob, 'shot.png');
    return fetch('ocr.php', { method: 'POST', body: fd })
      .then(r => {
        if (!r.ok) throw new Error('ocr http ' + r.status);
        return r.json();
      })
      .then(d => (d && d.text) || '');
  }

  /* Turn OCR'd text into word entries. OCR lines from a word list are usually
   * "word  /phonetic/  pos meaning" or just "word meaning". We pull out the
   * leading English token as the word and keep the rest as the meaning. */
  function textToWords(text) {
    var out = [];
    var lines = String(text || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      // leading latin token (allow hyphen/apostrophe)
      var m = /^([A-Za-z][A-Za-z'\-]{1,})\b[\s,:;·\-]*(.*)$/.exec(line);
      if (!m) continue;
      var word = m[1];
      var rest = (m[2] || '').trim();
      // skip obvious non-words (dates, pure headers)
      if (word.length < 2) continue;
      var entry = { word: word };
      var ph = /(\/[^\/]+\/|\[[^\]]+\])/.exec(rest);
      if (ph) { entry.phonetic = ph[1]; rest = rest.replace(ph[1], '').trim(); }
      if (rest) entry.meaning = rest;
      out.push(entry);
    }
    return out;
  }

  window.OCR = { available, recognize, textToWords };
})();
