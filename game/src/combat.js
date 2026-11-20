// Neon Bay — fists, pistol and car damage.
// Combat is close and loud: every hit can draw a witness,
// and a witness is what turns a scuffle into a wanted level.

import { PLAYER, CARS } from './config.js';
import { raiseHeat } from './police.js';
import { dropPedestrian, scatterCrowd } from './pedestrians.js';
import { burst } from './particles.js';

export function throwPunch(state) {
  const p = state.player;
  if (!p.onFoot || p.punchTimer > 0) return;
  p.punchTimer = PLAYER.punchCool;
  const px = p.x + Math.cos(p.angle) * PLAYER.punchReach;
  const py = p.y + Math.sin(p.angle) * PLAYER.punchReach;
  let hitAny = false;
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 30) {
      dropPedestrian(state, ped, (n, x, y) => raiseHeat(state, n, x, y));
      burst(state, ped.x, ped.y, 24, 10, '#ffd23f', 130);
      hitAny = true;
    }
  }
  if (hitAny) scatterCrowd(state, p.x, p.y, 200);
  else scatterCrowd(state, p.x, p.y, 90);
}

export function firePistol(state, tx, ty) {
  const p = state.player;
  if (!p.onFoot || p.shootTimer > 0 || state.ammo <= 0) return;
  p.shootTimer = PLAYER.pistolCool;
  state.ammo -= 1;
  state.stats.shotsFired += 1;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  state.bullets.push({
    x: p.x + Math.cos(angle) * 22,
    y: p.y + Math.sin(angle) * 22,
    z: 30,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    travelled: 0,
    angle,
  });
  burst(state, p.x + Math.cos(angle) * 26, p.y + Math.sin(angle) * 26, 30, 4, '#ffd23f', 170);
  scatterCrowd(state, p.x, p.y, 340);
  raiseHeat(state, 1, p.x, p.y);
}

export function stepBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += PLAYER.bulletSpeed * dt;
    let dead = b.travelled > PLAYER.bulletRange;
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          dropPedestrian(state, ped, (n, x, y) => raiseHeat(state, n, x, y));
          burst(state, b.x, b.y, 26, 10, '#ff5a5a', 190);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.cars) {
        if (car.kind === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          hurtVehicle(state, car, PLAYER.pistolDamage);
          burst(state, b.x, b.y, 26, 8, '#ffd23f', 170);
          dead = true;
          break;
        }
      }
    }
    b.dead = dead;
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

export function hurtVehicle(state, car, amount) {
  car.health -= amount;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.targetSpeed = 0;
    car.speed = 0;
    burst(state, car.x, car.y, 30, 42, '#ff7a2e', 270);
    burst(state, car.x, car.y, 40, 24, '#3a3f4a', 150);
    state.camera.shake = Math.max(state.camera.shake, 10);
    raiseHeat(state, 1, car.x, car.y);
  } else if (car.health < 50 && state.rng.chance(0.3)) {
    burst(state, car.x, car.y - 10, 34, 2, '#8a8f9a', 95);
  }
}

export function crashDamage(state, car, other) {
  if (other.kind === 'player') {
    const p = state.player;
    p.hurtTimer = Math.max(p.hurtTimer, 0.3);
    state.health -= 4;
    state.flash = Math.min(1, state.flash + 0.3);
    state.camera.shake = Math.max(state.camera.shake, 6);
    if (state.health <= 0) {
      state.health = 0;
      endRun(state, 'wasted');
    }
  }
  hurtVehicle(state, other, CARS.ramDamage);
}

export function endRun(state, kind) {
  if (state.end) return;
  const kept = Math.min(state.money, 100);
  state.end = {
    kind,
    kept,
    haul: Math.max(0, state.money - kept),
    timer: 0,
  };
  state.money = Math.max(0, state.money - kept);
  state.wanted = 0;
  state.heat = 0;
  state.banner = null;
  state.mode = 'end';
}
