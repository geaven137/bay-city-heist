// NEON BAY — the wanted level and the Bayview police.
// Crime adds wanted points; stars are the points, capped at five. Cops spawn
// on roads outside the player's view and chase by a simple intersection
// pathfind: at each crossing they take the road that most reduces the
// Manhattan distance to the player. Lose them by staying unseen: the stars
// tick down after WANTED.decaySeconds with no cop in sight.
import { CAR, WANTED } from './config.js';
import { collideCarWithCity, driveCar, spawnPoliceCar } from './vehicles.js';
import { atIntersection, nearestIntersection } from './world.js';

export function wantedStars(state) {
  return Math.min(WANTED.maxStars, state.wanted);
}

/** A crime at (x, y): raise the wanted level and reset the decay clock. */
export function addWanted(state, points, x, y) {
  if (points <= 0) return;
  state.wantedPoints += points;
  state.wanted = Math.min(WANTED.maxStars, state.wantedPoints);
  state.unseenTimer = 0;
  if (state.wanted > 0 && state.banner === null) {
    state.banner = { text: `WANTED — ${'★'.repeat(state.wanted)}`, sub: 'Lose the cops', timer: 1.6 };
  }
}

/** How many cops the current wanted level calls for. */
export function copsWanted(state) {
  return Math.min(WANTED.maxCops, state.wanted * 2);
}

/** Keep the right number of police cars on the road. */
export function maintainPolice(state, random) {
  const want = copsWanted(state);
  const cops = state.cars.filter((c) => c.kind === 'police');
  const p = state.player;
  for (const cop of cops) {
    if (Math.hypot(cop.x - p.x, cop.y - p.y) > 1600) {
      // Teleport a lost cop back onto a road near the player, off-screen.
      const spot = { x: p.x + (random() < 0.5 ? -1 : 1) * (600 + random() * 300), y: p.y + (random() - 0.5) * 600 };
      cop.x = Math.max(60, Math.min(state.city.width - 60, spot.x));
      cop.y = Math.max(60, Math.min(state.city.height - 60, spot.y));
    }
  }
  for (let i = cops.length; i < want; i += 1) spawnPoliceCar(state, random, p.x, p.y);
  if (want === 0) {
    state.cars = state.cars.filter((c) => c.kind !== 'police');
  }
}

/**
 * Police chase: steer toward the player, choosing at each intersection the
 * outgoing road that most reduces the Manhattan distance to the player
 * (greedy pathfinding on the road grid). Rams the player's car; on foot,
 * a slow cop beside the player busts them.
 */
export function updatePoliceCar(state, cop, dt, random) {
  const p = state.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const dist = Math.hypot(tx - cop.x, ty - cop.y);
  const wantAngle = Math.atan2(ty - cop.y, tx - cop.x);
  let diff = wantAngle - cop.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const throttle = dist > 60 ? 1 : 0.4;
  driveCar(cop, dt, throttle, steer, false);
  if (collideCarWithCity(state, cop)) cop.speed *= 0.5;
  // At an intersection, snap the heading toward the player's street:
  // the greedy choice is simply "steer at the player", which the road
  // grid turns into a pursuit route — but keep the car on asphalt.
  if (atIntersection(cop.x, cop.y, 40)) {
    const node = nearestIntersection(cop.x, cop.y);
    const dx = tx - node.x;
    const dy = ty - node.y;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const targetAngle = horizontal ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
    let d2 = targetAngle - cop.angle;
    while (d2 > Math.PI) d2 -= Math.PI * 2;
    while (d2 < -Math.PI) d2 += Math.PI * 2;
    cop.angle += d2 * Math.min(1, dt * 6);
  }
  if (dist < 46 && p.onFoot) {
    // A cop right beside the player on foot, nearly stopped: the bust.
    if (Math.abs(cop.speed) < 60) {
      cop.bustTimer = (cop.bustTimer || 0) + dt;
      if (cop.bustTimer > 1.2) {
        state.busted = true;
        state.endTimer = 0;
      }
    } else cop.bustTimer = 0;
  } else cop.bustTimer = 0;
  // Ram damage to the player's car and, through it, the player.
  if (dist < 50 && p.car && Math.abs(cop.speed) > 120) {
    cop.speed *= 0.5;
    damagePlayer(state, 6, random);
  }
  if (random() < dt * 0.5) cop.sirenPhase = (cop.sirenPhase || 0) + 1;
}

/** Damage the player (ram, bullet, crash): flash, shake, maybe WASTED. */
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
    state.banner = { text: 'WASTED', sub: 'St. Marina Hospital — $100 fee', timer: 999 };
  }
}

/** Wanted decay: no cop close and unseen for a while, lose a star. */
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
      if (state.wanted === 0) {
        state.banner = { text: 'CLEAN', sub: 'You lost them — for now', timer: 2 };
      }
    }
  }
}
