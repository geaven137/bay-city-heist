import { CAR, WANTED } from './config.js';
import { HL } from './patchkit.js';
import { collideCarWithCity, driveCar, spawnPoliceCar } from './vehicles.js';
import { atIntersection, nearestIntersection } from './world.js';

export function wantedStars(state) {
  return Math.min(WANTED.maxStars, state.wanted);
}

export function addWanted(state, points, x, y, crime) {
  if (points <= 0) return;
  if (crime && crime !== 'alarm' && !HL.Wanted.seen(state, crime, x, y)) return;
  state.wantedPoints += points;
  state.wanted = Math.min(WANTED.maxStars, state.wantedPoints);
  state.unseenTimer = 0;
  if (state.wanted > 0 && state.banner === null) {
    state.banner = { text: `WANTED — ${'★'.repeat(state.wanted)}`, sub: 'Lose the cops', timer: 1.6 };
  }
}

export function copsWanted(state) {
  return Math.min(WANTED.maxCops, state.wanted * 2 + HL.Profile.copBonus());
}

export function maintainPolice(state, random) {
  const want = copsWanted(state);
  const cops = state.cars.filter((c) => c.kind === 'police');
  const p = state.player;
  for (const cop of cops) {
    if (cop.roadblock) continue;
    if (Math.hypot(cop.x - p.x, cop.y - p.y) > 1600) {
      cop.x = Math.max(60, Math.min(state.city.width - 60, p.x + (random() < 0.5 ? -1 : 1) * (600 + random() * 300)));
      cop.y = Math.max(60, Math.min(state.city.height - 60, p.y + (random() - 0.5) * 600));
    }
  }
  for (let i = cops.length; i < want; i += 1) spawnPoliceCar(state, random, p.x, p.y);
  if (want === 0) state.cars = state.cars.filter((c) => c.kind !== 'police');
}

export function updatePoliceCar(state, cop, dt, random) {
  if (cop.roadblock) { cop.speed *= Math.max(0, 1 - 4 * dt); return; }
  const p = state.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const dist = Math.hypot(tx - cop.x, ty - cop.y);
  let diff = Math.atan2(ty - cop.y, tx - cop.x) - cop.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  driveCar(cop, dt, dist > 60 ? 1 : 0.4, Math.max(-1, Math.min(1, diff * 2.4)), false);
  if (collideCarWithCity(state, cop)) cop.speed *= 0.5;
  if (atIntersection(cop.x, cop.y, 40)) {
    const node = nearestIntersection(cop.x, cop.y);
    const dx = tx - node.x, dy = ty - node.y;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const targetAngle = horizontal ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
    let d2 = targetAngle - cop.angle;
    while (d2 > Math.PI) d2 -= Math.PI * 2;
    while (d2 < -Math.PI) d2 += Math.PI * 2;
    cop.angle += d2 * Math.min(1, dt * 6);
  }
  if (dist < 46 && p.onFoot) {
    if (Math.abs(cop.speed) < 60) {
      cop.bustTimer = (cop.bustTimer || 0) + dt;
      if (cop.bustTimer > 1.2) { state.busted = true; state.endTimer = 0; }
    } else cop.bustTimer = 0;
  } else cop.bustTimer = 0;
  if (dist < 50 && p.car && Math.abs(cop.speed) > 120) {
    cop.speed *= 0.5;
    damagePlayer(state, 6, random);
  }
  if (random() < dt * 0.5) cop.sirenPhase = (cop.sirenPhase || 0) + 1;
}

export function damagePlayer(state, amount, random) {
  const p = state.player;
  if (p.hurtTimer > 0 || state.wasted || state.busted) return;
  p.hurtTimer = 0.6;
  p.regenTimer = 0;
  state.health -= amount;
  state.flash = Math.min(1, state.flash + 0.5);
  state.camera.shake = Math.max(state.camera.shake, 7);
  if (state.health <= 0) {
    state.health = 0;
    state.wasted = true;
    state.endTimer = 0;
    state.banner = { text: 'WASTED', sub: `St. Marina Hospital — $${Math.min(state.money, 100)} fee`, timer: 999 };
  }
}

export function updateWanted(state, dt) {
  if (state.wanted === 0) return;
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  let seen = false;
  for (const cop of state.cars) {
    if (cop.kind !== 'police') continue;
    if (Math.hypot(cop.x - px, cop.y - py) < 520) { seen = true; break; }
  }
  if (seen) state.unseenTimer = 0;
  else {
    state.unseenTimer += dt;
    if (state.unseenTimer >= WANTED.decaySeconds) {
      state.unseenTimer = 0;
      state.wantedPoints = Math.max(0, state.wantedPoints - 1);
      state.wanted = state.wantedPoints;
      if (state.wanted === 0) state.banner = { text: 'CLEAN', sub: 'You lost them — for now', timer: 2 };
    }
  }
}
