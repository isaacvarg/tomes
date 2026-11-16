/* Quiz component. Markup:
   <div class="quiz" data-answer="b">
     <p>Question?</p>
     <div class="options"><button data-k="a">…</button><button data-k="b">…</button></div>
     <p class="why">Explanation shown after answering.</p>
   </div>
   Keep every option the same length so formatting never gives the answer away. */
(function () {
  "use strict";
  function wire(q) {
    const answer = q.dataset.answer;
    const buttons = q.querySelectorAll(".options button");
    buttons.forEach((b) => b.addEventListener("click", () => {
      if (q.classList.contains("done")) return;
      if (b.dataset.k === answer) {
        b.classList.add("right");
        q.classList.add("done");
        buttons.forEach((x) => (x.disabled = true));
      } else {
        b.classList.add("wrong");
        b.disabled = true; // try again: retrieval practice, not a one-shot test
      }
    }));
  }
  document.addEventListener("DOMContentLoaded", () => document.querySelectorAll(".quiz").forEach(wire));
})();
