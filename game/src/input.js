// NEON BAY — keyboard and mouse input.
// Held keys give movement/steering; one-shot presses (enter car, punch,
// pause, mute) queue as bit flags and are taken once by the loop, so a
// press between two frames is never lost or counted twice. The mouse
// turns the player (mouse-look); the right button aims over the shoulder,
// the left button shoots where the crosshair points, and Q swaps the
// shoulder. The mouse position is kept in screen pixels for menus.
import { HL } from './patchkit.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;
export const ACTION_RETRY = 64;

// Key bindings live in HL.Input.bind (remappable, persisted); these read it.
const B = HL.Input.bind;
const inBind = (a, c) => B[a].includes(c);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let lookDX = 0;
  let aiming = false;
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

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const before = actions;
    press(event.code);
    if (actions !== before || held.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; aiming = false; });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (typeof event.movementX === 'number') lookDX += event.movementX;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (event.button === 2) { aiming = true; return; }
    if (event.button !== 0) return;
    mouseDown = true;
    actions |= ACTION_CONFIRM | ACTION_SHOOT;
    if (target.requestPointerLock) {
      try { target.requestPointerLock(); } catch { /* pointer lock refused: mouse still steers */ }
    }
  });
  target.addEventListener('pointerup', (event) => {
    if (event.button === 2) aiming = false;
    if (event.button === 0) mouseDown = false;
  });
  target.addEventListener('contextmenu', (event) => { event.preventDefault(); });

  function hasB(action) {
    for (const code of B[action]) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1/0/1 on each axis from the held keys. */
    move() {
      return {
        x: (hasB('right') ? 1 : 0) - (hasB('left') ? 1 : 0),
        y: (hasB('down') ? 1 : 0) - (hasB('up') ? 1 : 0),
      };
    },
    get handbrake() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    get run() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    /** Right mouse button held: aiming over the shoulder. */
    get aiming() { return aiming; },
    /** 1 or -1: which shoulder the camera sits over. */
    get shoulder() { return shoulder; },
    /** Mouse-look pixels since the last call (resets). */
    takeLook() {
      const d = lookDX;
      lookDX = 0;
      return d;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queue an action bit from outside (touch buttons, gamepad). */
    inject(bit) { actions |= bit; },
  };
}
