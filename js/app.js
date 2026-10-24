/* Screens, navigation, sheets and alerts. */
(function (root) {
  'use strict';

  var S = root.AStore, W = root.AWords, G = root.AGame, Snd = root.ASound;

  var FA = '۰۱۲۳۴۵۶۷۸۹';
  function fa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return fa(Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2));
  }

  function icon(name, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + '><use href="#i-' + name + '"/></svg>'; }

  function $(id) { return document.getElementById(id); }

  function vibrate(pattern) {
    if (!S.setting('vibrate', true) || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* not supported */ }
  }

  /* ---------- keep the screen awake during a game ---------- */

  var wakeLock = null, wantAwake = false;

  function awake(on) {
    wantAwake = on;
    if (on && !wakeLock && navigator.wakeLock && document.visibilityState === 'visible') {
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        lock.addEventListener('release', function () { wakeLock = null; });
        if (!wantAwake) lock.release();
      }).catch(function () { /* not allowed now */ });
    } else if (!on && wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  }

  var SCREENS = ['home', 'setup', 'pass', 'turn', 'result'];

  var App = {
    screen: 'home',

    show: function (name) {
      App.screen = name;
      SCREENS.forEach(function (s) { $(s).classList.toggle('hidden', s !== name); });
      awake(name === 'pass' || name === 'turn');
    },

    toast: function (text) {
      var t = $('toast');
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(App.toastTimer);
      App.toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
    },

    /* ---------- sheet (settings, rules) and alert (pause, quit, team out) ---------- */

    // A bottom sheet. back: label of the back button, or '' for none.
    sheet: function (title, html, onClick, back) {
      var body = $('sheet-body'), same = App.sheetTitle === title && !$('sheet').classList.contains('hidden');
      var scroll = same ? body.scrollTop : 0;
      App.sheetTitle = title;
      $('sheet-title').textContent = title;
      $('sheet-back').classList.toggle('hidden', !back);
      if (back) $('sheet-back').querySelector('span').textContent = back;
      body.innerHTML = html;
      body.scrollTop = scroll;
      $('sheet').classList.remove('hidden');
      App.sheetClick = onClick || null;
    },

    closeSheet: function () { $('sheet').classList.add('hidden'); App.sheetClick = null; App.sheetTitle = null; },

    // opts: {title, message, buttons: [{label, act, style: 'prominent' | 'gray' | 'destructive'}]}
    alert: function (opts, onClick) {
      $('alert-box').innerHTML = '<h2>' + opts.title + '</h2>' +
        (opts.message ? '<p>' + opts.message + '</p>' : '') +
        '<div class="btns">' + opts.buttons.map(function (b) {
          return '<button class="btn ' + (b.style || 'gray') + '" data-act="' + b.act + '">' + b.label + '</button>';
        }).join('') + '</div>';
      $('alert').classList.remove('hidden');
      App.alertClick = onClick;
    },

    closeAlert: function () { $('alert').classList.add('hidden'); App.alertClick = null; },

    /* ---------- home ---------- */

    home: function () {
      App.closeAlert();
      App.closeSheet();
      var saved = S.game(), resume = !!(saved && saved.phase !== 'over');
      $('resume-btn').classList.toggle('hidden', !resume);
      // One prominent button: «ادامه‌ی بازی» when there is a game to go back to.
      $('new-btn').classList.toggle('prominent', !resume);
      $('new-btn').classList.toggle('gray', resume);
      App.show('home');
    },

    resume: function () {
      var g = G.restore();
      if (!g) { App.home(); return; }
      App.showGame();
    },

    /* ---------- players and teams ---------- */

    P: null,          // players screen state, saved as ash.players
    swapFrom: null,   // slot picked for swapping

    teamCount: function () { return App.P.count / 2; },

    fixOrder: function () {
      var P = App.P, n = P.count, ok = P.order && P.order.length === n;
      if (ok) {
        var seen = {};
        P.order.forEach(function (i) { if (i < 0 || i >= n || seen[i]) ok = false; seen[i] = true; });
      }
      if (!ok) {
        P.order = [];
        for (var i = 0; i < n; i++) P.order.push(i);
        P.shuffled = false;
      }
      for (var t = 0; t < P.teamNames.length; t++) if (!P.teamNames[t]) P.teamNames[t] = 'گروه ' + fa(t + 1);
    },

    savePlayers: function () { S.savePlayers(App.P); },

    setup: function () {
      App.closeAlert();
      App.fixOrder();
      App.swapFrom = null;
      App.renderSetup();
      $('setup').querySelector('.scroll').scrollTop = 0;
      $('setup').classList.remove('scrolled');
      App.show('setup');
    },

    chooseCount: function (n) {
      var P = App.P;
      if (P.count === n) return;
      P.count = n;
      P.order = null;
      App.fixOrder();
      App.savePlayers();
      App.swapFrom = null;
      App.renderSetup();
    },

    renderSetup: function () {
      var P = App.P, random = P.mode === 'random';
      document.querySelectorAll('#count-seg button').forEach(function (b) {
        b.classList.toggle('on', +b.dataset.count === P.count);
        b.setAttribute('aria-pressed', +b.dataset.count === P.count);
      });
      $('count-foot').textContent = fa(App.teamCount()) + ' گروه دونفره';
      document.querySelectorAll('#mode-seg button').forEach(function (b) {
        b.classList.toggle('on', b.dataset.mode === P.mode);
        b.setAttribute('aria-pressed', b.dataset.mode === P.mode);
      });

      $('random-box').classList.toggle('hidden', !random);
      if (random) {
        var list = '';
        for (var i = 0; i < P.count; i++) {
          list += '<label class="row"><input data-name="' + i + '" value="' + esc(P.names[i]) +
            '" placeholder="بازیکن ' + fa(i + 1) + '" maxlength="16" autocomplete="off" enterkeyhint="next"></label>';
        }
        $('name-list').innerHTML = list;
        $('shuffle-btn').querySelector('span').textContent = P.shuffled ? 'دوباره قاطی کن' : 'گروه‌بندی تصادفی';
      }

      var showTeams = !random || P.shuffled;
      $('swap-hint').classList.toggle('hidden', !showTeams);
      var cards = '';
      if (showTeams) {
        for (var t = 0; t < App.teamCount(); t++) {
          cards += '<div class="list team-list" style="--team:' + G.COLORS[t] + '">' +
            '<label class="row team-row inset"><i class="dot"></i><input data-team="' + t + '" value="' + esc(P.teamNames[t]) +
            '" placeholder="گروه ' + fa(t + 1) + '" maxlength="14" autocomplete="off" aria-label="نام گروه"></label>';
          for (var k = 0; k < 2; k++) {
            var slot = t * 2 + k, idx = P.order[slot];
            cards += '<div class="row slot inset' + (App.swapFrom === slot ? ' picked' : '') + '">' +
              '<span class="num">' + fa(k + 1) + '</span>' +
              '<input data-name="' + idx + '" value="' + esc(P.names[idx]) + '" placeholder="بازیکن ' + fa(idx + 1) +
              '" maxlength="16" autocomplete="off">' +
              '<button class="swap" data-slot="' + slot + '" aria-label="جابه‌جا کردن">' + icon('swap') + '</button></div>';
          }
          cards += '</div>';
        }
      }
      $('team-cards').innerHTML = cards;
      $('start-btn').textContent = showTeams ? 'شروع بازی' : 'گروه‌بندی و شروع';
    },

    shuffle: function () {
      var o = App.P.order;
      for (var i = o.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), x = o[i];
        o[i] = o[j]; o[j] = x;
      }
      App.P.shuffled = true;
      App.swapFrom = null;
      App.savePlayers();
      App.renderSetup();
    },

    pickSwap: function (slot) {
      var o = App.P.order;
      if (App.swapFrom === null) App.swapFrom = slot;
      else if (App.swapFrom === slot) App.swapFrom = null;
      else {
        var x = o[slot]; o[slot] = o[App.swapFrom]; o[App.swapFrom] = x;
        App.swapFrom = null;
        App.savePlayers();
      }
      App.renderSetup();
    },

    startGame: function () {
      var P = App.P;
      if (P.mode === 'random' && !P.shuffled) {
        App.shuffle();
        App.toast('گروه‌ها چیده شدند');
        var cards = $('team-cards');
        if (cards.firstChild) cards.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      var names = P.names.slice(0, P.count).map(function (s) { return s.trim(); });
      var empty = names.indexOf('');
      if (empty >= 0) {
        App.toast('نام همه‌ی بازیکن‌ها را بنویسید');
        var el = document.querySelector('#setup [data-name="' + empty + '"]');
        if (el) el.focus();
        return;
      }
      for (var i = 0; i < names.length; i++) {
        if (names.indexOf(names[i]) !== i) { App.toast('دو بازیکن هم‌نام‌اند: ' + names[i]); return; }
      }
      var teamNames = P.teamNames.slice(0, App.teamCount()).map(function (s, t) { return s.trim() || 'گروه ' + fa(t + 1); });
      for (var t = 0; t < teamNames.length; t++) {
        if (teamNames.indexOf(teamNames[t]) !== t) { App.toast('دو گروه هم‌نام‌اند: ' + teamNames[t]); return; }
      }
      P.names = P.names.map(function (s) { return s.trim(); });
      App.savePlayers();
      G.start(teamNames.map(function (name, t) {
        return { name: name, players: [names[P.order[t * 2]], names[P.order[t * 2 + 1]]] };
      }));
      App.showGame();
    },

    /* ---------- the game ---------- */

    // Shows whichever game screen fits the saved state.
    showGame: function () {
      var g = G.state();
      App.closeAlert();
      App.closeSheet();
      if (!g) { App.home(); return; }
      if (g.phase === 'over') { App.result(); return; }
      if (g.phase === 'pass') { App.renderPass(); App.show('pass'); return; }
      App.renderTurn();
      App.show('turn');
      if (g.paused) App.pauseMenu();
    },

    renderPass: function () {
      var g = G.state(), t = g.teams[g.current];
      $('pass').style.setProperty('--team', t.color);
      $('pass-team').textContent = t.name;
      $('pass-explainer').textContent = G.explainer(t);
      $('pass-explainer2').textContent = G.explainer(t);
      $('pass-listener').textContent = G.listener(t);
      $('pass-teams').innerHTML = g.teams.map(function (x, i) {
        return '<span class="' + (i === g.current ? 'now' : '') + '" style="--team:' + x.color + '"><i class="dot"></i>' + esc(x.name) + '</span>';
      }).join('');
    },

    renderTurn: function () {
      var g = G.state(), t = g.teams[g.current], w = g.word || { word: '', cat: '' };
      $('turn').style.setProperty('--team', t.color);
      $('turn-team').textContent = t.name;
      App.renderBoard();
      $('word-cat').textContent = g.showCategory ? w.cat : '';
      var word = $('word');
      word.textContent = w.word;
      word.className = 'word' + (w.word.length > 18 ? ' long' : w.word.length > 10 ? ' mid' : '');
      var pen = g.penalty ? '−' + fa(g.penalty) : '';
      document.querySelectorAll('#turn .pen').forEach(function (el) { el.textContent = pen; });
      $('turn').classList.toggle('paused', !!g.paused);
      App.renderClock();
    },

    // Teams in turn order, starting with the one playing now; teams that are out come last.
    // With more than 4 teams only the first 4 rows are shown.
    renderBoard: function () {
      var g = G.state(), n = g.teams.length, order = [], out = [];
      for (var i = 0; i < n; i++) {
        var t = g.teams[(g.current + i) % n];
        (t.out ? out : order).push(t);
      }
      $('turn-board').innerHTML = order.concat(out).slice(0, 4).map(function (t) {
        var now = t === g.teams[g.current];
        var who = t.out ? esc(t.players.join(' و ')) : esc(G.explainer(t)) + ' ← ' + esc(G.listener(t));
        return '<div class="trow' + (now ? ' now' : '') + (t.out ? ' out' : '') + '" role="listitem" style="--team:' + t.color + '"' +
          (now ? ' id="trow-now"' : '') + ' aria-label="' + esc(t.name) + '، ' + (t.out ? 'حذف شده' : who.replace('←', 'برای') + '، ' + clock(t.time)) + '">' +
          '<i class="dot"></i><span class="nm">' + esc(t.name) + '</span><span class="pp">' + who + '</span>' +
          '<span class="bar"><i style="width:' + App.timeShare(t) + '%"></i></span><span class="tm">' + clock(t.time) + '</span></div>';
      }).join('');
    },

    timeShare: function (t) {
      return Math.round(Math.max(0, Math.min(1, t.time / (G.state().time * 1000))) * 100);
    },

    renderClock: function () {
      var g = G.state();
      if (!g || g.phase !== 'turn') return;
      var t = g.teams[g.current];
      $('clock-text').textContent = clock(t.time);
      $('clock').setAttribute('aria-label', 'وقت ' + t.name + ': ' + clock(t.time));
      $('clock').classList.toggle('low', t.time <= 10000);
      // The ring empties as the team's time runs down (circumference 2π·9).
      var left = Math.max(0, Math.min(1, t.time / (g.time * 1000)));
      $('ring').style.strokeDashoffset = (56.55 * (1 - left)).toFixed(2);
      // The current team's row on the board counts down with the clock.
      var row = $('trow-now');
      if (row) {
        row.querySelector('.tm').textContent = clock(t.time);
        row.querySelector('.bar i').style.width = App.timeShare(t) + '%';
        row.classList.toggle('low', t.time <= 10000);
      }
    },

    // After the turn moves on, taps are ignored for a moment so a double tap on «درست» does not
    // also count for the next team.
    busyUntil: 0,

    busy: function () { return Date.now() < App.busyUntil; },

    ready: function () {
      G.begin();
      App.busyUntil = Date.now() + 400;
      App.renderTurn();
      App.show('turn');
    },

    // The next team's word comes up and its clock runs at once; the phone is passed meanwhile.
    correct: function () {
      var g = G.state();
      if (!g || g.phase !== 'turn' || g.paused || App.busy()) return;
      G.correct();
      if (g.phase !== 'turn' || g.paused) return; // time ran out first; onOut shows the alert
      Snd.play('correct');
      vibrate(60);
      App.busyUntil = Date.now() + 800;
      App.renderTurn();
      var card = document.querySelector('#turn .word-card');
      card.classList.remove('handover');
      void card.offsetWidth; // restart the animation
      card.classList.add('handover');
    },

    skip: function (foul) {
      var g = G.state();
      if (!g || g.phase !== 'turn' || g.paused || App.busy()) return;
      var res = G.skip(foul);
      if (res === 'out') return; // onOut shows the alert
      Snd.play(foul ? 'foul' : 'change');
      vibrate(30);
      if (g.penalty) App.toast((foul ? 'خطا؛ ' : '') + fa(g.penalty) + ' ثانیه کم شد');
      App.renderTurn();
    },

    teamOut: function (t) {
      var g = G.state();
      Snd.play('out');
      vibrate([200, 100, 200]);
      var over = g.phase === 'over';
      $('turn').classList.add('paused'); // hide the lost word behind the alert
      App.alert({
        title: esc(t.name) + ' حذف شد',
        message: 'وقت ' + esc(t.players.join(' و ')) + ' تمام شد.' + (over ? '' : ' بازی با گروه‌های دیگر ادامه دارد.'),
        buttons: [{ label: over ? 'دیدن برنده' : 'ادامه', act: 'ok', style: 'prominent' }]
      }, function () {
        App.closeAlert();
        if (over) { App.result(); return; }
        // The next team's turn starts now, no «آماده‌ام» screen in between.
        G.resume();
        App.busyUntil = Date.now() + 400;
        App.renderTurn();
        App.show('turn');
      });
    },

    pauseMenu: function () {
      var g = G.state();
      if (!g) return;
      if (g.phase === 'turn') {
        G.pause();
        if (g.phase !== 'turn') return; // the clock ran out just now; onOut shows the alert
        App.renderTurn();
      }
      App.alert({
        title: 'بازی متوقف شد',
        message: g.phase === 'turn' ? 'ساعت ' + esc(g.teams[g.current].name) + ' ایستاده و کلمه پنهان است.' : '',
        buttons: [
          { label: 'ادامه', act: 'resume', style: 'prominent' },
          { label: 'خروج از بازی', act: 'quit', style: 'destructive' }
        ]
      }, function (act) {
        if (act === 'resume') {
          App.closeAlert();
          G.resume();
          if (G.state().phase === 'turn') App.renderTurn();
        } else if (act === 'quit') {
          App.alert({
            title: 'از بازی خارج شوید؟',
            message: 'این بازی تمام می‌شود و برنمی‌گردد.',
            buttons: [
              { label: 'خروج', act: 'yes', style: 'destructive' },
              { label: 'انصراف', act: 'no', style: 'gray' }
            ]
          }, function (a) {
            if (a === 'yes') { G.quit(); App.home(); } else App.pauseMenu();
          });
        }
      });
    },

    /* ---------- result ---------- */

    result: function () {
      var g = G.state(), win = g.teams[g.winner];
      Snd.play('win');
      $('winner').style.setProperty('--team', win.color);
      $('winner').innerHTML = '<div class="medal">' + icon('trophy') + '</div>' +
        '<h1>' + esc(win.name) + ' برنده شد</h1><p>' + esc(win.players.join(' و ')) + '</p>';
      $('ranking').innerHTML = G.ranking().map(function (t, i) {
        var chips = t.words.map(function (w) { return '<span>' + esc(w) + '</span>'; })
          .concat(t.lost.map(function (w) { return '<span class="lost">' + esc(w) + '</span>'; }));
        return '<div class="row" style="--team:' + t.color + '"><span class="rank-n">' + fa(i + 1) + '</span><i class="dot"></i>' +
          '<div class="rank-main"><b>' + esc(t.name) + '</b><small>' + esc(t.players.join(' و ')) + '</small></div>' +
          '<span class="value">' + fa(t.words.length) + ' کلمه</span></div>' +
          (chips.length ? '<div class="row words"><div class="chips">' + chips.join('') + '</div></div>' : '');
      }).join('');
      $('result').querySelector('.scroll').scrollTop = 0;
      App.show('result');
    },

    /* ---------- settings ---------- */

    settingsPage: 'main',

    settings: function () {
      if (App.settingsPage === 'cats') { App.categoriesPage(); return; }
      var s = S.settings(), used = W.usedCount(), total = W.total(), cats = W.categories();
      function seg(name, options) {
        return '<div class="segmented">' + options.map(function (o) {
          return '<button class="' + (s[name] === o[0] ? 'on' : '') + '" aria-pressed="' + (s[name] === o[0]) +
            '" data-act="set:' + name + ':' + o[0] + '">' + o[1] + '</button>';
        }).join('') + '</div>';
      }
      function toggle(name, label) {
        return '<button class="row" role="switch" aria-checked="' + !!s[name] + '" data-act="toggle:' + name + '">' +
          '<span class="grow">' + label + '</span><i class="switch"></i></button>';
      }
      var DIFF = {
        easy: 'فقط کلمه‌های آسان؛ مناسب بچه‌ها.',
        mixed: 'از هر سه سطح، قاطی.',
        hard: 'کلمه‌های متوسط و سخت، با ضرب‌المثل‌ها.',
        steps: 'اول آسان، بعد متوسط، آخر بازی سخت.'
      };
      var on = cats.length - s.off.length;
      var html =
        '<div class="section-head">بازی</div><div class="list">' +
        '<div class="row col"><span>وقت هر گروه (دقیقه)</span>' +
        seg('time', [[60, '۱'], [90, '۱٫۵'], [120, '۲'], [180, '۳']]) + '</div>' +
        '<div class="row col"><span>جریمه‌ی «عوض کن» و «خطا»</span>' +
        seg('penalty', [[0, 'ندارد'], [5, '۵ ثانیه'], [10, '۱۰ ثانیه']]) + '</div></div>' +
        (S.game() ? '<div class="section-foot">تغییرها از بازی بعد اعمال می‌شوند.</div>' : '') +

        '<div class="section-head">کلمه‌ها</div><div class="list">' +
        '<div class="row col"><span>سختی</span>' +
        seg('difficulty', [['easy', 'آسان'], ['mixed', 'قاطی'], ['hard', 'سخت'], ['steps', 'پله‌پله']]) + '</div>' +
        '<button class="row" data-act="page:cats"><span class="grow">دسته‌ها</span><span class="value">' +
        (on === cats.length ? 'همه' : fa(on) + ' از ' + fa(cats.length)) + '</span>' + icon('forward', 'chev') + '</button>' +
        toggle('showCategory', 'نشان دادن دسته بالای کلمه') + '</div>' +
        '<div class="section-foot">' + DIFF[s.difficulty] + '</div>' +

        '<div class="section-head">صدا و لرزش</div><div class="list">' +
        toggle('sound', 'صدا') + toggle('vibrate', 'لرزش') + '</div>' +
        '<div class="section-foot">با صدا، در نوبت هر گروه تیک‌تاک آرامی می‌آید که در ۳۰ ثانیه‌ی آخر کم‌کم تند می‌شود.</div>' +

        '<div class="section-head">کلمه‌های دیده‌شده</div><div class="list">' +
        '<button class="row destructive" data-act="reset-used">شروع دوباره‌ی کلمه‌ها</button></div>' +
        '<div class="section-foot">' + fa(used) + ' از ' + fa(total) + ' کلمه روی این گوشی دیده شده و تا تمام شدن هر دسته تکرار نمی‌شود.</div>';
      App.sheet('تنظیمات', html, App.settingsClick, '');
    },

    categoriesPage: function () {
      var s = S.settings();
      var html = '<div class="list"><button class="row" data-act="cats:all"><span class="grow">انتخاب همه</span></button></div>' +
        '<div class="section-head">دسته‌ها</div><div class="list">' +
        W.categories().map(function (c) {
          var on = s.off.indexOf(c.name) < 0;
          return '<button class="row" role="checkbox" aria-checked="' + on + '" data-act="cat:' + esc(c.name) + '">' +
            '<span class="grow">' + esc(c.name) + '</span><span class="value">' + fa(c.count) + '</span>' +
            (on ? icon('check', 'check') : '<svg></svg>') + '</button>';
        }).join('') + '</div>' +
        '<div class="section-foot">کلمه‌ها فقط از دسته‌های تیک‌خورده می‌آیند.</div>';
      App.sheet('دسته‌ها', html, App.settingsClick, 'تنظیمات');
    },

    settingsClick: function (act) {
      var st = S.settings(), parts = act.split(':');
      if (parts[0] === 'page') {
        App.settingsPage = parts[1];
        $('sheet-body').scrollTop = 0;
        App.sheetTitle = null;
        App.settings();
        return;
      }
      if (parts[0] === 'set') {
        var v = parts[2];
        st[parts[1]] = /^\d+$/.test(v) ? +v : v;
      } else if (parts[0] === 'toggle') {
        if (parts[1] === 'sound') { Snd.set(!st.sound); App.settings(); return; }
        st[parts[1]] = !st[parts[1]];
        if (parts[1] === 'vibrate' && st.vibrate) vibrate(60);
      } else if (parts[0] === 'cat') {
        var name = act.slice(4), i = st.off.indexOf(name);
        if (i >= 0) st.off.splice(i, 1);
        else if (st.off.length + 1 >= W.categories().length) { App.toast('دست‌کم یک دسته روشن بماند'); return; }
        else st.off.push(name);
      } else if (act === 'cats:all') {
        st.off = [];
      } else if (act === 'reset-used') {
        App.alert({
          title: 'کلمه‌ها از اول شروع شوند؟',
          message: 'کلمه‌هایی که روی این گوشی دیده شده‌اند دوباره می‌توانند بیایند.',
          buttons: [
            { label: 'شروع دوباره', act: 'yes', style: 'destructive' },
            { label: 'انصراف', act: 'no', style: 'gray' }
          ]
        }, function (a) {
          App.closeAlert();
          if (a !== 'yes') return;
          W.resetUsed();
          App.settings();
          App.toast('کلمه‌ها از اول');
        });
        return;
      }
      S.saveSettings(st);
      App.settings();
    },

    openSettings: function () { App.settingsPage = 'main'; App.settings(); },

    rules: function () {
      function rule(ic, color, title, text) {
        return '<div class="row"><span class="rule-icon" style="--c:' + color + '">' + icon(ic) + '</span>' +
          '<div class="rule-text"><b>' + title + '</b><small>' + text + '</small></div></div>';
      }
      var html =
        '<div class="section-head">چطور بازی کنیم</div><div class="list">' +
        rule('people', '#007aff', 'گروه‌های دونفره، یک گوشی', 'گوشی بین گروه‌ها دست‌به‌دست می‌چرخد.') +
        rule('bubble', '#ff9500', 'فقط با حرف زدن', 'یک نفر کلمه را می‌بیند و برای هم‌گروهی‌اش توضیح می‌دهد.') +
        rule('check', '#34c759', '«درست»', 'نوبت فوراً به گروه بعد می‌رسد و ساعتش راه می‌افتد؛ گوشی را زود بدهید.') +
        rule('timer', '#af52de', 'ساعت هر گروه', 'فقط در نوبت خودش کم می‌شود. وقت هر گروه که تمام شود حذف می‌شود؛ آخرین گروه برنده است.') +
        '</div>' +
        '<div class="section-head">ممنوع است</div><div class="list">' +
        rule('xmark', '#ff3b30', 'گفتن خود کلمه', 'یا بخشی از آن، یا کلمه‌ای هم‌ریشه') +
        rule('xmark', '#ff3b30', 'مترادف و ترجمه', 'کلمه‌ی هم‌معنی یا همان کلمه به زبان دیگر') +
        rule('xmark', '#ff3b30', 'اشاره و ادا', 'بدون حرکت دست، ادا درآوردن یا صدا درآوردن') +
        '</div>' +
        '<div class="section-head">دکمه‌ها</div><div class="list">' +
        rule('arrows', '#8e8e93', '«عوض کن»', 'کلمه را عوض می‌کند و چند ثانیه جریمه دارد.') +
        rule('flag', '#8e8e93', '«خطا»', 'اگر کسی قانون را شکست: کلمه می‌سوزد و همان جریمه کم می‌شود.') +
        '</div>' +
        '<div class="section-foot">توضیح‌دهنده در هر نوبت گروه عوض می‌شود: یک بار سارا برای علی، دفعه‌ی بعد علی برای سارا. ' +
        'کلمه‌ها سه سطح دارند و روی هر گوشی تکرار نمی‌شوند تا دسته‌شان تمام شود.</div>';
      App.sheet('قوانین', html, null, '');
    },

    /* ---------- start ---------- */

    init: function () {
      App.P = S.players();
      App.fixOrder();

      G.onTick = function () {
        App.renderClock();
        var g = G.state(), left = g.teams[g.current].time, now = Date.now();
        // The tick runs during the whole turn: every 2 seconds until 30 seconds are left, then
        // smoothly faster, higher and louder, down to about 10 a second at the end.
        var f = Math.min(1, left / 30000); // 1 until 30 s left .. 0 at the end
        var gap = 100 + 1900 * f, urgency = 1 - f;
        if (now - App.lastTickSound >= gap) {
          App.lastTickSound = now;
          Snd.play('tick', urgency);
        }
      };
      App.lastTickSound = 0;
      G.onSecond = function (s) {
        App.renderClock();
        if (s <= 5) vibrate(80);
      };
      G.onOut = App.teamOut;

      $('new-btn').addEventListener('click', App.setup);
      $('resume-btn').addEventListener('click', App.resume);
      $('rules-btn').addEventListener('click', App.rules);
      $('settings-btn').addEventListener('click', App.openSettings);
      document.querySelectorAll('[data-go="home"]').forEach(function (b) { b.addEventListener('click', App.home); });

      // Large title: the small title appears in the bar once the big one scrolls away.
      document.querySelectorAll('.screen .scroll').forEach(function (sc) {
        sc.addEventListener('scroll', function () {
          sc.parentNode.classList.toggle('scrolled', sc.scrollTop > 36);
        }, { passive: true });
      });

      var setup = $('setup');
      setup.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.count) App.chooseCount(+b.dataset.count);
        else if (b.dataset.mode && b.dataset.mode !== App.P.mode) {
          App.P.mode = b.dataset.mode;
          App.swapFrom = null;
          App.savePlayers();
          App.renderSetup();
        } else if (b.dataset.slot) App.pickSwap(+b.dataset.slot);
      });
      setup.addEventListener('input', function (e) {
        var el = e.target;
        if (el.dataset.name) {
          App.P.names[+el.dataset.name] = el.value;
          // The same player can be in the list and in a team; keep both in step.
          setup.querySelectorAll('[data-name="' + el.dataset.name + '"]').forEach(function (o) { if (o !== el) o.value = el.value; });
        } else if (el.dataset.team) App.P.teamNames[+el.dataset.team] = el.value;
        App.savePlayers();
      });
      // Return moves to the next name field.
      setup.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || !e.target.matches('#name-list input')) return;
        e.preventDefault();
        var next = e.target.closest('.row').nextElementSibling;
        if (next) next.querySelector('input').focus(); else e.target.blur();
      });
      $('shuffle-btn').addEventListener('click', App.shuffle);
      $('start-btn').addEventListener('click', App.startGame);

      $('ready-btn').addEventListener('click', App.ready);
      $('pass-menu').addEventListener('click', App.pauseMenu);
      $('pause-btn').addEventListener('click', App.pauseMenu);
      $('correct-btn').addEventListener('click', App.correct);
      $('change-btn').addEventListener('click', function () { App.skip(false); });
      $('foul-btn').addEventListener('click', function () { App.skip(true); });

      $('again-btn').addEventListener('click', function () { G.again(); App.showGame(); });
      $('newteams-btn').addEventListener('click', function () {
        G.quit();
        App.P = S.players();
        App.setup();
      });
      $('home-btn').addEventListener('click', function () { G.quit(); App.home(); });

      $('sheet').addEventListener('click', function (e) {
        if (e.target.closest('[data-close]') || e.target.id === 'sheet') { App.closeSheet(); return; }
        var a = e.target.closest('[data-act]');
        if (a && App.sheetClick) App.sheetClick(a.dataset.act);
      });
      // Alerts close only through their buttons, as on iOS.
      $('alert').addEventListener('click', function (e) {
        var a = e.target.closest('[data-act]');
        if (a && App.alertClick) App.alertClick(a.dataset.act);
      });

      // Leaving the page (call, app switch) pauses a running turn.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          var g = G.state();
          if (g && g.phase === 'turn' && !g.paused) App.pauseMenu();
        } else if (wantAwake) awake(true);
      });

      // A game in progress comes back after a refresh, with the clock paused.
      if (G.restore()) App.showGame();
      else App.home();
    }
  };

  root.AApp = App;
  document.addEventListener('DOMContentLoaded', App.init);
})(this);
