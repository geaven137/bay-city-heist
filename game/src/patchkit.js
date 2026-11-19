// NEON BAY — Harbourlight Patch Kit, adapted from the module description.
// Original harbourlight-patch-kit.js was never provided; this is a fresh
// Canvas 2D adaptation (no Three.js/WebGL, no libs, no network). Pure logic
// is testable in Node; browser parts guard `window`.
import { CITY, MISSIONS, PALETTE, WANTED } from './config.js';
import { hitsBuilding, isOnRoad, nearestCentre, roadCentresX, roadCentresY } from './world.js';
import { makeCar } from './vehicles.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angD = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const h2 = (a, b) => { const h = (a * 374761393 + b * 668265263) % 1000; return ((h % 1000) + 1000) % 1000 / 1000; }; // deterministic 0..1, no shared RNG
const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); };
const listeners = {};
function on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); }
function emit(ev, data) { const l = listeners[ev]; if (l) for (const f of l) { try { f(data); } catch {} } }

// Save: versioned, checksum, backup, migrations. Falls back to backup, then v1.
const SK = 'neon-bay.save.v2', SB = 'neon-bay.save.v2.bak', S1 = 'neon-bay.save.v1';
function sum(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function memStore() { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; }
const MEM = memStore();
function store(s) { if (s) return s; try { return (typeof window !== 'undefined' && window.localStorage) || MEM; } catch { return MEM; } }
const Save = {
  VERSION: 2,
  migrations: { 1: (o) => ({ money: o.money ?? 60, health: o.health ?? 100, ammo: o.ammo ?? 24, missionsDone: o.missionsDone ?? 0, storyDone: !!o.storyDone, x: o.x, y: o.y, time: o.time ?? 0, profile: null, economy: null, skyTime: 18.5 }) },
  exists(st) { try { const s = store(st); return !!(s.getItem(SK) || s.getItem(SB) || s.getItem(S1)); } catch { return false; } },
  _read(st, key) { try { const raw = store(st).getItem(key); if (!raw) return null; const o = JSON.parse(raw); if (o.v !== 2 || o.sum !== sum(o.p)) return null; return JSON.parse(o.p); } catch { return null; } },
  _write(st, data) { try { const s = store(st); const p = JSON.stringify(data); const cur = s.getItem(SK); if (cur) s.setItem(SB, cur); s.setItem(SK, JSON.stringify({ v: 2, sum: sum(p), p })); return true; } catch { return false; } },
  load(st) { const d = this._read(st, SK) || this._read(st, SB); if (d) return d; try { const raw = store(st).getItem(S1); if (raw) return this.migrations[1](JSON.parse(raw)); } catch {} return null; },
  save(st, data) { return this._write(st, data); },
  _last: 0,
  autosave(st, collect, force) { const now = Date.now() / 1000; if (!force && now - this._last < 10) return false; this._last = now; return this._write(st, collect()); },
  collect(state) { return { money: state.money, health: state.health, ammo: state.ammo, missionsDone: state.missionsDone, storyDone: !!state.storyDone, x: state.player.x, y: state.player.y, time: state.time, profile: Profile.serialize(), economy: Economy.serialize(), skyTime: Sky.serialize() }; },
  apply(state, data) {
    if (!data) return false;
    state.money = data.money ?? 60; state.health = data.health ?? 100; state.ammo = data.ammo ?? 24;
    state.missionsDone = data.missionsDone ?? 0; state.storyDone = !!data.storyDone;
    if (data.x !== undefined && data.y !== undefined) { state.player.x = data.x; state.player.y = data.y; }
    if (data.time !== undefined) state.time = data.time;
    Profile.restore(data.profile); Economy.restore(data.economy); Sky.restore(data.skyTime);
    return true;
  },
};
// Guard + loop: per-frame try/catch + dt clamp so one error never kills the game.
const Guard = {
  run(fn) { try { fn(); return true; } catch (e) { emit('error', e); return false; } },
  clampDt(dt) { return dt > 0.1 ? 0.1 : dt; },
};
function loop(fn) {
  let last = (typeof performance !== 'undefined' ? performance.now() : 0);
  let on = true;
  const tick = (now) => { if (!on) return; if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(tick); const dt = Guard.clampDt(Math.max(0, (now - last) / 1000)); last = now; Guard.run(() => fn(dt)); };
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(tick);
  return () => { on = false; };
}
// Perf: auto quality up/down on FPS; emits perf:quality (level, scale).
const Perf = {
  level: 0, ema: 60, _t: 0, _up: 0,
  frame(dt) {
    if (dt <= 0) return;
    this.ema += (1 / dt - this.ema) * 0.05;
    if (this.ema < 45) { this._t += dt; if (this._t > 2) { this._t = 0; this.set(Math.min(2, this.level + 1)); } } else this._t = 0;
    if (this.ema > 58 && this.level > 0) { this._up += dt; if (this._up > 5) { this._up = 0; this.set(this.level - 1); } } else this._up = 0;
  },
  set(l) { if (l === this.level) return; this.level = l; emit('perf:quality', { level: l, scale: [1, 0.75, 0.5][l] }); },
  reset() { this.level = 0; this.ema = 60; this._t = 0; this._up = 0; },
};
// Audio: resume the AudioContext on the first user gesture.
const Audio = {
  _on: false,
  attach(unlock) {
    if (this._on || typeof window === 'undefined') return;
    this._on = true;
    let done = false;
    const go = () => { if (done) return; done = true; try { unlock(); } catch {} window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  },
};
// Bounds: last safe position; teleport back if out of the map / NaN / wedged.
const Bounds = {
  _safe: null, _t: 0, _lx: 0, _ly: 0, _stuck: 0,
  reset() { this._safe = null; this._t = 0; this._stuck = 0; },
  update(dt, city, ent, moving) {
    this._t += dt;
    if (this._t > 1) { this._t = 0; if (isOnRoad(city, ent.x, ent.y) && isFinite(ent.x) && isFinite(ent.y)) this._safe = { x: ent.x, y: ent.y }; }
    if (moving) {
      if (d2(ent.x, ent.y, this._lx, this._ly) < 2) { this._stuck += dt; if (this._stuck > 8) { this._stuck = 0; return this._safe || { x: CITY.safehouse.x, y: CITY.safehouse.y + 120 }; } }
      else this._stuck = 0;
    } else this._stuck = 0;
    this._lx = ent.x; this._ly = ent.y;
    if (!isFinite(ent.x) || !isFinite(ent.y) || ent.x < 0 || ent.y < 0 || ent.x > city.width || ent.y > city.height) return this._safe || { x: CITY.safehouse.x, y: CITY.safehouse.y + 120 };
    return null;
  },
};
// Missions: checkpoint on stage change, retry from it, mission:stuck event.
const Missions = {
  cp: null, _stage: -1, _best: 0, _still: 0, _stuck: false,
  reset() { this.cp = null; this._stage = -1; this._best = 0; this._still = 0; this._stuck = false; },
  checkpoint(state) { if (!state.mission) return; this.cp = { index: state.mission.index, stage: state.mission.stageIndex, x: state.player.x, y: state.player.y, money: state.money }; },
  retry(state, random, startMission) {
    if (!this.cp) return false;
    const cp = this.cp;
    startMission(state, random, cp.index);
    state.mission.stageIndex = cp.stage;
    if (state.player.car) { state.player.car.driver = null; state.player.car.kind = 'traffic'; state.player.car = null; state.player.onFoot = true; }
    state.player.x = cp.x; state.player.y = cp.y;
    state._hlRetry = false;
    return true;
  },
  fail(state, reason) { emit('mission:fail', { index: state.mission ? state.mission.index : this.cp ? this.cp.index : null, suggestSkip: !!this.cp, reason }); },
  update(dt, state) {
    const m = state.mission;
    if (!m) { this._stage = -1; this._stuck = false; return; }
    const px = state.player.car ? state.player.car.x : state.player.x;
    const py = state.player.car ? state.player.car.y : state.player.y;
    if (m.stageIndex !== this._stage) { this._stage = m.stageIndex; this.checkpoint(state); this._still = 0; this._stuck = false; const t = m.stages[m.stageIndex]; this._best = t && t.x !== undefined ? d2(px, py, t.x, t.y) : 0; }
    const t = m.stages[m.stageIndex];
    if (!t || t.x === undefined || t.type === 'escape' || t.type === 'wait') return;
    const d = d2(px, py, t.x, t.y);
    if (d < this._best - 1) { this._best = d; this._still = 0; } else this._still += dt;
    if (this._still > 20 && !this._stuck) { this._stuck = true; emit('mission:stuck', { mission: m.def.id }); }
  },
};
// Profile: 5 tiers, a point of no return (clean vs loud), affects pay/cops/ending.
const Profile = {
  score: 0, takedowns: 0, clean: 0, path: null, _t: 0,
  tier() { return this.score >= 12 ? 4 : this.score >= 8 ? 3 : this.score >= 5 ? 2 : this.score >= 2 ? 1 : 0; },
  name() { return ['Unknown', 'Wheelman', 'Fixer', 'Ghost', 'Legend'][this.tier()]; },
  record(kind) {
    if (kind === 'takedown') { this.takedowns += 1; this.score = Math.max(0, this.score - 1); if (this.takedowns >= 3 && !this.path) this.path = 'loud'; }
    else if (kind === 'cleanMission') { this.clean += 1; this.score += 2; if (this.clean >= 2 && !this.path) this.path = 'clean'; }
    else if (kind === 'mission' || kind === 'spare') this.score += 1;
    if (this.tier() !== this._t) { this._t = this.tier(); emit('profile:tier', { to: this.name(), tier: this._t, path: this.path }); }
  },
  rewardMult() { return 1 + this.tier() * 0.05; },
  copBonus() { return this.tier() >= 3 ? 1 : 0; },
  ending() { return this.path === 'clean' ? 'The city never saw you coming.' : this.path === 'loud' ? 'Neon Bay knows your name.' : 'The city is yours. Taxi fares keep paying.'; },
  serialize() { return { score: this.score, takedowns: this.takedowns, clean: this.clean, path: this.path }; },
  restore(o) { if (!o) return; this.score = o.score || 0; this.takedowns = o.takedowns || 0; this.clean = o.clean || 0; this.path = o.path || null; this._t = this.tier(); },
  reset() { this.score = 0; this.takedowns = 0; this.clean = 0; this.path = null; this._t = 0; },
};
// Weapons + Witness: drawn weapon; NPCs react on FOV + line of sight.
const Weapons = {
  drawn(state) { const p = state.player; return !!(p.onFoot && (p.aiming || p.shootTimer > 0)); },
};
const Witness = {
  canSee(ped, x, y, city) {
    const d = d2(ped.x, ped.y, x, y);
    if (d > 520 || d < 1) return false;
    if (d < 60) return true; // right there — they feel it, whatever they face
    if (Math.abs(angD(Math.atan2(y - ped.y, x - ped.x), ped.angle)) > 0.9) return false;
    for (let i = 1; i <= 6; i++) { if (hitsBuilding(city, ped.x + (x - ped.x) * i / 7, ped.y + (y - ped.y) * i / 7, 0)) return false; }
    return true;
  },
  near(state, x, y, radius) {
    const out = [];
    for (const ped of state.peds) if (!ped.down && d2(ped.x, ped.y, x, y) <= radius && this.canSee(ped, x, y, state.city)) out.push(ped);
    for (const car of state.cars) if (car.kind === 'police' && d2(car.x, car.y, x, y) <= radius) out.push(car);
    return out;
  },
  react(ped, player, city) {
    if (ped.down || !player.drawn) return 'none';
    if (!this.canSee(ped, player.x, player.y, city)) return 'none';
    return ped.kind === 'police' ? 'call_police' : 'flee';
  },
};
// Wanted: heat rises only with a witness; fades faster when the trail is lost.
const Wanted = {
  _lost: 0, _rbAt: -999,
  seen(state, crime, x, y) {
    if (crime === 'alarm') return true;
    const w = Witness.near(state, x, y, 520);
    if (crime === 'shoot') { for (const car of state.cars) if (car.kind === 'police' && d2(car.x, car.y, x, y) <= 900 && !w.includes(car)) w.push(car); }
    return w.length > 0;
  },
  update(state, dt, random) {
    const p = state.player;
    const nearCop = state.cars.some((c) => c.kind === 'police' && !c.roadblock && d2(c.x, c.y, p.x, p.y) < 900);
    if (state.wanted > 0 && !nearCop) {
      this._lost += dt;
      if (this._lost > 5) { this._lost = 0; state.wantedPoints = Math.max(0, state.wantedPoints - 1); state.wanted = Math.min(WANTED.maxStars, state.wantedPoints); emit('wanted:change', { to: state.wanted }); }
    } else this._lost = 0;
    SpikeStrip.update(state, dt);
    Roadblock.update(state, dt, random);
  },
  reset() { this._lost = 0; this._rbAt = -999; },
};
// SpikeStrip: pops tires (car.flat; driveCar caps a flat car at 180).
const SpikeStrip = {
  deploy(state, ax, ay, bx, by) { (state._hlSpikes || (state._hlSpikes = [])).push({ ax, ay, bx, by, t: 40 }); },
  update(state, dt) {
    const sp = state._hlSpikes;
    if (!sp || !sp.length) return;
    for (const s of sp) s.t -= dt;
    state._hlSpikes = sp.filter((s) => s.t > 0);
    for (const car of state.cars) {
      if (car.flat) continue;
      for (const s of state._hlSpikes) { if (segD(car.x, car.y, s.ax, s.ay, s.bx, s.by) < 22) { car.flat = true; emit('vehicle:tirePop', { id: car.id }); break; } }
    }
  },
};
// Roadblock: planned ahead of the player, snapped to a road.
const Roadblock = {
  plan(state, dist) {
    const p = state.player;
    const ex = p.car ? p.car : p;
    const dx = Math.cos(ex.angle), dy = Math.sin(ex.angle);
    let x = clamp(ex.x + dx * dist, 80, CITY.width - 80);
    let y = clamp(ex.y + dy * dist, 80, CITY.height - 80);
    const cx = nearestCentre(roadCentresX, x), cy = nearestCentre(roadCentresY, y);
    const horiz = Math.abs(x - cx) < Math.abs(y - cy);
    if (horiz) x = cx; else y = cy;
    return { x, y, heading: horiz ? 0 : Math.PI / 2 };
  },
  update(state, dt, random) {
    if (state._hlShot) return; // scripted screenshot staging: keep the frames comparable
    if (state.wanted < 3) return;
    if (state.time - Wanted._rbAt < 30) return;
    if (state.cars.some((c) => c.roadblock)) return;
    const r = this.plan(state, 700);
    Wanted._rbAt = state.time;
    const px = Math.cos(r.heading + Math.PI / 2), py = Math.sin(r.heading + Math.PI / 2);
    for (const s of [-28, 28]) { const car = makeCar(random, r.x + px * s, r.y + py * s, r.heading + Math.PI / 2, 'police', PALETTE.police); car.roadblock = true; car.targetSpeed = 0; car.driver = 'police'; state.cars.push(car); }
    SpikeStrip.deploy(state, r.x - px * 40, r.y - py * 40, r.x + px * 40, r.y + py * 40);
    emit('wanted:change', { to: state.wanted, roadblock: true });
  },
};
// Pool: fixed-size reusable objects (used by the rain drops).
const Pool = {
  make(n, factory) { const items = []; for (let i = 0; i < n; i++) items.push(factory(i)); return { items, next: 0, take() { const it = this.items[this.next]; this.next = (this.next + 1) % this.items.length; return it; } }; },
};
// Sky: slowed dusk, Markov weather, Canvas 2D rain. applyToThree/makeRain
// (Three.js) are DROPPED — no WebGL here; rain is 2D streaks, wet roads
// cut traction slightly. No rain in the first 150 s, so shots stay clear.
const Sky = {
  time: 18.5, rain: 0, wet: 0, _w: 'clear', _wt: 0, drops: null,
  update(dt, state) {
    this.time += dt / 600; if (this.time >= 24) this.time -= 24;
    this._wt += dt;
    if (this._wt >= 1) {
      this._wt = 0;
      const t = Math.floor(state.time);
      if (this._w === 'clear' && state.time > 150 && h2(t, 7) < 0.004) this._w = 'rain';
      else if (this._w === 'rain' && h2(t, 13) < 0.02) this._w = 'clear';
    }
    const target = this._w === 'rain' ? 1 : 0;
    this.rain += clamp(target - this.rain, -dt / 5, dt / 5);
    this.wet += clamp((this.rain > 0.3 ? 1 : 0) - this.wet, -dt / 20, dt / 20);
    state._hlRain = this.rain;
    state._hlWet = this.wet;
    const night = clamp((this.time - 18.5) / 3, 0, 1);
    state._hlTint = `rgba(${Math.round(50 - 30 * night)},${Math.round(36 - 20 * night)},${Math.round(50 + 30 * night)},${(0.03 + 0.09 * night + 0.08 * this.rain).toFixed(3)})`;
    if (!this.drops) this.drops = Pool.make(90, (i) => ({ x: 0, y: 0, v: 0, s: i * 37 }));
    if (this.rain > 0.05) {
      for (const d of this.drops.items) { if (d.v === 0 || d.y > 360) { d.x = h2(d.s, Math.floor(state.time * 2)) * 640; d.y = -10; d.v = 380 + h2(d.s, 11) * 220; } d.y += d.v * dt; d.x -= d.v * 0.25 * dt; }
      state._hlDrops = this.drops.items;
    } else state._hlDrops = null;
  },
  serialize() { return this.time; },
  restore(t) { if (t !== undefined && t !== null) this.time = t; },
  reset() { this.time = 18.5; this.rain = 0; this.wet = 0; this._w = 'clear'; this._wt = 0; },
};
// Input: remappable keys, gamepad polling, touch joystick + buttons.
const Input = {
  bind: { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], confirm: ['Space', 'Enter'], pause: ['KeyP', 'Escape'], enter: ['KeyE'], shoot: ['KeyF'], mute: ['KeyM'], retry: ['KeyR'], shoulder: ['KeyQ'] },
  _padPrev: 0,
  loadBind() { try { const raw = window.localStorage.getItem('neon-bay.bind.v1'); if (raw) { const o = JSON.parse(raw); for (const k in o) if (this.bind[k]) this.bind[k] = o[k]; } } catch {} },
  remap(action, code) { if (!this.bind[action]) return false; this.bind[action] = [code]; try { window.localStorage.setItem('neon-bay.bind.v1', JSON.stringify(this.bind)); } catch {} return true; },
  poll() {
    const out = { move: { x: 0, y: 0 }, look: 0, actions: 0, aiming: false };
    try {
      const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : [];
      const gp = pads && [...pads].find((p) => p && p.connected);
      if (!gp) return out;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      out.move.x = dz(gp.axes[0] || 0); out.move.y = dz(gp.axes[1] || 0);
      out.look = dz(gp.axes[2] || 0) * 6;
      out.aiming = !!(gp.buttons[7] && gp.buttons[7].value > 0.3);
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      let now = 0;
      if (b(0)) now |= 1; if (b(1)) now |= 8; if (b(2)) now |= 16; if (b(3)) now |= 4; if (b(9)) now |= 2; if (b(8)) now |= 32;
      out.actions = now & ~this._padPrev;
      this._padPrev = now;
    } catch {}
    return out;
  },
  touch: { joy: null, aim: false, on: false },
  attachTouch(canvas, input) {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;
    const t = this.touch;
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) }; };
    const btn = (p) => { if (d2(p.x, p.y, 1150, 480) < 56) return 'aim'; if (d2(p.x, p.y, 1150, 620) < 56) return 'shoot'; if (d2(p.x, p.y, 1010, 620) < 56) return 'enter'; return null; };
    canvas.addEventListener('touchstart', (e) => {
      t.on = true;
      for (const th of e.changedTouches) {
        const p = pos(th);
        const b = btn(p);
        if (b === 'aim') t.aim = true;
        else if (b === 'shoot') input.inject(16);
        else if (b === 'enter') input.inject(4);
        else if (p.x < 640 && !t.joy) t.joy = { id: th.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y };
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { for (const th of e.changedTouches) if (t.joy && th.identifier === t.joy.id) { const p = pos(th); t.joy.x = p.x; t.joy.y = p.y; } e.preventDefault(); }, { passive: false });
    const end = (e) => { for (const th of e.changedTouches) if (t.joy && th.identifier === t.joy.id) t.joy = null; t.aim = false; };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  },
  touchMove() { const j = this.touch.joy; if (!j) return { x: 0, y: 0 }; return { x: clamp((j.x - j.ox) / 60, -1, 1), y: clamp((j.y - j.oy) / 60, -1, 1) }; },
  drawTouch(ctx) {
    const t = this.touch;
    if (!t.on) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px sans-serif';
    if (t.joy) { ctx.strokeStyle = 'rgba(244,246,250,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.joy.ox, t.joy.oy, 60, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(34,211,238,0.6)'; ctx.beginPath(); ctx.arc(t.joy.x, t.joy.y, 26, 0, Math.PI * 2); ctx.fill(); }
    for (const [x, y, label, active] of [[1150, 480, 'AIM', t.aim], [1150, 620, 'FIRE', false], [1010, 620, 'ENTER', false]]) {
      ctx.fillStyle = active ? 'rgba(255,210,63,0.7)' : 'rgba(244,246,250,0.25)';
      ctx.beginPath(); ctx.arc(x, y, 44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(10,14,24,0.8)'; ctx.fillText(label, x, y);
    }
  },
};
// Economy: money gates for missions (The Big Score needs $500 to fund the crew).
const Economy = {
  gate: { 4: 500 },
  canStart(idx, money) { const g = this.gate[idx]; return g === undefined || money >= g; },
  need(idx) { return this.gate[idx] || 0; },
  serialize() { return { gate: this.gate }; },
  restore(o) { if (o && o.gate) this.gate = o.gate; },
};
export const HL = {
  on, emit,
  Save, Guard, loop, Perf, Audio, Bounds, Missions, Profile, Weapons, Witness, Wanted, SpikeStrip, Roadblock, Pool, Sky, Input, Economy,
  dispose(renderer) { if (renderer && renderer.clearCaches) renderer.clearCaches(); },
  boot(o) {
    this.Input.loadBind();
    if (o.unlockAudio) this.Audio.attach(o.unlockAudio);
    if (o.canvas && o.input) this.Input.attachTouch(o.canvas, o.input);
    if (o.setQuality) this.on('perf:quality', (q) => o.setQuality(q.level));
    if (o.announce) {
      this.on('vehicle:tirePop', () => o.announce('Tire blown! Drive slow.'));
      this.on('mission:fail', (d) => o.announce(d.suggestSkip ? 'Job failed — press R to retry from the checkpoint.' : 'Job failed.'));
      this.on('mission:stuck', () => o.announce('Stuck? Follow the yellow arrow — or press R to retry.'));
      this.on('profile:tier', (d) => o.announce('Reputation: ' + d.to));
      this.on('wanted:change', (d) => { if (d.to === 0) o.announce('Clean — you lost them.'); });
      this.on('error', () => o.announce('A hiccup was caught — press P to pause, then resume.'));
    }
    return this;
  },
};
