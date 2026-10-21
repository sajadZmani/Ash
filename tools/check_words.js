#!/usr/bin/env node
/*
 * Checks the word list in data/words.js after editing it:
 *
 *   node tools/check_words.js
 *
 * Prints how many words each category has per level (easy / medium / hard) and lists duplicates
 * (even across categories, ignoring spaces and half-spaces), words with a missing or wrong level,
 * and words before the first "# category" line. Exits with 1 if it found any of those.
 * The game itself needs nothing from here; it reads data/words.js directly.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var FILE = path.join(__dirname, '..', 'data', 'words.js');
var source = fs.readFileSync(FILE, 'utf8');
var sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
var text = sandbox.window.ASH_WORDS_TEXT || '';

// Line number in data/words.js of the first line of the word text.
var offset = source.slice(0, source.indexOf('`')).split('\n').length - 1;

var cats = [], cat = null, seen = {}, problems = [];

text.split('\n').forEach(function (raw, i) {
  var line = raw.trim(), at = 'data/words.js:' + (offset + i + 1);
  if (!line) return;
  if (line[0] === '#') {
    cat = { name: line.slice(1).trim(), n: [0, 0, 0] };
    cats.push(cat);
    return;
  }
  if (!cat) { problems.push(at + ' word before any "# category" line: ' + line); return; }
  var bits = line.split('|'), word = bits[0].trim(), level = parseInt(bits[1], 10);
  if (!(level >= 1 && level <= 3)) { problems.push(at + ' level should be 1, 2 or 3 (counts as 2): ' + line); level = 2; }
  var key = word.replace(/[\s‌]/g, '');
  if (seen[key]) { problems.push(at + ' duplicate of ' + seen[key] + ' (skipped by the game): ' + word); return; }
  seen[key] = '«' + word + '» in «' + cat.name + '»';
  cat.n[level - 1]++;
});

var totals = [0, 0, 0];
cats.forEach(function (c) {
  c.n.forEach(function (n, l) { totals[l] += n; });
  console.log(c.name + ': ' + c.n.join(' / '));
});
console.log('\n' + cats.length + ' categories, ' + (totals[0] + totals[1] + totals[2]) + ' words (easy ' +
  totals[0] + ', medium ' + totals[1] + ', hard ' + totals[2] + ')');

if (problems.length) {
  console.log('\nTo fix:');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exit(1);
}
console.log('No problems found.');
