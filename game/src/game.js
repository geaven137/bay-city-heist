// NEON BAY — the game itself: one fixed step of everything.
// This is the single place the loop, the attract mode and the screenshot
// autopilot all run through, so a screenshot stages the real rules, not a
// posed frame. Order per step: player, cars, traffic, pedestrians, police,
// wanted, missions, combat, particles, camera.
import { CITY, PLAYER, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createCity, createState, resolveBuildingCollision } from './world.js';
import {
  collideCarWithCity, collideCars, driveCar, exitCar, maintainTraffic,
  nearestCar, stealCar, updateTrafficCar,
} from './vehicles.js';
import { knockDownPed, maintainPedestrians, updatePedestrian } from './pedestrians.js';
import { addWanted, damagePlayer, maintainPolice, updatePoliceCar, updateWanted } from './police.js';
import { startSideJob, tryStartNextMission, updateMission } from './missions.js';
import { crashDamage, punch, shoot, updateBullets } from './combat.js';
import { spawnExhaust, spawnParticles, updateParticles, updateShake } from './particles.js';

/** A fresh game: city, state and the seeded random source. */
export function createGame(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const state = createState(city, random);
  return { state, random };
}

function playerWorldPos(state) {
  const p = state.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

function updatePlayerOnFoot(state, dt, input, random) {
  const p = state.player;
  const move = input.move;
  const len = Math.hypot(move.x, move.y);
  p.moving = len > 0;
  if (len > 0) {
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = move.x / len;
    const ny = move.y / len;
    p.angle = Math.atan2(ny, nx);
    p.x += nx * speed * dt;
    p.y += ny * speed * dt;
    const fixed = resolveBuildingCollision(state.city, p.x, p.y, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    p.x = Math.max(16, Math.min(CITY.width - 16, p.x));
    p.y = Math.max(16, Math.min(CITY.height - 16, p.y));
  }
  if (input.aim) p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  // Health comes back slowly when nothing has hurt the player lately.
  p.regenTimer += dt;
  if (p.regenTimer > 5 && state.health < PLAYER.health) {
    state.health = Math.min(PLAYER.health, state.health + 2 * dt);
  }
}

function updatePlayerDriving(state, dt, input, random, audio) {
  const car = state.player.car;
  if (!car) return;
  const throttle = -input.move.y;
  const steer = input.move.x;
  driveCar(car, dt, throttle, steer, input.handbrake);
  if (collideCarWithCity(state, car)) {
    if (Math.abs(car.speed) > 320) {
      damagePlayer(state, 8, random);
      audio.crash();
      spawnParticles(state, car.x, car.y, 14, '#ffd23f', 200);
    }
    car.speed *= 0.55;
    audio.crash();
  }
  if (Math.abs(car.speed) > 200 && random() < dt * 6) {
    spawnExhaust(state, car.x - Math.cos(car.angle) * 28, car.y - Math.sin(car.angle) * 28, car.angle);
  }
  if (random() < dt * 2) car.smokeTimer = 0;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

function updateCars(state, dt, random, audio) {
  for (const car of state.cars) {
    if (car.kind === 'player') continue;
    if (car.kind === 'police') updatePoliceCar(state, car, dt, random);
    else updateTrafficCar(state, car, dt, random);
  }
  // Car-vs-car bumps, player car included.
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 50) continue;
      if (collideCars(a, b)) {
        const fast = Math.max(Math.abs(a.speed), Math.abs(b.speed));
        if (fast > 200) {
          audio.crash();
          state.camera.shake = Math.max(state.camera.shake, 5);
          spawnParticles(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 10, '#ffd23f', 180);
          if (a.kind === 'player' || b.kind === 'player') {
            crashDamage(state, a.kind === 'player' ? a : b, a.kind === 'player' ? b : a, random);
          }
        }
      }
    }
  }
  // The player's car running a walker down.
  const pc = state.player.car;
  if (pc && Math.abs(pc.speed) > 60) {
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - pc.x, ped.y - pc.y) < 30) {
        knockDownPed(state, ped, (n, x, y) => addWanted(state, n, x, y));
        spawnParticles(state, ped.x, ped.y, 12, '#ff5a5a', 200);
        state.camera.shake = Math.max(state.camera.shake, 6);
      }
    }
  }
  // Wrecked cars smoulder, then get towed away.
  state.cars = state.cars.filter((car) => {
    if (car.wrecked && car.kind !== 'player') {
      car.smokeTimer = (car.smokeTimer || 0) + dt;
      if (random() < dt * 8) spawnParticles(state, car.x, car.y, 1, '#3a3f4a', 60);
      return car.smokeTimer < 20;
    }
    return true;
  });
}

function updateSideJob(state, dt) {
  const job = state.sideJob;
  if (!job) return;
  job.timer -= dt;
  if (job.timer <= 0) {
    state.sideJob = null;
    state.banner = { text: 'Fare lost', sub: 'The rider gave up waiting', timer: 2 };
    return;
  }
  const pos = playerWorldPos(state);
  const target = job.stage === 'pickup' ? job.pickup : job.drop;
  if (Math.hypot(pos.x - target.x, pos.y - target.y) < 52) {
    if (job.stage === 'pickup') {
      job.stage = 'drop';
      state.banner = { text: 'Rider aboard', sub: 'Take them where they point', timer: 2 };
    } else {
      state.money += job.fare;
      state.sideJob = null;
      state.banner = { text: `+$${job.fare}`, sub: 'Fare paid', timer: 2 };
    }
  }
}

function updateCamera(state, dt) {
  const pos = playerWorldPos(state);
  const cam = state.camera;
  cam.x += (pos.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (pos.y - cam.y) * Math.min(1, dt * 5);
  cam.x = Math.max(VIEW_HALF_X, Math.min(CITY.width - VIEW_HALF_X, cam.x));
  cam.y = Math.max(VIEW_HALF_Y, Math.min(CITY.height - VIEW_HALF_Y, cam.y));
}

const VIEW_HALF_X = 640;
const VIEW_HALF_Y = 360;

/**
 * One fixed step of the whole game. `input` is { move:{x,y}, run,
 * handbrake, aim:{x,y}|null, actions } where actions is the bit flags from
 * input.js (ACTION_*). `audio` may be null (attract mode / screenshots).
 * `harmless` is the title screen: the city lives, but nothing can hurt
 * the player and no crime counts.
 */
export function stepGame(game, dt, input, audio, harmless) {
  const { state, random } = game;
  if (state.wasted || state.busted) return;
  state.time += dt;
  const p = state.player;

  if (input.actions !== undefined && input.actions !== 0) {
    const acts = input.actions;
    if (acts & 4) { // ACTION_ENTER_CAR
      if (p.onFoot) {
        const car = nearestCar(state, p.x, p.y, 70);
        if (car && !car.wrecked) {
          if (!harmless) stealCar(state, car, (n, x, y) => addWanted(state, n, x, y));
          else { car.kind = 'player'; car.driver = 'player'; p.car = car; p.onFoot = false; }
          if (audio) audio.pickup();
        }
      } else {
        exitCar(state);
      }
    }
    if (acts & 8) { // ACTION_PUNCH
      if (p.onFoot && !harmless) { punch(state, random); if (audio) audio.punch(); }
    }
    if (acts & 16) { // ACTION_SHOOT
      if (p.onFoot && input.aim && !harmless) { shoot(state, input.aim.x, input.aim.y, random); if (audio) audio.gunshot(); }
    }
  }

  if (p.onFoot) updatePlayerOnFoot(state, dt, input, random);
  else updatePlayerDriving(state, dt, input, random, audio || { crash() {} });

  updateCars(state, dt, random, audio || { crash() {} });
  for (const ped of state.peds) updatePedestrian(state, ped, dt, random);
  updateBullets(state, dt, random);
  updateParticles(state, dt);
  updateShake(state, dt);
  if (!harmless) {
    maintainPolice(state, random);
    updateWanted(state, dt);
    updateMission(state, dt, random, (n, x, y) => addWanted(state, n, x, y));
    updateSideJob(state, dt);
    // After the story, taxi fares keep coming on their own.
    if (state.storyDone && !state.mission && !state.sideJob) {
      state.sideJobDelay = (state.sideJobDelay ?? 8) - dt;
      if (state.sideJobDelay <= 0) {
        startSideJob(state, random);
        state.sideJobDelay = 20;
      }
    }
    // A story job waits at the safehouse: walk up and it starts.
    if (!state.mission && !state.storyDone) {
      const pos = playerWorldPos(state);
      if (Math.hypot(pos.x - CITY.safehouse.x, pos.y - CITY.safehouse.y - 120) < 70) {
        tryStartNextMission(state, random);
      }
    }
  }
  maintainTraffic(state, random);
  maintainPedestrians(state, random);
  updateCamera(state, dt);
  if (state.banner) {
    state.banner.timer -= dt;
    if (state.banner.timer <= 0) state.banner = null;
  }
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.5);
  if (audio) {
    const speed = p.car ? Math.abs(p.car.speed) : 0;
    audio.setEngine(speed, 520);
    const anyCopNear = state.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - (p.car ? p.car.x : p.x), c.y - (p.car ? p.car.y : p.y)) < 600);
    audio.setSiren(anyCopNear, state.time);
  }
}

/** Wake up at the hospital after WASTED, or the precinct after BUSTED. */
export function recover(state, random) {
  const fee = Math.min(state.money, 100);
  state.money -= fee;
  state.health = 100;
  state.ammo = Math.max(state.ammo, 12);
  state.wanted = 0;
  state.wantedPoints = 0;
  state.unseenTimer = 0;
  state.cars = state.cars.filter((c) => c.kind === 'traffic');
  if (state.player.car) { state.player.car = null; }
  state.player.onFoot = true;
  if (state.wasted) {
    state.player.x = CITY.hospital.x;
    state.player.y = CITY.hospital.y + 170;
  } else {
    state.player.x = CITY.precinct.x;
    state.player.y = CITY.precinct.y + 150;
  }
  state.player.angle = -Math.PI / 2;
  state.wasted = false;
  state.busted = false;
  state.endTimer = 0;
  state.banner = { text: 'Back on the street', sub: state.wasted ? `Hospital fee: $${fee}` : `Bail: $${fee}`, timer: 3 };
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

/** Save to localStorage (best-effort: private windows may refuse). */
export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money, health: state.health, ammo: state.ammo,
      missionsDone: state.missionsDone, storyDone: state.storyDone,
      x: state.player.x, y: state.player.y, time: state.time,
    }));
    return true;
  } catch {
    return false;
  }
}

/** Load a save into a fresh state; returns true when a save existed. */
export function loadGame(state) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    state.money = s.money ?? 60;
    state.health = s.health ?? 100;
    state.ammo = s.ammo ?? 24;
    state.missionsDone = s.missionsDone ?? 0;
    state.storyDone = !!s.storyDone;
    state.stats.missionsDone = state.missionsDone;
    state.player.x = s.x ?? CITY.safehouse.x;
    state.player.y = s.y ?? CITY.safehouse.y + 120;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return true;
  } catch {
    return false;
  }
}

/** Best haul (most money ever held) for the title screen. */
export function readBest() {
  try { return Number.parseInt(window.localStorage.getItem('neon-bay.best.v1') ?? '0', 10) || 0; } catch { return 0; }
}

export function saveBest(value) {
  try { window.localStorage.setItem('neon-bay.best.v1', String(value)); } catch { /* storage off */ }
}
