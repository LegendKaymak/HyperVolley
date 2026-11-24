// =============================================================================
//  replay.js — Son N saniyenin ring buffer kaydı (her fizik adımında bir kare).
//  Bellek tahsisi yapmamak için kare nesneleri önceden oluşturulur ve üzerine yazılır.
// =============================================================================
import { CONFIG } from '../config.js';

function makeFrame() {
  return {
    blobs: Array.from({ length: 4 }, () => ({ x: 0, y: 0, r: 32, power: false, magnet: false })),   // 2'ye 2 için 4
    ball: { x: 0, y: 0, rot: 0, visible: false, fire: false, slow: false },
  };
}

function copyFrame(dst, src) {
  for (let i = 0; i < 4; i++) Object.assign(dst.blobs[i], src.blobs[i]);
  Object.assign(dst.ball, src.ball);
  return dst;
}

export class ReplayBuffer {
  constructor(seconds = CONFIG.replay.seconds) {
    this.cap = Math.round(seconds / CONFIG.physics.step);
    this.frames = Array.from({ length: this.cap }, makeFrame);
    this.head = 0;   // bir sonraki yazılacak indeks
    this.count = 0;
  }

  clear() {
    this.head = 0;
    this.count = 0;
  }

  record(blobs, ball) {
    const f = this.frames[this.head];
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i], o = f.blobs[i];
      o.x = b.x; o.y = b.y; o.r = b.r;
      o.power = b.fx.power > 0;
      o.magnet = b.fx.magnet > 0;
    }
    f.ball.x = ball.x; f.ball.y = ball.y; f.ball.rot = ball.rot;
    f.ball.visible = ball.visible;
    f.ball.fire = ball.fireTimer > 0;
    f.ball.slow = ball.slowTimer > 0;
    this.head = (this.head + 1) % this.cap;
    this.count = Math.min(this.count + 1, this.cap);
  }

  /** Kronolojik sırada bağımsız bir kopya döndürür (oynatma sırasında kayıt devam edebilir). */
  snapshot() {
    const out = [];
    const start = (this.head - this.count + this.cap) % this.cap;
    for (let i = 0; i < this.count; i++) {
      out.push(copyFrame(makeFrame(), this.frames[(start + i) % this.cap]));
    }
    return out;
  }
}
