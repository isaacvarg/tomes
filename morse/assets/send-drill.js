/* Sending drill: see a character, key it from memory with the spacebar (or the pad), and
   get instant feedback on what a receiver would decode and on your rhythm.
   Markup: <div class="drill" data-send-drill data-id="s1" data-chars="KM" data-rounds="10"></div> */
(function () {
  "use strict";
  const M = window.Morse;
  const SPEEDS = [8, 10, 13, 15, 20];

  function init(el) {
    const chars = el.dataset.chars.split("");
    const rounds = Number(el.dataset.rounds) || 10;
    const id = el.dataset.id;
    const saved = M.store.get("drill:" + id, { sessions: [], wpm: 10 });

    el.innerHTML = `
      <div class="drill-head">
        <p class="drill-title">Send: key the character you see</p>
        <span class="drill-meta">Sending speed
          <select class="wpm">${SPEEDS.map((s) => `<option value="${s}" ${s === saved.wpm ? "selected" : ""}>${s} WPM</option>`).join("")}</select>
        </span>
      </div>
      <div class="drill-stage">
        <div style="width:100%">
          <div class="drill-big target">–</div>
          <p class="drill-msg"></p>
          <button class="key-pad" disabled>Hold <b>space</b> (or press here) to key</button>
          <div class="viz"></div>
        </div>
      </div>
      <div style="text-align:center">
        <button class="btn primary start">Start</button>
        <button class="btn hint" disabled>Hear it first</button>
      </div>
      <div class="stats">
        <span>Clean sends <b class="clean">0</b>/<span class="done">0</span></span>
        <span>Your dah : dit <b class="ratio">–</b> <span class="small">(aim for 3)</span></span>
      </div>
      <p class="small muted history" style="text-align:center;margin-bottom:0"></p>`;

    const $ = (s) => el.querySelector(s);
    const target = $(".target"), msg = $(".drill-msg"), pad = $(".key-pad"), viz = $(".viz");
    const startBtn = $(".start"), hintBtn = $(".hint"), wpmSel = $(".wpm");

    let running = false, armed = false, current = null, round = 0, clean = 0, hints = 0;
    let presses = [], downAt = 0, release = null, idleTimer = null, ratios = [];

    const unit = () => M.unitMs(Number(wpmSel.value));

    function showHistory() {
      const s = saved.sessions;
      if (!s.length) { $(".history").textContent = "No sessions yet."; return; }
      const last = s[s.length - 1];
      $(".history").textContent = `Last session ${last.date}: ${last.clean}/${last.rounds} clean at ${last.wpm} WPM. Sessions: ${s.length}.`;
    }
    showHistory();

    wpmSel.addEventListener("change", () => { saved.wpm = Number(wpmSel.value); M.store.set("drill:" + id, saved); });

    function nextRound() {
      if (round >= rounds) return finish();
      round++;
      current = chars[Math.floor(Math.random() * chars.length)];
      target.textContent = current;
      msg.textContent = `Round ${round} of ${rounds}`;
      msg.className = "drill-msg";
      presses = [];
      armed = true;
      pad.disabled = false;
      hintBtn.disabled = false;
    }

    function down() {
      if (!armed || release) return;
      clearTimeout(idleTimer);
      downAt = performance.now();
      release = M.keyDown();
      pad.classList.add("down");
    }
    function up() {
      if (!release) return;
      release(); release = null;
      pad.classList.remove("down");
      const t = performance.now();
      presses.push({ start: downAt, end: t });
      // 5 units of silence ends the character: longer than the 3-unit letter gap, to be forgiving.
      idleTimer = setTimeout(evaluate, Math.max(5 * unit(), 350));
    }

    function evaluate() {
      armed = false;
      pad.disabled = true;
      hintBtn.disabled = true;
      const u = unit();
      const durs = presses.map((p) => p.end - p.start);
      const pattern = durs.map((d) => (d < 2 * u ? "." : "-")).join("");
      const decoded = M.DECODE[pattern];
      const ok = pattern === M.CODE[current];

      const dits = durs.filter((d) => d < 2 * u), dahs = durs.filter((d) => d >= 2 * u);
      let tip = "";
      if (dits.length && dahs.length) {
        const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        const r = avg(dahs) / avg(dits);
        ratios.push(r);
        $(".ratio").textContent = (ratios.reduce((x, y) => x + y, 0) / ratios.length).toFixed(1);
        if (r < 2.3) tip = " Your dahs are a bit short: hold them about 3× as long as a dit.";
        else if (r > 4) tip = " Your dahs are a bit long: about 3× a dit is the target.";
      }
      const gaps = presses.slice(1).map((p, i) => p.start - presses[i].end);
      if (gaps.some((g) => g > 2.5 * u)) tip += " Keep the gaps inside a letter short (1 unit), or a receiver may hear two letters.";

      if (ok) clean++;
      $(".clean").textContent = clean;
      $(".done").textContent = round;
      msg.className = "drill-msg " + (ok ? "good" : "bad");
      msg.textContent = ok
        ? `Clean ${current}.${tip}`
        : `A receiver would hear ${decoded ? "“" + decoded + "”" : "an unknown character"} (${pattern.split("").map((e) => (e === "." ? "dit" : "dah")).join("-") || "nothing"}). ${current} is ${M.say(current)}.${tip}`;
      drawViz(presses, current, u);
      setTimeout(nextRound, ok ? 1100 : 2600);
    }

    /* Your keying (top) against the ideal timing (bottom), on the same time scale. */
    function drawViz(ps, ch, u) {
      const t0 = ps[0].start;
      const actual = [];
      ps.forEach((p, i) => {
        if (i) actual.push({ on: false, d: p.start - ps[i - 1].end });
        actual.push({ on: true, d: p.end - p.start });
      });
      const ideal = [];
      M.CODE[ch].split("").forEach((e, i) => {
        if (i) ideal.push({ on: false, d: u });
        ideal.push({ on: true, d: (e === "." ? 1 : 3) * u });
      });
      const total = Math.max(ps[ps.length - 1].end - t0, ideal.reduce((s, x) => s + x.d, 0));
      const row = (segs, cls) => `<div class="keyed" style="width:100%">${segs.map((s) =>
        `<span class="${s.on ? cls : ""}" style="width:${(s.d / total) * 100}%"></span>`).join("")}
        <span style="flex:1"></span></div>`;
      viz.innerHTML = `<div class="row-label">you</div>${row(actual, "on")}<div class="row-label">ideal at ${wpmSel.value} WPM</div>${row(ideal, "ideal")}`;
    }

    function finish() {
      running = false;
      saved.sessions.push({ date: new Date().toISOString().slice(0, 10), clean, rounds, wpm: Number(wpmSel.value), hints });
      M.store.set("drill:" + id, saved);
      target.textContent = `${clean}/${rounds}`;
      msg.className = "drill-msg " + (clean / rounds >= 0.9 ? "good" : "");
      msg.textContent = clean / rounds >= 0.9
        ? "Clean sending. Next time, try one speed step faster."
        : "Keep going: rhythm comes with repetition. Hum the sound before you key it.";
      startBtn.textContent = "Run again";
      startBtn.disabled = false;
      showHistory();
    }

    startBtn.addEventListener("click", () => {
      running = true; round = 0; clean = 0; hints = 0; ratios = [];
      $(".clean").textContent = "0"; $(".done").textContent = "0"; $(".ratio").textContent = "–";
      viz.innerHTML = "";
      startBtn.disabled = true;
      nextRound();
    });
    hintBtn.addEventListener("click", () => { if (armed && !presses.length) { hints++; M.play(current); } });

    pad.addEventListener("pointerdown", (e) => { e.preventDefault(); down(); });
    pad.addEventListener("pointerup", up);
    pad.addEventListener("pointerleave", up);
    pad.addEventListener("pointercancel", up);
    document.addEventListener("keydown", (e) => {
      if (!running || e.key !== " ") return;
      e.preventDefault();
      if (!e.repeat) down();
    });
    document.addEventListener("keyup", (e) => {
      if (!running || e.key !== " ") return;
      e.preventDefault();
      up();
    });
  }

  document.addEventListener("DOMContentLoaded", () => document.querySelectorAll("[data-send-drill]").forEach(init));
})();
