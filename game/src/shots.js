// NEON BAY — the screenshot scenes behind ?shot=start|play|chase|end.
// Each one plays the real rules forward from a fresh game with a simple
// autopilot (walk to a car, steal it, drive the road grid toward a
// waypoint, ram the police), so the frame is what a short game really
// looks like and the same seed always gives the same frame. The cover
// (start) is the title over the living city; the chase shot is the money
// shot — wanted stars, police, minimap and a mission objective at once.
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
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 24) return idleInput();
  // moveWorld: the autopilot steers in world axes (the player steers
  // camera-relative, but the staging pilot is a director, not a player).
  return { move: { x: dx / d, y: dy / d }, run: true, handbrake: false, aim: null, actions: 0, moveWorld: true };
}

/**
 * Drive the player's car toward (tx, ty) on the road grid: at each
 * intersection pick the street that leads toward the target (greedy,
 * like the police pathfind), and steer to hold that street between them.
 * The leg is picked from the road the car is actually on — traffic cars
 * live on roads, so the stolen car is on one, and driving straight at a
 * target off that road would cut across blocks and wedge on buildings.
 */
function driveToward(game, tx, ty) {
  const car = game.state.player.car;
  if (!car) return idleInput();
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 70) return idleInput();
  // Remember the chosen street on the car so it holds a line between crossings.
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
  // At an intersection, turn onto the road that still has far to go.
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
  // Coast through turns instead of handbraking to a crawl: the grip model
  // needs speed to turn, so braking hard mid-corner stranded the car at
  // 1 km/h. Handbrake only for a near-reversal.
  const gas = Math.abs(diff) > 0.9 ? 0 : -1;
  const handbrake = Math.abs(diff) > 2.4;
  // Re-pick the street every 240px of travel, so the route bends toward the target.
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

/** Walk to the nearest car and steal it (up to `limit` seconds). */
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
    } else if (car) {
      input = walkToward(game, car.x, car.y);
    } else input = idleInput();
    stepGame(game, STEP, input, null, false);
    if (game.state.wasted || game.state.busted) return false;
  }
  // Staging fallback: the traffic may have driven off — put the player
  // beside the nearest car and steal it for real with the E action.
  const p = game.state.player;
  const car = nearestCar(game.state, p.x, p.y, 1400);
  if (!car) return false;
  p.x = car.x + 40;
  p.y = car.y + 20;
  stepGame(game, STEP, { ...idleInput(), actions: 4 }, null, false);
  return !!game.state.player.car;
}

const DOWNTOWN_LOOP = [
  { x: 480, y: 480 }, { x: 2560, y: 480 }, { x: 2560, y: 1760 }, { x: 480, y: 1760 },
];

/**
 * Set `game` to the named scene (start, play, chase or end; any other name
 * is start) and return the screen to draw over it and the best money to show.
 */
export function stageShot(name, game) {
  const { state, random } = game;
  if (name === 'play' || name === 'chase') {
    stealNearestCar(game, 14);
    if (name === 'play') {
      // Capture the frame while the car is actually moving: stop the drive
      // once it holds a cruise over 50 km/h for a few steps, so the shot
      // shows driving down a clear road, not a car parked mid-turn. If the
      // car never gets clear road, the full run is the fallback frame.
      let wp = 0;
      let fast = 0;
      const steps = Math.floor(PLAY_SECONDS / STEP);
      for (let i = 0; i < steps; i += 1) {
        const target = DOWNTOWN_LOOP[wp % DOWNTOWN_LOOP.length];
        const car = game.state.player.car;
        if (car && Math.hypot(car.x - target.x, car.y - target.y) < 120) wp += 1;
        stepGame(game, STEP, game.state.player.car ? driveToward(game, target.x, target.y) : idleInput(), null, false);
        if (game.state.wasted || game.state.busted) break;
        const c = game.state.player.car;
        fast = c && Math.abs(c.speed) > 140 ? fast + 1 : 0;
        if (fast >= 12) break;
      }
      return { screen: SCREEN_PLAY, best: state.money };
    }
    // Chase: a job that makes noise, three stars, and the police on us.
    startMission(state, random, 3);
    addWanted(state, 1, state.player.x, state.player.y);
    runSteps(game, CHASE_SECONDS, () => {
      const p = game.state.player;
      if (!p.car) return idleInput();
      // Drive at the bank, then away from it — the cops follow either way.
      const elapsed = state.time;
      const target = elapsed < 10 ? { x: CITY.bank.x, y: CITY.bank.y + 160 } : { x: 480, y: 1760 };
      return driveToward(game, target.x, target.y);
    }, false);
    return { screen: SCREEN_PLAY, best: state.money };
  }
  if (name === 'end') {
    stealNearestCar(game, 14);
    addWanted(state, 3, state.player.x, state.player.y);
    // Phase 1: ram the nearest cop, head-on, until the car or the player breaks.
    runSteps(game, 40, () => {
      const p = game.state.player;
      if (!p.car) return idleInput();
      let cop = null;
      let best = Infinity;
      for (const c of state.cars) {
        if (c.kind !== 'police') continue;
        const d = Math.hypot(c.x - p.car.x, c.y - p.car.y);
        if (d < best) { best = d; cop = c; }
      }
      return cop ? driveToward(game, cop.x, cop.y) : idleInput();
    }, false);
    if (state.wasted) return { screen: SCREEN_OVER, best: state.money };
    // Phase 2: out of the car, in front of a stopped cop — that is a bust.
    // (Staging only: hold the cop still, as a cop that has pulled up would
    // be; the bust itself runs through the real updatePoliceCar rule.)
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
        // Reposition the eye for the final frame: the bust puts the player
        // 34 units in front of a cop, and the camera had been pulled in
        // by a wall behind (eye 23 units behind the player, cop 57 from
        // the eye), so the cop car filled the frame. A straight pull-back
        // is blocked by that same wall, so search: step back until the
        // nearest cop reads ~170 units deep, sidestepping to clear the
        // wall's corner, and only accept a spot that is open and has a
        // clear line to the cop. Steps have stopped, so the camera stays.
        const cam = state.camera;
        const fx = Math.cos(cam.angle);
        const fy = Math.sin(cam.angle);
        const px = -fy;
        const py = fx;
        const depthOf = (cx, cy) => (cop.x - cx) * fx + (cop.y - cy) * fy;
        const clearToCop = (cx, cy) => {
          const dx = cop.x - cx;
          const dy = cop.y - cy;
          const d = Math.hypot(dx, dy);
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
        return { screen: SCREEN_BUSTED, best: state.money };
      }
    }
    return { screen: state.wasted ? SCREEN_OVER : SCREEN_PLAY, best: state.money };
  }
  // start: the title over the living city, camera downtown.
  state.camera.x = 1600;
  state.camera.y = 1120;
  runSteps(game, START_SECONDS, () => idleInput(), true);
  return { screen: SCREEN_TITLE, best: 0 };
}
