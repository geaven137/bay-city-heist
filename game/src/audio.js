// NEON BAY — all sound is synthesized with WebAudio: no audio files.
// A low engine hum that follows the car's speed, a two-tone police siren,
// a noise-burst gunshot, pickup chimes, a mission jingle, and a slow
// synthwave bass loop. Created on the first user gesture; M mutes.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  const BASS = [55, 55, 65.41, 55, 49, 55, 82.41, 73.42];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      musicTimer = window.setInterval(() => {
        if (muted || !ctx) return;
        const freq = BASS[musicStep % BASS.length];
        musicStep += 1;
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
        osc.connect(g);
        g.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }, 460);
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, duration, type, volume) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function noiseBurst(duration, volume) {
    if (!ctx || muted) return;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    /** Call from any user gesture: unlocks audio in the browser. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    /** Engine hum follows speed (0 when on foot). */
    setEngine(speed, maxSpeed) {
      if (!ctx || muted) return;
      const ratio = Math.abs(speed) / maxSpeed;
      engineGain.gain.setTargetAtTime(ratio * 0.09, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + ratio * 140, ctx.currentTime, 0.1);
    },
    /** Two-tone siren; `on` when any cop is near, alternating pitch. */
    setSiren(on, time) {
      if (!ctx || muted) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.1);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.floor(time * 2) % 2 === 0 ? 700 : 950, ctx.currentTime, 0.05);
    },
    gunshot() { noiseBurst(0.14, 0.5); },
    punch() { noiseBurst(0.06, 0.25); },
    crash() { noiseBurst(0.25, 0.6); blip(70, 0.2, 'sine', 0.4); },
    pickup() { blip(880, 0.12, 'sine', 0.25); window.setTimeout(() => blip(1318, 0.18, 'sine', 0.25), 90); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'triangle', 0.25), i * 110));
    },
    fail() { blip(220, 0.4, 'sawtooth', 0.2); },
    wasted() { [392, 311, 233].forEach((f, i) => window.setTimeout(() => blip(f, 0.35, 'sawtooth', 0.2), i * 180)); },
  };
}
