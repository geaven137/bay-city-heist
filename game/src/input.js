// Neon Bay — keyboard and mouse input.
// Keeps a small live table of keys and the mouse so the game
// loop can ask "is this held?" without touching the DOM itself.
// Safe to import in Node: nothing touches window/document until
// attach() is called, and only in a browser.

export function createInput() {
  return {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    rightDown: false,
    clicked: false,
    attached: false,
  };
}

export function attachInput(input, target) {
  if (input.attached || typeof window === 'undefined') return input;
  const el = target || window;
  el.addEventListener('keydown', (ev) => {
    input.keys.add(ev.code);
    if (ev.code === 'Space') ev.preventDefault();
  });
  el.addEventListener('keyup', (ev) => {
    input.keys.delete(ev.code);
  });
  el.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
    input.rightDown = false;
  });
  window.addEventListener('mousemove', (ev) => {
    input.mouseX = ev.clientX;
    input.mouseY = ev.clientY;
  });
  window.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
    if (ev.button === 2) input.rightDown = true;
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) input.mouseDown = false;
    if (ev.button === 2) input.rightDown = false;
  });
  window.addEventListener('contextmenu', (ev) => ev.preventDefault());
  input.attached = true;
  return input;
}

export function keyHeld(input, codes) {
  for (const c of codes) {
    if (input.keys.has(c)) return true;
  }
  return false;
}

export function keyPressed(input, codes) {
  for (const c of codes) {
    if (input.keys.has(c)) {
      input.keys.delete(c);
      return true;
    }
  }
  return false;
}

export function consumeClick(input) {
  const was = input.clicked;
  input.clicked = false;
  return was;
}
