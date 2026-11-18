// Keyboard and pointer input. Held keys give movement and driving; one-shot presses
// (enter car, shoot, punch, pause, mute, help) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_HELP = 32;
export const ACTION_RELOAD = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const HELP = new Set(['KeyH']);
const RELOAD = new Set(['KeyR']);
const SHOOT = new Set(['Space']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    else if (HELP.has(code)) actions |= ACTION_HELP;
    else if (RELOAD.has(code)) actions |= ACTION_RELOAD;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    press(event.code);
    if (SHOOT.has(event.code) || UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  const has = (set) => { for (const code of set) if (held.has(code)) return true; return false; };

  return {
    /** Steering vector -1..1 on each axis, from WASD or arrows. */
    move() {
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
      };
    },
    shootHeld() { return has(SHOOT) || mouseDown; },
    sprintHeld() { return has(SPRINT); },
    mouse() { return { x: mouseX, y: mouseY }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
