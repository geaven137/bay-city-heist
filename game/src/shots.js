// Neon Bay — screenshot staging.
// When the page opens with ?shot=<name>&seed=1 it must show the
// game at its best in one frame: the car on the beach road with
// the sea on its right, the camera square behind it on the road
// axis, a clear lane ahead, the cops in formation behind, the
// helicopter up with its spotlight, and no big banner across
// the middle. The end frame shows the BUSTED panel with honest
// numbers and no gameplay HUD behind it.

import { WORLD, PLAYER } from './config.js';
import { endRun } from './combat.js';
import { hideBanner, showBanner } from './police.js';
import { startMission } from './missions.js';

const BEACH_Y = WORLD.beachY;

function putOnBeach(state, x) {
  const p = state.player;
  const car = p.car;
  p.x = x;
  p.y = BEACH_Y;
  p.angle = 0;
  p.onFoot = false;
  if (car) {
    car.x = x;
    car.y = BEACH_Y;
    car.angle = 0;
    car.speed = PLAYER.driveTop;
    car.targetSpeed = PLAYER.driveTop;
    car.wrecked = false;
    car.health = 100;
    p.car = car;
  }
  p.speed = PLAYER.driveTop;
}

// Is the lane ahead of (x, y) along angle clear for `dist`?
export function laneClear(state, x, y, angle, dist) {
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const px = -fy;
  const py = fx;
  for (const b of state.city.buildings) {
    const dx = b.x - x;
    const dy = b.y - y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 0 || ahead > dist) continue;
    const side = Math.abs(dx * px + dy * py);
    const halfW = Math.max(b.w, b.d) / 2 + 30;
    if (side < halfW) return false;
  }
  return true;
}

// Slide the car along the beach road until the lane ahead is clear.
function findClearSpot(state, x0) {
  let x = x0;
  for (let i = 0; i < 12; i++) {
    if (laneClear(state, x, BEACH_Y, 0, 900)) return x;
    x += 90;
    if (x > WORLD.beachX1 - 100) x = WORLD.beachX0 + 60;
  }
  return x;
}

// Police in formation for the chase frame: two units flank ahead
// (a roadblock forming, visible in the chase camera) and two
// behind in pursuit. Never stacked.
function lineUpCops(state) {
  const p = state.player;
  const cops = state.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  const px = -fy;
  const py = fx;
  // [ahead(+)/behind(-) along the road, side offset] per unit.
  // The flanking pair starts far ahead so that, even as the
  // pursuit pulls them back toward the player, they are still
  // in the chase camera's frame at screenshot time.
  const spots = [
    [200, 30],
    [230, -32],
    [-80, 26],
    [-140, -28],
  ];
  cops.forEach((car, i) => {
    const spot = spots[i % spots.length];
    const along = spot[0];
    const side = spot[1];
    car.x = p.x + fx * along + px * side;
    car.y = p.y + fy * along + py * side;
    car.angle = p.angle;
    const spd = Math.abs(p.car ? p.car.speed : 0);
    car.speed = spd * 0.96;
    car.targetSpeed = spd;
    car.retire = false;
    car.slot = i;
  });
}

// Move any traffic out of the lane ahead, behind the camera.
function sweepLane(state) {
  const p = state.player;
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  const px = -fy;
  const py = fx;
  for (const car of state.cars) {
    if (car.kind === 'player' || car.kind === 'police') continue;
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * px + dy * py);
    if (ahead > -20 && ahead < 520 && side < 46) {
      const s = car.serial % 2 === 0 ? 1 : -1;
      car.x = p.x - fx * 150 + px * 60 * s;
      car.y = p.y - fy * 150 + py * 60 * s;
      car.angle = p.angle;
      car.targetSpeed = 0;
      car.speed = 0;
    }
  }
  for (const ped of state.peds) {
    const dx = ped.x - p.x;
    const dy = ped.y - p.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * px + dy * py);
    if (ahead > 0 && ahead < 320 && side < 34) {
      ped.x = p.x + px * 90;
      ped.y = p.y + py * 90;
    }
  }
}

function stagePlay(state) {
  state.mode = 'play';
  state.money = PLAYER.startMoney;
  state.health = PLAYER.health;
  state.ammo = PLAYER.startAmmo;
  state.wanted = 1;
  state.heat = 1;
  state.end = null;
  const x = findClearSpot(state, 640);
  putOnBeach(state, x);
  startMission(state, 0);
  state.missionTimer = 97;
  hideBanner(state);
  sweepLane(state);
  state.talk = null;
}

function stageChase(state) {
  state.mode = 'play';
  state.money = PLAYER.startMoney;
  state.health = 94;
  state.ammo = PLAYER.startAmmo;
  state.wanted = 5;
  state.heat = 5;
  state.end = null;
  const x = findClearSpot(state, 1560);
  putOnBeach(state, x);
  // Four units, then the helicopter.
  state.heli = { x: state.player.x + 300, y: state.player.y + 50, z: 115, angle: 0, rotor: 0 };
  startMission(state, 2);
  state.missionTimer = 145;
  lineUpCops(state);
  sweepLane(state);
  hideBanner(state);
  state.talk = null;
}

function stageEnd(state) {
  state.mode = 'play';
  state.money = PLAYER.startMoney;
  state.health = 40;
  state.ammo = PLAYER.startAmmo;
  const x = findClearSpot(state, 900);
  putOnBeach(state, x);
  if (state.player.car) {
    state.player.car.speed = 0;
    state.player.car.targetSpeed = 0;
  }
  state.player.speed = 0;
  // A police car stopped just ahead, as the arresting unit.
  const cops = state.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  if (cops.length > 0) {
    const lead = cops[0];
    lead.x = state.player.x + 70;
    lead.y = state.player.y + 6;
    lead.angle = Math.PI;
    lead.speed = 0;
    lead.targetSpeed = 0;
  }
  hideBanner(state);
  state.talk = null;
  endRun(state, 'busted');
}

export function stageShot(state, name) {
  if (name === 'start') {
    state.mode = 'title';
    state.money = PLAYER.startMoney;
    state.health = PLAYER.health;
    state.banner = null;
    state.talk = null;
    putOnBeach(state, 600);
    if (state.player.car) {
      state.player.car.speed = 0;
      state.player.car.targetSpeed = 0;
    }
    state.player.speed = 0;
    return;
  }
  if (name === 'play') {
    stagePlay(state);
    return;
  }
  if (name === 'chase') {
    stageChase(state);
    return;
  }
  if (name === 'end') {
    stageEnd(state);
    return;
  }
  state.mode = 'title';
}

export function shotList() {
  return ['start', 'play', 'chase', 'end'];
}
// Round 9: NEON BAY design pack integration point (see src/designs.js).
if (typeof window !== 'undefined') { (window.__NEON_POINTS__ = window.__NEON_POINTS__ || []).push('shots.js'); }
