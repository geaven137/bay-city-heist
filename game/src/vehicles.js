// NEON BAY — vehicles: arcade car physics, traffic AI, stealing cars.
// Traffic cars drive the road grid in right-hand lanes, pick a turn at each
// intersection, and brake for the car ahead. The player's car uses the same
// physics (gas, brake, steering that depends on speed, handbrake).
import { CAR, CITY, PALETTE, WANTED } from './config.js';
import {
  atIntersection, hitsBuilding, laneOffset, nearestCentre, nearestIntersection,
  randomRoadPoint, resolveBuildingCollision, roadCentresX, roadCentresY,
} from './world.js';

let nextCarId = 1;

/** Sim speed (units/s) as km/h for the speedometer. */
export function carSpeedKmh(car) { return Math.abs(car.speed) * 0.36; }

export function makeCar(random, x, y, angle, kind, color) {
  return {
    id: nextCarId, x, y, angle, speed: 0, kind, // 'traffic' | 'police' | 'player'
    color: color || PALETTE.traffic[Math.floor(random() * PALETTE.traffic.length)],
    health: CAR.health, driver: kind === 'traffic' ? 'ai' : null,
    axis: 'x', dir: 1, targetSpeed: CAR.trafficSpeed, brakeTimer: 0,
    siren: kind === 'police', honkTimer: 0, smokeTimer: 0,
    stuckTimer: 0, lastX: x, lastY: y,
  };
}

/** Spawn a traffic car on a road near (x, y). */
export function spawnTrafficCar(state, random, x, y) {
  const p = randomRoadPoint(random, x, y, 300, 900);
  const vertical = Math.abs(p.x - nearestCentre(roadCentresX, p.x)) < 4;
  const axis = vertical ? 'y' : 'x';
  const dir = random() < 0.5 ? 1 : -1;
  const car = makeCar(random, p.x, p.y, axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 'traffic');
  car.axis = axis;
  car.dir = dir;
  car.targetSpeed = CAR.trafficSpeed * (0.8 + random() * 0.4);
  if (axis === 'x') car.y += laneOffset('x', dir);
  else car.x += laneOffset('y', dir);
  state.cars.push(car);
  return car;
}

/** Spawn a police car on a road outside the player's view. */
export function spawnPoliceCar(state, random, x, y) {
  const p = randomRoadPoint(random, x, y, 500, 1000);
  const car = makeCar(random, p.x, p.y, 0, 'police', PALETTE.police);
  car.driver = 'police';
  car.targetSpeed = CAR.policeSpeed;
  state.cars.push(car);
  return car;
}

/** Arcade driving: throttle -1..1, steer -1..1, handbrake true/false. */
export function driveCar(car, dt, throttle, steer, handbrake) {
  const accel = throttle > 0 ? CAR.accel : CAR.reverseAccel;
  car.speed += throttle * accel * dt;
  car.speed -= car.speed * (handbrake ? 1.6 : CAR.drag) * dt;
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.flat && car.speed > 180) car.speed = 180; // blown tire: limp
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  const turn = (handbrake ? CAR.handbrakeTurn : CAR.turnRate) * (car.flat ? 0.6 : 1);
  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * turn * grip * (car.speed >= 0 ? 1 : -1) * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

/** Two circles (front and back) against buildings; returns true on a hit. */
export function collideCarWithCity(state, car) {
  let hit = false;
  for (const s of [-16, 16]) {
    const fx = car.x + Math.cos(car.angle) * s;
    const fy = car.y + Math.sin(car.angle) * s;
    if (hitsBuilding(state.city, fx, fy, 13)) {
      const fixed = resolveBuildingCollision(state.city, fx, fy, 13);
      car.x += fixed.x - fx;
      car.y += fixed.y - fy;
      hit = true;
    }
  }
  car.x = Math.max(20, Math.min(CITY.width - 20, car.x));
  car.y = Math.max(20, Math.min(CITY.height - 20, car.y));
  return hit;
}

/** Circle-vs-circle bump between two cars; pushes both apart, swaps speed. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 44;
  if (d === 0 || d >= min) return false;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const swap = a.speed;
  a.speed = b.speed * 0.4;
  b.speed = swap * 0.4;
  return true;
}

function carAhead(state, car, distance) {
  const ax = car.x + Math.cos(car.angle) * distance;
  const ay = car.y + Math.sin(car.angle) * distance;
  for (const other of state.cars) {
    if (other === car) continue;
    if (Math.hypot(other.x - ax, other.y - ay) < 34) return other;
  }
  return null;
}

/**
 * Traffic AI: keep to the lane, slow for the car ahead, and at each
 * intersection pick a new direction (never reverse). Called per car per step.
 */
export function updateTrafficCar(state, car, dt, random) {
  if (car.brakeTimer > 0) car.brakeTimer -= dt;
  const ahead = carAhead(state, car, 70);
  const want = ahead ? 0 : car.targetSpeed;
  const throttle = car.speed < want ? 1 : (car.speed > want + 10 ? -0.6 : 0);
  const steerTo = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  let steer = 0;
  let diff = steerTo - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  steer = Math.max(-1, Math.min(1, diff * 2.2));
  driveCar(car, dt, throttle, steer, false);
  if (car.axis === 'x') {
    const laneY = nearestCentre(roadCentresY, car.y) + laneOffset('x', car.dir);
    car.y += (laneY - car.y) * Math.min(1, dt * 1.5);
  } else {
    const laneX = nearestCentre(roadCentresX, car.x) + laneOffset('y', car.dir);
    car.x += (laneX - car.x) * Math.min(1, dt * 1.5);
  }
  if (atIntersection(car.x, car.y)) {
    const node = nearestIntersection(car.x, car.y);
    const key = `${node.x},${node.y}`;
    if (car.lastNode !== key) {
      car.lastNode = key;
      const options = [];
      if (car.axis === 'x') {
        options.push({ axis: 'x', dir: car.dir });
        options.push({ axis: 'y', dir: 1 });
        options.push({ axis: 'y', dir: -1 });
      } else {
        options.push({ axis: 'y', dir: car.dir });
        options.push({ axis: 'x', dir: 1 });
        options.push({ axis: 'x', dir: -1 });
      }
      const pick = options[Math.floor(random() * options.length)];
      car.axis = pick.axis;
      car.dir = pick.dir;
    }
  }
  if (collideCarWithCity(state, car)) {
    car.speed *= 0.4;
    car.brakeTimer = 0.4;
  }
}

/** The nearest drivable car to (x, y) within `radius`, or null. */
export function nearestCar(state, x, y, radius) {
  let best = null;
  let bestD = radius;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/**
 * Steal a car: the driver is thrown out as a pedestrian, the player gets in,
 * and the crime raises the wanted level. Returns the car or null.
 */
export function stealCar(state, car, addWanted) {
  if (!car) return null;
  const occupied = car.driver === 'ai';
  if (occupied) {
    state.peds.push({
      x: car.x + 30, y: car.y + 20, angle: 0, speed: 0, color: PALETTE.ped[0],
      mode: 'flee', fleeX: car.x, fleeY: car.y, timer: 0, down: false, downTimer: 0,
    });
    car.driver = null;
  }
  car.kind = 'player';
  car.driver = 'player';
  state.player.car = car;
  state.player.onFoot = false;
  state.stats.carsStolen += 1;
  if (occupied) addWanted(WANTED.stealCar, car.x, car.y);
  return car;
}

/** Get out of the car: the player steps out beside the driver's door. */
export function exitCar(state) {
  const car = state.player.car;
  if (!car) return;
  car.driver = null;
  car.kind = 'traffic';
  car.targetSpeed = 0;
  state.player.car = null;
  state.player.onFoot = true;
  state.player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 30;
  state.player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 30;
  state.player.angle = car.angle;
}

/** Keep the traffic population full near the player; cull far-away cars. */
export function maintainTraffic(state, random, target = 14) {
  const p = state.player;
  state.cars = state.cars.filter((car) => {
    if (car.kind === 'player') return true;
    if (car.kind === 'police') return true;
    return Math.hypot(car.x - p.x, car.y - p.y) < 1400;
  });
  const traffic = state.cars.filter((c) => c.kind === 'traffic').length;
  for (let i = traffic; i < target; i += 1) spawnTrafficCar(state, random, p.x, p.y);
}
