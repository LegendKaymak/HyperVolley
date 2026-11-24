// =============================================================================
//  tween.js — Küçük tween / timeline yardımcısı (dış kütüphane yok).
// =============================================================================

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

export const Ease = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

/**
 * Tweener: süre (saniye) boyunca 0→1 ilerleme üretir ve onUpdate(e) çağırır (e = ease(t)).
 *   tweener.add({ dur: 0.3, delay: 0.1, ease: Ease.easeOutBack, onUpdate: (e) => ..., onComplete })
 */
export class Tweener {
  constructor() {
    this.list = [];
  }

  add({ dur, delay = 0, ease = Ease.linear, onStart, onUpdate, onComplete }) {
    const tw = { dur: Math.max(1e-4, dur), delay, ease, onStart, onUpdate, onComplete, t: 0, started: false, dead: false };
    tw.cancel = () => { tw.dead = true; };
    this.list.push(tw);
    return tw;
  }

  update(dt) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const tw = list[i];
      if (tw.dead) continue;
      let step = dt;
      if (tw.delay > 0) {
        tw.delay -= dt;
        if (tw.delay > 0) continue;
        step = -tw.delay; // gecikmeden taşan süre
        tw.delay = 0;
      }
      if (!tw.started) { tw.started = true; tw.onStart?.(); }
      tw.t += step;
      const p = clamp01(tw.t / tw.dur);
      tw.onUpdate?.(tw.ease(p), p);
      if (p >= 1) { tw.dead = true; tw.onComplete?.(); }
    }
    if (list.some((t) => t.dead)) this.list = list.filter((t) => !t.dead);
  }

  clear() {
    this.list.length = 0;
  }
}

/**
 * Timeline: belirli milisaniyelerde fonksiyon çağırır.
 *   const tl = new Timeline(); tl.at(0, boom).at(300, showText); tl.update(dt)
 */
export class Timeline {
  constructor() {
    this.t = 0;
    this.events = [];
    this.done = false;
  }

  at(ms, fn) {
    this.events.push({ ms, fn, fired: false });
    this.events.sort((a, b) => a.ms - b.ms);
    this.done = false;
    return this;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt * 1000;
    let all = true;
    for (const e of this.events) {
      if (!e.fired && e.ms <= this.t) { e.fired = true; e.fn(); }
      if (!e.fired) all = false;
    }
    this.done = all;
  }

  stop() {
    this.done = true;
    this.events.length = 0;
  }
}
