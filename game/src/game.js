// Neon Bay — the game itself: state and the update loop.
// createGame builds a fresh city from a seed (pure data, no
// Three.js, no DOM, so Node can import and step it). stepGame
// advances everything one frame: input, cars, cops, crowd,
// bullets, missions, the shop and the save timer.

import { PLAYER, CARS, KEYS } from './config.js';
import { makeRng } from './random.js';
import { generateCity } from './world.js';
import { spawnTraffic, stepTraffic } from './vehicles.js';
import { spawnFleet, stepFleet } from './fleet.js';
import { spawnCrowd, stepCrowd } from './pedestrians.js';
import { stepCops, raiseHeat } from './police.js';
import { throwPunch, firePistol, stepBullets, crashDamage } from './combat.js';
import { startMission, stepMissions } from './missions.js';
import { stepShop, buyItem } from './shop.js';
import { stepParticles } from './particles.js';
import { clampToCity, saveGame, perfTick } from './patchkit.js';
import { keyHeld, keyPressed } from './input.js';
import { stepAudio } from './audio.js';

export function createGame(seed) {
  const rng = makeRng(seed);
  const state = {
    seed,
    rng,
    time: 0,
    mode: 'title',
    player: {
      x: 600, y: 2080, angle: 0,
      onFoot: false, speed: 0,
      health: PLAYER.health,
      punchTimer: 0, shootTimer: 0, hurtTimer: 0,
      car: null,
    },
    cars: [],
    peds: [],
    wanted: 0,
    heat: 0,
    money: PLAYER.startMoney,
    ammo: PLAYER.startAmmo,
    health: PLAYER.health,
    rep: 0,
    rankIndex: 0,
    jobsDone: 0,
    missionIndex: 0,
    missionTimer: 0,
    missionTarget: null,
    missionStage: 0,
    missionDist: 0,
    banner: null,
    talk: null,
    end: null,
    camera: { mode: 'chase', shoulder: 1, shake: 0 },
    city: null,
    fleet: null,
    heli: null,
    particles: [],
    bullets: [],
    shopOpen: false,
    flash: 0,
    weapon: 0,
    carSerial: 1,
    frameTime: 0.016,
    quality: 2,
    pedCap: 24,
    stats: { shotsFired: 0, pedsDown: 0, carsStolen: 0, missionsDone: 0, ammoBought: 0, spent: 0 },
    saveTimer: 0,
    audio: null,
  };
  state.city = generateCity(rng);
  spawnCrowd(state);
  spawnTraffic(state);
  spawnFleet(state);
  startMission(state, 0);
  return state;
}

export function kmh(speed) {
  return Math.round(Math.abs(speed) * 2.6);
}

export function stepGame(state, dt, input) {
  state.time += dt;
  if (state.talk) {
    state.talk.timer -= dt;
    if (state.talk.timer <= 0) state.talk = null;
  }
  if (state.camera.shake > 0) state.camera.shake = Math.max(0, state.camera.shake - dt * 22);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.5);
  const p = state.player;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;

  if (state.mode === 'title' || state.mode === 'end') {
    if (state.mode === 'end' && state.end) state.end.timer += dt;
    stepTraffic(state, dt);
    stepFleet(state, dt);
    stepCrowd(state, dt);
    stepParticles(state, dt);
    return;
  }

  handleInput(state, dt, input);
  stepTraffic(state, dt);
  stepFleet(state, dt);
  stepCops(state, dt);
  stepCrowd(state, dt);
  stepBullets(state, dt);
  stepParticles(state, dt);
  stepMissions(state, dt);
  stepShop(state);
  clampToCity(state);
  perfTick(state, dt);
  if (state.audio) stepAudio(state.audio, state, dt);
  state.saveTimer += dt;
  if (state.saveTimer > 20) {
    state.saveTimer = 0;
    saveGame(state);
  }
}

function handleInput(state, dt, input) {
  const p = state.player;
  if (!input) return;
  if (input.keys && input.keys.has('KeyF')) {
    input.keys.delete('KeyF');
    state.weapon = 1 - state.weapon;
  }
  if (input.keys && input.keys.has('KeyQ')) {
    input.keys.delete('KeyQ');
    state.camera.shoulder *= -1;
  }
  if (p.onFoot) {
    let turn = 0;
    if (keyHeld(input, KEYS.left)) turn += 1;
    if (keyHeld(input, KEYS.right)) turn -= 1;
    p.angle += turn * 2.6 * dt;
    if (input.mouseDX) {
      p.angle -= input.mouseDX * 0.004;
      input.mouseDX = 0;
    }
    let fwd = 0;
    if (keyHeld(input, KEYS.forward)) fwd += 1;
    if (keyHeld(input, KEYS.back)) fwd -= 0.6;
    const spd = fwd > 0 ? PLAYER.walkSpeed : PLAYER.walkSpeed * 0.7;
    p.speed = fwd * spd;
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    if (keyPressed(input, KEYS.enter)) tryEnterCar(state);
    if (input.clicked) {
      input.clicked = false;
      if (state.weapon === 0) throwPunch(state);
      else firePistol(state, p.x + Math.cos(p.angle) * 220, p.y + Math.sin(p.angle) * 220);
    }
  } else {
    const car = p.car;
    if (!car || car.wrecked) {
      if (car && car.wrecked) exitCar(state, true);
      else p.onFoot = true;
      return;
    }
    let gas = 0;
    if (keyHeld(input, KEYS.forward)) gas += 1;
    if (keyHeld(input, KEYS.back)) gas -= 0.7;
    const top = car.kind === 'police' ? CARS.policeTop : PLAYER.driveTop;
    car.speed += gas * PLAYER.driveAccel * dt;
    if (keyHeld(input, KEYS.brake)) car.speed *= Math.max(0, 1 - 3.2 * dt);
    car.speed = Math.max(-top * 0.45, Math.min(top, car.speed));
    let steer = 0;
    if (keyHeld(input, KEYS.left)) steer += 1;
    if (keyHeld(input, KEYS.right)) steer -= 1;
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * PLAYER.turnRate * (Math.abs(car.speed) / top) * dir * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.wheelSpin += dt * car.speed;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    if (keyPressed(input, KEYS.enter)) exitCar(state, false);
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      if (Math.hypot(other.x - car.x, other.y - car.y) < 36 && Math.abs(car.speed) > 12) {
        crashDamage(state, car, other);
        car.speed *= 0.55;
      }
    }
    if (car.wrecked) exitCar(state, true);
  }
  if (state.shopOpen) {
    if (keyPressed(input, KEYS.buy1)) buyItem(state, 0);
    if (keyPressed(input, KEYS.buy2)) buyItem(state, 1);
    if (keyPressed(input, KEYS.buy3)) buyItem(state, 2);
    if (keyPressed(input, KEYS.buy4)) buyItem(state, 3);
  }
}

function tryEnterCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 60;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  if (best.kind !== 'player') {
    raiseHeat(state, 1, best.x, best.y);
    state.stats.carsStolen += 1;
  }
  if (p.car && p.car !== best) p.car.kind = 'civil';
  best.kind = 'player';
  p.car = best;
  p.onFoot = false;
  p.x = best.x;
  p.y = best.y;
  p.angle = best.angle;
  p.speed = best.speed;
}

function exitCar(state, forced) {
  const p = state.player;
  const car = p.car;
  if (!car) {
    p.onFoot = true;
    return;
  }
  p.onFoot = true;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 8;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 8;
  p.speed = 0;
  if (!forced) car.targetSpeed = 0;
}
