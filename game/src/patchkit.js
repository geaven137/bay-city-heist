// Neon Bay — save/load, city bounds and performance guard.
// The save is a small JSON blob in localStorage with a checksum
// and a backup slot, so a bad write never eats the player's run.

import { WORLD } from './config.js';

const SAVE_KEY = 'neonbay.save.v1';
const BACKUP_KEY = 'neonbay.save.v1.bak';

function checksum(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export function saveGame(state) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const snap = {
      money: state.money,
      ammo: state.ammo,
      health: state.health,
      rep: state.rep,
      jobsDone: state.jobsDone,
      missionIndex: state.missionIndex,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      time: Math.round(state.time),
    };
    const body = JSON.stringify(snap);
    const blob = JSON.stringify({ sum: checksum(body), body });
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(SAVE_KEY, blob);
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(state) {
  if (typeof localStorage === 'undefined') return false;
  const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(BACKUP_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (checksum(parsed.body) !== parsed.sum) return false;
    const snap = JSON.parse(parsed.body);
    state.money = snap.money;
    state.ammo = snap.ammo;
    state.health = snap.health;
    state.rep = snap.rep;
    state.jobsDone = snap.jobsDone;
    state.missionIndex = snap.missionIndex;
    state.player.x = snap.x;
    state.player.y = snap.y;
    state.time = snap.time;
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(BACKUP_KEY);
}

// Keep the player and the cars inside the city and out of the sea.
export function clampToCity(state) {
  const half = WORLD.half + 40;
  const p = state.player;
  p.x = Math.max(-half, Math.min(half + 900, p.x));
  p.y = Math.max(-half, Math.min(WORLD.seaY - 30, p.y));
  for (const car of state.cars) {
    car.x = Math.max(-half, Math.min(half + 900, car.x));
    car.y = Math.max(-half, Math.min(WORLD.seaY - 30, car.y));
  }
}

// Rolling frame-time guard: if the game stutters, shed load.
export function perfTick(state, dt) {
  state.frameTime = state.frameTime * 0.9 + dt * 0.1;
  if (state.frameTime > 0.034 && state.quality > 0) {
    state.quality -= 1;
    state.pedCap = state.quality === 0 ? 12 : 24;
  } else if (state.frameTime < 0.017 && state.quality < 2) {
    state.quality += 1;
    state.pedCap = 24;
  }
}
