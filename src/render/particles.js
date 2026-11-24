// =============================================================================
//  particles.js — Object pool'lu basit parçacık sistemi.
//  Sprite'lar bir kez oluşturulur, ölünce havuza döner (çöp toplayıcı baskısı yok).
// =============================================================================
import { Container, Sprite } from 'pixi.js';

export class ParticleSystem {
  /**
   * @param parent    Parçacıkların ekleneceği Container
   * @param capacity  Havuz boyutu (dolunca yeni parçacık atlanır)
   */
  constructor(parent, capacity = 1000) {
    this.container = new Container();
    parent.addChild(this.container);
    this.capacity = capacity;
    this.pool = [];
    this.alive = [];
    this.countMul = 1;   // mobil / "efektleri azalt" çarpanı
  }

  /** Bir efektin istediği parçacık sayısını ayarlara göre ölçekler. */
  n(count) {
    return Math.max(1, Math.round(count * this.countMul));
  }

  emit(o) {
    if (this.alive.length >= this.capacity) return null;
    let p = this.pool.pop();
    if (!p) {
      const s = new Sprite(o.tex);
      s.anchor.set(0.5);
      p = { s };
    }
    const s = p.s;
    s.texture = o.tex;
    s.tint = o.tint ?? 0xffffff;
    s.blendMode = o.blend || 'normal';
    s.visible = true;
    s.rotation = o.rot || 0;
    this.container.addChild(s);

    p.x = o.x; p.y = o.y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.life = 0;
    p.maxLife = o.life || 1;
    p.gravity = o.gravity || 0;
    p.drag = o.drag || 0;
    p.s0 = o.scale ?? 1;
    p.s1 = o.scaleEnd ?? p.s0;
    p.a0 = o.alpha ?? 1;
    p.a1 = o.alphaEnd ?? 0;
    p.vr = o.vr || 0;
    p.align = !!o.align;        // kıvılcım: hız yönüne dön ve hızla uza
    p.stretch = o.stretch || 0;
    p.flutter = o.flutter || 0; // konfeti: kendi ekseni etrafında dönme illüzyonu
    p.phase = Math.random() * 6.28;
    p.groundY = o.groundY ?? null;
    p.bounce = o.bounce ?? 0.35;
    p.fadeIn = o.fadeIn || 0;
    p.fadeOut = o.fadeOut || 0;
    this.alive.push(p);
    this.apply(p, 0);
    return p;
  }

  apply(p, t) {
    const s = p.s;
    s.x = p.x;
    s.y = p.y;
    const sc = p.s0 + (p.s1 - p.s0) * t;
    let a = p.a0 + (p.a1 - p.a0) * t;
    if (p.fadeIn > 0 && t < p.fadeIn) a *= t / p.fadeIn;
    if (p.fadeOut > 0 && t > 1 - p.fadeOut) a *= (1 - t) / p.fadeOut;
    s.alpha = a;
    if (p.align) {
      s.rotation = Math.atan2(p.vy, p.vx);
      const sp = Math.hypot(p.vx, p.vy);
      s.scale.set(sc * (1 + sp * p.stretch), sc);
    } else if (p.flutter) {
      s.scale.set(sc * Math.cos(p.phase + p.life * p.flutter), sc);
    } else {
      s.scale.set(sc);
    }
  }

  update(dt) {
    if (dt <= 0) return;
    const alive = this.alive;
    for (let i = alive.length - 1; i >= 0; i--) {
      const p = alive[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.s.visible = false;
        this.container.removeChild(p.s);
        this.pool.push(p);
        alive[i] = alive[alive.length - 1];
        alive.pop();
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.groundY !== null && p.y > p.groundY) {
        p.y = p.groundY;
        p.vy = -Math.abs(p.vy) * p.bounce;
        p.vx *= 0.7;
        p.vr *= 0.6;
      }
      if (!p.align) p.s.rotation += p.vr * dt;
      this.apply(p, p.life / p.maxLife);
    }
  }

  clear() {
    for (const p of this.alive) {
      p.s.visible = false;
      this.container.removeChild(p.s);
      this.pool.push(p);
    }
    this.alive.length = 0;
  }
}
