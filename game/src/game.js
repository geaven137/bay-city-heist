import { AIM, BEST_KEY, CITY, PLAYER } from './config.js';
import { HL } from './patchkit.js';
import { createRandom } from './random.js';
import { createCity, createState, hitsBuilding, resolveBuildingCollision } from './world.js';
import {
  collideCarWithCity, collideCars, driveCar, exitCar, maintainTraffic,
  nearestCar, stealCar, updateTrafficCar,
} from './vehicles.js';
import { knockDownPed, maintainPedestrians, updatePedestrian } from './pedestrians.js';
import { addWanted, damagePlayer, maintainPolice, updatePoliceCar, updateWanted } from './police.js';
import { startSideJob, tryStartNextMission, updateMission } from './missions.js';
import { crashDamage, punch, shoot, updateBullets } from './combat.js';
import { spawnExhaust, spawnParticles, updateParticles, updateShake } from './particles.js';
import { updateShop } from './shop.js';

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

function shapeLook(dx, aiming) {
  const mag = Math.abs(dx);
  if (mag < AIM.deadZone) return 0;
  const m = mag - AIM.deadZone;
  return Math.sign(dx) * Math.pow(m, AIM.curve) * (aiming ? AIM.aimSens : AIM.hipSens);
}

function aimAssist(state, p, dt) {
  let best = null, bestDiff = AIM.assistCone;
  const consider = (x, y) => {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d > AIM.assistRange || d < 1) return;
    let diff = Math.atan2(dy, dx) - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < bestDiff) { bestDiff = Math.abs(diff); best = diff; }
  };
  for (const ped of state.peds) if (!ped.down) consider(ped.x, ped.y);
  for (const car of state.cars) if (car.kind !== 'player') consider(car.x, car.y);
  if (best === null) return false;
  p.angle += Math.max(-AIM.assistRate * dt, Math.min(AIM.assistRate * dt, best));
  return true;
}

function updatePlayerOnFoot(state, dt, input, random) {
  const p = state.player;
  p.aiming = !!input.aiming;
  p.shoulder = input.shoulder || 1;
  p.assist = false;
  if (input.look) p.angle += shapeLook(input.look, p.aiming);
  if (p.aiming) p.assist = aimAssist(state, p, dt);
  const move = input.move;
  const len = Math.hypot(move.x, move.y);
  p.moving = len > 0;
  if (len > 0) {
    let wx, wy;
    if (input.moveWorld) {
      wx = move.x / len;
      wy = move.y / len;
      p.angle = Math.atan2(wy, wx);
    } else {
      const f = -move.y, s = move.x, c = Math.cos(p.angle), sn = Math.sin(p.angle);
      wx = (c * f - sn * s) / len;
      wy = (sn * f + c * s) / len;
    }
    const speed = p.aiming ? PLAYER.walkSpeed * 0.55 : (input.run ? PLAYER.runSpeed : PLAYER.walkSpeed);
    p.x += wx * speed * dt;
    p.y += wy * speed * dt;
    const fixed = resolveBuildingCollision(state.city, p.x, p.y, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    p.x = Math.max(16, Math.min(CITY.width - 16, p.x));
    p.y = Math.max(16, Math.min(CITY.height - 16, p.y));
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  p.regenTimer += dt;
  if (p.regenTimer > 5 && state.health < PLAYER.health) {
    state.health = Math.min(PLAYER.health, state.health + 2 * dt);
  }
}

function updatePlayerDriving(state, dt, input, random, audio) {
  const car = state.player.car;
  if (!car) return;
  driveCar(car, dt, -input.move.y * (1 - 0.2 * (state._hlWet || 0)), input.move.x, input.handbrake);
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
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
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
  const pc = state.player.car;
  if (pc && Math.abs(pc.speed) > 60) {
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - pc.x, ped.y - pc.y) < 30) {
        knockDownPed(state, ped, (n, x, y) => addWanted(state, n, x, y, 'hit'));
        spawnParticles(state, ped.x, ped.y, 12, '#ff5a5a', 200);
        state.camera.shake = Math.max(state.camera.shake, 6);
      }
    }
  }
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
  const p = state.player, cam = state.camera;
  const target = p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
  const targetAngle = p.car ? p.car.angle : p.angle;
  let diff = targetAngle - cam.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cam.angle += diff * Math.min(1, dt * 10);
  const wantFov = p.car ? 1.22 : (p.aiming ? 0.87 : 1.15);
  cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 8);
  const wantShoulder = p.car ? 0 : (p.aiming ? -95 * (p.shoulder || 1) : 0);
  cam.shoulder += (wantShoulder - cam.shoulder) * Math.min(1, dt * 8);
  let dist = p.car ? 120 : (p.aiming ? 62 : 95);
  const fx = Math.cos(cam.angle), fy = Math.sin(cam.angle);
  while (dist > 30 && hitsBuilding(state.city, target.x - fx * dist, target.y - fy * dist, 14)) dist -= 12;
  cam.x = target.x - fx * dist;
  cam.y = target.y - fy * dist;
  cam.x = Math.max(40, Math.min(CITY.width - 40, cam.x));
  cam.y = Math.max(40, Math.min(CITY.height - 40, cam.y));
}

export function stepGame(game, dt, input, audio, harmless) {
  const { state, random } = game;
  if (state.wasted || state.busted) return;
  state.time += dt;
  HL.Sky.update(dt, state);
  HL.Wanted.update(state, dt, random);
  state._hlTier = HL.Profile.name();
  const p = state.player;

  if (input.actions !== undefined && input.actions !== 0) {
    const acts = input.actions;
    if (acts & 4) {
      if (p.onFoot) {
        const car = nearestCar(state, p.x, p.y, 70);
        if (car && !car.wrecked) {
          if (!harmless) stealCar(state, car, (n, x, y) => addWanted(state, n, x, y, 'steal'));
          else { car.kind = 'player'; car.driver = 'player'; p.car = car; p.onFoot = false; }
          if (audio) audio.pickup();
        }
      } else {
        exitCar(state);
      }
    }
    if (acts & 8) {
      if (p.onFoot && !harmless) { punch(state, random); if (audio) audio.punch(); }
    }
    if (acts & 16) {
      if (p.onFoot && input.aim && !harmless) { shoot(state, input.aim.x, input.aim.y, random); if (audio) audio.gunshot(); }
    }
  }

  if (p.onFoot) updatePlayerOnFoot(state, dt, input, random);
  else updatePlayerDriving(state, dt, input, random, audio || { crash() {} });

  updateCars(state, dt, random, audio || { crash() {} });
  for (const ped of state.peds) updatePedestrian(state, ped, dt, random);
  state._hlWitT = (state._hlWitT || 0) + dt;
  if (state._hlWitT > 0.3 && HL.Weapons.drawn(state)) {
    state._hlWitT = 0;
    for (const ped of state.peds) {
      const r = HL.Witness.react(ped, { x: state.player.x, y: state.player.y, drawn: true }, state.city);
      if (r !== 'none') {
        ped.mode = 'flee'; ped.fleeX = state.player.x; ped.fleeY = state.player.y; ped.timer = 2.5;
        if (r === 'call_police') addWanted(state, 1, state.player.x, state.player.y, 'alarm');
      }
    }
  }
  updateBullets(state, dt, random);
  updateParticles(state, dt);
  updateShake(state, dt);
  if (!harmless) {
    maintainPolice(state, random);
    updateWanted(state, dt);
    const hadM = state.mission, doneB = state.missionsDone;
    updateMission(state, dt, random, (n, x, y) => addWanted(state, n, x, y));
    if (hadM && !state.mission && state.missionsDone > doneB) {
      HL.Profile.record(state.wanted === 0 ? 'cleanMission' : 'mission');
      HL.Save.autosave(null, () => HL.Save.collect(state), true);
    } else if (hadM && !state.mission) {
      state._hlRetry = true;
      HL.Missions.fail(state, 'Out of time');
    }
    HL.Missions.update(dt, state);
    updateSideJob(state, dt);
    if (state.storyDone && !state.mission && !state.sideJob) {
      state.sideJobDelay = (state.sideJobDelay ?? 8) - dt;
      if (state.sideJobDelay <= 0) { startSideJob(state, random); state.sideJobDelay = 20; }
    }
    if (!state.mission && !state.storyDone) {
      const pos = playerWorldPos(state);
      if (Math.hypot(pos.x - CITY.safehouse.x, pos.y - CITY.safehouse.y - 120) < 70) {
        tryStartNextMission(state, random);
      }
    }
  }
  maintainTraffic(state, random);
  maintainPedestrians(state, random);
  updateShop(state, dt);
  const ent = state.player.car || state.player;
  const safe = HL.Bounds.update(dt, state.city, ent, !!(input.move.x || input.move.y));
  if (safe) {
    ent.x = safe.x; ent.y = safe.y;
    if (state.player.car) { state.player.car.speed = 0; state.player.x = safe.x; state.player.y = safe.y; }
  }
  updateCamera(state, dt);
  if (state.banner) {
    state.banner.timer -= dt;
    if (state.banner.timer <= 0) state.banner = null;
  }
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.5);
  if (audio) {
    const speed = p.car ? Math.abs(p.car.speed) : 0;
    audio.setEngine(speed, 520);
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    const anyCopNear = state.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - px, c.y - py) < 600);
    audio.setSiren(anyCopNear, state.time);
    if (state.wanted >= 3 && state.time % 0.25 < dt) audio.rotor();
  }
}

export function recover(state, random) {
  const wasWasted = state.wasted;
  const fee = Math.min(state.money, 100);
  state.money -= fee;
  state.health = 100;
  state.ammo = Math.max(state.ammo, 12);
  state.wanted = 0;
  state.wantedPoints = 0;
  state.unseenTimer = 0;
  state.cars = state.cars.filter((c) => c.kind === 'traffic');
  if (state.player.car) state.player.car = null;
  state.player.onFoot = true;
  if (wasWasted) {
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
  state.banner = { text: 'Back on the street', sub: wasWasted ? `Hospital fee: $${fee}` : `Bail: $${fee}`, timer: 3 };
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.camera.angle = -Math.PI / 2;
}

export function saveGame(state) {
  return HL.Save.save(null, HL.Save.collect(state));
}

export function loadGame(state) {
  const ok = HL.Save.apply(state, HL.Save.load(null));
  if (!ok) return false;
  state.stats.missionsDone = state.missionsDone;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.camera.angle = -Math.PI / 2;
  return true;
}

export function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

export function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage off */ }
}
