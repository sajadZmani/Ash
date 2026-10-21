/*
 * Picks the next word. Words come from data/words.js (built from words.txt), grouped by
 * category and level (1 easy, 2 medium, 3 hard).
 *
 * A word shown on this phone is remembered in ash.used and is not shown again, in this game or
 * the next ones. When a category has no unseen words left at the wanted levels, that category
 * starts over (except for words already shown in the current game).
 */
(function (root) {
  'use strict';

  var S = root.AStore;
  var CATS = root.ASH_WORDS || [];

  var LEVELS = {
    easy: [1],
    mixed: [1, 2, 3],
    hard: [2, 3]
  };

  // «پله‌پله»: easy words for the first two rounds, then medium for two, then hard.
  function stepLevels(correct, teams) {
    var round = Math.floor(correct / Math.max(teams, 1));
    return round < 2 ? [1] : round < 4 ? [2] : [3];
  }

  function wordsOf(cat, levels) {
    var out = [];
    levels.forEach(function (l) {
      (cat.w[l - 1] || []).forEach(function (w) { out.push([w, l]); });
    });
    return out;
  }

  function toSet(list) {
    var set = {};
    list.forEach(function (w) { set[w] = true; });
    return set;
  }

  var Words = {
    categories: function () {
      return CATS.map(function (c) {
        return { name: c.name, count: c.w[0].length + c.w[1].length + c.w[2].length };
      });
    },

    total: function () {
      return Words.categories().reduce(function (n, c) { return n + c.count; }, 0);
    },

    levelsFor: function (difficulty, correct, teams) {
      return difficulty === 'steps' ? stepLevels(correct, teams) : LEVELS[difficulty] || LEVELS.mixed;
    },

    /*
     * opts: {levels, off: [category names], shown: [words already in this game], last: category}
     * Returns {word, cat, level} and marks the word as used, or null if nothing fits at all.
     */
    pick: function (opts) {
      var levels = opts.levels, off = toSet(opts.off || []), inGame = toSet(opts.shown || []);
      var usedList = S.used(), used = toSet(usedList);

      var cats = CATS.filter(function (c) { return !off[c.name] && wordsOf(c, levels).length; });
      if (!cats.length) cats = CATS.filter(function (c) { return wordsOf(c, levels).length; });
      if (!cats.length) { levels = [1, 2, 3]; cats = CATS; }

      var changed = false;
      var pools = cats.map(function (c) {
        var all = wordsOf(c, levels);
        var fresh = all.filter(function (x) { return !used[x[0]] && !inGame[x[0]]; });
        if (!fresh.length) {
          // This category ran out: forget its words (at these levels) and start it over.
          var mine = toSet(all.map(function (x) { return x[0]; }));
          usedList = usedList.filter(function (w) { return !mine[w] || inGame[w]; });
          used = toSet(usedList);
          changed = true;
          fresh = all.filter(function (x) { return !inGame[x[0]]; });
        }
        return { cat: c, words: fresh };
      }).filter(function (p) { return p.words.length; });

      if (!pools.length) { if (changed) S.saveUsed(usedList); return null; }

      // Try not to give the same category twice in a row.
      if (pools.length > 1 && opts.last) {
        var others = pools.filter(function (p) { return p.cat.name !== opts.last; });
        if (others.length) pools = others;
      }

      // Every unseen word has the same chance, so big categories are not used up first.
      var total = pools.reduce(function (n, p) { return n + p.words.length; }, 0);
      var r = Math.floor(Math.random() * total);
      for (var i = 0; i < pools.length; i++) {
        if (r < pools[i].words.length) break;
        r -= pools[i].words.length;
      }
      var pool = pools[Math.min(i, pools.length - 1)];
      var pick = pool.words[r] || pool.words[0];

      usedList.push(pick[0]);
      S.saveUsed(usedList);
      return { word: pick[0], cat: pool.cat.name, level: pick[1] };
    },

    usedCount: function () {
      var all = {};
      CATS.forEach(function (c) { c.w.forEach(function (l) { l.forEach(function (w) { all[w] = true; }); }); });
      return S.used().filter(function (w) { return all[w]; }).length;
    },

    resetUsed: function () { S.saveUsed([]); }
  };

  root.AWords = Words;
})(this);
