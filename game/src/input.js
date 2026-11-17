// Keyboard and pointer input. The keeper answers to WASD or the arrow keys, and walks
// toward a held mouse or touch. This module only records what is down and where the
// pointer is (in field coordinates, converted by the callback main supplies); the
// game decides what to do with it.

export class Input {
  /** `toField(clientX, clientY)` converts a pointer position into field coordinates. */
  constructor(canvas, toField) {
    this.canvas = canvas;
    this.toField = toField;
    this.keys = new Set();
    this.pressed = new Set();
    this.pointer = { x: 0, y: 0, down: false, seen: false };
    this.clicks = [];
    this.bound = null;
  }

  attach() {
    const onKeyDown = (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.pressed.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    };
    const onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    const onBlur = () => {
      this.keys.clear();
      this.pointer.down = false;
    };
    const onPointerDown = (event) => {
      const point = this.toField(event.clientX, event.clientY);
      this.pointer.x = point.x;
      this.pointer.y = point.y;
      this.pointer.down = true;
      this.pointer.seen = true;
      this.clicks.push(point);
      this.canvas.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!this.pointer.seen && event.pointerType !== 'mouse') return;
      const point = this.toField(event.clientX, event.clientY);
      this.pointer.x = point.x;
      this.pointer.y = point.y;
      this.pointer.seen = true;
    };
    const onPointerUp = () => {
      this.pointer.down = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.canvas.addEventListener('pointerdown', onPointerDown);
    this.canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    this.bound = { onKeyDown, onKeyUp, onBlur, onPointerDown, onPointerMove, onPointerUp };
  }

  detach() {
    if (this.bound === null) return;
    window.removeEventListener('keydown', this.bound.onKeyDown);
    window.removeEventListener('keyup', this.bound.onKeyUp);
    window.removeEventListener('blur', this.bound.onBlur);
    this.canvas.removeEventListener('pointerdown', this.bound.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.bound.onPointerMove);
    window.removeEventListener('pointerup', this.bound.onPointerUp);
    window.removeEventListener('pointercancel', this.bound.onPointerUp);
    this.bound = null;
  }

  /** The keyboard steering axis: x and y each in -1..1, diagonals normalised. */
  axis() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  /** True once if the key was pressed since the last call; consumes the press. */
  takePressed(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** True once if Enter or Space was pressed since the last call; consumes both. */
  takeConfirm() {
    const enter = this.takePressed('Enter');
    const space = this.takePressed('Space');
    return enter || space;
  }

  /** All click points since the last call, in field coordinates. */
  takeClicks() {
    const clicks = this.clicks;
    this.clicks = [];
    return clicks;
  }
}
