/* Listening drill: hear a character, name it. Answer-paced, so there's no time pressure
   between characters, but each character is sent at full character speed.
   Markup: <div class="drill" data-listen-drill data-id="l1" data-chars="KM" data-trials="30"></div>
   Progress is saved as Morse.store "drill:<id>". */
(function () {
  "use strict";
  const M = window.Morse;
  const WINDOW = 20; // accuracy is measured over the last 20 answers
  const PASS = 0.9;

  function init(el) {
    const chars = el.dataset.chars.split("");
    const trials = Number(el.dataset.trials) || 30;
    const id = el.dataset.id;
    const saved = M.store.get("drill:" + id, { sessions: [] });

    el.innerHTML = `
      <div class="drill-head">
        <p class="drill-title">Listen: which character?</p>
        <span class="drill-meta">${M.settings.charWpm} WPM characters · ${trials} trials</span>
      </div>
      <div class="drill-stage">
        <div>
          <div class="drill-big" aria-live="polite">♪</div>
          <p class="drill-msg"></p>
          <div class="answers">${chars.map((c) => `<button data-a="${c}" disabled>${c}<kbd>${c.toLowerCase()}</kbd></button>`).join("")}</div>
          <div class="track"></div>
        </div>
      </div>
      <div style="text-align:center">
        <button class="btn primary start">Start</button>
        <button class="btn replay" disabled>Replay <span class="mono">(space)</span></button>
      </div>
      <div class="stats">
        <span>Accuracy (last ${WINDOW}) <b class="acc">–</b></span>
        <span>Median response time <b class="rt">–</b></span>
        <span>Trial <b class="n">0</b>/${trials}</span>
      </div>
      <p class="small muted history" style="text-align:center;margin-bottom:0"></p>`;

    const $ = (s) => el.querySelector(s);
    const big = $(".drill-big"), msg = $(".drill-msg"), track = $(".track");
    const startBtn = $(".start"), replayBtn = $(".replay");
    const answerBtns = [...el.querySelectorAll(".answers button")];

    let results = [], times = [], current = null, shownAt = 0, n = 0, running = false, locked = true;

    function showHistory() {
      const s = saved.sessions;
      if (!s.length) { $(".history").textContent = "No sessions yet."; return; }
      const last = s[s.length - 1];
      const best = Math.max(...s.map((x) => x.acc));
      $(".history").textContent = `Last session ${last.date}: ${Math.round(last.acc * 100)}%. Best: ${Math.round(best * 100)}%. Sessions: ${s.length}.`;
    }
    showHistory();

    function accuracy() {
      const w = results.slice(-WINDOW);
      return w.length ? w.filter(Boolean).length / w.length : 0;
    }
    function median(a) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; }
    function updateStats() {
      $(".acc").textContent = results.length ? Math.round(accuracy() * 100) + "%" : "–";
      $(".rt").textContent = times.length ? (median(times) / 1000).toFixed(2) + "s" : "–";
      $(".n").textContent = n;
      track.innerHTML = results.map((r) => `<i class="${r ? "ok" : "no"}"></i>`).join("");
    }

    function pick() {
      // avoid long runs of the same character, which let you guess instead of listen
      let c;
      do { c = chars[Math.floor(Math.random() * chars.length)]; }
      while (results.length > 1 && c === current && Math.random() < 0.5);
      return c;
    }

    async function next() {
      if (n >= trials) return finish();
      current = pick();
      big.textContent = "♪";
      msg.textContent = ""; msg.className = "drill-msg";
      locked = true;
      await M.play(current);
      shownAt = performance.now();
      locked = false;
      answerBtns.forEach((b) => (b.disabled = false));
    }

    async function answer(a) {
      if (!running || locked) return;
      locked = true;
      answerBtns.forEach((b) => (b.disabled = true));
      n++;
      const ok = a === current;
      results.push(ok);
      if (ok) times.push(performance.now() - shownAt);
      big.textContent = current;
      if (ok) {
        msg.textContent = "Yes: " + M.say(current);
        msg.className = "drill-msg good";
        updateStats();
        await new Promise((r) => setTimeout(r, 550));
      } else {
        msg.textContent = `That was ${current}: ${M.say(current)}. Listen again…`;
        msg.className = "drill-msg bad";
        updateStats();
        await new Promise((r) => setTimeout(r, 400));
        await M.play(current);
        await new Promise((r) => setTimeout(r, 700));
      }
      next();
    }

    function finish() {
      running = false;
      const acc = accuracy();
      saved.sessions.push({ date: new Date().toISOString().slice(0, 10), acc, trials: n, medianMs: Math.round(median(times)) });
      M.store.set("drill:" + id, saved);
      big.textContent = Math.round(acc * 100) + "%";
      msg.className = "drill-msg " + (acc >= PASS ? "good" : "");
      msg.textContent = acc >= PASS
        ? "Over 90%: you're ready for the next characters. Do one more session tomorrow to make sure it sticks."
        : "Under 90% for now, which is normal early on. Run it again tomorrow: spacing it out is what builds memory.";
      startBtn.textContent = "Run again";
      startBtn.disabled = false;
      replayBtn.disabled = true;
      showHistory();
    }

    startBtn.addEventListener("click", () => {
      results = []; times = []; n = 0; running = true;
      startBtn.disabled = true; replayBtn.disabled = false;
      updateStats();
      next();
    });
    replayBtn.addEventListener("click", () => { if (running && !locked) M.play(current); });
    answerBtns.forEach((b) => b.addEventListener("click", () => answer(b.dataset.a)));

    document.addEventListener("keydown", (e) => {
      if (!running || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (chars.includes(k)) { e.preventDefault(); answer(k); }
      else if (e.key === " " && !locked) { e.preventDefault(); M.play(current); }
    });
  }

  document.addEventListener("DOMContentLoaded", () => document.querySelectorAll("[data-listen-drill]").forEach(init));
})();
