/*
 * Game sounds, made with the Web Audio API (no audio files to download).
 * Off by default; the player turns them on in Settings.
 */
(function (root) {
  'use strict';

  var ctx = null;

  function audio() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // One soft note: frequency in Hz, start offset and length in seconds.
  function tone(freq, at, len, type, volume) {
    var a = audio();
    if (!a) return;
    var t = a.currentTime + (at || 0);
    var osc = a.createOscillator(), gain = a.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume || 0.18, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + len + 0.05);
  }

  var SOUNDS = {
    // urgency 0..1: the higher, the higher and louder the tick.
    tick: function (urgency) { var u = urgency || 0; tone(900 + 700 * u, 0, 0.05, 'square', 0.05 + 0.05 * u); },
    correct: function () { [659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.07, 0.25, 'triangle'); }); },
    change: function () { tone(523, 0, 0.1, 'sine', 0.12); tone(392, 0.09, 0.16, 'sine', 0.12); },
    foul: function () { tone(196, 0, 0.18, 'square', 0.06); tone(165, 0.1, 0.22, 'square', 0.06); },
    out: function () { [440, 370, 311, 262].forEach(function (f, i) { tone(f, i * 0.14, 0.3, 'triangle', 0.16); }); },
    win: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, i * 0.11, i === 5 ? 0.6 : 0.2, 'triangle'); }); }
  };

  root.ASound = {
    enabled: function () { return !!root.AStore.setting('sound', false); },

    set: function (value) {
      root.AStore.saveSetting('sound', !!value);
      if (value) this.play('correct'); // a sample, so the player hears it is on
    },

    play: function (name, arg) {
      if (!this.enabled() || !SOUNDS[name]) return;
      try { SOUNDS[name](arg); } catch (e) { /* audio not available */ }
    }
  };
})(this);
