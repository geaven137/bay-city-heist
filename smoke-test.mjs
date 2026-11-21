// Neon Bay — headless smoke test (Node, no browser).
// Builds the game from seed 1, drives the play and chase shots,
// checks the helicopter, the wanted level, the shop and the
// BUSTED money math. Exits 0 and prints SMOKE OK when every
// check passes, else exits 1 listing the failures.

import { createGame, stepGame, kmh } from './game/src/game.js';
import { stageShot, laneClear } from './game/src/shots.js';
import { dispatchBoard } from './game/src/police.js';
import { shopNearby, buyItem } from './game/src/shop.js';
import { MISSIONS } from './game/src/config.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log('PASS ' + name + (detail ? ' — ' + detail : ''));
  } else {
    failed += 1;
    failures.push(name);
    console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

function fakeInput(keys) {
  return {
    keys: new Set(keys || []),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    rightDown: false,
    clicked: false,
    attached: true,
    mouseDX: 0,
  };
}

function stepFor(state, seconds, keys) {
  const input = fakeInput(keys);
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) stepGame(state, 1 / 60, input);
  return input;
}

// ---- build ----
const state = createGame(1);
check('city builds', state.city.buildings.length === 68, state.city.buildings.length + ' buildings');
check('parks build', state.city.parks.length === 9, state.city.parks.length + ' parks');
check('player starts in car on beach road', !state.player.onFoot && Math.abs(state.player.y - 2080) < 1, 'y=' + state.player.y);
check('money starts at 60', state.money === 60, '$' + state.money);
check('ammo starts at 24', state.ammo === 24, String(state.ammo));
check('eight missions defined', MISSIONS.length === 8, MISSIONS.length + ' missions');
check('fleet has three planes', state.fleet.planes.length === 3, state.fleet.planes.length + ' planes');
const rigKinds = state.cars.map((c) => c.kind);
check('fire trucks present', rigKinds.filter((k) => k === 'pumper' || k === 'ladder' || k === 'rescue' || k === 'arff').length === 4);
check('ambulance present', rigKinds.includes('ambulance'));
check('three motorcycles present', ['sport', 'cruiser', 'enduro'].every((k) => rigKinds.includes(k)));

// ---- play shot ----
stageShot(state, 'play');
check('play stages on beach road', Math.abs(state.player.y - 2080) < 1 && Math.abs(state.player.x - 640) < 400, 'x=' + Math.round(state.player.x) + ' y=' + Math.round(state.player.y));
check('play lane ahead clear', laneClear(state, state.player.x, state.player.y, 0, 900), '900 units');
check('play banner cleared', state.banner === null);
stepFor(state, 3, ['KeyW']);
const playKmh = kmh(state.player.car ? state.player.car.speed : state.player.speed);
check('play speed high', playKmh >= 100, playKmh + ' km/h');
check('play still on beach road', Math.abs(state.player.y - 2080) < 40, 'y=' + Math.round(state.player.y));
check('play wanted is 1 star', state.wanted === 1, state.wanted + ' stars');

// ---- chase shot ----
stageShot(state, 'chase');
check('chase wanted is 5 stars', state.wanted === 5, state.wanted + ' stars');
check('chase helicopter up', state.heli !== null && state.heli.z > 100, state.heli ? 'z=' + Math.round(state.heli.z) : 'no heli');
stepFor(state, 2, ['KeyW']);
const chaseKmh = kmh(state.player.car ? state.player.car.speed : state.player.speed);
check('chase speed high', chaseKmh >= 100, chaseKmh + ' km/h');
const board = dispatchBoard(state);
const labels = board.map((r) => r.label);
check('dispatch labels distinct', new Set(labels).size === labels.length, labels.join(', '));
check('dispatch has AIR ONE', labels.includes('AIR ONE'));
check('chase banner cleared', state.banner === null);

// ---- shop ----
const shopState = createGame(1);
shopState.mode = 'play';
shopState.player.onFoot = true;
shopState.player.car = null;
shopState.player.x = 420;
shopState.player.y = 1560;
stepGame(shopState, 1 / 60, fakeInput([]));
check('shop opens near garage', shopState.shopOpen === true);
const moneyBefore = shopState.money;
const ammoBefore = shopState.ammo;
buyItem(shopState, 0);
check('shop sells ammo', shopState.ammo === ammoBefore + 24 && shopState.money === moneyBefore - 50, 'ammo ' + ammoBefore + '->' + shopState.ammo + ', $' + moneyBefore + '->' + shopState.money);

// ---- end shot (BUSTED math) ----
const endState = createGame(1);
endState.money = 60;
stageShot(endState, 'end');
check('end is BUSTED', endState.end && endState.end.kind === 'busted', endState.end ? endState.end.kind : 'no end');
check('BUSTED kept is 60', endState.end && endState.end.kept === 60, endState.end ? 'kept $' + endState.end.kept : 'no end');
check('BUSTED haul is 0', endState.end && endState.end.haul === 0, endState.end ? 'haul $' + endState.end.haul : 'no end');
check('BUSTED money consistent', endState.end && endState.end.kept + endState.end.haul === 60, 'kept+haul=60');
check('end mode hides HUD (mode=end)', endState.mode === 'end');

// ---- summary ----
console.log('');
if (failed === 0) {
  console.log('SMOKE OK (' + passed + ' checks)');
  process.exit(0);
} else {
  console.log('SMOKE FAIL: ' + failed + ' failed (' + failures.join(', ') + '), ' + passed + ' passed');
  process.exit(1);
}
// Round 9: NEON BAY design pack — 98 designs in game/src/designs*.js + game/designs.html.
// Round 9: viewer at game/designs.html — ?design=<id> for all 98 designs.
