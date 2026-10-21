/*
 * Everything the game keeps lives in localStorage:
 *   ash.settings  time per team, penalty, difficulty, categories, sound, vibration
 *   ash.players   the last player and team names, grouping mode
 *   ash.used      words already shown on this phone, so they do not come back
 *   ash.game      the game in progress, restored after a refresh
 */
(function (root) {
  'use strict';

  var PREFIX = 'ash.';
  var memory = {}; // fallback when localStorage is blocked (private mode etc.)

  function read(key, fallback) {
    var raw = null;
    try { raw = root.localStorage.getItem(PREFIX + key); } catch (e) { raw = memory[key] || null; }
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function write(key, value) {
    var raw = JSON.stringify(value);
    memory[key] = raw;
    try { root.localStorage.setItem(PREFIX + key, raw); } catch (e) { /* keep in memory */ }
  }

  function remove(key) {
    delete memory[key];
    try { root.localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
  }

  var DEFAULTS = {
    time: 120,            // seconds per team
    penalty: 5,           // seconds lost for «عوض کن» or «خطا»
    difficulty: 'mixed',  // easy | mixed | hard | steps
    off: [],              // names of categories turned off
    showCategory: true,
    sound: false,
    vibrate: true
  };

  var Store = {
    settings: function () {
      var s = read('settings', {}), out = {};
      Object.keys(DEFAULTS).forEach(function (k) { out[k] = k in s ? s[k] : DEFAULTS[k]; });
      return out;
    },

    saveSettings: function (s) { write('settings', s); },

    setting: function (name, fallback) {
      var s = Store.settings();
      return name in s ? s[name] : fallback;
    },

    saveSetting: function (name, value) {
      var s = Store.settings();
      s[name] = value;
      Store.saveSettings(s);
    },

    // names: 12 player names (only the first `count` are used), order: who sits in which team slot.
    players: function () {
      var p = read('players', null) || {};
      return {
        count: [4, 6, 8, 10, 12].indexOf(p.count) >= 0 ? p.count : 4,
        names: (p.names || []).concat(new Array(12).fill('')).slice(0, 12),
        teamNames: (p.teamNames || []).concat(new Array(6).fill('')).slice(0, 6),
        order: p.order || null,
        mode: p.mode === 'manual' ? 'manual' : 'random',
        shuffled: !!p.shuffled
      };
    },

    savePlayers: function (p) { write('players', p); },

    used: function () { return read('used', []); },

    saveUsed: function (list) { write('used', list); },

    game: function () { return read('game', null); },

    saveGame: function (g) { write('game', g); },

    clearGame: function () { remove('game'); }
  };

  root.AStore = Store;
})(this);
