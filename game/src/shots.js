import { CITY, STEP } from './config.js';
import { atIntersection, hitsBuilding, nearestCentre, roadCentresX, roadCentresY } from './world.js';
import { stepGame } from './game.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { exitCar, nearestCar } from './vehicles.js';
import { SCREEN_BUSTED, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const CHASE_SECONDS = 22;
const END_LIMIT_SECONDS = 100;

function idleInput() {
  return { move: { x: 0, y: 0 }, run: false, handbrake: false, aim: null, actions: 0 };
}

function walkToward(game, tx, ty) {
  const p = game.state.player;
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 24) return idleInput();
  return { move: { x: dx / d, y: dy / d }, run: true, handbrake: false, aim: null, actions: 0, moveWorld: true };
}

function driveToward(game, tx, ty) {
  const car = game.state.player.car;
  if (!car) return idleInput();
  const dx = tx - car.x, dy = ty - car.y, dist = Math.hypot(dx, dy);
  if (dist < 70) return idleInput();
  if (car.autoAxis === undefined) {
    const onH = Math.abs(car.y - nearestCentre(roadCentresY, car.y)) <= 26;
    const onV = Math.abs(car.x - nearestCentre(roadCentresX, car.x)) <= 26;
    if (onH && !onV) car.autoAxis = 'x';
    else if (onV && !onH) car.autoAxis = 'y';
    else car.autoAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    car.autoDir = car.autoAxis === 'x' ? (Math.sign(dx) || 1) : (Math.sign(dy) || 1);
    car.autoX = car.x;
    car.autoY = car.y;
  }
  if (atIntersection(car.x, car.y)) {
    if (car.autoAxis === 'x' && Math.abs(dy) > 160 && Math.abs(dx) < 160) {
      car.autoAxis = 'y'; car.autoDir = Math.sign(dy) || 1;
    } else if (car.autoAxis === 'y' && Math.abs(dx) > 160 && Math.abs(dy) < 160) {
      car.autoAxis = 'x'; car.autoDir = Math.sign(dx) || 1;
    }
  }
  const wantAngle = car.autoAxis === 'x' ? (car.autoDir > 0 ? 0 : Math.PI) : (car.autoDir > 0 ? Math.PI / 2 : -Math.PI / 2);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const gas = Math.abs(diff) > 0.9 ? 0 : -1;
  const handbrake = Math.abs(diff) > 2.4;
  if (Math.hypot(car.x - car.autoX, car.y - car.autoY) > 240) car.autoAxis = undefined;
  return { move: { x: steer, y: gas }, run: false, handbrake, aim: null, actions: 0 };
}

function runSteps(game, seconds, inputFn, harmless) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepGame(game, STEP, inputFn(game, i), null, harmless);
    if (game.state.wasted || game.state.busted) break;
  }
}

function stealNearestCar(game, limit) {
  const steps = Math.floor(limit / STEP);
  for (let i = 0; i < steps; i += 1) {
    const p = game.state.player;
    if (p.car) return true;
    const car = nearestCar(game.state, p.x, p.y, 900);
    let input;
    if (car && Math.hypot(car.x - p.x, car.y - p.y) < 70) {
      input = idleInput();
      input.actions = 4; // ACTION_ENTER_CAR
    } else if (car) input = walkToward(game, car.x, car.y);
    else input = idleInput();
    stepGame(game, STEP, input, null, false);
    if (game.state.wasted || game.state.busted) return false;
  }
  const p = game.state.player;
  const car = nearestCar(game.state, p.x, p.y, 1400);
  if (!car) return false;
  p.x = car.x + 40;
  p.y = car.y + 20;
  stepGame(game, STEP, { ...idleInput(), actions: 4 }, null, false);
  return !!game.state.player.car;
}

const SPREAD_LATS = [150, -150, 220, -220];
function trailPolice(game) {
  const p = game.state.player;
  const car = p.car;
  if (!car) return;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let i = 0;
  for (const c of game.state.cars) {
    if (c.kind !== 'police') continue;
    const ahead = (c.x - car.x) * fx + (c.y - car.y) * fy;
    if (ahead > -40) {
      const back = 150 + (i % 3) * 90;
      const lat = (i % 2 === 0 ? 1 : -1) * 72;
      const nx = car.x - fx * back - fy * lat;
      const ny = car.y - fy * back + fx * lat;
      if (!hitsBuilding(game.state.city, nx, ny, 20)) {
        c.x = nx; c.y = ny; c.angle = car.angle; c.speed = Math.max(c.speed, 320);
      }
    }
    i += 1;
  }
}

function spreadPolice(game) {
  const { state } = game;
  const pcar = state.player.car;
  if (!pcar) return;
  const cam = state.camera;
  const fx = Math.cos(cam.angle), fy = Math.sin(cam.angle);
  const px = -fy, py = fx;
  const pDepth = (pcar.x - cam.x) * fx + (pcar.y - cam.y) * fy;
  const pLat = (pcar.x - cam.x) * px + (pcar.y - cam.y) * py;
  let next = 0;
  for (const c of state.cars) {
    if (c.kind !== 'police') continue;
    const depth = (c.x - cam.x) * fx + (c.y - cam.y) * fy;
    const lat = (c.x - cam.x) * px + (c.y - cam.y) * py;
    if (Math.abs(lat - pLat) >= 110 || depth <= 0 || depth >= pDepth + 280) continue;
    for (let k = 0; k < SPREAD_LATS.length; k += 1) {
      const latOff = SPREAD_LATS[(next + k) % SPREAD_LATS.length];
      const nx = cam.x + fx * (pDepth + 160) + px * (pLat + latOff);
      const ny = cam.y + fy * (pDepth + 160) + py * (pLat + latOff);
      if (nx < 40 || nx > CITY.width - 40 || ny < 40 || ny > CITY.height - 40) continue;
      if (hitsBuilding(state.city, nx, ny, 20)) continue;
      c.x = nx;
      c.y = ny;
      c.angle = pcar.angle;
      c.speed = pcar.speed;
      next = (next + k + 1) % SPREAD_LATS.length;
      break;
    }
  }
}

const BEACH_Y = 2080;
function driveBeach(game, dir) {
  const car = game.state.player.car;
  if (!car) return idleInput();
  return driveToward(game, dir > 0 ? 3000 : 200, BEACH_Y);
}

function clearShot(g) {
  const s = g.state, c = s.camera, fx = Math.cos(c.angle), fy = Math.sin(c.angle);
  for (const p of s.peds) {
    const dx = p.x - c.x, dy = p.y - c.y;
    if (dx * dx + dy * dy < 40000 && dx * fx + dy * fy > -20) { p.x = c.x - fx * 320; p.y = c.y - fy * 320; }
  }
  const pl = s.player, qx = pl.car ? pl.car.x : pl.x, qy = pl.car ? pl.car.y : pl.y;
  const ca = (qx - c.x) * fx + (qy - c.y) * fy;
  for (const l of s.city.lamps) {
    const dx = l.x - c.x, dy = l.y - c.y, a = dx * fx + dy * fy, la = dy * fx - dx * fy;
    if (a > 0 && Math.abs(a - ca) < 80 && Math.abs(la) < a * 0.12) {
      let nx = c.x - fy * 70, ny = c.y + fx * 70;
      if (hitsBuilding(s.city, nx, ny, 14)) { nx = c.x + fy * 70; ny = c.y - fx * 70; }
      if (!hitsBuilding(s.city, nx, ny, 14)) { c.x = nx; c.y = ny; }
      break;
    }
  }
  if (!pl.car) { // on foot (end shot): pull the lens back so the crowd/lamp by the cop is not in the lens
    const nx = c.x - fx * 80, ny = c.y - fy * 80;
    if (!hitsBuilding(s.city, nx, ny, 14)) { c.x = nx; c.y = ny; }
  }
}

export function stageShot(name, game) {
  const { state, random } = game;
  if (name === 'play' || name === 'chase') {
    stealNearestCar(game, 14);
    if (name === 'play') {
      let fast = 0, dir = 1;
      const steps = Math.floor(PLAY_SECONDS / STEP);
      for (let i = 0; i < steps; i += 1) {
        const car = game.state.player.car;
        if (car && ((dir > 0 && car.x > 2900) || (dir < 0 && car.x < 300))) dir = -dir;
        stepGame(game, STEP, game.state.player.car ? driveBeach(game, dir) : idleInput(), null, false);
        if (game.state.wasted || game.state.busted) break;
        const c = game.state.player.car;
        fast = c && Math.abs(c.speed) > 220 ? fast + 1 : 0;
        if (fast >= 12) break;
      }
      spreadPolice(game);
      clearShot(game);
      return { screen: SCREEN_PLAY, best: state.money };
    }
    startMission(state, random, 3);
    addWanted(state, 1, state.player.x, state.player.y);
    let fast = 0, dir = 1, elapsed = 0;
    const steps = Math.floor(CHASE_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const car = game.state.player.car;
      if (car && ((dir > 0 && car.x > 2900) || (dir < 0 && car.x < 300))) dir = -dir;
      stepGame(game, STEP, game.state.player.car ? driveBeach(game, dir) : idleInput(), null, false);
      elapsed += STEP;
      trailPolice(game);
      if (game.state.wasted || game.state.busted) break;
      const c = game.state.player.car;
      fast = c && Math.abs(c.speed) > 250 ? fast + 1 : 0;
      if (fast >= 12 && elapsed > 5) break;
    }
    spreadPolice(game);
    clearShot(game);
    state.banner = null; // drop the fading WANTED banner so the chase frame is clean
    return { screen: SCREEN_PLAY, best: state.money };
  }
  if (name === 'end') {
    stealNearestCar(game, 14);
    addWanted(state, 3, state.player.x, state.player.y);
    runSteps(game, 40, () => {
      const p = game.state.player;
      if (!p.car) return idleInput();
      let cop = null, best = Infinity;
      for (const c of state.cars) {
        if (c.kind !== 'police') continue;
        const d = Math.hypot(c.x - p.car.x, c.y - p.car.y);
        if (d < best) { best = d; cop = c; }
      }
      return cop ? driveToward(game, cop.x, cop.y) : idleInput();
    }, false);
    if (state.wasted) return { screen: SCREEN_OVER, best: state.money };
    if (state.player.car) {
      exitCar(state);
      const cop = state.cars.find((c) => c.kind === 'police');
      if (cop) {
        state.player.x = cop.x + 34;
        state.player.y = cop.y;
        runSteps(game, 12, () => {
          cop.speed = 0;
          return idleInput();
        }, false);
      }
      if (state.busted) {
        const cam = state.camera;
        const fx = Math.cos(cam.angle), fy = Math.sin(cam.angle);
        const px = -fy, py = fx;
        const depthOf = (cx, cy) => (cop.x - cx) * fx + (cop.y - cy) * fy;
        const clearToCop = (cx, cy) => {
          const dx = cop.x - cx, dy = cop.y - cy, d = Math.hypot(dx, dy);
          const steps = Math.ceil(d / 8);
          for (let i = 1; i < steps; i += 1) {
            if (hitsBuilding(state.city, cx + (dx * i) / steps, cy + (dy * i) / steps, 10)) return false;
          }
          return true;
        };
        const need = Math.max(0, 170 - depthOf(cam.x, cam.y));
        let placed = false;
        for (let back = need; back <= need + 72 && !placed; back += 12) {
          for (const lat of [0, -48, 48, -96, 96]) {
            const nx = cam.x - fx * back + px * lat;
            const ny = cam.y - fy * back + py * lat;
            if (nx < 40 || nx > CITY.width - 40 || ny < 40 || ny > CITY.height - 40) continue;
            if (hitsBuilding(state.city, nx, ny, 14)) continue;
            if (!clearToCop(nx, ny)) continue;
            if (depthOf(nx, ny) < 150) continue;
            cam.x = nx;
            cam.y = ny;
            placed = true;
            break;
          }
        }
        clearShot(game);
        return { screen: SCREEN_BUSTED, best: state.money };
      }
    }
    return { screen: state.wasted ? SCREEN_OVER : SCREEN_PLAY, best: state.money };
  }
  state.camera.x = 1600;
  state.camera.y = 1120;
  runSteps(game, START_SECONDS, () => idleInput(), true);
  return { screen: SCREEN_TITLE, best: 0 };
}
