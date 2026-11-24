// =============================================================================
//  goalExplosion.js — Rocket League tarzı "GOAL EXPLOSION" (sayı efekti).
//
//  Kullanım:  goalFx.play({ x, y, teamColor, streak, isMatchPoint, team, onScorePop })
//
//  Zaman çizelgesi (gerçek zaman, ms):
//   T+0    hit-stop (80 ms donma) → 0.25x slow-motion (~700 ms) → yumuşak 1x
//          patlama: parlak çekirdek, 3 kademeli şok dalgası, 150+ kıvılcım, toz bulutu, enkaz
//          kamera: güçlü azalan shake, zoom 1.0→1.12→1.0, kısa RGB ayrışması
//          ışık: beyaz flaş, arka plan takım rengine tonlanır, zeminde parlama, bloom
//   T+300  dev, eğik "SAYI!" yazısı (soldan kayar, overshoot ile oturur) + alt yazı, konfeti
//   T+500  skor tabelası pop + flip (onScorePop)
//   (seri ≥3 → "SERİ!" yazısı; maç sayısında her şey 1.5x, slow-motion daha uzun)
//  Geri sayım (3-2-1) ve topun parıltılı doğuşu: playCountdown() / playSpawn().
//
//  Kıvılcım/toz/enkaz dünya katmanındadır → slow-motion'la birlikte yavaşlar (dramatik).
//  Yazılar, konfeti ve kamera tween'leri gerçek zamanla akar.
// =============================================================================
import { Container, Sprite, Text, Graphics } from 'pixi.js';
import { CONFIG } from '../config.js';
import { Ease, Timeline } from './tween.js';
import { UI_FONT as FONT } from './fonts.js';
import { t as tr } from '../i18n.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export class GoalExplosion {
  constructor({ stage, tweener, time, sfx, textures }) {
    this.stage = stage;
    this.tw = tweener;
    this.time = time;
    this.sfx = sfx;
    this.tex = textures;
    this.tl = null;
    this.cdTl = null;
    this.rings = [];
    this.fireworkT = 0;

    // Şok dalgası halkaları (dünya katmanı, additive)
    this.ringG = new Graphics();
    this.ringG.blendMode = 'add';
    stage.fxLayer.addChild(this.ringG);

    // Patlama çekirdeği: beyaz-sarı flaş + takım renginde büyük parlama
    this.coreTeam = this.makeGlow(stage.fxTop);
    this.core = this.makeGlow(stage.fxTop);
    this.core.tint = 0xfff4c2;

    // Yazılar (bir kez oluşturulup yeniden kullanılır)
    this.textLayer = new Container();
    stage.ui.addChild(this.textLayer);

    this.sayi = new Container();
    this.sayiText = new Text({
      text: tr('SAYI!'),
      style: {
        fontFamily: FONT, fontWeight: '900', fontStyle: 'italic', fontSize: 132,
        fill: 0xffffff, letterSpacing: 4,
        stroke: { color: 0xff8a1f, width: 12, join: 'round' },
        dropShadow: { color: 0x000000, blur: 10, distance: 6, alpha: 0.35, angle: Math.PI / 2 },
        padding: 30,
      },
    });
    this.sayiText.anchor.set(0.5);
    this.sayi.addChild(this.sayiText);
    this.sayi.skew.set(-0.2, 0);
    this.sayi.visible = false;

    this.sub = this.makeText(28, 0xffffff);
    this.seri = this.makeText(40, 0xffd23f);
    this.countdown = this.makeText(110, 0xffffff);
    this.textLayer.addChild(this.sayi, this.sub, this.seri, this.countdown);
  }

  makeGlow(parent) {
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.alpha = 0;
    parent.addChild(s);
    return s;
  }

  makeText(size, fill) {
    const t = new Text({
      text: '',
      style: {
        fontFamily: FONT, fontWeight: '900', fontSize: size, fill,
        dropShadow: { color: 0x000000, blur: 8, distance: 2, alpha: 0.4, angle: Math.PI / 2 },
        padding: 16,
      },
    });
    t.anchor.set(0.5);
    t.visible = false;
    return t;
  }

  get low() {
    return this.stage.lowFx;
  }

  // ===========================================================================
  play({ x, y, teamColor, team, streak = 1, isMatchPoint = false, subText = '', onScorePop }) {
    const G = CONFIG.goalFx;
    const isStreak = streak >= G.streakThreshold;
    const big = (isStreak ? G.streakMul : 1) * (isMatchPoint ? G.matchPointMul : 1);
    const T = CONFIG.teams[team];

    // 1) Hit-stop → slow-motion → yumuşak dönüş (sadece accumulator'a giden zamanı ölçekler)
    this.time.hitStop({
      freezeMs: G.hitStopMs * (isMatchPoint ? 1.5 : 1),
      slowScale: G.slowScale,
      slowMs: G.slowMs * (isMatchPoint ? G.matchPointSlowMul : 1),
      recoverMs: G.recoverMs,
    });

    // 2-4) Patlama, kamera, ışık — hepsi T+0
    this.burst(x, y, teamColor, T, big);
    this.cameraKick(x, y, big);
    this.lightFx(x, y, teamColor, big);
    this.sfx?.explosion(big);

    this.tl = new Timeline()
      .at(G.textDelayMs, () => {
        this.showSayi(teamColor, subText || `${T.name} Takım +1`, big);
        this.confetti(team, T, big);
      })
      .at(G.scorePopDelayMs, () => onScorePop?.());
    if (isStreak) this.tl.at(G.textDelayMs + 380, () => this.showSeri(streak, teamColor));
  }

  // --- 2) Patlama ------------------------------------------------------------
  burst(x, y, color, T, big) {
    const G = CONFIG.goalFx;
    const P = this.stage.particles;
    const tex = this.tex;
    const ground = CONFIG.world.groundY;
    const sb = Math.sqrt(big);

    // Çekirdek flaşı (gerçek zamanlı tween → donma karesinde bile görünür)
    this.core.position.set(x, y - 6);
    this.coreTeam.position.set(x, y - 6);
    this.coreTeam.tint = color;
    this.tw.add({ dur: 0.16, ease: Ease.easeOutCubic, onUpdate: (e) => { this.core.alpha = 1; this.core.scale.set(0.3 + 2.9 * sb * e); } ,
      onComplete: () => this.tw.add({ dur: 0.5, ease: Ease.easeInQuad, onUpdate: (e) => { this.core.alpha = 1 - e; this.core.scale.set(3.2 * sb + e); } }) });
    this.tw.add({ dur: 1.0, ease: Ease.easeOutCubic, onUpdate: (e) => { this.coreTeam.alpha = 0.95 * (1 - e); this.coreTeam.scale.set(1 + 5.5 * sb * e); } });

    // Kıvılcımlar: çoğu yukarı yarım küreye, yerçekimi ile düşer, zeminde seker
    const sparkColors = [0xffffff, 0xfff1a8, 0xffd23f, color, color, T.light];
    for (let i = 0, n = P.n(G.sparks * big); i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
      const sp = rand(220, 980) * sb;
      P.emit({
        tex: tex.spark, x: x + rand(-6, 6), y: y - 6,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.5, 1.5), gravity: 950, drag: 1.1,
        scale: rand(0.55, 1.15), scaleEnd: 0.15, alpha: 1, alphaEnd: 0,
        tint: pick(sparkColors), blend: 'add', align: true, stretch: 0.0022,
        groundY: ground + 2, bounce: 0.3,
      });
    }
    // Parlak noktalar (kıvılcımlara hacim katar)
    for (let i = 0, n = P.n(30 * big); i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(60, 380) * sb;
      P.emit({ tex: tex.dot, x, y: y - 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: rand(0.4, 0.9), gravity: 300, drag: 2,
        scale: rand(0.8, 1.6), scaleEnd: 0, tint: pick([0xffffff, color, 0xffe48a]), blend: 'add' });
    }
    // Yükselen toz/kum bulutu
    const A = this.stage.arena;
    const dustColors = [A.dust, A.ground[0], A.ground[1], 0xffffff];
    for (let i = 0, n = P.n(G.dust * big); i < n; i++) {
      P.emit({
        tex: tex.smoke, x: x + rand(-45, 45) * sb, y: y - rand(0, 14),
        vx: rand(-110, 110) * sb, vy: rand(-160, -40) * sb,
        life: rand(1.4, 2.5), gravity: -25, drag: 0.9,
        scale: rand(0.6, 1.1), scaleEnd: rand(2.4, 3.8) * sb, alpha: 0.6, alphaEnd: 0, fadeIn: 0.08,
        tint: pick(dustColors), vr: rand(-1, 1),
      });
    }
    // Dönen enkaz
    const debrisColors = [T.dark, A.speck[0], color, 0xffffff, A.ground[1]];
    for (let i = 0, n = P.n(G.debris * big); i < n; i++) {
      P.emit({
        tex: Math.random() < 0.5 ? tex.tri : tex.square, x: x + rand(-10, 10), y: y - 6,
        vx: rand(-440, 440) * sb, vy: rand(-700, -260) * sb,
        life: rand(1.3, 2.1), gravity: 1300, drag: 0.25,
        scale: rand(0.7, 1.5), scaleEnd: 0.8, alpha: 1, alphaEnd: 1, fadeOut: 0.3,
        tint: pick(debrisColors), vr: rand(-14, 14), groundY: ground + 4, bounce: 0.35,
      });
    }
    // Kademeli şok dalgaları
    const waves = this.low ? G.shockwaves.slice(0, 1) : G.shockwaves;
    for (const w of waves) {
      this.rings.push({ x, y: y - 4, delay: w.delay / 1000, t: 0, dur: w.dur / 1000, R: w.radius * sb, w: w.width * Math.min(1.5, big), color });
    }
  }

  // --- 3) Kamera -------------------------------------------------------------
  cameraKick(x, y, big) {
    const G = CONFIG.goalFx;
    const st = this.stage;
    const cam = st.cam;
    st.addTrauma(G.shakeTrauma * Math.min(1.25, big));
    if (this.low) return; // efektleri azalt: zoom ve RGB ayrışma kapalı
    cam.fx = x; cam.fy = Math.min(y, CONFIG.height - 30);
    const z = 1 + (G.zoom - 1) * Math.min(big, 1.5);
    this.tw.add({ dur: G.zoomInMs / 1000, ease: Ease.easeOutCubic, onUpdate: (e) => { cam.zoom = 1 + (z - 1) * e; },
      onComplete: () => this.tw.add({ delay: G.zoomHoldMs / 1000, dur: G.zoomOutMs / 1000, ease: Ease.easeInOutQuad, onUpdate: (e) => { cam.zoom = z - (z - 1) * e; } }) });
    const ca = G.chromaticPx * Math.min(big, 1.6);
    this.tw.add({ dur: G.chromaticMs / 1000, ease: Ease.easeOutQuad, onUpdate: (e) => { cam.ca = ca * (1 - e); } });
    this.tw.add({ dur: G.bloomMs / 1000, ease: Ease.easeOutQuad, onUpdate: (e) => { cam.bloom = G.bloomScale * Math.min(big, 1.4) * (1 - e); } });
  }

  // --- 4) Işık ---------------------------------------------------------------
  lightFx(x, y, color, big) {
    const G = CONFIG.goalFx;
    const st = this.stage;
    const flashA = G.flashAlpha * (this.low ? 0.45 : 1);
    this.tw.add({ dur: G.flashMs / 1000, ease: Ease.easeOutQuad, onUpdate: (e) => { st.flash.alpha = flashA * (1 - e); } });

    st.tint.tint = color;
    const ta = G.tintAlpha * Math.min(1.3, big);
    this.tw.add({ dur: G.tintMs / 1000, ease: Ease.linear, onUpdate: (e, p) => {
      // hızlı yüksel, sonra yavaşça sön
      st.tint.alpha = p < 0.12 ? ta * (p / 0.12) : ta * (1 - Ease.easeInQuad((p - 0.12) / 0.88));
    } });

    const gg = st.groundGlow;
    gg.tint = color;
    gg.position.set(x, CONFIG.world.groundY);
    this.tw.add({ dur: 1.3, ease: Ease.easeOutCubic, onUpdate: (e) => {
      gg.alpha = 1 - e;
      gg.scale.set((2.2 + 3.5 * e) * Math.sqrt(big), (0.7 + 0.6 * e) * Math.sqrt(big));
    } });
  }

  // --- 5) "SAYI!" yazısı -----------------------------------------------------
  showSayi(color, subText, big) {
    const G = CONFIG.goalFx;
    const s = this.sayi;
    const st = this.sayiText.style;
    st.stroke = { color, width: 12, join: 'round' };
    s.visible = true;
    s.alpha = 1;
    s.position.set(-520, 205);
    const sc = Math.min(1.25, 0.95 + 0.15 * big);
    s.scale.set(sc);
    this.tw.add({ dur: 0.38, ease: Ease.easeOutBack, onUpdate: (e) => { s.x = -520 + 920 * e; } });
    this.tw.add({ delay: G.textHoldMs / 1000, dur: 0.32, ease: Ease.easeInQuad,
      onUpdate: (e) => { s.scale.set(sc * (1 + 0.7 * e)); s.alpha = 1 - e; },
      onComplete: () => { s.visible = false; } });

    const sub = this.sub;
    sub.text = tr(subText);
    sub.style.fill = 0xffffff;
    sub.visible = true;
    sub.position.set(400, 300);
    this.tw.add({ delay: 0.12, dur: 0.3, ease: Ease.easeOutCubic, onStart: () => { sub.alpha = 0; },
      onUpdate: (e) => { sub.alpha = e; sub.y = 300 - 16 * e; } });
    this.tw.add({ delay: G.textHoldMs / 1000 + 0.05, dur: 0.3, ease: Ease.easeInQuad,
      onUpdate: (e) => { sub.alpha = 1 - e; }, onComplete: () => { sub.visible = false; } });
  }

  // --- 9) "SERİ!" ------------------------------------------------------------
  showSeri(streak, color) {
    const t = this.seri;
    t.text = tr(`SERİ ×${streak}`);
    t.style.fill = color;
    t.visible = true;
    t.position.set(400, 112);
    t.rotation = -0.08;
    this.sfx?.streak();
    this.tw.add({ dur: 0.6, ease: Ease.easeOutElastic, onStart: () => { t.alpha = 1; }, onUpdate: (e) => { t.scale.set(e); } });
    this.tw.add({ delay: 1.3, dur: 0.3, ease: Ease.easeInQuad, onUpdate: (e) => { t.alpha = 1 - e; }, onComplete: () => { t.visible = false; } });
  }

  // --- 6) Konfeti ------------------------------------------------------------
  confetti(team, T, big) {
    const G = CONFIG.goalFx;
    const P = this.stage.uiParticles;
    const colors = [T.color, T.light, 0xffffff, 0xffd23f, 0xff4d8d, 0x4dffb8];
    const x0 = team === 0 ? 10 : 410, x1 = team === 0 ? 390 : 790;
    for (let i = 0, n = P.n(G.confettiRain * big); i < n; i++) {
      P.emit({
        tex: Math.random() < 0.8 ? this.tex.square : this.tex.star,
        x: rand(x0, x1), y: rand(-80, -10), vx: rand(-40, 40), vy: rand(40, 150),
        life: rand(2.2, 3.4), gravity: 120, drag: 0.6,
        scale: rand(0.6, 1.05), alpha: 1, alphaEnd: 1, fadeOut: 0.25,
        tint: pick(colors), flutter: rand(6, 13), vr: rand(-4, 4),
      });
    }
    // İki yandan konfeti topları
    for (const side of [0, 1]) {
      const sx = side === 0 ? 0 : 800;
      for (let i = 0, n = P.n(G.confettiCannon * big); i < n; i++) {
        const a = side === 0 ? -Math.PI / 2 + rand(0.2, 0.8) : -Math.PI / 2 - rand(0.2, 0.8);
        const sp = rand(420, 820);
        P.emit({
          tex: this.tex.square, x: sx, y: 395,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: rand(1.8, 2.8), gravity: 520, drag: 1.3,
          scale: rand(0.55, 1), alpha: 1, alphaEnd: 1, fadeOut: 0.3,
          tint: pick(colors), flutter: rand(7, 14), vr: rand(-8, 8),
        });
      }
    }
    this.sfx?.confetti();
  }

  // --- 8) Geri sayım ve doğuş -------------------------------------------------
  playCountdown(onDone) {
    const step = CONFIG.goalFx.countdownStepMs;
    const t = this.countdown;
    this.cdTl = new Timeline();
    ['3', '2', '1'].forEach((n, i) => {
      this.cdTl.at(i * step, () => {
        t.text = n;
        t.visible = true;
        t.position.set(400, 200);
        this.sfx?.countdown(3 - i);
        this.tw.add({ dur: step / 1000, ease: Ease.easeOutCubic, onUpdate: (e) => {
          t.scale.set(1.8 - 0.8 * Ease.easeOutBack(Math.min(1, e * 1.6)));
          t.alpha = e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
        } });
      });
    });
    this.cdTl.at(3 * step, () => { t.visible = false; onDone?.(); });
  }

  playSpawn(x, y, color) {
    const P = this.stage.particles;
    const bv = this.stage.ballView;
    bv.pop = 0;
    this.tw.add({ dur: 0.4, ease: Ease.easeOutBack, onUpdate: (e) => { bv.pop = Math.max(0.01, e); } });
    for (let i = 0, n = P.n(22); i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = rand(50, 75);
      P.emit({ tex: this.tex.star, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 2.6, life: 0.38, scale: rand(0.6, 1), scaleEnd: 0.2,
        alpha: 0, alphaEnd: 1, tint: pick([0xffffff, 0xfff1a8, color]), blend: 'add', vr: 6 });
    }
    const g = this.core;
    g.position.set(x, y);
    g.tint = 0xfff6d0;
    this.tw.add({ delay: 0.25, dur: 0.45, ease: Ease.easeOutCubic, onUpdate: (e) => { g.alpha = 0.9 * (1 - e); g.scale.set(0.5 + 1.5 * e); },
      onComplete: () => { g.tint = 0xfff4c2; } });
    this.sfx?.spawn();
  }

  // --- Maç sonu havai fişekleri ------------------------------------------------
  fireworks(dt, colors) {
    this.fireworkT -= dt;
    if (this.fireworkT > 0) return;
    this.fireworkT = rand(0.25, 0.55);
    const P = this.stage.uiParticles;
    const x = rand(90, 710), y = rand(70, 230);
    const c = pick(colors);
    for (let i = 0, n = P.n(48); i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
      const sp = rand(160, 300);
      P.emit({ tex: this.tex.spark, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.9, 1.5), gravity: 160, drag: 1.4,
        scale: rand(0.6, 0.9), scaleEnd: 0.1, alpha: 1, alphaEnd: 0, tint: Math.random() < 0.25 ? 0xffffff : c, blend: 'add', align: true, stretch: 0.002 });
    }
    P.emit({ tex: this.tex.glow, x, y, life: 0.5, scale: 0.4, scaleEnd: 2.2, alpha: 0.9, alphaEnd: 0, tint: c, blend: 'add' });
    this.sfx?.firework();
  }

  // ===========================================================================
  /** @param realDt gerçek zaman  @param simDt slow-motion ile ölçeklenmiş zaman */
  update(realDt, simDt) {
    this.tl?.update(realDt);
    this.cdTl?.update(realDt);

    // Halka yokken yeniden çizim yapılmaz (boş clear() bile her karede geometri kurar)
    if (!this.rings.length) { if (this.ringsDrawn) { this.ringG.clear(); this.ringsDrawn = false; } return; }
    this.ringsDrawn = true;
    const g = this.ringG.clear();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      if (r.delay > 0) { r.delay -= simDt; continue; }
      r.t += simDt;
      const p = Math.min(1, r.t / r.dur);
      if (p >= 1) { this.rings.splice(i, 1); continue; }
      const e = Ease.easeOutCubic(p);
      const rad = 8 + r.R * e;
      g.circle(r.x, r.y, rad).stroke({ width: Math.max(1, r.w * (1 - p * 0.75)), color: r.color, alpha: 1 - p });
      g.circle(r.x, r.y, rad * 0.97).stroke({ width: Math.max(1, r.w * 0.3 * (1 - p)), color: 0xffffff, alpha: (1 - p) * 0.8 });
    }
  }

  /** Tekrar başlarken / menüye dönerken dünya efektlerini temizle. */
  clearWorldFx() {
    this.rings.length = 0;
    this.ringG.clear();
    this.core.alpha = 0;
    this.coreTeam.alpha = 0;
    this.stage.particles.clear();
  }

  clearAll() {
    this.clearWorldFx();
    this.tl?.stop();
    this.cdTl?.stop();
    this.tl = this.cdTl = null;
    for (const t of [this.sayi, this.sub, this.seri, this.countdown]) t.visible = false;
    this.stage.uiParticles.clear();
  }
}
