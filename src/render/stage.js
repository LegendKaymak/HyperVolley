// =============================================================================
//  stage.js — Sahne: katmanlar, arka plan (gökyüzü/deniz/kum/bulutlar), blob ve
//  top görünümleri, iz, kamera (shake/zoom), Pixi filtreleri (RGB ayrışma, bloom).
//  Her şey Pixi Graphics ile kodla çizilir.
// =============================================================================
import { Container, Graphics, Sprite, Rectangle } from 'pixi.js';
import { RGBSplitFilter, AdvancedBloomFilter } from 'pixi-filters';
import { CONFIG } from '../config.js';
import { ParticleSystem } from './particles.js';

const W = CONFIG.world;
const lerpColor = (a, b, t) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
};
const rand = (a, b) => a + Math.random() * (b - a);
// pixi-filters sürümleri arasında farklı API'lere dayanıklı nokta ayarlayıcı
function setPoint(f, name, x, y) {
  if (`${name}X` in f) { f[`${name}X`] = x; f[`${name}Y`] = y; } else f[name] = { x, y };
}

// -----------------------------------------------------------------------------
//  BLOB GÖRÜNÜMÜ
// -----------------------------------------------------------------------------
class BlobView {
  constructor(team, textures) {
    this.team = CONFIG.teams[team];
    this.teamIndex = team;
    this.look = null;                    // 2'ye 2 takım arkadaşı: kendi karakterinin renkleri
    this.root = new Container();         // orijin = gövde tabanının ortası
    this.aura = new Sprite(textures.glow);
    this.aura.anchor.set(0.5);
    this.aura.blendMode = 'add';
    this.aura.alpha = 0;
    this.magnetRing = new Graphics();
    this.body = new Graphics();
    this.eyes = new Graphics();
    this.root.addChild(this.aura, this.magnetRing, this.body, this.eyes);
    this.shadow = new Graphics().ellipse(0, 0, 32, 9).fill({ color: 0x000000, alpha: 0.22 });
    this.drawnR = 0;
    // Squash & stretch yayı: s>0 uzama, s<0 basılma
    this.s = 0; this.sv = 0;
    this.blinkT = rand(1.5, 4);
    this.walk = 0; this.walkPhase = 0; this.lean = 0; this.stepped = false;
    this.blink = 0;
    this.lastY = W.groundY;
    this.time = Math.random() * 10;
  }

  impulse(a) {
    this.sv += a;
  }

  /**
   * Blobby Volley tarzı parlak gövde: gövde + baş daireleri ve aradaki boyun.
   * Gölgeli kenar → ana renk → açık iç ton → speküler parlamalar katman katman çizilir.
   */
  /** Takım rengi yerine özel renkler (null → takım rengi). */
  setLook(colors) {
    this.look = colors;
    this.drawnR = 0;   // bir sonraki karede yeniden çiz
  }

  drawBody(R) {
    const c = this.look || this.team;
    const B = CONFIG.blob;
    const g = this.body.clear();
    const shape = (k, ox, oy, fill) => {
      g.circle(ox, -B.bodyY * R + oy, B.bodyR * R * k).fill(fill);
      g.circle(ox, -B.headY * R + oy, B.headR * R * k).fill(fill);
      g.rect(ox - B.headR * R * k * 0.92, -B.headY * R + oy, B.headR * R * k * 1.84, (B.headY - B.bodyY) * R).fill(fill);
    };
    shape(1, 0, 0, c.dark);
    shape(0.9, -R * 0.05, -R * 0.05, c.color);
    shape(0.6, -R * 0.17, -R * 0.15, { color: c.light, alpha: 0.32 });
    g.ellipse(-R * 0.26, -B.headY * R - R * 0.28, R * 0.2, R * 0.12).fill({ color: 0xffffff, alpha: 0.8 });
    g.ellipse(-R * 0.42, -B.bodyY * R - R * 0.3, R * 0.17, R * 0.3).fill({ color: 0xffffff, alpha: 0.32 });
    this.aura.scale.set((R * 3.6) / 128);
    this.aura.y = -R * 1.2;
    // Gözler ve mıknatıs halkası boyut değişince BİR KEZ çizilir; her karede sadece
    // kaydırılır/ölçeklenir (her karede yeniden çizmek zayıf cihazlarda pahalı).
    const ey = -B.headY * R - R * 0.04;
    const e = this.eyes.clear();
    for (const side of [-1, 1]) e.ellipse(side * R * 0.22, 0, R * 0.075, R * 0.14).fill({ color: 0x0d0f14, alpha: 0.9 });
    this.eyeY = ey;
    const rr = CONFIG.abilities.miknatis.radius;
    this.magnetRing.clear()
      .circle(0, 0, rr).stroke({ width: 2, color: 0xb388ff, alpha: 0.35 })
      .circle(0, 0, rr * 0.6).stroke({ width: 1.5, color: 0xb388ff, alpha: 0.2 });
    this.magnetRing.y = -R * 1.6;
    this.drawnR = R;
  }

  /** @param s {x,y,r,power,magnet,grounded} @param ball {x,y,visible} */
  /** @param vx yatay hız (px/sn) — yürüme sallanması için */
  sync(s, ball, realDt, vy, vx = 0) {
    const R = s.r;
    if (Math.abs(R - this.drawnR) > 0.01) this.drawBody(R);
    this.time += realDt;

    // Squash & stretch: yay + yükselme hızına bağlı uzama
    const k = 340, damp = 15;
    this.sv += (-k * this.s - damp * this.sv) * realDt;
    this.s += this.sv * realDt;
    const velStretch = s.y < W.groundY - 0.5 ? Math.max(-0.1, Math.min(0.16, -vy / 3800)) : 0;
    let st = Math.max(-0.35, Math.min(0.35, this.s + velStretch));

    // Yürüme (Blobby Volley'deki gibi): yerde yürürken ritmik zıplar gibi esneme,
    // hareket yönüne hafif eğilme ve küçük bir sekme. Hız arttıkça adım hızlanır.
    const onGround = s.y >= W.groundY - 0.5;
    const speed = Math.abs(vx);
    const walkTarget = onGround && speed > 30 ? Math.min(1, speed / 300) : 0;
    this.walk += (walkTarget - this.walk) * Math.min(1, realDt * 12);
    if (this.walk > 0.01) this.walkPhase += realDt * (10 + speed * 0.02);
    const wave = Math.sin(this.walkPhase);
    st += wave * 0.07 * this.walk;
    const bob = Math.abs(Math.sin(this.walkPhase)) * 3 * this.walk;
    const leanTarget = onGround ? Math.max(-1, Math.min(1, vx / 300)) * 0.09 : 0;
    this.lean += (leanTarget - this.lean) * Math.min(1, realDt * 10);
    this.stepped = this.walk > 0.3 && Math.sign(wave) !== Math.sign(this.lastWave || 0);
    this.lastWave = wave;

    this.root.scale.set(1 - st * 0.7, 1 + st);
    this.root.rotation = this.lean;
    this.root.position.set(s.x, s.y - bob);

    // Gölge: yükseldikçe küçülür ve soluklaşır
    const h = Math.max(0, W.groundY - s.y);
    const f = Math.max(0.35, 1 - h / 260);
    this.shadow.position.set(s.x, W.groundY + 2);
    this.shadow.scale.set((R / 32) * 1.05 * f);
    this.shadow.alpha = f;

    // Aura (Güç Vuruşu hazır)
    const targetAura = s.power || s.spin || s.superArmed ? 0.55 + Math.sin(this.time * 22) * 0.15 : 0;
    this.aura.alpha += (targetAura - this.aura.alpha) * Math.min(1, realDt * 12);
    this.aura.tint = s.superArmed ? 0xffd23f : s.spin ? 0xb070ff : 0xff6a00;   // Hyper sürerken: altın parıltı

    // Mıknatıs halkası
    this.magnetRing.visible = !!s.magnet;
    if (s.magnet) this.magnetRing.scale.set(0.92 + Math.sin(this.time * 9) * 0.05);

    // Göz kırpma
    this.blinkT -= realDt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = rand(2, 5); }
    this.blink = Math.max(0, this.blink - realDt);
    const lid = this.blink > 0 ? 0.15 : 1;

    // Sade, koyu gözler; topa doğru hafifçe kayar
    const B = CONFIG.blob;
    let dx = 0, dy = 0;
    if (ball.visible) {
      dx = ball.x - s.x;
      dy = ball.y - (s.y - B.headY * R);
      const d = Math.hypot(dx, dy) || 1;
      dx = (dx / d) * R * 0.07; dy = (dy / d) * R * 0.06;
    }
    this.eyes.position.set(dx, this.eyeY + dy);
    this.eyes.scale.y = lid;
  }
}

// -----------------------------------------------------------------------------
//  TOP GÖRÜNÜMÜ (plaj topu)
// -----------------------------------------------------------------------------
class BallView {
  constructor(textures) {
    const r = CONFIG.ball.radius;
    this.root = new Container();
    this.glow = new Sprite(textures.glow);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.alpha = 0;
    this.glow.scale.set((r * 5) / 128);
    // Yavaş Zaman halkası bir kez çizilir; etkinken sadece görünür olur ve nabız gibi ölçeklenir
    this.slowRing = new Graphics()
      .circle(0, 0, r + 6).stroke({ width: 3, color: 0x7fd8ff, alpha: 0.75 })
      .circle(0, 0, r + 13).stroke({ width: 1.5, color: 0x7fd8ff, alpha: 0.35 });
    this.slowRing.visible = false;
    // Voleybol topu: beyaz gövde + dönen dikiş çizgileri + sabit gölge/parlama
    this.spin = new Graphics();
    this.spin.circle(0, 0, r).fill(0xf6f6f2);
    const seam = (a, D, Rc) => {
      const cx = Math.cos(a) * D * r, cy = Math.sin(a) * D * r, rc = Rc * r;
      const phi = Math.acos((D * D + Rc * Rc - 1) / (2 * D * Rc));
      const s0 = a + Math.PI - phi;
      this.spin.moveTo(cx + Math.cos(s0) * rc, cy + Math.sin(s0) * rc)
        .arc(cx, cy, rc, s0, a + Math.PI + phi).stroke({ width: 1.6, color: 0x9aa1aa });
    };
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      seam(a, 1.5, 1.15);
      seam(a, 1.95, 1.6);
    }
    this.shine = new Graphics()
      .circle(0, 0, r).fill({ color: 0x1b2230, alpha: 0.2 })
      .circle(-r * 0.1, -r * 0.1, r * 0.88).fill({ color: 0xffffff, alpha: 0.2 })
      .ellipse(-r * 0.34, -r * 0.4, r * 0.3, r * 0.17).fill({ color: 0xffffff, alpha: 0.85 })
      .circle(0, 0, r).stroke({ width: 1.5, color: 0x5f6670 });
    this.root.addChild(this.glow, this.slowRing, this.spin, this.shine);
    const r0 = CONFIG.ball.radius;
    this.heavyRing = new Graphics();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      this.heavyRing.moveTo(Math.cos(a) * (r0 + 4), Math.sin(a) * (r0 + 4)).arc(0, 0, r0 + 4, a, a + 0.6).stroke({ width: 3, color: 0x2a2e38, alpha: 0.9 });
    }
    this.heavyRing.visible = false;
    this.shadow = new Graphics().ellipse(0, 0, CONFIG.ball.radius, CONFIG.ball.radius * 0.3).fill({ color: 0x000000, alpha: 0.22 });
    this.pop = 1;       // doğma animasyonu ölçeği (goalExplosion ayarlar)
    this.time = 0;
  }

  sync(s, realDt) {
    this.time += realDt;
    const show = s.visible;
    this.root.visible = show;
    this.shadow.visible = show;
    if (!show) return;
    this.root.position.set(s.x, s.y);
    this.root.scale.set(this.pop * ((s.r || CONFIG.ball.radius) / CONFIG.ball.radius));   // Parti: Dev / Mini Top
    const fogA = s.fog ? 0.07 : 1;
    this.root.alpha += (fogA - this.root.alpha) * Math.min(1, realDt * 14);
    this.shadow.alpha *= this.root.alpha;
    this.spin.rotation = s.rot;
    const h = Math.max(0, W.groundY - s.y);
    const f = Math.max(0.25, 1 - h / 320);
    this.shadow.position.set(s.x, W.groundY + 2);
    this.shadow.scale.set(f);
    this.shadow.alpha = f;

    const targetGlow = s.fire ? 0.9 : 0;
    this.glow.alpha += (targetGlow - this.glow.alpha) * Math.min(1, realDt * 10);
    this.glow.tint = s.super ? 0xffd23f : 0xff7b1c;

    this.slowRing.visible = !!s.slow;
    if (s.slow) this.slowRing.scale.set(1 + (Math.sin(this.time * 10) * 2) / (CONFIG.ball.radius + 6));
  }
}

// -----------------------------------------------------------------------------
//  SAHNE
// -----------------------------------------------------------------------------
export class Stage {
  constructor(app, textures, opts = {}) {
    this.app = app;
    this.textures = textures;
    this.lowFx = false;
    this.time = 0;

    // Katman yapısı:
    //  fxRoot (filtreler, dönüşümsüz)  └ world (kamera: shake + zoom)
    //  hud  (skor, cooldown)  ui (yazılar, konfeti/havai fişek)  flash (beyaz flaş)
    this.fxRoot = new Container();
    this.fxRoot.filterArea = new Rectangle(0, 0, CONFIG.width, CONFIG.height);
    this.world = new Container();
    this.fxRoot.addChild(this.world);
    this.hud = new Container();
    this.ui = new Container();
    this.flash = new Graphics().rect(-20, -20, CONFIG.width + 40, CONFIG.height + 40).fill(0xffffff);
    this.flash.alpha = 0;
    this.flash.eventMode = 'none';
    app.stage.addChild(this.fxRoot, this.hud, this.ui, this.flash);

    this.cam = { zoom: 1, fx: 400, fy: 300, trauma: 0, shakeMul: 1, ca: 0, bloom: 0 };

    this.bgRoot = new Container();
    this.world.addChild(this.bgRoot);
    this.arena = null;
    this.setArena(opts.arena || 'plaj');
    this.snowT = 0;

    // Dünya katmanları (arka plandan öne)
    this.groundGlow = new Sprite(textures.glow);
    this.groundGlow.anchor.set(0.5);
    this.groundGlow.blendMode = 'add';
    this.groundGlow.alpha = 0;
    this.shadowLayer = new Container();
    this.netG = new Graphics();
    this.drawNet();
    // Top izi: önceden oluşturulmuş sprite havuzu (her karede Graphics çizmek yerine
    // sadece konum/ölçek/saydamlık güncellenir → tek draw call, tessellation yok)
    this.trail = new Container();
    this.trailSprites = [];
    for (let i = 0; i < CONFIG.effects.trailLength; i++) {
      const sp = new Sprite(textures.dot);
      sp.anchor.set(0.5);
      sp.visible = false;
      this.trail.addChild(sp);
      this.trailSprites.push(sp);
    }
    this.entityLayer = new Container();
    this.fxLayer = new Container();        // şok dalgaları vb.
    this.shieldG = new Graphics();
    this.shieldG.blendMode = 'add';
    this.pathG = new Graphics();   // Hyper Kehanet yol çizgisi
    this.world.addChild(this.groundGlow, this.shieldG, this.shadowLayer, this.netG, this.trail, this.pathG, this.entityLayer, this.fxLayer);

    // 0, 1: ana oyuncular; 2, 3: 2'ye 2'de takım arkadaşları (sol, sağ)
    this.blobViews = [new BlobView(0, textures), new BlobView(1, textures), new BlobView(0, textures), new BlobView(1, textures)];
    this.ballView = new BallView(textures);
    for (const v of this.blobViews) { this.shadowLayer.addChild(v.shadow); this.entityLayer.addChild(v.root); }
    this.shadowLayer.addChild(this.ballView.shadow);
    this.entityLayer.addChild(this.ballView.root, this.ballView.heavyRing);
    // Hayal Top: gerçeğinden ayırt edilemeyen sahte toplar (en fazla 4)
    this.decoyViews = [0, 1, 2, 3].map(() => {
      const v = new BallView(textures);
      this.shadowLayer.addChild(v.shadow);
      this.entityLayer.addChild(v.root);
      v.root.visible = v.shadow.visible = false;
      return v;
    });

    // Parçacık sistemleri: dünya (slow-motion'dan etkilenir) ve arayüz (gerçek zaman)
    const cap = CONFIG.effects.particleCapacity;
    this.particles = new ParticleSystem(this.world, cap);
    this.uiParticles = new ParticleSystem(this.ui, Math.round(cap / 2));
    this.fxTop = new Container();            // patlama çekirdeği (parçacıkların üstünde)
    this.world.addChild(this.fxTop);

    this.trailPts = [];
    this.trailShown = 0;
    this.trailK = 0;
    this.prevBlobY = [W.groundY, W.groundY, W.groundY, W.groundY];
    this.prevBlobX = [200, 600, 120, 680];

    // Filtreler (efektleri azalt açıkken hiç kullanılmaz)
    this.rgb = null;
    this.bloom = null;
    try {
      this.rgb = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
    } catch (e) { console.warn('RGBSplitFilter kullanılamadı', e); }
    try {
      this.bloom = new AdvancedBloomFilter({ threshold: 0.7, bloomScale: 0, brightness: 1, blur: 6, quality: 4 });
    } catch (e) { console.warn('AdvancedBloomFilter kullanılamadı', e); }
    this.filtersOn = false;
    this.filtersAllowed = true;
    this.quality = CONFIG.effects.quality.yuksek;
  }

  // ---------------------------------------------------------------- arka plan
  /** Arena değiştir: arka plan katmanı baştan çizilir (fizik etkilenmez). */
  setArena(id) {
    const arena = CONFIG.arenas.find((a) => a.id === id) || CONFIG.arenas[0];
    if (this.arena === arena) return;
    this.arena = arena;
    this.bgRoot.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.buildBackground(arena);
  }

  buildBackground(A = this.arena) {
    const bg = this.bgRoot;
    const horizon = 300;
    const groundTop = A.water ? W.sandTopY : A.backdrop === 'hall' ? 352 : 340;
    this.groundTop = groundTop;

    // Gökyüzü / arka duvar: dikey gradyan (şeritlerle)
    this.far = new Container();
    const sky = new Graphics();
    const top = -150, bottom = A.water ? horizon : groundTop, N = 40;
    for (let i = 0; i < N; i++) {
      const y0 = top + ((bottom - top) * i) / N;
      sky.rect(-150, y0, CONFIG.width + 300, (bottom - top) / N + 1).fill(lerpColor(A.sky[0], A.sky[1], Math.pow(i / (N - 1), 1.3)));
    }
    this.far.addChild(sky);

    if (A.sun) {
      const glow = new Sprite(this.textures.glow);
      glow.anchor.set(0.5); glow.blendMode = 'add'; glow.tint = A.sun.glow; glow.alpha = 0.85;
      glow.position.set(A.sun.x, A.sun.y); glow.scale.set(A.sun.r / 22); glow.alpha = 0.6;
      this.far.addChild(glow, new Graphics().circle(A.sun.x, A.sun.y, A.sun.r).fill(A.sun.color));
    }

    const deco = new Graphics();
    if (A.backdrop === 'islands') {
      deco.ellipse(110, horizon + 2, 120, 26).fill(A.far[0]);
      deco.ellipse(190, horizon + 4, 80, 18).fill(A.far[1]);
      deco.ellipse(700, horizon + 3, 140, 22).fill(A.far[0]);
      deco.ellipse(590, horizon + 5, 60, 12).fill(A.far[1]);
      const palm = (x, y, k) => {
        deco.moveTo(x, y).quadraticCurveTo(x + 4 * k, y - 14 * k, x + 2 * k, y - 26 * k).stroke({ width: 2.2 * k, color: A.palms });
        for (const a of [-2.6, -2.0, -1.2, -0.5, 0.1]) {
          deco.moveTo(x + 2 * k, y - 26 * k)
            .quadraticCurveTo(x + 2 * k + Math.cos(a) * 8 * k, y - 30 * k + Math.sin(a) * 4 * k, x + 2 * k + Math.cos(a) * 14 * k, y - 24 * k + Math.sin(a) * 9 * k)
            .stroke({ width: 2.5 * k, color: A.palms });
        }
      };
      palm(95, 284, 1); palm(125, 286, 0.8); palm(720, 288, 0.9);
    } else if (A.backdrop === 'mountains') {
      // İki sıra dağ: uzaktaki soluk, yakındaki daha koyu; tepeleri karlı
      const range = (pts, color, capColor) => {
        deco.poly([-150, groundTop, ...pts.flat(), 950, groundTop]).fill(color);
        for (const [x, y] of pts) {
          if (y > groundTop - 90) continue;
          deco.poly([x, y, x + 26, y + 30, x + 10, y + 24, x, y + 34, x - 12, y + 26, x - 26, y + 30]).fill(capColor);
        }
      };
      range([[-80, 190], [60, 120], [190, 210], [330, 140], [470, 220], [600, 110], [760, 200], [900, 150]], A.far[0], 0xf4f9ff);
      range([[-60, 270], [80, 215], [230, 280], [380, 230], [520, 285], [660, 205], [820, 275]], A.far[1], 0xffffff);
      // Çam ağaçları
      for (let i = 0; i < 18; i++) {
        const x = -40 + i * 50 + rand(-12, 12), h = rand(26, 44), y = groundTop + 2;
        deco.poly([x, y - h, x + h * 0.32, y, x - h * 0.32, y]).fill(A.palms);
        deco.poly([x, y - h, x + h * 0.14, y - h * 0.62, x - h * 0.14, y - h * 0.62]).fill({ color: 0xffffff, alpha: 0.85 });
      }
    } else if (A.backdrop === 'hall') {
      // Spor salonu: duvar panelleri, tribün şeridi, pencereler
      deco.rect(-150, 70, CONFIG.width + 300, 6).fill({ color: 0xffffff, alpha: 0.08 });
      for (let x = -120; x < 940; x += 120) {
        deco.roundRect(x + 14, 96, 92, 120, 6).fill({ color: 0x9fc6ff, alpha: 0.10 });
        deco.rect(x + 59, 96, 2, 120).fill({ color: 0xffffff, alpha: 0.06 });
      }
      deco.rect(-150, 250, CONFIG.width + 300, groundTop - 250).fill(A.far[0]);
      for (let r = 0; r < 4; r++) {
        deco.rect(-150, 256 + r * 24, CONFIG.width + 300, 3).fill({ color: 0xffffff, alpha: 0.06 });
      }
      // Seyirci silüetleri (basit yuvarlaklar)
      for (let i = 0; i < 90; i++) {
        const row = i % 4, x = -140 + (i * 23.7) % 1080, y = 270 + row * 24;
        deco.circle(x, y - 6, 5).fill({ color: A.far[1], alpha: 0.9 });
        deco.roundRect(x - 7, y - 1, 14, 10, 4).fill({ color: A.far[1], alpha: 0.9 });
      }
      // Tavan ışıkları
      for (const x of [120, 400, 680]) {
        const l = new Sprite(this.textures.glow);
        l.anchor.set(0.5); l.blendMode = 'add'; l.tint = 0xfff1d6; l.alpha = 0.45; l.position.set(x, 18); l.scale.set(2.2, 1.2);
        this.far.addChild(l);
        deco.roundRect(x - 34, 8, 68, 8, 4).fill(0xf6f2ea);
      }
    }
    this.far.addChild(deco);
    bg.addChild(this.far);

    // Paralaks bulutlar (iki katman, farklı hız)
    this.clouds = [];
    this.cloudLayers = [new Container(), new Container()];
    for (let L = 0; L < 2; L++) {
      bg.addChild(this.cloudLayers[L]);
      if (!A.clouds) continue;
      for (let i = 0; i < 4; i++) {
        const c = new Graphics();
        const k = L === 0 ? rand(0.6, 0.8) : rand(0.9, 1.25);
        const alpha = L === 0 ? 0.6 : 0.85;
        const parts = 4 + Math.floor(Math.random() * 3);
        for (let j = 0; j < parts; j++) {
          c.circle(j * 18 * k - parts * 9 * k, -Math.sin((j / (parts - 1)) * Math.PI) * 12 * k, (14 + Math.random() * 10) * k).fill({ color: A.clouds, alpha });
        }
        c.ellipse(0, 6 * k, parts * 12 * k, 9 * k).fill({ color: A.clouds, alpha });
        c.position.set(rand(-100, 900), L === 0 ? rand(40, 150) : rand(30, 200));
        this.cloudLayers[L].addChild(c);
        this.clouds.push({ g: c, speed: (L === 0 ? 7 : 16) * rand(0.8, 1.2) });
      }
    }

    // Su (deniz/göl)
    this.waves = new Container();   // dalga çizgileri (buildWaves doldurur)
    if (A.water) {
      const sea = new Graphics();
      for (let i = 0; i < 12; i++) {
        const y0 = horizon + (groundTop - horizon) * (i / 12);
        sea.rect(-150, y0, CONFIG.width + 300, (groundTop - horizon) / 12 + 1).fill(lerpColor(A.water[0], A.water[1], i / 11));
      }
      bg.addChild(sea);
    }
    bg.addChild(this.waves);

    // Takım rengine tonlama katmanı (zeminin üstündeki her şey)
    this.tint = new Graphics().rect(-150, -150, CONFIG.width + 300, groundTop + 150).fill(0xffffff);
    this.tint.alpha = 0;
    bg.addChild(this.tint);

    // Zemin
    const ground = new Graphics();
    const gh = CONFIG.height + 120 - groundTop;
    for (let i = 0; i < 10; i++) {
      ground.rect(-150, groundTop + (gh * i) / 10, CONFIG.width + 300, gh / 10 + 1).fill(lerpColor(A.ground[0], A.ground[1], i / 9));
    }
    if (A.backdrop === 'hall') {
      // Parke: perspektifli tahta çizgileri
      for (let x = -400; x < 1200; x += 46) {
        ground.moveTo(400 + (x - 400) * 0.55, groundTop).lineTo(x, CONFIG.height + 120).stroke({ width: 1, color: A.speck[0], alpha: 0.25 });
      }
      ground.rect(-150, groundTop, CONFIG.width + 300, 3).fill({ color: 0x000000, alpha: 0.25 });
    } else {
      for (let i = 0; i < 160; i++) {
        ground.circle(rand(-140, 940), rand(groundTop + 6, CONFIG.height + 100), rand(0.8, 2)).fill({ color: Math.random() < 0.5 ? A.speck[0] : A.speck[1], alpha: 0.6 });
      }
    }
    // Saha çizgisi
    ground.rect(-150, W.groundY + 1, CONFIG.width + 300, 2).fill({ color: A.line, alpha: 0.45 });
    ground.rect(W.netX - 1, W.groundY + 1, 2, 30).fill({ color: A.line, alpha: 0.35 });
    this.foam = new Container();
    bg.addChild(ground, this.foam);
    this.buildWaves(A);
  }

  /** File: metal direk + üstte gümüş küre (Blobby Volley'deki gibi). */
  /** Dalga ve köpük çizgilerini bir kez, bir dalga boyu fazlasıyla çizer. */
  buildWaves(A) {
    this.waveLayers = [];
    const span = CONFIG.width + 300;
    if (A.water) {
      for (let L = 0; L < 3; L++) {
        const k = 0.03, period = (Math.PI * 2) / k, y = 316 + L * 18;
        const g = new Graphics();
        g.moveTo(-150, y);
        for (let x = -150; x <= span + period; x += 20) g.lineTo(x, y + Math.sin(x * k + L) * 2.2);
        g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.28 - L * 0.06 });
        this.waves.addChild(g);
        this.waveLayers.push({ g, period, speed: (1.2 + L * 0.5) / k });
      }
    }
    if (A.foam) {
      const k = 0.05, period = (Math.PI * 2) / k, gt = this.groundTop;
      const g = new Graphics();
      g.moveTo(-150, gt);
      for (let x = -150; x <= span + period; x += 16) g.lineTo(x, gt + Math.sin(x * k) * 1.8 + 1);
      g.lineTo(span + period, gt - 3).lineTo(-150, gt - 3).closePath().fill({ color: 0xffffff, alpha: 0.65 });
      this.foam.addChild(g);
      this.waveLayers.push({ g, period, speed: 1.6 / k });
    }
  }

  drawNet() {
    const g = this.netG.clear();
    const x = W.netX, hw = W.netHalfWidth, top = W.netTopY, h = W.groundY - top + 6;
    g.ellipse(x + 4, W.groundY + 3, 18, 4).fill({ color: 0x000000, alpha: 0.25 });
    g.rect(x - hw, top, hw * 2, h).fill(0xaeb4bc);
    g.rect(x - hw, top, hw * 0.8, h).fill(0xdde1e6);
    g.rect(x + hw * 0.45, top, hw * 0.55, h).fill(0x7a818b);
    g.rect(x - hw - 2, W.groundY - 2, hw * 2 + 4, 8).fill(0x5d636c);
    const r = W.netCapRadius;
    g.circle(x, top, r).fill(0x8d949e);
    g.circle(x - r * 0.1, top - r * 0.1, r * 0.86).fill(0xe6e9ed);
    g.ellipse(x - r * 0.35, top - r * 0.4, r * 0.32, r * 0.2).fill({ color: 0xffffff, alpha: 0.95 });
  }

  // ---------------------------------------------------------------- ayarlar
  /**
   * @param lowFx   "Efektleri azalt" ayarı
   * @param q       kalite seviyesi (CONFIG.effects.quality.*)
   */
  setFx(lowFx, q) {
    this.lowFx = lowFx;
    this.quality = q;
    this.filtersAllowed = q.filters && !lowFx;
    const mul = q.particles * (lowFx ? CONFIG.effects.reducedParticleMul : 1);
    this.particles.countMul = mul;
    this.uiParticles.countMul = mul;
    this.cam.shakeMul = lowFx ? CONFIG.effects.reducedShakeMul : 1;
  }

  addTrauma(a) {
    this.cam.trauma = Math.min(1, this.cam.trauma + a);
  }

  // ---------------------------------------------------------------- çizim
  /**
   * Dünyayı çizer. Fizik durumları alpha ile enterpole edilir:
   *   çizim = önceki + (şimdiki - önceki) * alpha
   * (alpha = accumulator'da kalan süre / adım). Böylece 144 Hz ekranda bile 60 Hz fizik akıcı görünür.
   */
  renderWorld(gw, alpha, realDt, replayFrame = null) {
    const ball = gw.ball;
    const ballState = replayFrame ? replayFrame.ball : {
      x: ball.prevX + (ball.x - ball.prevX) * alpha,
      y: ball.prevY + (ball.y - ball.prevY) * alpha,
      rot: ball.prevRot + (ball.rot - ball.prevRot) * alpha,
      visible: ball.visible,
      fire: ball.fireTimer > 0,
      slow: ball.slowTimer > 0 || ball.stallTimer > 0,
      super: ball.superTimer > 0,
      r: ball.r,
      // Hyper Sis Perdesi: top rakip sahadayken neredeyse görünmez
      fog: ball.fogTimer > 0 && (ball.fogTeam === 0 ? ball.x > W.netX : ball.x < W.netX),
    };
    for (let i = gw.blobs.length; i < 4; i++) { this.blobViews[i].root.visible = false; this.blobViews[i].shadow.visible = false; }
    for (let i = 0; i < gw.blobs.length; i++) {
      const b = gw.blobs[i];
      const s = replayFrame ? replayFrame.blobs[i] : {
        x: b.prevX + (b.x - b.prevX) * alpha,
        y: b.prevY + (b.y - b.prevY) * alpha,
        r: b.r, power: b.fx.power > 0, magnet: b.fx.magnet > 0, spin: b.fx.spin > 0, superArmed: b.hyperTimer > 0 || b.hyperShow > 0 || b.hyperArmed,
      };
      const vy = realDt > 0 ? (s.y - this.prevBlobY[i]) / Math.max(realDt, 1e-3) : 0;
      this.prevBlobY[i] = s.y;
      const vx = replayFrame ? (s.x - this.prevBlobX[i]) / Math.max(realDt, 1e-3) : b.vx;
      this.prevBlobX[i] = s.x;
      this.blobViews[i].sync(s, ballState, realDt, vy, vx);
      this.blobViews[i].root.visible = !b.ghost;
      this.blobViews[i].shadow.visible = !b.ghost;
      // Her adımda ayak altından küçük bir toz/kum (zemin rengine göre)
      const bv = this.blobViews[i];
      if (bv.stepped && realDt > 0 && Math.random() < (this.lowFx ? 0.35 : 1)) {
        const back = -Math.sign(vx);
        this.particles.emit({ tex: this.textures.smoke, x: s.x + back * s.r * 0.6, y: W.groundY - 2,
          vx: back * rand(20, 60), vy: rand(-30, -8), life: rand(0.3, 0.5), drag: 3,
          scale: rand(0.18, 0.28), scaleEnd: 0.55, alpha: 0.4, tint: this.arena.dust });
      }
    }
    this.ballView.sync(ballState, realDt);
    for (let i = 0; i < this.decoyViews.length; i++) {
      const d = !replayFrame && ball.decoys[i];
      const v = this.decoyViews[i];
      if (!d || !ballState.visible) { v.root.visible = v.shadow.visible = false; continue; }
      v.sync({ x: d.prevX + (d.x - d.prevX) * alpha, y: d.prevY + (d.y - d.prevY) * alpha, rot: d.prevRot + (d.rot - d.prevRot) * alpha,
        visible: true, r: ball.r, fire: ballState.fire, slow: false, super: ballState.super, fog: false }, realDt);
    }
    // Hyper Kehanet: topun yolu noktalarla
    // (Çizilecek bir şey yokken clear() bile çağrılmaz: boş yeniden kurulum da maliyetlidir)
    let pathOn = false;
    if (!replayFrame) for (const b of gw.blobs) {
      const pts = b.hyperTimer > 0 && b.hyperPath;
      if (!pts || pts.length < 4) continue;
      if (!pathOn) { this.pathG.clear(); pathOn = true; }
      for (let k = 0; k < pts.length; k += 2) this.pathG.circle(pts[k], pts[k + 1], 3).fill({ color: 0xffd23f, alpha: 0.25 + 0.55 * (k / pts.length) });
    }
    if (!pathOn && this.pathDrawn) this.pathG.clear();
    this.pathDrawn = pathOn;

    // Kalkan: açık olan takımın kumu boyunca parlayan şerit
    // Ağır Top: topun çevresinde koyu, dönen halka
    const hv = this.ballView.heavyRing;
    hv.visible = !replayFrame && ball.heavyTimer > 0 && ballState.visible;
    if (hv.visible) { hv.position.set(ballState.x, ballState.y); hv.rotation += realDt * 6; }

    const sg = this.shieldG;
    let shieldOn = false;
    if (!replayFrame) {
      for (const b of gw.blobs) {
        if (!(b.fx.shield > 0)) continue;
        if (!shieldOn) { sg.clear(); shieldOn = true; }
        const x0 = b.team === 0 ? 0 : W.netX + W.netHalfWidth, x1 = b.team === 0 ? W.netX - W.netHalfWidth : CONFIG.width;
        const pulse = 0.55 + Math.sin(this.time * 8) * 0.2;
        const fade = Math.min(1, b.fx.shield / 0.6);
        sg.rect(x0, W.groundY - 6, x1 - x0, 12).fill({ color: 0x7fe0ff, alpha: 0.18 * fade });
        sg.rect(x0, W.groundY - 1.5, x1 - x0, 3).fill({ color: 0xbff2ff, alpha: pulse * fade });
      }
    }
    if (!shieldOn && this.shieldDrawn) sg.clear();
    this.shieldDrawn = shieldOn;
    // Hayal Top varken gerçek topun izi de çizilmez (sahte toplarda iz yok, ele vermesin)
    if (!replayFrame && ball.decoys.length) this.drawTrail({ ...ballState, fire: false }, 0, realDt);
    else this.drawTrail(ballState, replayFrame ? 0 : ball.speed, realDt);
  }

  drawTrail(s, speed, realDt) {
    const sprites = this.trailSprites;
    if (!s.visible) { this.trailPts.length = 0; this.hideTrail(0); return; }
    const want = s.fog ? 0 : s.fire ? 1 : speed > CONFIG.effects.trailMinSpeed ? Math.min(1, (speed - CONFIG.effects.trailMinSpeed) / 250) : 0;   // Sis Perdesinde iz yok
    this.trailK += (want - this.trailK) * Math.min(1, realDt * 10);
    this.trailPts.push(s.x, s.y);
    const maxPts = CONFIG.effects.trailLength * 2;
    while (this.trailPts.length > maxPts) this.trailPts.splice(0, 2);
    if (this.trailK < 0.02) { this.hideTrail(0); return; }
    const n = this.trailPts.length / 2;
    const r = CONFIG.ball.radius;
    const color = s.super ? 0xffd23f : s.fire ? 0xff8a2a : 0xffffff;
    const step = this.quality.filters ? 1 : 2;   // orta/düşük kalitede yarı sayıda daire
    let used = 0;
    for (let i = n % step; i < n - 1 && used < sprites.length; i += step) {
      const t = (i + 1) / n;
      const sp = sprites[used++];
      sp.visible = true;
      sp.position.set(this.trailPts[i * 2], this.trailPts[i * 2 + 1]);
      sp.scale.set((r * (0.25 + 0.7 * t)) / 6);   // dot dokusu 6 px yarıçaplı
      sp.alpha = t * 0.38 * this.trailK;
      sp.tint = color;
    }
    this.hideTrail(used);
  }

  hideTrail(from) {
    if (from >= this.trailShown) { this.trailShown = from; return; }
    for (let i = from; i < this.trailShown; i++) this.trailSprites[i].visible = false;
    this.trailShown = from;
  }

  /** Arka plan animasyonları, kamera ve filtreler. */
  update(realDt, simDt) {
    this.time += realDt;

    for (const c of this.clouds) {
      c.g.x += c.speed * realDt;
      if (c.g.x > CONFIG.width + 160) c.g.x = -160;
    }

    // Dalgalar, köpük ve kar (arenaya göre)
    const t = this.time;
    const A = this.arena;
    // Dalga ve köpük çizgileri bir kez çizilir (buildWaves); burada sadece kaydırılır.
    // Her karede yeniden çizmek (tessellation) zayıf cihazlarda pahalıdır.
    for (const w of this.waveLayers) w.g.x = -((t * w.speed) % w.period);
    if (A.snow && simDt > 0) {
      this.snowT -= simDt;
      while (this.snowT <= 0) {
        this.snowT += 0.045 / Math.max(0.2, this.particles.countMul);
        this.particles.emit({ tex: this.textures.dot, x: rand(-40, 840), y: -10, vx: rand(-25, 10), vy: rand(35, 70), life: 8,
          scale: rand(0.25, 0.6), alpha: 0.9, alphaEnd: 0.9, tint: 0xffffff, groundY: W.groundY + rand(0, 30), bounce: 0, fadeOut: 0.15 });
      }
    }

    this.applyCamera(realDt);
  }

  applyCamera(realDt) {
    const c = this.cam;
    // Screen shake: genlik = travma² (küçük travmalar çok hafif, büyükler güçlü hissettirir)
    const amp = c.trauma * c.trauma * CONFIG.goalFx.shakeMaxOffset * c.shakeMul;
    const t = this.time;
    const sx = amp * (Math.sin(t * 47.3) * 0.6 + Math.sin(t * 91.7 + 1.3) * 0.4);
    const sy = amp * (Math.sin(t * 53.1 + 2.1) * 0.6 + Math.sin(t * 79.9 + 0.7) * 0.4);
    c.trauma = Math.max(0, c.trauma - CONFIG.goalFx.shakeDecay * realDt);

    // Zoom, odak noktası ekranda sabit kalacak şekilde uygulanır.
    const z = this.lowFx ? 1 : c.zoom;
    this.world.scale.set(z);
    this.world.position.set(c.fx - c.fx * z + sx, c.fy - c.fy * z + sy);

    // Paralaks: uzak katmanlar sarsıntıyı daha az hisseder
    this.far.position.set(-sx * 0.55, -sy * 0.55);
    this.cloudLayers[0].position.set(-sx * 0.45, -sy * 0.45);
    this.cloudLayers[1].position.set(-sx * 0.25, -sy * 0.25);

    // Filtreler sadece gerektiğinde açılır (performans)
    const list = [];
    if (this.filtersAllowed) {
      if (this.rgb && c.ca > 0.15) {
        const o = c.ca;
        setPoint(this.rgb, 'red', -o, o * 0.25);
        setPoint(this.rgb, 'green', 0, 0);
        setPoint(this.rgb, 'blue', o, -o * 0.25);
        list.push(this.rgb);
      }
      if (this.bloom && c.bloom > 0.02) {
        this.bloom.bloomScale = c.bloom;
        list.push(this.bloom);
      }
    }
    if (list.length) { this.fxRoot.filters = list; this.filtersOn = true; }
    else if (this.filtersOn) { this.fxRoot.filters = null; this.filtersOn = false; }
  }

  resetFx() {
    this.cam.zoom = 1;
    this.cam.trauma = 0;
    this.cam.ca = 0;
    this.cam.bloom = 0;
    this.tint.alpha = 0;
    this.groundGlow.alpha = 0;
    this.flash.alpha = 0;
    this.ballView.pop = 1;
  }
}
