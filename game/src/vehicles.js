// Neon Bay — cars: the player's orange coupe, police interceptors
// and civilian traffic. Data (position, speed, health) lives in
// plain objects the logic steps; meshes are built on demand
// in the browser from the same data.

import { CARS, WORLD } from './config.js';

function paint(color, rough, metal) {
  const T = globalThis.THREE;
  return new T.MeshStandardMaterial({ color, roughness: rough ?? 0.42, metalness: metal ?? 0.35 });
}

function piece(parent, geo, material, x, y, z, rx, ry, rz) {
  const T = globalThis.THREE;
  const mesh = new T.Mesh(geo, material);
  mesh.position.set(x, y, z);
  if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function tyre(radius, width) {
  const T = globalThis.THREE;
  const g = new T.Group();
  // CylinderGeometry is built along Y; rotateZ puts the axle along
  // X (the car's width), so the wheel stands upright and spins
  // around X. (rotateX would leave the axle vertical, a flat disc.)
  const tireGeo = new T.CylinderGeometry(radius, radius, width, 16);
  tireGeo.rotateZ(Math.PI / 2);
  piece(g, tireGeo, paint(0x14161a, 0.9, 0.05));
  const rimGeo = new T.CylinderGeometry(radius * 0.55, radius * 0.55, width * 1.06, 12);
  rimGeo.rotateZ(Math.PI / 2);
  piece(g, rimGeo, paint(0xcbd5e1, 0.3, 0.8));
  return g;
}

export function spawnCar(state, kind, x, y, angle) {
  const color = kind === 'player'
    ? CARS.playerColor
    : kind === 'police'
      ? CARS.policeColor
      : CARS.civilianColors[state.rng.whole(0, CARS.civilianColors.length - 1)];
  return {
    serial: state.carSerial++,
    kind,
    x, y,
    angle: angle ?? state.rng.next() * Math.PI * 2,
    speed: 0,
    targetSpeed: 0,
    health: 100,
    wrecked: false,
    color,
    strobe: false,
    ramCool: 0,
    retire: false,
    slot: 0,
    mesh: null,
    wheelSpin: 0,
  };
}

export function spawnTraffic(state) {
  const rng = state.rng;
  for (let i = 0; i < WORLD.trafficCount; i++) {
    const onBeach = rng.chance(0.35);
    const x = onBeach ? rng.range(560, 2000) : rng.range(-WORLD.half + 100, WORLD.half - 100);
    const y = onBeach ? WORLD.beachY + rng.range(-8, 8) : rng.range(-WORLD.half + 100, WORLD.half - 100);
    const car = spawnCar(state, 'civil', x, y, onBeach ? 0 : rng.next() * Math.PI * 2);
    car.targetSpeed = rng.range(16, CARS.trafficTop);
    car.speed = car.targetSpeed;
    car.lane = rng.pick([-1, 1]);
    state.cars.push(car);
  }
  const playerCar = spawnCar(state, 'player', 600, WORLD.beachY, 0);
  playerCar.x = 600;
  playerCar.y = WORLD.beachY;
  state.cars.push(playerCar);
  state.player.car = playerCar;
  state.player.x = 600;
  state.player.y = WORLD.beachY;
  state.player.angle = 0;
  state.player.onFoot = false;
}

export function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'civil' || car.wrecked) continue;
    car.speed += Math.max(-300 * dt, Math.min(300 * dt, car.targetSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.wheelSpin += dt * car.speed * 0.9;
    // Wander: at an intersection, sometimes turn.
    const nearX = Math.abs(car.x % WORLD.roadGap) < 8 || Math.abs(car.x % WORLD.roadGap) > WORLD.roadGap - 8;
    const nearY = Math.abs(car.y % WORLD.roadGap) < 8 || Math.abs(car.y % WORLD.roadGap) > WORLD.roadGap - 8;
    if ((nearX || nearY) && state.rng.chance(dt * 0.5)) {
      car.angle += state.rng.pick([-Math.PI / 2, Math.PI / 2]);
    }
    if (car.x < -WORLD.half || car.x > WORLD.half || car.y < -WORLD.half || car.y > WORLD.half) {
      car.angle += Math.PI;
      car.x = Math.max(-WORLD.half + 40, Math.min(WORLD.half - 40, car.x));
      car.y = Math.max(-WORLD.half + 40, Math.min(WORLD.half - 40, car.y));
    }
  }
}

export function buildCarMesh(car) {
  const T = globalThis.THREE;
  const g = new T.Group();
  const isPolice = car.kind === 'police';
  const bodyMat = paint(car.color, 0.3, 0.55);
  const glassMat = paint(0x16202e, 0.12, 0.85);
  piece(g, new T.BoxGeometry(2.0, 4.5, 0.62), bodyMat, 0, 0, 0.55);
  piece(g, new T.BoxGeometry(1.7, 2.1, 0.52), glassMat, 0, -0.2, 1.05);
  piece(g, new T.BoxGeometry(1.74, 1.8, 0.08), bodyMat, 0, -0.25, 1.32);
  if (isPolice) {
    piece(g, new T.BoxGeometry(2.02, 2.1, 0.34), paint(0xf4f6f8, 0.3, 0.3), 0, -0.1, 0.55);
    const red = piece(g, new T.BoxGeometry(0.55, 0.3, 0.16), paint(0xef4444, 0.4, 0.2), -0.32, -0.2, 1.44);
    const blue = piece(g, new T.BoxGeometry(0.55, 0.3, 0.16), paint(0x3b82f6, 0.4, 0.2), 0.32, -0.2, 1.44);
    red.material.emissive = new T.Color(0xef4444);
    blue.material.emissive = new T.Color(0x3b82f6);
    red.material.emissiveIntensity = 1.2;
    blue.material.emissiveIntensity = 1.2;
    car.strobeRed = red;
    car.strobeBlue = blue;
  }
  piece(g, new T.BoxGeometry(1.4, 0.14, 0.2), paint(0xd7dde3, 0.3, 0.85), 0, 2.28, 0.5);
  const wheels = [];
  for (const [wx, wy] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = tyre(0.4, 0.3);
    w.position.set(wx, wy, 0.4);
    g.add(w);
    wheels.push(w);
  }
  car.wheels = wheels;
  car.mesh = g;
  return g;
}

export function syncCarMesh(car) {
  if (!car.mesh) return;
  car.mesh.position.set(car.x, car.y, 0);
  car.mesh.rotation.z = car.angle - Math.PI / 2;
  const spin = (car.wheelSpin || 0) * 0.12;
  if (car.wheels) {
    for (const w of car.wheels) w.rotation.x = spin;
  }
  if (car.strobeRed && car.strobeBlue) {
    const on = car.strobe;
    car.strobeRed.material.emissiveIntensity = on ? 1.8 : 0.2;
    car.strobeBlue.material.emissiveIntensity = on ? 0.2 : 1.8;
  }
}
// Round 9: NEON BAY design pack integration point (see src/designs.js).
if (typeof window !== 'undefined') { (window.__NEON_POINTS__ = window.__NEON_POINTS__ || []).push('vehicles.js'); }
