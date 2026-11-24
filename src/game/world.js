// =============================================================================
//  world.js — Tek bir sabit fizik adımında oyunun tamamını ilerleten "çekirdek".
//  Pixi'den bağımsızdır (Node'da test edilebilir). main.js bunu dt = 1/60 ile çağırır.
// =============================================================================
import { CONFIG } from '../config.js';
import { MODS } from './mods.js';
import { Blob, Ball } from './entities.js';
import { stepBlob, stepBall } from './physics.js';
import { Match } from './rules.js';
import { resetHyper, hyperReady, triggerHyper, hitHyper, endHyper } from './hyper.js';
import { ReplayBuffer } from './replay.js';
import {
  tickCooldown, tryActivate, updateAbilities, onHitAbilities, cancelEffects, holdBall, throwBall,
} from './abilities.js';

const NO_INPUT = { move: 0, jump: false, ability: false };

export class GameWorld {
  constructor() {
    this.blobs = [new Blob(0), new Blob(1)];
    this.ball = new Ball();
    this.match = new Match();
    this.replay = new ReplayBuffer();
    this.events = [];
    this.pendingFault = null;

    // Yeteneklerin olay yaydığı bağlam
    this.ctx = { ball: this.ball, blobs: this.blobs, match: this.match, emit: (e) => this.events.push(e), summon: (b, dur) => this.summonClone(b, dur) };

    // Fizik → kurallar köprüsü: her top–blob çarpışmasında çağrılır.
    this.hooks = {
      onHit: (blob, ball, info) => {
        // Aynı temasın ardışık adımları tek dokunuş sayılır.
        if (blob.touchLock > 0) return;
        blob.touchLock = CONFIG.rules.touchLockTime;
        if (this.countTouches && blob.isClone) {
          info.first = false;   // Klonun dokunuşu takımın dokunuş hakkından yemez
        } else if (this.countTouches) {
          const res = this.match.registerTouch(blob.team);
          info.first = res.first;
          info.count = res.count;
          if (res.fault && !this.pendingFault) {
            this.pendingFault = { team: 1 - blob.team, x: ball.x, y: ball.y };
          }
          // Kor Top: rakibin dokunuşu 2 dokunuş sayılır (faul sınırını tek başına aşırtmaz)
          if (ball.hotTimer > 0 && ball.hotTeam !== blob.team && !res.fault) {
            if (res.count < CONFIG.rules.maxTouches) { res.count = this.match.registerTouch(blob.team).count; this.events.push({ type: 'hotTouch', blob, x: ball.x, y: ball.y }); }
            if (!ball.hotAll) ball.hotTimer = 0;
          }
          this.events.push({ type: 'touch', team: blob.team, count: res.count, fault: res.fault });
        } else {
          info.first = false;
        }
        // Rüzgâr: rakip topa dokununca biter (geri gelen topu da itmesin)
        if (ball.windTimer > 0 && ball.windDir === (blob.team === 0 ? -1 : 1)) ball.windTimer = 0;
        if (ball.wellTimer > 0 && (ball.wellX < CONFIG.world.netX) === (blob.team === 0)) ball.wellTimer = 0;   // Kara Delik de
        // Hayal Top: rakip gerçek topa dokununca sahte toplar kaybolur
        if (ball.decoys.length && ball.decoys.some((d) => d.team !== blob.team)) this.popDecoys(blob.team);
        ball.lineTimer = 0;   // Hat Vuruşu her yeni vuruşta biter (yeniden başlatılabilir)
        onHitAbilities(blob, ball, this.ctx, info);
        if (ball.cutTeam >= 0 && ball.cutTeam !== blob.team) ball.cutTeam = -1;   // rakip dokundu: Keskin Kesim biter
        if (this.hyperOn && this.countTouches) this.hyperOnHit(blob, ball);
      },
    };
    this.countTouches = true;
    // Hyper (main.js açar: karakterli/parti maçlarında)
    this.hyperOn = false;
    this.rallyHits = 0;
  }

  /** Maç başında: bütün blob'ların Hyper barları sıfırlanır. */
  resetHyper() {
    this.rallyHits = 0;
    for (const b of this.blobs) resetHyper(b);
  }

  /**
   * Vuruşta: bekleyen vuruş Hyper'ı varsa bu topa uygulanır; yoksa bar dolar.
   * Bar dolunca "HYPER HAZIR" olur, bir sonraki aktif yetenek kullanımında devreye girer.
   * (Süren ya da bekleyen Hyper varken bar dolmaz.)
   */
  hyperOnHit(blob, ball) {
    this.rallyHits++;
    if (!blob.hyper) return;
    if (blob.hyperArmed) { hitHyper(blob, this.ctx, ball); return; }
    if (blob.hyperTimer > 0 || blob.hyperMeter >= 1) return;
    const S = CONFIG.hyper;
    blob.hyperMeter = Math.min(1, blob.hyperMeter + S.perHit + (this.rallyHits > 6 ? S.rallyBonus : 0));
  }

  /** Hayal Top: rakip takımın sahte toplarını kaldır (team verilmezse hepsi). */
  popDecoys(hitterTeam = -1) {
    const ball = this.ball;
    for (let i = ball.decoys.length - 1; i >= 0; i--) {
      const d = ball.decoys[i];
      if (hitterTeam >= 0 && d.team === hitterTeam) continue;
      this.events.push({ type: 'decoyPop', x: d.x, y: d.y });
      ball.decoys.splice(i, 1);
    }
  }

  /** Sahte topları ilerlet: yerçekimi + duvar; yere değince ya da süresi bitince kaybolur. */
  stepDecoys(dt) {
    const ball = this.ball, C = CONFIG.ball, Wd = CONFIG.world;
    for (let i = ball.decoys.length - 1; i >= 0; i--) {
      const d = ball.decoys[i];
      d.prevX = d.x; d.prevY = d.y; d.prevRot = d.rot;
      d.vy += C.gravity * MODS.ballGravity * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.rot += (d.vx * dt) / d.r;
      if (d.x < d.r) { d.x = d.r; d.vx = Math.abs(d.vx) * 0.9; }
      if (d.x > CONFIG.width - d.r) { d.x = CONFIG.width - d.r; d.vx = -Math.abs(d.vx) * 0.9; }
      if (d.y < d.r) { d.y = d.r; d.vy = Math.abs(d.vy) * 0.9; }
      d.t -= dt;
      if (d.t <= 0 || d.y + d.r >= Wd.groundY) {
        this.events.push({ type: 'decoyPop', x: d.x, y: Math.min(d.y, Wd.groundY - d.r) });
        ball.decoys.splice(i, 1);
      }
    }
  }

  resetPositions() {
    for (const b of this.blobs) b.reset();
  }

  /**
   * 1'e 1 ya da 2'ye 2. 2'ye 2'de blobs[2] sol takımın, blobs[3] sağ takımın arkadaşıdır;
   * ana oyuncular fileye yakın, arkadaşlar arkada başlar. (blobs[0], blobs[1] hep ana oyunculardır.)
   */
  setTeamSize(n) {
    const B = this.blobs;
    this.size = n;
    if (n === 2 && B.length === 2) B.push(new Blob(0, 1), new Blob(1, 1));
    for (const b of B) { b.isClone = false; b.cloneTimer = 0; }
    if (n === 2) B[2].ghost = B[3].ghost = false;
    if (n === 1 && B.length > 2) B.length = 2;
    const sx = CONFIG.blob.startX;
    if (n === 2) {
      B[0].homeX = sx[0] + 75; B[2].homeX = sx[0] - 85;
      B[1].homeX = sx[1] - 75; B[3].homeX = sx[1] + 85;
    } else {
      B[0].homeX = B[1].homeX = null;
    }
    this.resetPositions();
  }

  get teamSize() {
    return this.size || 1;
  }

  /**
   * Klon (Cura): 1'e 1'de sahibinin yanına yapay zekayla oynayan geçici bir blob çağırır.
   * Takım arkadaşı yuvasını (blobs[2 + takım]) kullanır; 2'ye 2'de yuva dolu olduğundan false döner.
   */
  summonClone(owner, duration) {
    if (this.size === 2) return false;
    const B = this.blobs;
    if (B.length === 2) { const a = new Blob(0, 1), b = new Blob(1, 1); a.ghost = b.ghost = true; B.push(a, b); }
    const c = B[2 + owner.team];
    const fresh = c.ghost;
    c.ghost = false; c.isClone = true;
    c.cloneTimer = Math.max(c.cloneTimer || 0, duration);
    if (fresh) {
      c.reset();
      const W = CONFIG.world, back = owner.team === 0 ? -1 : 1;
      const lo = owner.team === 0 ? 40 : W.netX + 50, hi = owner.team === 0 ? W.netX - 50 : CONFIG.width - 40;
      let x = owner.x + back * 110;
      if (x < lo || x > hi) x = owner.x - back * 110;
      c.x = c.prevX = Math.max(lo, Math.min(hi, x));
      c.radiusMul = owner.radiusMul;
      // 2'ye 2 düzeni: sahibi önde, klon arkada bekler (ikisi aynı topa koşmasın)
      const sx = CONFIG.blob.startX[owner.team], dir = owner.team === 0 ? 1 : -1;
      owner.homeX = sx + dir * 75; c.homeX = sx - dir * 85;
      c.cloneOwner = owner;
      this.events.push({ type: 'clone', blob: c, owner });
    }
    return true;
  }

  dismissClone(c) {
    if (!c.isClone) return;
    c.isClone = false; c.ghost = true; c.cloneTimer = 0;
    if (c.cloneOwner) { c.cloneOwner.homeX = null; c.cloneOwner = null; }
    c.homeX = null;
    this.events.push({ type: 'cloneEnd', blob: c, x: c.x, y: c.y - c.r });
  }

  serve(team) {
    this.rallyHits = 0;
    this.ball.placeForServe(CONFIG.ball.serveX[team], CONFIG.ball.serveY);
  }

  /**
   * Kalkan: top, kalkanı açık takımın kumuna değdiyse sayı olmaz; top yukarı seker
   * ve kalkan tükenir. @returns true ise düşüş engellendi.
   */
  shieldBlock(e) {
    const team = e.x < CONFIG.world.netX ? 0 : 1;
    // Hyper Kale Duvarı süresince her düşüşü engeller (tükenmez)
    const wall = this.blobs.find((o) => o.team === team && o.hyperTimer > 0 && o.hyper?.id === 'kaleDuvari');
    const b = wall || this.blobs.find((o) => o.team === team && o.fx.shield > 0);   // 2'ye 2: takımdan biri
    if (!b) return false;
    if (!wall) { b.fx.shield = 0; b.activeTimer = 0; }
    const ball = this.ball;
    ball.active = true;
    ball.y = CONFIG.world.groundY - ball.r - 1;
    ball.vy = -CONFIG.abilities.kalkan.bounceSpeed;
    ball.vx *= 0.5;
    ball.spinTimer = 0;
    return true;
  }

  /**
   * Bir fizik adımı.
   * @param controls [ctrl0, ctrl1] — {move, jump, ability}
   * @param opts.input       oyuncu girişi açık mı (sayı efekti sırasında kilitli)
   * @param opts.cooldowns   cooldown'lar işlesin mi (menüde/duraklatmada hayır)
   * @param opts.scoring     sayı verilsin mi (demo modunda hayır)
   */
  step(dt, controls, opts = {}) {
    const { input = true, cooldowns = true, scoring = true, touches = scoring } = opts;
    const ev = this.events;
    ev.length = 0;
    this.countTouches = touches;
    const ball = this.ball;

    // Zamanlayıcılar
    if (cooldowns) for (const b of this.blobs) tickCooldown(b, dt);
    ball.slowTimer = Math.max(0, ball.slowTimer - dt);
    ball.hotTimer = Math.max(0, ball.hotTimer - dt);
    if (ball.hotTimer <= 0) ball.hotAll = false;
    ball.boostTimer = Math.max(0, ball.boostTimer - dt);
    ball.fireTimer = Math.max(0, ball.fireTimer - dt);
    ball.spinTimer = Math.max(0, ball.spinTimer - dt);
    ball.heavyTimer = Math.max(0, ball.heavyTimer - dt);
    ball.windTimer = Math.max(0, ball.windTimer - dt);
    ball.floatTimer = Math.max(0, ball.floatTimer - dt);
    ball.wellTimer = Math.max(0, ball.wellTimer - dt);
    ball.superTimer = Math.max(0, (ball.superTimer || 0) - dt);
    ball.fogTimer = Math.max(0, ball.fogTimer - dt);
    for (const b of this.blobs) {
      b.stunTimer = Math.max(0, b.stunTimer - dt);
      // Şişme: boyut hedefe yumuşakça yaklaşır (aniden büyüyüp topu fırlatmasın)
      b.growTimer = Math.max(0, b.growTimer - dt);
      b.shrinkTimer = Math.max(0, b.shrinkTimer - dt);
      b.turboTimer = Math.max(0, b.turboTimer - dt);
      b.confuseTimer = Math.max(0, b.confuseTimer - dt);
      b.freezeTimer = Math.max(0, b.freezeTimer - dt);
      b.weakTimer = Math.max(0, b.weakTimer - dt);
      b.rootTimer = Math.max(0, b.rootTimer - dt);
      if (b.isClone && input) { b.cloneTimer -= dt; if (b.cloneTimer <= 0) this.dismissClone(b); }
      // Hyper: süresi bitince sona erer
      b.hyperShow = Math.max(0, b.hyperShow - dt);
      if (b.hyperTimer > 0) {
        b.hyperTimer -= dt;
        if (b.hyperTimer <= 0) endHyper(b, this.ctx);
        else b.hyper?.update?.(b, this.ctx, dt);
      }
      const target = (b.growTimer > 0 ? CONFIG.abilities.sisme.radiusMul : 1) * (b.shrinkTimer > 0 ? CONFIG.abilities.kucult.radiusMul : 1);
      b.growMul += (target - b.growMul) * Math.min(1, dt * 7);
      if (Math.abs(target - b.growMul) < 0.002) b.growMul = target;
    }

    // Aktif yetenek tetikleme + sürekli etkiler
    for (let i = 0; i < this.blobs.length; i++) {
      const b = this.blobs[i];
      if (b.ghost) continue;   // antrenmanda karşı taraf boş (top makinesi)
      if (input && controls[i]?.ability && tryActivate(b, this.ctx) && this.hyperOn && hyperReady(b)) triggerHyper(b, this.ctx);
      updateAbilities(b, this.ctx, dt);
    }

    // Hareket
    for (let i = 0; i < this.blobs.length; i++) if (!this.blobs[i].ghost) stepBlob(this.blobs[i], input ? controls[i] || NO_INPUT : NO_INPUT, dt, ev);
    if (ball.stallTimer > 0 && !ball.hover) {
      // Gök Askısı: top zamanda donar (hızı korunur, süre bitince kaldığı yerden devam eder)
      ball.prevX = ball.x; ball.prevY = ball.y; ball.prevRot = ball.rot;
      ball.stallTimer -= dt;
    } else if (ball.holdTimer > 0 && ball.holder) {
      // Yakala: top blob'un tepesinde; süre dolunca rakibe fırlatılır
      ball.prevX = ball.x; ball.prevY = ball.y; ball.prevRot = ball.rot;
      ball.holdTimer -= dt;
      holdBall(ball);
      if (ball.holdTimer <= 0) throwBall(ball, this.ctx);
    } else stepBall(ball, this.blobs, dt, this.hooks, ev);
    if (ball.decoys.length) this.stepDecoys(dt);

    // Olayları kurallara uygula
    let pointTeam = -1, px = 0, py = 0, reason = '';
    if (this.pendingFault) {
      ({ team: pointTeam, x: px, y: py } = this.pendingFault);
      reason = 'fault';
      this.pendingFault = null;
    }
    for (const e of ev) {
      if (e.type === 'cross') {
        this.match.onCross(e.from);
        // Keskin Kesim: vuran takımın topu fileyi geçince dik düşer
        if (ball.cutTeam === e.from) { ball.vx *= 0.18; ball.cutTeam = -1; ev.push({ type: 'cut', blob: this.blobs[e.from], x: ball.x, y: ball.y }); }
        for (const b of this.blobs) if (b.hyperTimer > 0) b.hyper?.onCross?.(b, this.ctx, e.from);
      }
      else if (e.type === 'ground' && pointTeam < 0 && this.shieldBlock(e)) {
        ev.push({ type: 'shieldBlock', team: e.x < CONFIG.world.netX ? 0 : 1, x: e.x, y: e.y });
      }
      else if (e.type === 'ground' && pointTeam < 0) {
        pointTeam = this.match.scorerForGround(e.x);
        px = e.x; py = e.y;
        reason = 'ground';
      }
    }

    if (pointTeam >= 0) {
      ball.active = false;
      ball.slowTimer = ball.fireTimer = ball.boostTimer = ball.spinTimer = ball.heavyTimer = ball.windTimer = ball.floatTimer = ball.wellTimer = ball.superTimer = ball.fogTimer = 0;
      ball.cutTeam = -1;
      ball.holdTimer = 0; ball.holder = null; ball.stallTimer = 0;
      ball.hotTimer = 0; ball.hotAll = false; ball.lineTimer = 0;
      for (const b of this.blobs) this.dismissClone(b);
      if (ball.decoys.length) this.popDecoys();
      this.rallyHits = 0;
      for (const b of this.blobs) { endHyper(b, this.ctx); b.freezeTimer = 0; }
      for (const b of this.blobs) cancelEffects(b);
      const result = scoring ? this.match.awardPoint(pointTeam) : { team: pointTeam, streak: 0, isMatchWin: false };
      ev.push({ type: 'point', team: pointTeam, x: px, y: py, reason, result });
    }

    this.replay.record(this.blobs, ball);
    return ev;
  }
}
