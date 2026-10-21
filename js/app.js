/* Screens, navigation, popups. */
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

  var SCREENS = ['home', 'count', 'teams', 'pass', 'turn', 'result'];

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

    // sticky: tapping outside the box does not close it.
    modal: function (html, onClick, sticky) {
      $('modal-box').innerHTML = html;
      $('modal').classList.remove('hidden');
      App.modalClick = onClick || null;
      App.modalSticky = !!sticky;
    },

    closeModal: function () { $('modal').classList.add('hidden'); App.modalClick = null; },

    /* ---------- home ---------- */

    home: function () {
      App.closeModal();
      var saved = S.game();
      $('resume-btn').classList.toggle('hidden', !(saved && saved.phase !== 'over'));
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
      for (var t = 0; t < 4; t++) if (!P.teamNames[t]) P.teamNames[t] = 'گروه ' + fa(t + 1);
    },

    savePlayers: function () { S.savePlayers(App.P); },

    chooseCount: function (n) {
      var P = App.P;
      if (P.count !== n) { P.count = n; P.order = null; }
      App.fixOrder();
      App.savePlayers();
      App.swapFrom = null;
      App.renderTeams();
      App.show('teams');
    },

    renderTeams: function () {
      var P = App.P, random = P.mode === 'random';
      document.querySelectorAll('#teams .tabs button').forEach(function (b) {
        var on = b.dataset.mode === P.mode;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on);
      });

      $('random-box').classList.toggle('hidden', !random);
      if (random) {
        var list = '';
        for (var i = 0; i < P.count; i++) {
          list += '<input class="name-input" data-name="' + i + '" value="' + esc(P.names[i]) +
            '" placeholder="بازیکن ' + fa(i + 1) + '" maxlength="16" autocomplete="off">';
        }
        $('name-list').innerHTML = list;
        $('shuffle-btn').querySelector('span').textContent = P.shuffled ? 'دوباره قاطی کن' : 'گروه‌بندی تصادفی';
      }

      var showTeams = !random || P.shuffled;
      $('swap-hint').classList.toggle('hidden', !showTeams);
      var cards = '';
      if (showTeams) {
        for (var t = 0; t < App.teamCount(); t++) {
          cards += '<div class="team-card" style="--team:' + G.COLORS[t] + '">' +
            '<input class="team-name" data-team="' + t + '" value="' + esc(P.teamNames[t]) +
            '" placeholder="گروه ' + fa(t + 1) + '" maxlength="14" autocomplete="off" aria-label="نام گروه">';
          for (var k = 0; k < 2; k++) {
            var slot = t * 2 + k, idx = P.order[slot];
            cards += '<div class="slot' + (App.swapFrom === slot ? ' picked' : '') + '">' +
              '<input class="name-input" data-name="' + idx + '" value="' + esc(P.names[idx]) +
              '" placeholder="بازیکن ' + fa(idx + 1) + '" maxlength="16" autocomplete="off">' +
              '<button class="swap" data-slot="' + slot + '" aria-label="جابه‌جا کردن"><svg><use href="#i-swap"/></svg></button></div>';
          }
          cards += '</div>';
        }
      }
      $('team-cards').innerHTML = cards;
      $('start-btn').classList.toggle('off', !showTeams);
      $('start-btn').textContent = showTeams ? 'شروع' : 'اول گروه‌بندی کنید';
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
      App.renderTeams();
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
      App.renderTeams();
    },

    startGame: function () {
      var P = App.P;
      if (P.mode === 'random' && !P.shuffled) { App.shuffle(); App.toast('گروه‌ها چیده شدند'); return; }
      var names = P.names.slice(0, P.count).map(function (s) { return s.trim(); });
      var empty = names.indexOf('');
      if (empty >= 0) {
        App.toast('نام همه‌ی بازیکن‌ها را بنویسید');
        var el = document.querySelector('#teams [data-name="' + empty + '"]');
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
      App.closeModal();
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
      $('pass-clocks').innerHTML = g.teams.map(function (x, i) {
        return '<div class="clock-row' + (x.out ? ' out' : '') + (i === g.current ? ' now' : '') +
          '" style="--team:' + x.color + '"><i></i><span>' + esc(x.name) + '</span><b>' +
          (x.out ? 'حذف شد' : clock(x.time)) + '</b></div>';
      }).join('');
    },

    renderTurn: function () {
      var g = G.state(), t = g.teams[g.current], w = g.word || { word: '', cat: '', level: 1 };
      $('turn').style.setProperty('--team', t.color);
      $('turn-team').textContent = t.name;
      $('turn-who').innerHTML = 'نوبت <b>' + esc(G.explainer(t)) + '</b>، برای <b>' + esc(G.listener(t)) + '</b> توضیح بده';
      $('word-cat').textContent = g.showCategory ? w.cat : '';
      var word = $('word');
      word.textContent = w.word;
      word.className = 'word' + (w.word.length > 18 ? ' long' : w.word.length > 10 ? ' mid' : '');
      $('word-level').innerHTML = ['آسان', 'متوسط', 'سخت'].map(function (name, i) {
        return '<i class="' + (i < w.level ? 'on' : '') + '"></i>';
      }).join('') + '<span>' + ['آسان', 'متوسط', 'سخت'][w.level - 1] + '</span>';
      var pen = g.penalty ? '−' + fa(g.penalty) + ' ثانیه' : 'بدون جریمه';
      document.querySelectorAll('#turn .pen').forEach(function (el) { el.textContent = pen; });
      $('turn').classList.toggle('paused', !!g.paused);
      App.renderClock();
    },

    renderClock: function () {
      var g = G.state();
      if (!g || g.phase !== 'turn') return;
      var t = g.teams[g.current];
      $('clock').textContent = clock(t.time);
      $('clock').classList.toggle('low', t.time <= 10000);
    },

    // After the turn moves on, taps are ignored for a moment so a double tap on «درست!» does not
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
      if (g.phase !== 'turn' || g.paused) return; // time ran out first; onOut shows the popup
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
      if (res === 'out') return; // onOut shows the popup
      Snd.play(foul ? 'foul' : 'change');
      if (g.penalty) App.toast((foul ? 'خطا! ' : '') + '−' + fa(g.penalty) + ' ثانیه');
      App.renderTurn();
    },

    teamOut: function (t) {
      var g = G.state();
      Snd.play('out');
      vibrate([200, 100, 200]);
      var over = g.phase === 'over';
      $('turn').classList.add('paused'); // hide the lost word behind the popup
      App.modal('<div class="out-title" style="color:' + t.color + '">' + esc(t.name) + ' حذف شد</div>' +
        '<p>وقت ' + esc(t.players.join(' و ')) + ' تمام شد.</p>' +
        (over ? '' : '<p class="muted">بازی با گروه‌های دیگر ادامه دارد.</p>') +
        '<button class="btn" data-act="ok">' + (over ? 'دیدن برنده' : 'ادامه') + '</button>',
      function () {
        App.closeModal();
        if (over) { App.result(); return; }
        // The next team's turn starts now, no «آماده‌ام» screen in between.
        G.resume();
        App.busyUntil = Date.now() + 400;
        App.renderTurn();
        App.show('turn');
      }, true);
    },

    pauseMenu: function () {
      var g = G.state();
      if (!g) return;
      if (g.phase === 'turn') {
        G.pause();
        if (g.phase !== 'turn') return; // the clock ran out just now; onOut shows the popup
        App.renderTurn();
      }
      App.modal('<h2>مکث</h2>' +
        (g.phase === 'turn' ? '<p class="muted">ساعت ' + esc(g.teams[g.current].name) + ' ایستاده و کلمه پنهان است.</p>' : '') +
        '<button class="btn" data-act="resume">ادامه</button>' +
        '<button class="btn danger" data-act="quit">خروج از بازی</button>',
      function (act) {
        if (act === 'resume') {
          App.closeModal();
          G.resume();
          if (G.state().phase === 'turn') App.renderTurn();
        } else if (act === 'quit') {
          App.modal('<h2>از بازی خارج شوید؟</h2><p>این بازی تمام می‌شود و برنمی‌گردد.</p>' +
            '<button class="btn danger" data-act="yes">بله، خروج</button>' +
            '<button class="btn ghost" data-act="no">نه، برگرد</button>',
          function (a) {
            if (a === 'yes') { G.quit(); App.home(); } else App.pauseMenu();
          }, true);
        }
      }, true);
    },

    /* ---------- result ---------- */

    result: function () {
      var g = G.state(), win = g.teams[g.winner];
      Snd.play('win');
      $('result').style.setProperty('--team', win.color);
      $('winner').innerHTML = '<div class="trophy">🏆</div><div class="win-name" style="color:' + win.color + '">' +
        esc(win.name) + ' برنده شد!</div><div class="win-players">' + esc(win.players.join(' و ')) + '</div>';
      $('ranking').innerHTML = G.ranking().map(function (t, i) {
        return '<div class="rank-card" style="--team:' + t.color + '">' +
          '<div class="rank-head"><b>' + fa(i + 1) + '. ' + esc(t.name) + '</b><span>' + esc(t.players.join(' و ')) + '</span></div>' +
          '<div class="rank-sub">' + fa(t.words.length) + ' کلمه درست' + (t.out ? '' : '، ' + clock(t.time) + ' وقت مانده') + '</div>' +
          (t.words.length ? '<div class="chips">' + t.words.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('') + '</div>' : '') +
          (t.lost.length ? '<div class="chips lost">' + t.lost.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('') + '</div>' : '') +
          '</div>';
      }).join('');
      App.show('result');
    },

    /* ---------- settings ---------- */

    settings: function () {
      var s = S.settings(), box = $('modal-box'), scroll = box.scrollTop;
      var used = W.usedCount(), total = W.total();
      function chips(name, options) {
        return '<div class="seg">' + options.map(function (o) {
          return '<button class="' + (s[name] === o[0] ? 'on' : '') + '" data-act="set:' + name + ':' + o[0] + '">' + o[1] + '</button>';
        }).join('') + '</div>';
      }
      function toggle(name, label) {
        return '<button class="toggle' + (s[name] ? ' on' : '') + '" data-act="toggle:' + name + '" role="switch" aria-checked="' + !!s[name] + '">' +
          '<span>' + label + '</span><b>' + (s[name] ? 'روشن' : 'خاموش') + '</b><i></i></button>';
      }
      var DIFF = {
        easy: 'فقط کلمه‌های آسان؛ مناسب بچه‌ها.',
        mixed: 'از هر سه سطح، قاطی.',
        hard: 'کلمه‌های متوسط و سخت، با ضرب‌المثل‌ها.',
        steps: 'اول آسان، بعد متوسط، آخر بازی سخت.'
      };
      var cats = W.categories().map(function (c) {
        var on = s.off.indexOf(c.name) < 0;
        return '<button class="cat' + (on ? ' on' : '') + '" data-act="cat:' + esc(c.name) + '">' + esc(c.name) +
          ' <small>' + fa(c.count) + '</small></button>';
      }).join('');
      var html = '<h2>تنظیمات</h2>' +
        '<div class="set-label">وقت هر گروه</div>' +
        chips('time', [[60, '۱ دقیقه'], [90, '۱٫۵ دقیقه'], [120, '۲ دقیقه'], [180, '۳ دقیقه']]) +
        '<div class="set-label">جریمه‌ی «عوض کن» و «خطا»</div>' +
        chips('penalty', [[0, 'بدون جریمه'], [5, '۵ ثانیه'], [10, '۱۰ ثانیه']]) +
        '<div class="set-label">سختی کلمه‌ها</div>' +
        chips('difficulty', [['easy', 'آسان'], ['mixed', 'قاطی'], ['hard', 'سخت'], ['steps', 'پله‌پله']]) +
        '<p class="muted">' + DIFF[s.difficulty] + '</p>' +
        '<div class="set-label">دسته‌ها <button class="link" data-act="cats:all">همه</button></div>' +
        '<div class="cats">' + cats + '</div>' +
        toggle('showCategory', 'نشان دادن دسته بالای کلمه') +
        toggle('sound', 'صدا') +
        toggle('vibrate', 'لرزش') +
        '<p class="muted">' + fa(used) + ' از ' + fa(total) + ' کلمه روی این گوشی دیده شده و تا تمام شدن هر دسته تکرار نمی‌شود.</p>' +
        '<button class="btn ghost" data-act="reset-used">شروع دوباره‌ی کلمه‌ها</button>' +
        (S.game() ? '<p class="muted">تغییرها از بازی بعد اعمال می‌شوند.</p>' : '') +
        '<button class="btn" data-close>بستن</button>';
      App.modal(html, function (act) {
        var st = S.settings(), parts = act.split(':');
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
          W.resetUsed();
          App.toast('کلمه‌ها از اول');
        }
        S.saveSettings(st);
        App.settings();
      });
      box.scrollTop = scroll;
    },

    rules: function () {
      App.modal('<h2>قوانین آش</h2><div class="rules">' +
        '<p>بازیکن‌ها گروه‌های دونفره می‌شوند و یک گوشی دست‌به‌دست می‌چرخد.</p>' +
        '<p>در هر نوبت یک نفر کلمه را می‌بیند و برای هم‌گروهی‌اش <b>فقط با حرف زدن</b> توضیح می‌دهد. وقتی هم‌گروهی درست حدس زد، «درست!» را بزنید؛ کلمه‌ی گروه بعد همان لحظه می‌آید و ساعتش راه می‌افتد، پس گوشی را زود به آن‌ها بدهید.</p>' +
        '<p><b>ممنوع است:</b></p><ul>' +
        '<li>گفتن خود کلمه، بخشی از آن یا کلمه‌ای هم‌ریشه</li>' +
        '<li>گفتن مترادف یا ترجمه به زبان دیگر</li>' +
        '<li>اشاره، ادا درآوردن و صدا درآوردن</li></ul>' +
        '<p>اگر کسی قانون را شکست، «خطا» را بزنید. کلمه می‌سوزد و جریمه کم می‌شود.</p>' +
        '<p>هر گروه ساعت خودش را دارد که فقط در نوبت خودش کم می‌شود. «عوض کن» کلمه را عوض می‌کند ولی چند ثانیه جریمه دارد. در ۱۰ ثانیه‌ی آخر صدای تیک‌تاک کم‌کم تندتر می‌شود.</p>' +
        '<p>وقت هر گروه که تمام شود، آن گروه حذف می‌شود. آخرین گروهی که بماند برنده است.</p>' +
        '<p>توضیح‌دهنده در هر نوبت گروه عوض می‌شود: یک بار سارا برای علی، دفعه‌ی بعد علی برای سارا.</p>' +
        '<p class="muted">کلمه‌ها سه سطح دارند (آسان، متوسط، سخت) و روی هر گوشی تکرار نمی‌شوند تا دسته‌شان تمام شود.</p>' +
        '</div><button class="btn" data-close>فهمیدم</button>');
    },

    /* ---------- start ---------- */

    init: function () {
      App.P = S.players();
      App.fixOrder();

      G.onTick = function () {
        App.renderClock();
        var g = G.state(), left = g.teams[g.current].time, now = Date.now();
        if (left > 10000) return;
        // In the last 10 seconds the tick speeds up: once a second at 10, about 10 a second at the end.
        if (now - App.lastTickSound >= Math.max(100, left / 10)) {
          App.lastTickSound = now;
          Snd.play('tick', 1 - left / 10000);
        }
      };
      App.lastTickSound = 0;
      G.onSecond = function (s) {
        App.renderClock();
        if (s <= 5) vibrate(80);
      };
      G.onOut = App.teamOut;

      $('new-btn').addEventListener('click', function () { App.show('count'); });
      $('resume-btn').addEventListener('click', App.resume);
      $('rules-btn').addEventListener('click', App.rules);
      $('settings-btn').addEventListener('click', App.settings);
      document.querySelectorAll('[data-go]').forEach(function (b) {
        b.addEventListener('click', function () { if (b.dataset.go === 'home') App.home(); else App.show(b.dataset.go); });
      });
      document.querySelectorAll('[data-count]').forEach(function (b) {
        b.addEventListener('click', function () { App.chooseCount(+b.dataset.count); });
      });

      var teams = $('teams');
      teams.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.mode) {
          App.P.mode = b.dataset.mode;
          App.swapFrom = null;
          App.savePlayers();
          App.renderTeams();
        } else if (b.dataset.slot) App.pickSwap(+b.dataset.slot);
      });
      teams.addEventListener('input', function (e) {
        var el = e.target;
        if (el.dataset.name) {
          App.P.names[+el.dataset.name] = el.value;
          // The same player can be in the list and in a team card; keep both in step.
          teams.querySelectorAll('[data-name="' + el.dataset.name + '"]').forEach(function (o) { if (o !== el) o.value = el.value; });
        } else if (el.dataset.team) App.P.teamNames[+el.dataset.team] = el.value;
        App.savePlayers();
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
        App.chooseCount(App.P.count);
      });
      $('home-btn').addEventListener('click', function () { G.quit(); App.home(); });

      $('modal').addEventListener('click', function (e) {
        if (e.target.closest('[data-close]') || (e.target.id === 'modal' && !App.modalSticky)) { App.closeModal(); return; }
        var a = e.target.closest('[data-act]');
        if (a && App.modalClick) App.modalClick(a.dataset.act);
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
