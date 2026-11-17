// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (start, enter car, shoot, pause) are consumed once per press.
export const ACTION = {
  UP: 1,
  DOWN: 2,
  LEFT: 4,
  RIGHT: 8,
  ENTER_CAR: 16,
  SHOOT: 32,
  PAUSE: 64,
  CONFIRM: 128,
  NEW_GAME: 256,
};

const KEY_MAP = {
  KeyW: ACTION.UP,
  ArrowUp: ACTION.UP,
  KeyS: ACTION.DOWN,
  ArrowDown: ACTION.DOWN,
  KeyA: ACTION.LEFT,
  ArrowLeft: ACTION.LEFT,
  KeyD: ACTION.RIGHT,
  ArrowRight: ACTION.RIGHT,
  KeyE: ACTION.ENTER_CAR,
  KeyF: ACTION.ENTER_CAR,
  KeyJ: ACTION.SHOOT,
  Space: ACTION.SHOOT,
  KeyP: ACTION.PAUSE,
  Escape: ACTION.PAUSE,
  Enter: ACTION.CONFIRM,
  KeyN: ACTION.NEW_GAME,
};

export function createInput(canvas) {
  const held = new Set();
  let pressed = 0;
  let mouse = { x: 0, y: 0, down: false };

  function onKeyDown(e) {
    const action = KEY_MAP[e.code];
    if (action === undefined) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed |= action;
    held.add(action);
  }
  function onKeyUp(e) {
    const action = KEY_MAP[e.code];
    if (action !== undefined) held.delete(action);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    pressed |= ACTION.SHOOT;
  }
  function onMouseUp() { mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Held-key bitmask, as ACTION_* flags. */
    heldMask() {
      let mask = 0;
      for (const a of held) mask |= a;
      return mask;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    consumePressed() {
      const p = pressed;
      pressed = 0;
      return p;
    },
    mouse() { return mouse; },
  };
}
