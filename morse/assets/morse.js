/* Morse core: the code table (ITU-R M.1677-1), audio synthesis, timing and storage.
   A classic script (not an ES module) so the pages also work when opened from file://.
   Exposes window.Morse. */
(function () {
  "use strict";

  const CODE = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
    I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
    Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
    Y: "-.--", Z: "--..",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  };
  const DECODE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));

  /* The order this workspace introduces characters in. New characters are added a few at a
     time once accuracy on the current set reaches 90% (a Koch-style rule; see RESOURCES.md). */
  const ORDER = ["K", "M", "R", "S", "U", "A", "P", "T", "L", "O", "W", "I", "N", "J", "E",
    "F", "Y", "V", "G", "5", "Q", "9", "Z", "H", "3", "8", "B", "4", "2", "7", "C", "1",
    "D", "6", "0", "X"];

  /* ---------- storage (always guarded; pages must work without it) ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("morse:" + key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("morse:" + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  const settings = Object.assign({ tone: 600, volume: 0.35, charWpm: 20 }, store.get("settings", {}));

  /* ---------- timing ---------- */
  /* PARIS standard: one "word" = 50 units, so a unit lasts 1200 / WPM milliseconds. */
  const unitMs = (wpm) => 1200 / wpm;

  /* ---------- audio ---------- */
  let ctx = null;
  let active = [];
  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const RAMP = 0.005; // 5 ms on/off ramps stop the tone from clicking

  function scheduleTone(start, dur) {
    const c = audio();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = settings.tone;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(settings.volume, start + RAMP);
    g.gain.setValueAtTime(settings.volume, start + dur - RAMP);
    g.gain.linearRampToValueAtTime(0, start + dur);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(start + dur + 0.02);
    active.push(o);
    o.onended = () => { active = active.filter((x) => x !== o); };
  }

  function stop() {
    active.forEach((o) => { try { o.stop(); } catch (e) { /* already stopped */ } });
    active = [];
  }

  /* Play a sequence of characters. Gaps: 1 unit inside a character, 3 between characters,
     7 between words (ITU-R M.1677-1). Resolves when the sound has finished. */
  function play(text, opts) {
    const wpm = (opts && opts.wpm) || settings.charWpm;
    const u = unitMs(wpm) / 1000;
    const c = audio();
    stop();
    let t = c.currentTime + 0.06;
    const chars = String(text).toUpperCase().split("");
    chars.forEach((ch, i) => {
      if (ch === " ") { t += 4 * u; return; } // 3 already added after the last character, plus 4 = 7
      const pattern = CODE[ch];
      if (!pattern) return;
      pattern.split("").forEach((el, j) => {
        const d = el === "." ? u : 3 * u;
        scheduleTone(t, d);
        t += d;
        if (j < pattern.length - 1) t += u;
      });
      if (i < chars.length - 1) t += 3 * u;
    });
    const ms = (t - c.currentTime) * 1000;
    return new Promise((res) => setTimeout(res, ms + 20));
  }

  /* A live tone for sending (sidetone): call the returned function to release it. */
  function keyDown() {
    const c = audio();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = settings.tone;
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(settings.volume, t + RAMP);
    o.connect(g).connect(c.destination);
    o.start(t);
    return function keyUp() {
      const t2 = c.currentTime;
      g.gain.cancelScheduledValues(t2);
      g.gain.setValueAtTime(g.gain.value, t2);
      g.gain.linearRampToValueAtTime(0, t2 + RAMP);
      o.stop(t2 + RAMP + 0.02);
    };
  }

  /* How a character is said aloud: "dah-di-dah" for K. An element that's not the last
     dot is "di", because it's clipped when spoken at speed. */
  function say(ch) {
    const p = CODE[String(ch).toUpperCase()];
    if (!p) return "";
    return p.split("").map((el, i) => (el === "-" ? "dah" : i === p.length - 1 ? "dit" : "di")).join("-");
  }

  /* Wire up every <button data-play="K" [data-wpm="20"]> on the page. */
  function wirePlayButtons(root) {
    (root || document).querySelectorAll("[data-play]").forEach((b) => {
      if (b.dataset.wired) return;
      b.dataset.wired = "1";
      b.addEventListener("click", () => play(b.dataset.play, { wpm: Number(b.dataset.wpm) || undefined }));
    });
  }

  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }

  window.Morse = { CODE, DECODE, ORDER, settings, store, unitMs, play, stop, keyDown, say, wirePlayButtons, shuffle };
  document.addEventListener("DOMContentLoaded", () => wirePlayButtons());
})();
