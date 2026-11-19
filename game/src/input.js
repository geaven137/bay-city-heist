// NEON BAY — keyboard and mouse input.
// Held keys give movement/steering; one-shot presses (enter car, punch,
// pause, mute) queue as bit flags and are taken once by the loop, so a
// press between two frames is never lost or counted twice. The mouse
// position is kept in screen pixels; the loop converts it to world space
// for aiming.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function press(code) {
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code)) held.add(code);
    else if (CONFIRM.has(code)) actions |= ACTION_CONFIRM | ACTION_PUNCH;
    else if (code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (code === 'KeyF') actions |= ACTION_SHOOT;
    else if (code === 'KeyM') actions |= ACTION_MUTE;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const before = actions;
    press(event.code);
    if (actions !== before || held.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseDown = true;
    actions |= ACTION_CONFIRM | ACTION_SHOOT;
  });
  target.addEventListener('pointerup', () => { mouseDown = false; });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1/0/1 on each axis from the held keys. */
    move() {
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
      };
    },
    get handbrake() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    get run() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
