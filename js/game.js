/*
 * Game rules: teams of two, one time bank per team, turn order, penalties.
 * No DOM here; js/app.js draws the screens and calls these functions.
 *
 * Turn order: A1→A2, B1→B2, C1→C2, … then A2→A1, B2→B1, … Each team's explainer switches every
 * time that team gets the turn. Teams that are out are skipped.
 *
 * Only the first turn of a game waits for «آماده‌ام». After that, «درست!» hands over straight
 * away: the next team's word is shown and its clock starts while the phone is passed.
 */
(function (root) {
  'use strict';

  var S = root.AStore, W = root.AWords;

  var COLORS = ['#e4572e', '#17a398', '#7b5cd6', '#e9a10a', '#2d7dd2', '#c2407a'];

  var g = null;        // the game in progress (also saved as ash.game)
  var timer = null;
  var lastSaved = 0;

  function save() { if (g) S.saveGame(g); lastSaved = Date.now(); }

  function team() { return g.teams[g.current]; }

  function alive() { return g.teams.filter(function (t) { return !t.out; }); }

  function nextAlive(from) {
    for (var i = 1; i <= g.teams.length; i++) {
      var j = (from + i) % g.teams.length;
      if (!g.teams[j].out) return j;
    }
    return from;
  }

  function newWord() {
    var levels = W.levelsFor(g.difficulty, g.correct, g.teams.length);
    var w = W.pick({ levels: levels, off: g.off, shown: g.shown, last: g.word && g.word.cat });
    if (!w) w = { word: '؟', cat: '', level: 1 };
    g.shown.push(w.word);
    g.word = w;
  }

  function stopClock() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startClock() {
    stopClock();
    g.lastTick = Date.now();
    timer = setInterval(tick, 100);
  }

  function tick() {
    if (!g || g.phase !== 'turn' || g.paused) { stopClock(); return; }
    var now = Date.now(), t = team();
    var before = Math.ceil(t.time / 1000);
    t.time -= now - g.lastTick;
    g.lastTick = now;
    var after = Math.ceil(t.time / 1000);
    if (t.time <= 0) { teamOut(); return; }
    if (after !== before) Game.onSecond(after);
    Game.onTick();
    if (now - lastSaved > 1000) save();
  }

  // The team whose turn it is ran out of time.
  function teamOut() {
    stopClock();
    var t = team();
    t.time = 0;
    t.out = true;
    t.outRank = g.teams.length - alive().length; // 1 = first team out
    if (g.word) t.lost.push(g.word.word);
    g.word = null;
    var left = alive();
    if (left.length <= 1) {
      g.phase = 'over';
      g.winner = left.length ? g.teams.indexOf(left[0]) : g.current;
    } else {
      // The next team plays on; its clock waits until the «حذف شد» popup is closed.
      g.current = nextAlive(g.current);
      newWord();
      g.paused = true;
    }
    save();
    Game.onOut(t);
  }

  var Game = {
    COLORS: COLORS,

    // Hooks set by app.js.
    onTick: function () {},
    onSecond: function () {},
    onOut: function () {},

    state: function () { return g; },

    // teams: [{name, players: [explains first, listens first]}]
    start: function (teams) {
      var st = S.settings();
      g = {
        teams: teams.map(function (t, i) {
          return { name: t.name, color: COLORS[i], players: t.players.slice(), time: st.time * 1000,
            turns: 0, out: false, outRank: 0, words: [], lost: [] };
        }),
        time: st.time,
        penalty: st.penalty,
        difficulty: st.difficulty,
        off: st.off.slice(),
        showCategory: st.showCategory,
        current: 0,
        phase: 'pass',  // pass (first turn, word hidden until «آماده‌ام») | turn | over
        paused: false,
        word: null,
        shown: [],
        correct: 0,
        winner: -1
      };
      save();
      return g;
    },

    // A game saved before a refresh. A turn that was running comes back paused.
    restore: function () {
      var saved = S.game();
      if (!saved || !saved.teams || saved.phase === 'over') return null;
      g = saved;
      if (g.phase === 'turn') g.paused = true;
      save();
      return g;
    },

    explainer: function (t) { t = t || team(); return t.players[t.turns % 2]; },

    listener: function (t) { t = t || team(); return t.players[(t.turns + 1) % 2]; },

    // «آماده‌ام»: show the word and start this team's clock.
    begin: function () {
      if (g.phase !== 'pass') return;
      g.phase = 'turn';
      g.paused = false;
      if (!g.word) newWord();
      save();
      startClock();
    },

    // «درست!»: the teammate guessed it; the next team's turn starts right away.
    correct: function () {
      if (g.phase !== 'turn' || g.paused) return;
      tick(); // count the last fraction of a second
      if (g.phase !== 'turn') return; // time ran out first
      var t = team();
      t.words.push(g.word.word);
      t.turns++;
      g.correct++;
      g.current = nextAlive(g.current);
      newWord();
      g.lastTick = Date.now();
      save();
    },

    // «عوض کن» (skip) or «خطا» (rule broken): lose the word and the penalty seconds.
    skip: function (foul) {
      if (g.phase !== 'turn' || g.paused) return;
      var t = team();
      t.lost.push(g.word.word);
      t.time -= g.penalty * 1000;
      if (t.time <= 0) { g.word = null; teamOut(); return 'out'; }
      newWord();
      save();
      return foul ? 'foul' : 'change';
    },

    pause: function () {
      if (!g || g.phase !== 'turn' || g.paused) return;
      tick();
      if (g.phase !== 'turn') return;
      stopClock();
      g.paused = true;
      save();
    },

    resume: function () {
      if (!g || g.phase !== 'turn' || !g.paused) return;
      g.paused = false;
      save();
      startClock();
    },

    // Ranking for the result screen: winner first, then the teams that lasted longest.
    ranking: function () {
      return g.teams.slice().sort(function (a, b) {
        if (a.out !== b.out) return a.out ? 1 : -1;
        return b.outRank - a.outRank;
      });
    },

    // Same teams, fresh clocks and settings.
    again: function () {
      return Game.start(g.teams.map(function (t) { return { name: t.name, players: t.players }; }));
    },

    quit: function () {
      stopClock();
      g = null;
      S.clearGame();
    }
  };

  root.AGame = Game;
})(this);
