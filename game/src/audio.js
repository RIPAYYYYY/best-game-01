// All of Gloamgarden's sound is synthesised with the Web Audio API: no audio files, no
// network, just small oscillator voices shaped by hand. The context is created lazily on
// the first user gesture (browsers refuse it sooner), and every call is safe to make
// before that: it simply stays silent.

export class SoundFX {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.lastZapAt = 0;
    this.pickupRung = 0;
    this.lastPickupAt = 0;
  }

  /** Create the context on a user gesture and wake it if the browser suspended it. */
  unlock() {
    try {
      if (this.context === null) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        this.context = new AudioCtor();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.42;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      this.context = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master !== null && this.context !== null) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.42, this.context.currentTime);
    }
  }

  /** One shaped oscillator voice: a pitch glide and a gain envelope, then gone. */
  tone({ type = 'sine', from = 440, to = null, seconds = 0.12, volume = 0.5, delay = 0 }) {
    if (this.context === null || this.master === null || this.muted) return;
    try {
      const start = this.context.currentTime + delay;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + seconds);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    } catch {
      // A failed voice is a silent one; the game never depends on sound.
    }
  }

  /** A wisp searing a gloom. Throttled: a busy orbit would otherwise buzz without pause. */
  zap() {
    const now = performance.now();
    if (now - this.lastZapAt < 45) return;
    this.lastZapAt = now;
    this.tone({ type: 'square', from: 920, to: 240, seconds: 0.06, volume: 0.16 });
  }

  /** A mote gathered. Consecutive pickups climb a little ladder of pitches. */
  pickup() {
    const now = performance.now();
    this.pickupRung = now - this.lastPickupAt < 350 ? Math.min(this.pickupRung + 1, 11) : 0;
    this.lastPickupAt = now;
    const pitch = 620 * Math.pow(2, this.pickupRung / 12);
    this.tone({ type: 'sine', from: pitch, to: pitch * 1.5, seconds: 0.09, volume: 0.22 });
  }

  /** A gloom bursting into sparks. */
  pop() {
    this.tone({ type: 'triangle', from: 340, to: 70, seconds: 0.14, volume: 0.3 });
  }

  /** The keeper is bitten: a low thud with a sawtooth edge. */
  hurt() {
    this.tone({ type: 'sawtooth', from: 170, to: 55, seconds: 0.2, volume: 0.4 });
    this.tone({ type: 'sine', from: 90, to: 40, seconds: 0.22, volume: 0.4 });
  }

  /** The ember nova going off: a deep swell that falls away. */
  nova() {
    this.tone({ type: 'sine', from: 420, to: 38, seconds: 0.4, volume: 0.55 });
    this.tone({ type: 'triangle', from: 840, to: 120, seconds: 0.25, volume: 0.2 });
  }

  /** A level reached: four rising notes. */
  levelup() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((pitch, index) => {
      this.tone({ type: 'sine', from: pitch, seconds: 0.16, volume: 0.26, delay: index * 0.07 });
    });
  }

  /** An upgrade card chosen: a warm confirm. */
  choose() {
    this.tone({ type: 'triangle', from: 392, seconds: 0.1, volume: 0.25 });
    this.tone({ type: 'triangle', from: 587, seconds: 0.14, volume: 0.25, delay: 0.06 });
  }

  /** A menu click. */
  ui() {
    this.tone({ type: 'sine', from: 1180, to: 900, seconds: 0.05, volume: 0.18 });
  }

  /** The Maw rising: two low pulses. */
  boss() {
    this.tone({ type: 'sawtooth', from: 65, seconds: 0.5, volume: 0.4 });
    this.tone({ type: 'sawtooth', from: 49, seconds: 0.7, volume: 0.4, delay: 0.3 });
  }

  /** The light goes out: a slow minor fall. */
  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((pitch, index) => {
      this.tone({ type: 'triangle', from: pitch, seconds: 0.3, volume: 0.3, delay: index * 0.16 });
    });
  }

  /** Dawn: a bright rising figure. */
  dawn() {
    const notes = [262, 330, 392, 523, 659, 784];
    notes.forEach((pitch, index) => {
      this.tone({ type: 'sine', from: pitch, seconds: 0.24, volume: 0.26, delay: index * 0.09 });
    });
  }
}
