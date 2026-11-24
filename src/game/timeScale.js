// =============================================================================
//  timeScale.js — Hit-stop ve slow-motion kontrolü.
//  Ürettiği "scale" değeri SADECE main.js'teki accumulator'a eklenen süreyi ölçekler.
//  Fizik adımı hep 1/60 kalır; slow-motion = saniyede daha az fizik adımı.
// =============================================================================
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class TimeScale {
  constructor() {
    this.scale = 1;
    this.seq = null;
  }

  /** freezeMs boyunca 0x, slowMs boyunca slowScale, recoverMs içinde yumuşakça 1x. */
  hitStop({ freezeMs, slowScale, slowMs, recoverMs }) {
    this.seq = { t: 0, freeze: freezeMs / 1000, slowScale, slow: slowMs / 1000, recover: recoverMs / 1000 };
    this.scale = 0;
  }

  reset() {
    this.seq = null;
    this.scale = 1;
  }

  /** Gerçek (ölçeklenmemiş) zamanla güncellenir. */
  update(realDt) {
    const s = this.seq;
    if (!s) return;
    s.t += realDt;
    const t = s.t;
    if (t < s.freeze) this.scale = 0;
    else if (t < s.freeze + s.slow) this.scale = s.slowScale;
    else if (t < s.freeze + s.slow + s.recover) {
      const p = (t - s.freeze - s.slow) / s.recover;
      this.scale = s.slowScale + (1 - s.slowScale) * easeInOutQuad(p);
    } else {
      this.reset();
    }
  }
}
