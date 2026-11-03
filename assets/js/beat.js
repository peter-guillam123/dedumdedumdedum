// The heartbeat: a soft "de" and a deeper "DUM" played under the words,
// made on the fly with the Web Audio API. Never plays until asked.

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// strength: 0 offbeat, 1 light beat, 2 beat
function thump(t, strength) {
  const c = ctx;
  const osc = c.createOscillator();
  const g = c.createGain();
  if (strength === 0) {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  } else {
    const peak = strength === 2 ? 0.95 : 0.45;
    osc.type = "sine";
    osc.frequency.setValueAtTime(strength === 2 ? 130 : 160, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  }
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.3);
}

let current = null;

export function stop() {
  if (current) {
    current.cancelled = true;
    current.timers.forEach(clearTimeout);
    if (current.onEnd) current.onEnd();
    current = null;
  }
}

export function isPlaying() {
  return !!current;
}

// steps: [{strength 0|1|2, pause?: extra beats of silence after}]
// onStep(i) is called as each step sounds; onEnd when finished or stopped.
export function play(steps, { tempo = 150, onStep, onEnd, sound = true } = {}) {
  stop();
  const c = sound ? audio() : null;
  const gap = 60 / tempo / 2; // two syllables per beat of the metronome
  const job = { cancelled: false, timers: [], onEnd };
  current = job;
  let t = 0;
  const start = c ? c.currentTime + 0.08 : 0;
  steps.forEach((st, i) => {
    if (c) thump(start + t, st.strength);
    job.timers.push(setTimeout(() => !job.cancelled && onStep && onStep(i), (t + 0.08) * 1000));
    t += gap * (st.strength === 2 ? 1.08 : 1) + (st.pause || 0) * gap;
  });
  job.timers.push(
    setTimeout(() => {
      if (job.cancelled) return;
      if (onStep) onStep(-1);
      current = null;
      if (onEnd) onEnd();
    }, (t + 0.35) * 1000),
  );
  return job;
}

// A plain metronome pulse for the "tap along" games: n feet of de-DUM.
export function pulse(feet, opts = {}) {
  const steps = [];
  for (let i = 0; i < feet; i++) steps.push({ strength: 0 }, { strength: 2 });
  return play(steps, opts);
}

export function stepsFromScan(scan) {
  return scan.syllables.map((s, i) => {
    const w = scan.words[s.word];
    const lastOfWord = w.syllables[w.syllables.length - 1] === i;
    const pause = lastOfWord && /[.;:!?–]/.test(w.punct) ? 0.6 : lastOfWord && /,/.test(w.punct) ? 0.3 : 0;
    return { strength: s.beat ? ("fFuU".includes(s.cls) ? 1 : 2) : 0, pause };
  });
}

export function now() {
  return ctx ? ctx.currentTime : performance.now() / 1000;
}

export function unlock() {
  audio();
}

export function click(strength = 2) {
  const c = audio();
  if (c) thump(c.currentTime + 0.01, strength);
}
