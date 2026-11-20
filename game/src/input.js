import { HL } from './patchkit.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;
export const ACTION_RETRY = 64;

const B = HL.Input.bind;
const inBind = (a, c) => B[a].includes(c);
const SHIFT = (held) => held.has('ShiftLeft') || held.has('ShiftRight');

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false, lookDX = 0, aiming = false;
  let shoulder = 1; // 1 = right shoulder (player on the left), -1 = swapped

  function press(code) {
    if (inBind('up', code) || inBind('down', code) || inBind('left', code) || inBind('right', code)) held.add(code);
    else if (inBind('confirm', code)) actions |= ACTION_CONFIRM | ACTION_PUNCH;
    else if (inBind('enter', code)) actions |= ACTION_ENTER_CAR;
    else if (inBind('shoot', code)) actions |= ACTION_SHOOT;
    else if (inBind('mute', code)) actions |= ACTION_MUTE;
    else if (inBind('retry', code)) actions |= ACTION_RETRY;
    else if (inBind('shoulder', code)) shoulder = -shoulder;
    else if (inBind('pause', code)) actions |= ACTION_PAUSE;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const before = actions;
    press(e.code);
    if (actions !== before || held.has(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { held.delete(e.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; aiming = false; });
  target.addEventListener('pointermove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (typeof e.movementX === 'number') lookDX += e.movementX;
  });
  target.addEventListener('pointerdown', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (e.button === 2) { aiming = true; return; }
    if (e.button !== 0) return;
    mouseDown = true;
    actions |= ACTION_CONFIRM | ACTION_SHOOT;
    if (target.requestPointerLock) {
      try { target.requestPointerLock(); } catch { /* pointer lock refused: mouse still steers */ }
    }
  });
  target.addEventListener('pointerup', (e) => {
    if (e.button === 2) aiming = false;
    if (e.button === 0) mouseDown = false;
  });
  target.addEventListener('contextmenu', (e) => { e.preventDefault(); });

  const hasB = (action) => B[action].some((code) => held.has(code));

  return {
    move() {
      return {
        x: (hasB('right') ? 1 : 0) - (hasB('left') ? 1 : 0),
        y: (hasB('down') ? 1 : 0) - (hasB('up') ? 1 : 0),
      };
    },
    get handbrake() { return SHIFT(held); },
    get run() { return SHIFT(held); },
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    get aiming() { return aiming; },
    get shoulder() { return shoulder; },
    takeLook() { const d = lookDX; lookDX = 0; return d; },
    takeActions() { const taken = actions; actions = 0; return taken; },
    inject(bit) { actions |= bit; },
  };
}
