// NEON BAY — boot and the one loop.
// Input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints
// what is there. Screens: title, play, paused, WASTED, BUSTED.
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame, loadGame, readBest, recover, saveBest, saveGame, stepGame } from './game.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const renderer = createRenderer(canvas);

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game.state, scene.screen, scene.best, game.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let hasSave = false;
  try { hasSave = !!window.localStorage.getItem('neon-bay.save.v1'); } catch { hasSave = false; }

  function announce(message) {
    status.textContent = message;
  }

  function trackBest() {
    if (game.state.money > best) {
      best = game.state.money;
      saveBest(best);
    }
  }

  function startGame(fresh) {
    if (fresh) {
      const seedNow = Math.floor(Math.random() * 4294967296);
      const next = createGame(seedNow);
      game.state = next.state;
      game.random = next.random;
    } else if (hasSave) {
      loadGame(game.state);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Mara Voss has work at the Marina Safehouse.');
  }

  function buildInput() {
    const move = input.move();
    const p = game.state.player;
    // Third-person aim: the crosshair sits in the middle of the screen,
    // so a shot goes straight where the player faces.
    const aim = p.onFoot ? { x: p.x + Math.cos(p.angle) * 460, y: p.y + Math.sin(p.angle) * 460 } : null;
    return {
      move, run: input.run, handbrake: input.handbrake, aim,
      look: input.takeLook(), aiming: input.aiming, shoulder: input.shoulder,
      actions: 0, // actions are consumed by handleActions; see below
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    // One-shot presses belong to this frame's steps: take them once here.
    let pressed = input.takeActions();
    if (pressed & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (pressed & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE) {
      if (pressed & ACTION_CONFIRM) startGame(false);
      while (accumulator >= STEP) {
        stepGame(game, STEP, { move: { x: 0, y: 0 }, run: false, handbrake: false, aim: null, actions: 0 }, null, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      if (pressed & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
        accumulator = 0;
      } else {
        const base = buildInput();
        while (accumulator >= STEP) {
          stepGame(game, STEP, { ...base, actions: pressed }, null, false);
          pressed = 0;
          accumulator -= STEP;
          if (game.state.wasted || game.state.busted) break;
        }
        // Save on S is handled by the keydown listener below (see saveNow).
        if (game.state.wasted) screen = SCREEN_OVER;
        else if (game.state.busted) screen = SCREEN_BUSTED;
        trackBest();
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      game.state.endTimer += frameDt;
      if ((pressed & ACTION_CONFIRM) && game.state.endTimer > 2) {
        recover(game.state, game.random);
        trackBest();
        screen = SCREEN_PLAY;
        announce('Back on the street.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (pressed & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      accumulator = 0;
    }
    renderer.draw(game.state, screen, best, game.state.time);
  }

  // S saves right now from the pause screen (S is also "drive down",
  // so it must not save while playing).
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyS' && screen === SCREEN_PAUSED) {
      if (saveGame(game.state)) announce('Saved.');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('NEON BAY. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
