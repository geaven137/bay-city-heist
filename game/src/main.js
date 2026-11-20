// NEON BAY — boot and the one loop.
// Input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints
// what is there. Screens: title, play, paused, WASTED, BUSTED.
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame, loadGame, readBest, recover, saveBest, saveGame, stepGame } from './game.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RETRY, createInput } from './input.js';
import { createAudio } from './audio.js';
import { HL } from './patchkit.js';
import { startMission } from './missions.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const status = document.getElementById('status');
const game = createGame(seed);
const renderer = createRenderer(canvas, hudCanvas);
const ctx2d = hudCanvas.getContext('2d');

function runShot(name) {
  game.state._hlShot = true; // scripted demo: no roadblocks, so the frames stay comparable
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
  const input = createInput(hudCanvas);
  const audio = createAudio();
  HL.boot({ canvas: hudCanvas, input, unlockAudio: () => audio.unlock(), setQuality: (l) => renderer.setQuality(l), announce });
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let autoT = 0;
  let hasSave = HL.Save.exists();

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

  let pendingLook = 0;
  function buildInput(pad) {
    pendingLook += input.takeLook() + (pad ? pad.look : 0);
    const move = input.move();
    const tm = HL.Input.touchMove();
    const mx = Math.max(-1, Math.min(1, move.x + tm.x + (pad ? pad.move.x : 0)));
    const my = Math.max(-1, Math.min(1, move.y + tm.y + (pad ? pad.move.y : 0)));
    const p = game.state.player;
    const aim = p.onFoot ? { x: p.x + Math.cos(p.angle) * 460, y: p.y + Math.sin(p.angle) * 460 } : null;
    return {
      move: { x: mx, y: my }, run: input.run, handbrake: input.handbrake, aim,
      look: pendingLook, aiming: input.aiming || HL.Input.touch.aim || (pad ? pad.aiming : false), shoulder: input.shoulder,
      actions: 0, // actions are consumed by handleActions; see below
    };
  }

  HL.loop((frameDt) => {
    accumulator += frameDt;
    HL.Perf.frame(frameDt);
    let pressed = input.takeActions();
    const pad = HL.Input.poll();
    pressed |= pad.actions;
    autoT += frameDt;
    if (screen === SCREEN_PLAY && autoT > 30) { autoT = 0; saveGame(game.state); }
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
        if ((pressed & ACTION_RETRY) && game.state._hlRetry && HL.Missions.retry(game.state, game.random, startMission)) announce('Retrying the job from the checkpoint.');
        const base = buildInput(pad);
        let look = base.look;
        while (accumulator >= STEP) {
          stepGame(game, STEP, { ...base, look, actions: pressed }, null, false);
          look = 0;
          pressed = 0;
          accumulator -= STEP;
          if (game.state.wasted || game.state.busted) break;
        }
        pendingLook = look; // unconsumed look (no step this frame) carries over
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
    HL.Input.drawTouch(ctx2d);
  });

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
}

if (shot) runShot(shot);
else runGame();
