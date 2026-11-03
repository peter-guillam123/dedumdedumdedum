// The heartbeat: a soft "de" and a deeper "DUM" played under the words,
// made on the fly with the Web Audio API. Never plays until asked.
//
// Each playback gets its own volume control, so Stop can silence it at once,
// and the on-screen highlight follows the audio clock (allowing for the
// device's output delay) rather than a separate timer that can drift.
import { load, save } from "./store.js";

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

// Speeds: seconds per light syllable (a beat lasts a little longer).
// "Steady" is one de-DUM per resting heartbeat, about 66 a minute.
export const SPEEDS = [
  { key: "slow", label: "Slow", gap: 0.62 },
  { key: "steady", label: "Steady", gap: 0.45 },
  { key: "quick", label: "Quick", gap: 0.32 },
];
export function getSpeed() {
  const k = load("beat:speed", "steady");
  return SPEEDS.find((s) => s.key === k) || SPEEDS[1];
}
export function setSpeed(key) {
  save("beat:speed", key);
}

// strength: 0 offbeat, 1 light beat, 2 beat
function thump(dest, t, strength, oscs) {
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
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.3);
  oscs.push(osc);
}

let current = null;

function finish(job, stopped) {
  if (job.done) return;
  job.done = true;
  cancelAnimationFrame(job.raf);
  clearTimeout(job.fallback);
  if (job.gain) {
    try {
      job.gain.gain.cancelScheduledValues(0);
      job.gain.gain.setValueAtTime(0, ctx.currentTime);
      job.gain.disconnect();
    } catch {}
    for (const o of job.oscs) {
      try {
        o.stop();
      } catch {}
    }
  }
  if (current === job) current = null;
  if (job.onStep) job.onStep(-1);
  if (job.onEnd) job.onEnd(stopped);
}

export function stop() {
  if (current) finish(current, true);
}

export function isPlaying() {
  return !!current;
}

// steps: [{strength 0|1|2, pause?: extra light-syllables of silence after}]
// Options: gap (seconds per light syllable) or tempo (old style: 60/tempo/2),
// onStep(i) as each step sounds (-1 at the end), onEnd(stopped).
// Returns the job; job.at[i] is when step i sounds, in seconds from the call.
export function play(steps, { gap, tempo, onStep, onEnd, sound = true } = {}) {
  stop();
  const c = sound ? audio() : null;
  const g = gap || (tempo ? 60 / tempo / 2 : getSpeed().gap);
  const job = { onStep, onEnd, oscs: [], done: false, raf: 0, at: [] };
  current = job;
  const lead = 0.08;
  // where each step falls, and how long it lasts
  let t = 0;
  const times = steps.map((st) => {
    const here = t;
    t += g * (st.strength === 2 ? 1.08 : 1) + (st.pause || 0) * g;
    return here;
  });
  const total = t;
  // the device's own delay between "play now" and sound coming out
  const latency = c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0;
  job.at = times.map((x) => lead + x + latency);
  let clock;
  if (c) {
    job.gain = c.createGain();
    job.gain.connect(master);
    const start = c.currentTime + lead;
    steps.forEach((st, i) => thump(job.gain, start + times[i], st.strength, job.oscs));
    clock = () => c.currentTime - start - latency;
  } else {
    const start = performance.now() / 1000 + lead;
    clock = () => performance.now() / 1000 - start;
  }
  let shown = -2;
  const tick = () => {
    if (job.done) return;
    const now = clock();
    if (now >= total + 0.25) return finish(job, false);
    let k = -1;
    for (let i = 0; i < times.length && times[i] <= now; i++) k = i;
    // show nothing during a long pause after a syllable
    if (k >= 0 && now - times[k] > g * 1.4) k = -1;
    if (k !== shown) {
      shown = k;
      if (onStep && k >= 0) onStep(k);
      else if (onStep && k < 0 && now > 0) onStep(-1);
    }
    job.raf = requestAnimationFrame(tick);
  };
  job.raf = requestAnimationFrame(tick);
  // if the page is hidden, frames stop: make sure the job still ends
  job.fallback = setTimeout(() => finish(job, false), (lead + total + latency + 1) * 1000);
  return job;
}

// A plain metronome pulse: n feet of de-DUM.
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

export function unlock() {
  audio();
}

export function click(strength = 2) {
  const c = audio();
  if (c) thump(master, c.currentTime + 0.01, strength, []);
}
