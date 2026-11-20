// Neon Bay — procedural sound.
// No audio files: the radio, the engine hum and the siren are
// all oscillators shaped in code. Everything is guarded, so the
// module imports cleanly in Node and stays silent there.

const BASSLINE = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4, 55, 0, 55, 65.4, 98, 82.4, 73.4, 65.4];
const LEADLINE = [220, 261.6, 329.6, 392, 329.6, 261.6, 220, 196, 220, 261.6, 329.6, 440, 392, 329.6, 261.6, 220];

export function createAudio() {
  return {
    ctx: null,
    master: null,
    radioGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    step: 0,
    nextNote: 0,
    started: false,
  };
}

export function startAudio(audio) {
  if (audio.started || typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.35;
    audio.master.connect(ctx.destination);
    audio.radioGain = ctx.createGain();
    audio.radioGain.gain.value = 0.16;
    audio.radioGain.connect(audio.master);
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 52;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.sirenOsc = ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 660;
    audio.sirenGain = ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    audio.started = true;
    audio.nextNote = ctx.currentTime + 0.1;
  } catch (e) {
    audio.ctx = null;
  }
}

function blip(audio, freq, dur, type, gainVal) {
  if (!audio.ctx) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gainVal || 0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(g);
  g.connect(audio.radioGain);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

export function stepAudio(audio, state, dt) {
  if (!audio.ctx || !audio.started) return;
  const ctx = audio.ctx;
  // Radio: one bass note and one lead note per eighth, 132 bpm.
  const eighth = 60 / 132 / 2;
  while (audio.nextNote < ctx.currentTime + 0.12) {
    const i = audio.step % BASSLINE.length;
    const bass = BASSLINE[i];
    if (bass > 0) blip(audio, bass, eighth * 0.92, 'triangle', 0.5);
    if (audio.step % 2 === 0) {
      const lead = LEADLINE[(audio.step / 2) % LEADLINE.length];
      blip(audio, lead, eighth * 1.6, 'sine', 0.1);
    }
    audio.step += 1;
    audio.nextNote += eighth;
  }
  // Engine hum follows the player's speed.
  const p = state.player;
  const speed = p.car ? Math.abs(p.car.speed) : Math.abs(p.speed || 0);
  if (audio.engineOsc && audio.engineGain) {
    audio.engineOsc.frequency.value = 48 + speed * 1.6;
    audio.engineGain.gain.value = p.car ? 0.05 + speed * 0.0012 : 0;
  }
  // Siren wails while wanted.
  if (audio.sirenOsc && audio.sirenGain) {
    if (state.wanted > 0) {
      audio.sirenOsc.frequency.value = 620 + Math.sin(state.time * 3.2) * 190;
      audio.sirenGain.gain.value = 0.045;
    } else {
      audio.sirenGain.gain.value = 0;
    }
  }
}

export function playShot(audio) {
  if (!audio.ctx) return;
  blip(audio, 180, 0.09, 'square', 0.3);
  blip(audio, 90, 0.14, 'sawtooth', 0.22);
}

export function playChime(audio) {
  if (!audio.ctx) return;
  blip(audio, 660, 0.16, 'sine', 0.25);
  setTimeout(() => blip(audio, 880, 0.22, 'sine', 0.25), 130);
}
