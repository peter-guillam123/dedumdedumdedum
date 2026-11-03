import { getScanner } from "../data.js";
import { createMarker, explain } from "../marker.js";
import { el, renderLine, beatWords } from "../render.js";
import * as beat from "../beat.js";
import { save } from "../store.js";

const LINE = "If music be the food of love, play on;";

async function main() {
  const scanner = await getScanner();
  const scan = scanner.scanLine(LINE);
  const holder = document.getElementById("try-line");
  const result = document.getElementById("try-result");
  const checkBtn = document.getElementById("try-check");
  const hearBtn = document.getElementById("try-hear");
  const againBtn = document.getElementById("try-again");
  let marker;

  function setup() {
    holder.innerHTML = "";
    result.innerHTML = "";
    marker = createMarker(scan, { label: "Twelfth Night, line 1" });
    holder.append(marker.node);
    checkBtn.hidden = false;
    againBtn.hidden = true;
  }
  setup();

  checkBtn.addEventListener("click", () => {
    if (!marker.marks.size) {
      result.innerHTML = "";
      result.append(el("div", { class: "feedback feedback--info" }, "Tap the syllables you lean on first. Saying it out loud helps."));
      return;
    }
    const r = marker.check();
    checkBtn.hidden = true;
    againBtn.hidden = false;
    result.innerHTML = "";
    const good = r.right >= r.total - 1;
    result.append(
      el(
        "div",
        { class: `feedback ${good ? "feedback--good" : "feedback--bad"}` },
        r.perfect ? "Spot on." : good ? `Nearly: ${r.right} of ${r.total}.` : `${r.right} of ${r.total}. Have another listen.`,
        ...explain(r, scan).map((t) => el("p", {}, t)),
        el("p", {}, "Five beats, each after a lighter syllable: ", el("b", {}, beatWords(scan)), ". That's iambic pentameter, the heartbeat of Shakespeare's verse. Most of what makes his lines interesting is where he breaks it."),
      ),
      el("p", {}, el("a", { class: "btn btn--red", href: "learn.html?l=heartbeat" }, "Start lesson 1: the heartbeat")),
    );
    save("home-tried", true);
  });

  againBtn.addEventListener("click", setup);

  hearBtn.addEventListener("click", () => {
    if (beat.isPlaying()) {
      beat.stop();
      return;
    }
    // show the line with its marks while it plays
    const shown = renderLine(scan);
    const verse = el("div", { class: "verse" }, shown);
    const prev = holder.firstChild;
    holder.replaceChildren(verse);
    hearBtn.textContent = "Stop";
    const syls = shown.querySelectorAll(".syl");
    beat.play(beat.stepsFromScan(scan), {
      tempo: 132,
      onStep: (i) => syls.forEach((s, k) => s.classList.toggle("is-now", k === i)),
      onEnd: () => {
        hearBtn.textContent = "Hear the heartbeat";
        holder.replaceChildren(prev);
      },
    });
  });
}

main().catch((e) => {
  document.getElementById("try-line").textContent = "Sorry, the line didn't load. Try refreshing the page.";
  console.error(e);
});
