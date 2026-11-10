// Sound and touch: a short click when a tile is picked, a chime when a word is taken, a low note when it is not,
// and a little tune when a board is cleared or a game is won. The sounds are made here (Web Audio), so the app
// carries no sound files. In the app the phone's own vibration (Capacitor Haptics) goes with them; on the web,
// Android vibrates where the browser allows it, and an iPhone does not.
// Both can be turned off in Settings (ordspill/lyd/v1, ordspill/vibrasjon/v1); both are on until then.
(function () {
  var SOUND_KEY = "ordspill/lyd/v1", BUZZ_KEY = "ordspill/vibrasjon/v1";
  function read(k) { try { var v = JSON.parse(localStorage.getItem(k)); return v === null ? true : !!v; } catch (e) { return true; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(!!v)); } catch (e) {} }
  var sound = read(SOUND_KEY), buzz = read(BUZZ_KEY), ctx = null;
  var C = window.Capacitor, HAP = C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Haptics;

  // The audio is started by the first touch: browsers keep it silent until the player has done something.
  function audio() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(function () {}); return ctx; }
    var A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    try { ctx = new A(); } catch (e) { ctx = null; }
    return ctx;
  }
  document.addEventListener("pointerdown", function () { if (sound) audio(); }, { capture: true, passive: true });

  // One note: a frequency, when it starts (seconds from now), how long it lasts, how loud, and its shape.
  function note(f, at, dur, vol, type) {
    var a = audio(); if (!a) return;
    var t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var SOUNDS = {
    tap: function () { note(740, 0, 0.07, 0.05, "sine"); },
    back: function () { note(520, 0, 0.06, 0.04, "sine"); },
    pocket: function () { note(440, 0, 0.09, 0.05, "triangle"); note(330, 0.06, 0.1, 0.04, "triangle"); },
    good: function () { note(660, 0, 0.12, 0.07, "triangle"); note(880, 0.09, 0.2, 0.07, "triangle"); },
    great: function () { note(660, 0, 0.11, 0.07, "triangle"); note(880, 0.08, 0.11, 0.07, "triangle"); note(1175, 0.16, 0.26, 0.07, "triangle"); },
    bad: function () { note(196, 0, 0.16, 0.06, "triangle"); note(165, 0.1, 0.2, 0.05, "triangle"); },
    turn: function () { note(587, 0, 0.1, 0.05, "sine"); note(784, 0.1, 0.16, 0.05, "sine"); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { note(f, i * 0.11, i === 3 ? 0.5 : 0.16, 0.07, "triangle"); }); }
  };
  var TOUCH = {
    tap: function () { HAP.impact({ style: "LIGHT" }); }, back: function () { HAP.impact({ style: "LIGHT" }); },
    pocket: function () { HAP.impact({ style: "MEDIUM" }); }, turn: function () { HAP.impact({ style: "MEDIUM" }); },
    good: function () { HAP.notification({ type: "SUCCESS" }); }, great: function () { HAP.notification({ type: "SUCCESS" }); },
    bad: function () { HAP.notification({ type: "ERROR" }); }, win: function () { HAP.notification({ type: "SUCCESS" }); }
  };
  var VIBRATE = { tap: 8, back: 8, pocket: 15, turn: 15, good: [12, 40, 12], great: [12, 40, 12, 40, 12], bad: [40, 30, 40], win: [20, 50, 20, 50, 60] };

  window.WB_FEEL = {
    play: function (kind) {
      if (sound && SOUNDS[kind]) try { SOUNDS[kind](); } catch (e) {}
      if (!buzz) return;
      try {
        if (HAP && TOUCH[kind]) { var p = TOUCH[kind](); if (p && p.catch) p.catch(function () {}); }
        else if (navigator.vibrate && VIBRATE[kind]) navigator.vibrate(VIBRATE[kind]);
      } catch (e) {}
    },
    sound: function () { return sound; },
    buzz: function () { return buzz; },
    // Vibration only where the phone can do it: the app, or a browser that has navigator.vibrate.
    canBuzz: function () { return !!(HAP || navigator.vibrate); },
    setSound: function (on) { sound = !!on; save(SOUND_KEY, sound); if (sound) SOUNDS.good(); },
    setBuzz: function (on) { buzz = !!on; save(BUZZ_KEY, buzz); if (buzz) window.WB_FEEL.play("tap"); }
  };
})();
