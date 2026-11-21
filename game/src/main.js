// Neon Bay — browser entry point.
// Builds the game from a seed, wires the canvases, and runs the
// loop. With ?shot=<start|play|chase|end>&seed=1 it stages that
// screenshot and holds it; otherwise it opens on the title
// screen and starts on Space or a click.

import { createGame, stepGame } from './game.js';
import { createStage, buildSceneMeshes, drawFrame, resizeStage } from './render.js';
import { drawHud } from './hud.js';
import { stageShot } from './shots.js';
import { createInput, attachInput, consumeClick } from './input.js';
import { createAudio, startAudio } from './audio.js';
import { loadGame, saveGame } from './patchkit.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;

const gameCanvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const state = createGame(seed);
const input = createInput();
attachInput(input, window);
state.input = input;
const audio = createAudio();
state.audio = audio;
loadGame(state);

const stage = createStage(gameCanvas);
buildSceneMeshes(stage, state);
const hudCtx = hudCanvas.getContext('2d');

function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  gameCanvas.width = w;
  gameCanvas.height = h;
  hudCanvas.width = w;
  hudCanvas.height = h;
  resizeStage(stage, w, h);
}
window.addEventListener('resize', fit);
fit();

if (shotName) {
  stageShot(state, shotName);
} else {
  state.mode = 'title';
}

let last = performance.now();
let started = false;

function begin() {
  if (started) return;
  started = true;
  startAudio(audio);
  state.mode = 'play';
  saveGame(state);
}

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' && (state.mode === 'title' || state.mode === 'end')) {
    if (state.mode === 'end') {
      const keepMoney = state.money;
      const keepRep = state.rep;
      const keepJobs = state.jobsDone;
      const fresh = createGame(state.seed);
      fresh.money = keepMoney;
      fresh.rep = keepRep;
      fresh.jobsDone = keepJobs;
      Object.assign(state, fresh);
      state.input = input;
      state.audio = audio;
      buildSceneMeshes(stage, state);
    }
    begin();
  }
  if (ev.code === 'KeyP' && state.mode === 'play') {
    state.paused = !state.paused;
  }
});
window.addEventListener('mousedown', () => {
  if (state.mode === 'title' || state.mode === 'end') {
    if (state.mode === 'end') {
      const keepMoney = state.money;
      const fresh = createGame(state.seed);
      fresh.money = keepMoney;
      Object.assign(state, fresh);
      state.input = input;
      state.audio = audio;
      buildSceneMeshes(stage, state);
    }
    begin();
  }
});

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.paused) {
    if (shotName) {
      // Hold the staged shot: step gently so the scene lives
      // (traffic, heli, water) without driving off the beach.
      stepGame(state, Math.min(dt, 0.016), input);
      if (state.player.car && state.mode === 'play') {
        state.player.car.speed = Math.max(0, state.player.car.speed);
      }
    } else {
      stepGame(state, dt, input);
    }
    consumeClick(input);
  }
  drawFrame(stage, state, dt);
  drawHud(hudCtx, state, hudCanvas.width, hudCanvas.height);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
// Round 9: NEON BAY design pack integration point (see src/designs.js).
if (typeof window !== 'undefined') { (window.__NEON_POINTS__ = window.__NEON_POINTS__ || []).push('main.js'); }
