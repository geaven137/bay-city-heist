// NEON BAY — pedestrians: walkers on the sidewalks.
// Each walker strolls along a sidewalk, turns at intersections, and flees
// from gunshots, crashes and the player's car. Knocked-down walkers stay
// down for a while, then get up and walk away.
import { PALETTE } from './config.js';
import { atIntersection, nearestIntersection, randomSidewalkPoint, resolveBuildingCollision } from './world.js';

export function makePed(random, x, y) {
  return {
    x, y, angle: random() * Math.PI * 2, speed: 40 + random() * 40,
    color: PALETTE.ped[Math.floor(random() * PALETTE.ped.length)],
    mode: 'walk', // 'walk' | 'flee' | 'down'
    fleeX: 0, fleeY: 0, timer: 1 + random() * 3, down: false, downTimer: 0,
    axis: random() < 0.5 ? 'x' : 'y', dir: random() < 0.5 ? 1 : -1,
  };
}

export function spawnPedestrian(state, random, x, y) {
  const p = randomSidewalkPoint(random, x, y);
  const ped = makePed(random, p.x, p.y);
  state.peds.push(ped);
  return ped;
}

/** Scare every walker near (x, y): they run away from it. */
export function scarePedestrians(state, x, y, radius = 260) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.mode = 'flee';
      ped.fleeX = x;
      ped.fleeY = y;
      ped.timer = 2.5;
    }
  }
}

export function updatePedestrian(state, ped, dt, random) {
  if (ped.down) {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      ped.down = false;
      ped.mode = 'flee';
      ped.timer = 2;
      ped.fleeX = state.player.x;
      ped.fleeY = state.player.y;
    }
    return;
  }
  if (ped.mode === 'flee') {
    ped.timer -= dt;
    const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
    ped.angle = away;
    ped.x += Math.cos(away) * 240 * dt;
    ped.y += Math.sin(away) * 240 * dt;
    if (ped.timer <= 0) ped.mode = 'walk';
  } else {
    ped.timer -= dt;
    const speed = ped.speed;
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    if (ped.timer <= 0 || atIntersection(ped.x, ped.y, 30)) {
      ped.timer = 2 + random() * 4;
      // Turn onto the crossing street, or about-face.
      const node = nearestIntersection(ped.x, ped.y);
      const options = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
      ped.angle += options[Math.floor(random() * options.length)];
      ped.x = node.x + (random() - 0.5) * 20;
      ped.y = node.y + (random() - 0.5) * 20;
    }
  }
  const fixed = resolveBuildingCollision(state.city, ped.x, ped.y, 12);
  ped.x = fixed.x;
  ped.y = fixed.y;
  ped.x = Math.max(16, Math.min(state.city.width - 16, ped.x));
  ped.y = Math.max(16, Math.min(state.city.height - 16, ped.y));
}

/** Keep the walker population full near the player; cull far-away ones. */
export function maintainPedestrians(state, random, target = 22) {
  const p = state.player;
  state.peds = state.peds.filter((ped) => Math.hypot(ped.x - p.x, ped.y - p.y) < 1200);
  for (let i = state.peds.length; i < target; i += 1) spawnPedestrian(state, random, p.x, p.y);
}

/**
 * Knock a walker down (punch, bullet, car hit). Returns true when it was
 * a fresh knock-down (the crime counts once per walker).
 */
export function knockDownPed(state, ped, addWanted) {
  if (ped.down) return false;
  ped.down = true;
  ped.downTimer = 6;
  ped.mode = 'down';
  state.stats.pedsDown += 1;
  addWanted(1, ped.x, ped.y);
  return true;
}
