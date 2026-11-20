// Neon Bay — the wanted level, the pursuit and Air One.
// Heat only rises when someone sees the crime. The more stars,
// the more units answer, and at three stars the helicopter
// comes up with its spotlight.

import { WANTED, CARS } from './config.js';
import { witnessedBy } from './pedestrians.js';

export function raiseHeat(state, amount, x, y) {
  if (state.end) return;
  if (!witnessedBy(state, x, y)) return;
  state.heat = Math.min(WANTED.max, state.heat + amount);
  state.wanted = Math.ceil(state.heat);
  if (state.wanted > 0 && !state.banner) {
    showBanner(state, 'WANTED', 'Lose the cops');
  }
}

export function showBanner(state, text, sub) {
  state.banner = { text, sub: sub || '', timer: 3.2 };
}

export function hideBanner(state) {
  state.banner = null;
}

export function stepCops(state, dt) {
  // Heat fades when the player is out of sight and slow — but
  // never while a unit is close enough to keep the chase on.
  const hidden = state.player.onFoot && state.player.speed < 20;
  const nearest = state.cars.reduce((best, c) => {
    if (c.kind !== 'police' || c.wrecked) return best;
    return Math.min(best, Math.hypot(c.x - state.player.x, c.y - state.player.y));
  }, Infinity);
  const fade = (nearest < 80 ? 0 : hidden ? WANTED.hidePerSec : WANTED.decayPerSec) * dt;
  if (state.heat > 0) {
    state.heat = Math.max(0, state.heat - fade);
    state.wanted = Math.ceil(state.heat);
  }
  if (state.banner) {
    state.banner.timer -= dt;
    if (state.banner.timer <= 0) state.banner = null;
  }

  // How many units the stars call for.
  const want = state.wanted;
  const need = want === 0 ? 0 : want <= 2 ? 2 : want <= 4 ? 3 : 4;
  const cops = state.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  while (cops.length < need) {
    const car = spawnCop(state, cops.length);
    state.cars.push(car);
    cops.push(car);
  }
  // Retire extras when the heat drops.
  for (let i = cops.length - 1; i >= need; i--) {
    const car = cops[i];
    car.retire = true;
    car.targetSpeed = CARS.policeTop;
    if (Math.hypot(car.x - state.player.x, car.y - state.player.y) > 700) {
      state.cars.splice(state.cars.indexOf(car), 1);
      cops.splice(i, 1);
    }
  }
  // Pursuit steering: each unit chases the player, offset to the side.
  const p = state.player;
  cops.forEach((car, idx) => {
    const side = idx % 2 === 0 ? 1 : -1;
    const tx = p.x + Math.cos(p.angle + Math.PI / 2) * 26 * side;
    const ty = p.y + Math.sin(p.angle + Math.PI / 2) * 26 * side;
    const wantAngle = Math.atan2(ty - car.y, tx - car.x);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const dist = Math.hypot(p.x - car.x, p.y - car.y);
    car.targetSpeed = car.retire ? CARS.policeTop : Math.min(CARS.policeTop, 18 + dist * 0.12);
    car.speed += Math.max(-420 * dt, Math.min(420 * dt, car.targetSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.strobe = (state.time * 8 + idx * Math.PI) % (Math.PI * 2) < Math.PI;
    // A hard ram hurts both cars.
    if (dist < 34 && !car.ramCool) {
      car.ramCool = 1.2;
      if (p.car) {
        p.car.health -= CARS.ramDamage;
        state.camera.shake = Math.max(state.camera.shake, 7);
        if (p.car.health <= 0) {
          p.car.wrecked = true;
          p.car.speed = 0;
          p.car.targetSpeed = 0;
        }
      }
    }
    if (car.ramCool) car.ramCool -= dt;
  });

  // Air One: up at three stars, hovering with a spotlight.
  // It tracks from ahead and to the sea side, high enough to see
  // but low enough to stay in the chase camera's frame.
  if (want >= WANTED.heliAt) {
    if (!state.heli) {
      state.heli = { x: p.x + 300, y: p.y + 50, z: 115, angle: 0, rotor: 0 };
    }
    const h = state.heli;
    h.rotor += dt * 22;
    const hx = p.x + Math.cos(p.angle) * 300 - Math.sin(p.angle) * 50;
    const hy = p.y + Math.sin(p.angle) * 300 + Math.cos(p.angle) * 50;
    h.x += (hx - h.x) * Math.min(1, dt * 0.9);
    h.y += (hy - h.y) * Math.min(1, dt * 0.9);
    h.z += (115 - h.z) * Math.min(1, dt * 1.2);
    h.angle = Math.atan2(p.y - h.y, p.x - h.x);
  } else if (state.heli) {
    state.heli.z += 60 * dt;
    if (state.heli.z > 320) state.heli = null;
  }
}

function spawnCop(state, slot) {
  const p = state.player;
  const a = state.rng.next() * Math.PI * 2;
  const d = 260 + state.rng.range(0, 160);
  const car = {
    serial: state.carSerial++,
    kind: 'police',
    x: p.x + Math.cos(a) * d,
    y: p.y + Math.sin(a) * d,
    angle: 0,
    speed: 0,
    targetSpeed: CARS.policeTop,
    health: 100,
    wrecked: false,
    color: CARS.policeColor,
    strobe: false,
    ramCool: 0,
    retire: false,
    slot,
  };
  return car;
}

// The dispatch board: every active unit with a distinct label.
export function dispatchBoard(state) {
  const rows = [];
  const cops = state.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  const p = state.player;
  cops.forEach((car, i) => {
    rows.push({
      label: 'UNIT ' + String(i + 1).padStart(2, '0'),
      dist: Math.round(Math.hypot(car.x - p.x, car.y - p.y)),
      status: car.retire ? 'STAND DOWN' : 'PURSUIT',
    });
  });
  if (state.heli) {
    const d = Math.round(Math.hypot(state.heli.x - p.x, state.heli.y - p.y));
    rows.splice(1, 0, { label: 'AIR ONE', dist: d, status: 'SPOTLIGHT' });
  }
  return rows;
}
