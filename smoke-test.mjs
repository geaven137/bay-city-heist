// NEON BAY smoke test — no browser. A fake canvas/DOM lets the real game
// modules run under Node: city gen, 60s of play (walk, steal, drive,
// police, mission), all four screenshot stagings, and a render pass.
// Run: node smoke-test.mjs   (exit 0 = pass; prints a failure and exit 1)
import { createGame, stepGame } from './game/src/game.js';
import { stageShot } from './game/src/shots.js';
import { createRenderer, SCREEN_PLAY } from './game/src/render.js';
import { STEP } from './game/src/config.js';

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// ---- Fake DOM: just enough for render.js / main.js modules ----
function fakeGradient() {
  return { addColorStop() {} };
}
function fakeContext() {
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    setTransform() {}, fillRect() {}, strokeRect() {}, clearRect() {}, fillText() {},
    rect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    clip() {}, drawImage() {}, roundRect() {}, createRadialGradient: fakeGradient,
    createLinearGradient: fakeGradient,
  };
}
const fakeCanvas = { width: 1280, height: 720, getContext: () => fakeContext(), addEventListener() {} };
globalThis.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener() {}, localStorage: { getItem: () => null, setItem() {} },
  requestAnimationFrame() {}, AudioContext: undefined,
  location: { search: '' },
};
globalThis.document = {
  createElement: () => fakeCanvas, addEventListener() {},
  getElementById: () => fakeCanvas,
};
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = () => {};

// ---- 1. City + state ----
const game = createGame(1);
const { state } = game;
check('city has buildings', state.city.buildings.length > 50, `${state.city.buildings.length} buildings`);
check('city has parks', state.city.parks.length > 0, `${state.city.parks.length} parks`);
check('player starts on foot at safehouse', state.player.onFoot && Math.abs(state.player.x - 1600) < 200, `(${state.player.x|0},${state.player.y|0})`);

// ---- 2. Render once (catches draw errors) ----
const renderer = createRenderer(fakeCanvas);
try {
  renderer.draw(state, SCREEN_PLAY, 0, 0);
  check('render play frame', true);
} catch (e) {
  check('render play frame', false, String(e && e.stack || e));
}

// ---- 3. 60s of play: walk, steal, drive, wanted, mission ----
const idle = { move: { x: 0, y: 0 }, run: false, handbrake: false, aim: null, actions: 0 };
let drove = false;
let stole = false;
let wantedSeen = false;
for (let i = 0; i < 60 / STEP; i += 1) {
  const p = state.player;
  let input = idle;
  if (!p.car) {
    // Walk toward the nearest car; steal when close.
    let car = null; let best = Infinity;
    for (const c of state.cars) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < best) { best = d; car = c; }
    }
    if (car && best < 70) input = { ...idle, actions: 4 };
    else if (car) {
      const dx = car.x - p.x; const dy = car.y - p.y; const d = Math.hypot(dx, dy) || 1;
      input = { ...idle, move: { x: dx / d, y: dy / d }, run: true, moveWorld: true };
    }
  } else {
    stole = true;
    drove = drove || Math.abs(p.car.speed) > 100;
    input = { ...idle, move: { x: 0.3, y: -1 } };
  }
  stepGame(game, STEP, input, null, false);
  if (state.wanted > 0) wantedSeen = true;
  if (state.wasted || state.busted) break;
}
check('player stole a car', stole);
check('player drove (speed > 100)', drove);
check('traffic populated', state.cars.filter((c) => c.kind === 'traffic').length >= 8, `${state.cars.length} cars`);
check('pedestrians populated', state.peds.length >= 10, `${state.peds.length} peds`);
check('wanted rose from stealing', wantedSeen, `wanted=${state.wanted}`);
check('no NaN in player pos', Number.isFinite(state.player.x) && Number.isFinite(state.player.y));
check('camera inside city', state.camera.x >= 0 && state.camera.x <= 3200 && state.camera.y >= 0 && state.camera.y <= 2400);

// ---- 4. Mission flow: start job 0, teleport through its stages ----
const g2 = createGame(7);
import('./game/src/missions.js').then(({ startMission, currentStage }) => {
  startMission(g2.state, g2.random, 0);
  check('mission 0 starts', !!g2.state.mission, g2.state.mission?.text);
  // Walk the player through each stage's target, one step at a time.
  for (let guard = 0; guard < 4 && g2.state.mission; guard += 1) {
    const stage = currentStage(g2.state);
    if (!stage) break;
    const p = g2.state.player;
    p.x = stage.x; p.y = stage.y;
    if (stage.needsCar) {
      const car = g2.state.cars[0];
      if (car) { p.car = car; p.onFoot = false; car.kind = 'player'; car.driver = 'player'; }
    }
    for (let i = 0; i < 30; i += 1) stepGame(g2, STEP, idle, null, false);
  }
  check('mission 0 completes', g2.state.missionsDone === 1, `missionsDone=${g2.state.missionsDone}, money=${g2.state.money}`);
  finish();
});

// ---- 5. All four shots stage + render ----
async function finish() {
  // Every remaining module must at least parse and load: input, audio, main.
  try {
    const inputMod = await import('./game/src/input.js');
    check('input.js loads', typeof inputMod.createInput === 'function');
    const audioMod = await import('./game/src/audio.js');
    const audio = audioMod.createAudio();
    check('audio.js loads (no AudioContext)', typeof audio.setEngine === 'function');
    await import('./game/src/main.js');
    check('main.js loads (boot, no shot)', true);
  } catch (e) {
    check('remaining modules load', false, String(e && e.stack || e));
  }
  for (const name of ['start', 'play', 'chase', 'end']) {
    try {
      const g = createGame(1);
      const scene = stageShot(name, g);
      renderer.draw(g.state, scene.screen, scene.best, g.state.time);
      check(`shot ${name} stages (${scene.screen})`, true,
        `wanted=${g.state.wanted} cars=${g.state.cars.length} money=${g.state.money} ` +
        `inCar=${!g.state.player.onFoot} mission=${g.state.mission ? g.state.mission.def.title : 'none'} ` +
        `cops=${g.state.cars.filter((c) => c.kind === 'police').length}`);
    } catch (e) {
      check(`shot ${name} stages`, false, String(e && e.stack || e));
    }
  }
  console.log(failures === 0 ? 'SMOKE OK' : `SMOKE FAILED (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}
