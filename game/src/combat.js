// NEON BAY — combat on foot: punch, pistol, bullets.
// The player punches with Space (a short arc in front of them) and shoots
// with a mouse click (or F, straight ahead). Bullets fly straight, hit
// walkers and cars, and every shot is a crime the police notice. Cars that
// take enough damage smoke, then burn out.
import { PLAYER } from './config.js';
import { addWanted } from './police.js';
import { knockDownPed, scarePedestrians } from './pedestrians.js';
import { spawnParticles } from './particles.js';

/** Punch: hit walkers in a short arc ahead of the player. */
export function punch(state, random) {
  const p = state.player;
  if (!p.onFoot || p.punchTimer > 0) return;
  p.punchTimer = PLAYER.punchCooldown;
  const px = p.x + Math.cos(p.angle) * PLAYER.punchRange;
  const py = p.y + Math.sin(p.angle) * PLAYER.punchRange;
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 30) {
      knockDownPed(state, ped, (n, x, y) => addWanted(state, n, x, y, 'punch'));
      spawnParticles(state, ped.x, ped.y, 8, '#ffd23f', 120);
    }
  }
  scarePedestrians(state, p.x, p.y, 180);
}

/** Shoot toward (tx, ty) in world space. Needs ammo; makes noise. */
export function shoot(state, tx, ty, random) {
  const p = state.player;
  if (!p.onFoot || p.shootTimer > 0 || state.ammo <= 0) return;
  p.shootTimer = PLAYER.pistolCooldown;
  state.ammo -= 1;
  state.stats.shotsFired += 1;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  state.bullets.push({
    x: p.x + Math.cos(angle) * 20, y: p.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed,
    travelled: 0, angle,
  });
  spawnParticles(state, p.x + Math.cos(angle) * 24, p.y + Math.sin(angle) * 24, 4, '#ffd23f', 160);
  scarePedestrians(state, p.x, p.y, 320);
  addWanted(state, 1, p.x, p.y, 'shoot');
}

/** Fly the bullets; hit walkers and cars; spark on buildings. */
export function updateBullets(state, dt, random) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += PLAYER.bulletSpeed * dt;
    let dead = b.travelled > PLAYER.bulletRange;
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          knockDownPed(state, ped, (n, x, y) => addWanted(state, n, x, y, 'shoot'));
          spawnParticles(state, b.x, b.y, 10, '#ff5a5a', 180);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.cars) {
        if (car.kind === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          damageCar(state, car, PLAYER.pistolDamage, random);
          spawnParticles(state, b.x, b.y, 8, '#ffd23f', 160);
          dead = true;
          break;
        }
      }
    }
    b.dead = dead;
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

/** Damage a car: smoke at half health, burn out at zero (a crime scene). */
export function damageCar(state, car, amount, random) {
  car.health -= amount;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.targetSpeed = 0;
    car.speed = 0;
    spawnParticles(state, car.x, car.y, 40, '#ff7a2e', 260);
    spawnParticles(state, car.x, car.y, 24, '#3a3f4a', 140);
    state.camera.shake = Math.max(state.camera.shake, 10);
    addWanted(state, 1, car.x, car.y, 'shoot');
  } else if (car.health < 50 && random() < 0.3) {
    spawnParticles(state, car.x, car.y - 10, 2, '#8a8f9a', 90);
  }
}

/** A car crash at speed hurts the player and the other car. */
export function crashDamage(state, car, other, random) {
  if (other.kind === 'player') {
    const p = state.player;
    p.hurtTimer = Math.max(p.hurtTimer, 0.3);
    state.health -= 4;
    state.flash = Math.min(1, state.flash + 0.3);
    state.camera.shake = Math.max(state.camera.shake, 6);
    if (state.health <= 0) {
      state.health = 0;
      state.wasted = true;
      state.endTimer = 0;
      state.banner = { text: 'WASTED', sub: 'St. Marina Hospital — $100 fee', timer: 999 };
    }
  }
  damageCar(state, other, 12, random);
}
