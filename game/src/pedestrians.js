// Neon Bay — the people on the sidewalks.
// Pedestrians stroll, panic and scatter when trouble starts,
// and go down when hit. They are also witnesses: a crime only
// raises the wanted level when a pedestrian or a cop sees it.

import { WORLD } from './config.js';
import { burst } from './particles.js';

const SKIN = [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6b4423, 0xd9a066];
const SHIRT = [0xef476f, 0x118ab2, 0xffd166, 0x06d6a0, 0x9b5de5, 0xf15bb5, 0xef8354];

export function spawnCrowd(state) {
  const rng = state.rng;
  state.peds.length = 0;
  for (let i = 0; i < WORLD.pedCount; i++) {
    const onBeach = rng.chance(0.3);
    const x = onBeach ? rng.range(520, 2000) : rng.range(-WORLD.half + 80, WORLD.half - 80);
    const y = onBeach ? rng.range(2010, 2160) : rng.range(-WORLD.half + 80, WORLD.half - 80);
    state.peds.push({
      x, y,
      angle: rng.next() * Math.PI * 2,
      speed: rng.range(28, 62),
      down: false,
      downTimer: 0,
      panic: 0,
      skin: SKIN[rng.whole(0, SKIN.length - 1)],
      shirt: SHIRT[rng.whole(0, SHIRT.length - 1)],
      stride: rng.range(0, Math.PI * 2),
    });
  }
}

export function stepCrowd(state, dt) {
  const half = WORLD.half - 60;
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.panic = 0.6;
      }
      continue;
    }
    ped.stride += dt * 7;
    const boost = ped.panic > 0 ? 2.1 : 1;
    ped.x += Math.cos(ped.angle) * ped.speed * boost * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * boost * dt;
    if (ped.panic > 0) ped.panic -= dt * 0.5;
    if (ped.x < -half || ped.x > half || ped.y < -half || ped.y > half) {
      ped.angle += Math.PI * (0.6 + state.rng.next() * 0.8);
      ped.x = Math.max(-half, Math.min(half, ped.x));
      ped.y = Math.max(-half, Math.min(half, ped.y));
    }
    if (state.rng.chance(dt * 0.25)) {
      ped.angle += state.rng.range(-0.9, 0.9);
    }
  }
}

export function dropPedestrian(state, ped, onCrime) {
  if (ped.down) return;
  ped.down = true;
  ped.downTimer = 2.4;
  ped.panic = 1;
  burst(state, ped.x, ped.y, 26, 10, '#ffd23f', 150);
  if (onCrime) onCrime(1, ped.x, ped.y);
  state.stats.pedsDown += 1;
}

export function scatterCrowd(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.angle = Math.atan2(ped.y - y, ped.x - x) + state.rng.range(-0.4, 0.4);
      ped.panic = 1;
    }
  }
}

// Is anyone close enough to witness a crime at (x, y)?
export function witnessedBy(state, x, y) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < 260) return true;
  }
  for (const car of state.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - x, car.y - y) < 420) return true;
  }
  return false;
}
