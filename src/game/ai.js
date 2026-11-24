// =============================================================================
//  ai.js — Yapay zeka. Topun düşeceği x'i fizik simülasyonuyla tahmin eder,
//  topun biraz "arkasına" (fileden uzak tarafına) geçer ki vuruş normali fileye baksın.
//  Zorluk: tepki gecikmesi, nişan hatası, hareket hızı, zıplama becerisi, smaç eğilimi.
// =============================================================================
import { CONFIG } from '../config.js';
import { predictLanding, sideOfX, blobBounds, clamp, blobTop, blobCircles, stepBlob, stepBall } from './physics.js';
import { MODS } from './mods.js';

const W = CONFIG.world;
const _probe = { x: 0, y: 0, vx: 0, vy: 0, r: CONFIG.ball.radius, active: true, hover: false, slowTimer: 0, boostTimer: 0 };

/** Hedefe orantılı yaklaşma kuralı (gerçek hareket ve Usta'nın simülasyonu aynı kuralı kullanır). */
function planMove(diff, moveMul) {
  if (Math.abs(diff) <= 3) return 0;
  const m = Math.sign(diff) * Math.min(1, Math.abs(diff) / 24) * moveMul;
  return Math.abs(m) < 0.25 ? Math.sign(diff) * 0.25 : m;
}

export class AIController {
  constructor(blob, difficulty = 'orta') {
    this.blob = blob;
    this.setDifficulty(difficulty);
    this.timer = 0;
    this.targetX = blob.x;
    this.noise = 0;
    this.predX = blob.x;
    this.wantAbility = false;
    this.jumpHold = 0;
    this.spikeMode = false;
    this.plan = null;     // Usta: simülasyonla seçilmiş vuruş planı {tx, jumpAt, k, hitK}
    this.simCd = 0;
  }

  setDifficulty(name) {
    this.name = name;
    this.p = CONFIG.ai[name] || CONFIG.ai.orta;
  }

  /**
   * Hayal Top: rakibin sahte topu varken yapay zeka bazen ona kanar ve gerçek top yerine
   * sahtesini takip eder (kolayda sık, ustada nadiren). Karar her sahte top için bir kez verilir.
   */
  perceive(world) {
    const ds = world.ball.decoys;
    const d = ds && ds.length ? ds.find((x) => x.team !== this.blob.team) : null;
    if (!d) { this.decoy = null; return world; }
    if (d !== this.decoy) {
      this.decoy = d;
      this.fooled = Math.random() < ({ kolay: 0.6, orta: 0.45, zor: 0.3, usta: 0.06 }[this.name] ?? 0.6);
      this.timer = 0;   // hemen yeniden planla
    }
    return this.fooled ? { ball: d, blobs: world.blobs, match: world.match } : world;
  }

  /** @param world {ball, match} @returns kontrol {move, jump, ability} */
  update(dt, world) {
    world = this.perceive(world);
    const b = this.blob;
    const p = this.p;
    const ball = world.ball;
    const me = b.team;
    const toNet = me === 0 ? 1 : -1;
    const home = b.homeX ?? CONFIG.blob.startX[me];

    // Tepki gecikmesi: hedef sadece belirli aralıklarla yeniden planlanır.
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = p.reaction * (0.7 + Math.random() * 0.6);
      this.noise = (Math.random() * 2 - 1) * p.error;
      this.replan(world, toNet, home);
    }

    // Usta: plan topun gidişatı değişince ya da süresi dolunca düşer
    this.simCd -= dt;
    if (!ball.active || ball.hover) this.myHits = 0;   // yeni ralli
    if (this.plan && (!ball.active || (ball.hover && !this.plan.serve) || sideOfX(ball.x) !== me || this.plan.k > this.plan.hitK + 4)) {
      if (ball.active && !ball.hover) this.myHits = (this.myHits || 0) + 1;
      this.plan = null;
    }

    // --- Hareket: hedefe orantılı yaklaş (titreşimi önler) ---
    const diff = (this.plan ? this.plan.tx : this.targetX) - b.x;
    let move = planMove(diff, p.moveMul);
    // Şaşırt: yönler ters döndü. Bir insan gibi önce yanlış yöne gider, kısa bir şaşkınlıktan
    // sonra durumu fark edip tuşları tersine basar (kolayda daha geç fark eder).
    if (b.confuseTimer > 0) {
      this.confusedFor = (this.confusedFor || 0) + dt;
      if (this.confusedFor > 0.35 + p.reaction * 2) move = -move;
    } else this.confusedFor = 0;

    // --- Zıplama ---
    let jump = false;
    if (this.plan) {
      // Usta: planlanan anda zıpla ve vuruşa kadar tuşu bırakma (zıplayarak sert/dik vuruş)
      if (this.plan.jumpAt >= 0 && this.plan.k >= this.plan.jumpAt) jump = true;
      this.plan.k++;
    } else if (ball.active && ball.visible) {
      const dx = ball.x - b.x;
      const above = blobTop(b) - ball.y; // topun blob tepesinden yüksekliği
      if (ball.hover) {
        // Servis: topun hemen arkasına geçince zıpla
        if (sideOfX(ball.x) === me && Math.abs(diff) < 6 && b.grounded && Math.random() < 0.08 + p.jumpSkill * 0.1) {
          this.jumpHold = 0.3;
        }
      } else if (this.spikeMode && sideOfX(ball.x) === me && b.grounded) {
        // Smaç: sadece fileye yakın, yüksekten inen toplarda zıpla. Normal toplar
        // zıplamadan (blob'un tepesiyle) vurulur; böylece yörünge tahmini tutarlı kalır.
        if (dx * toNet > 2 && Math.abs(dx) < 46 && above > 105 && above < 175 && ball.vy > 0 && Math.random() < p.jumpSkill * 0.5) {
          this.jumpHold = 0.45;
        }
      }
    }
    if (this.jumpHold > 0 && !this.plan) {
      this.jumpHold -= dt;
      jump = true;
    }
    // Süzülme pasifi: yapay zeka zamanlamayı bozmamak için düşerken tuşu bırakır
    if (b.glide && b.vy > 0) jump = false;

    const ability = this.wantAbility;
    this.wantAbility = false;
    return { move, jump, ability };
  }

  replan(world, toNet, home) {
    const b = this.blob;
    const p = this.p;
    const ball = world.ball;
    const me = b.team;
    const [minX, maxX] = blobBounds(me, b.r);

    if (!ball.active || !ball.visible || sideOfX(ball.x) !== me) this.spikeMode = false;
    if (!ball.active || !ball.visible) {
      this.targetX = home;
    } else if (ball.hover) {
      // Servis: 2'ye 2'de servisi ana oyuncu atar, arkadaş yerinde bekler
      const server = !this.mateOf(world) || b.slot === 0;
      this.targetX = sideOfX(ball.x) === me && server ? ball.x - toNet * (10 + Math.random() * 6) : home;
      // Usta: servisi de simülasyonla planlar (rakibin en zor alacağı servis)
      if (p.elite >= 2 && sideOfX(ball.x) === me && server && b.grounded) {
        if (!this.plan) this.plan = this.simPlan(world, toNet, true);
        if (this.plan) this.targetX = this.plan.tx;
      }
    } else {
      // Topun blob'un tepesine ineceği yüksekliği hedefle
      const head = blobCircles(b)[0];
      const hitY = W.groundY - (b.y - head.cy) - head.R - ball.r;
      const pred = predictLanding(ball, hitY, 3);
      this.predX = pred.x;
      this.predSpeed = Math.hypot(pred.vx || 0, pred.vy || 0);   // topun temas anındaki tahmini hızı
      const mate = this.mateOf(world);
      if (mate && sideOfX(pred.x) === me && !this.shouldTake(pred.x, mate)) {
        // 2'ye 2: topu takım arkadaşı alıyor → kendi bölgemde bekle, ona yer aç
        this.spikeMode = false;
        this.targetX = home;
      } else if (sideOfX(pred.x) === me) {
        // Topu hangi noktadan vurursak nereye düşer? Birkaç ofset dene, karşı sahaya
        // düşen ve rakipten en uzak olanı seç (kolay zorlukta seçim daha rastgele).
        // Usta: gerçek fizikle onlarca vuruşu (yerden ve zıplayarak) dener, rakibin en zor
        // yetişeceğini uygular. Zıpladıktan sonra plan değiştirilmez.
        if (p.elite) {
          const committed = this.plan && this.plan.jumpAt >= 0 && this.plan.k >= this.plan.jumpAt;
          if (!committed && b.grounded && this.simCd <= 0) {
            this.simCd = p.elite >= 2 ? 0.05 : 0.07;
            this.plan = this.simPlan(world, toNet);
          }
          // Çok uzun rallide (kendi 12+ vuruşu, toplam ~25) yorgunluk: duruş noktası giderek sapar; iki Usta'nın
          // karşılaştığı maçlar (İzle, turnuva) sonsuza kadar sürmesin diye.
          const rh = this.myHits || 0;
          if (this.plan && rh > 12 && !this.plan.tired) { this.plan.tired = true; this.plan.tx += Math.sin(rh * 12.9898 + b.team) * Math.min(36, (rh - 12) * 3); }
          if (this.plan) { this.spikeMode = false; this.targetX = this.plan.tx; this.considerAbility(world, toNet); this.targetX = clamp(this.targetX, minX, maxX); return; }
        }
        const off = this.chooseOffset(pred.x, hitY, toNet, world);
        this.targetX = pred.x - toNet * off + this.noise;
        // Top fileye yakın düşecekse belli olasılıkla smaç dene (topun arkasına geç, zıpla).
        if (!this.spikeMode && Math.abs(pred.x - W.netX) < 110 && Math.random() < p.spike) this.spikeMode = true;
        if (this.spikeMode) this.targetX = pred.x - toNet * 28 + this.noise * 0.5;
      } else {
        // Top karşıdaysa ortaya yakın bekle, biraz da top tarafına kay
        this.targetX = home + (ball.x - W.netX) * 0.08;
        // Usta: rakibin o noktadan atabileceği vuruşların sahama düşeceği aralığı hesaplar,
        // aralığın ortasında (her topa en kısa mesafede) bekler
        if (p.elite >= 2) { const a = this.anticipate(world, toNet); if (a != null) this.targetX = a * 0.65 + home * 0.35; }
      }
      this.considerAbility(world, toNet);
    }
    this.targetX = clamp(this.targetX, minX, maxX);
  }

  /** 2'ye 2: aynı takımdaki diğer blob (yoksa null). */
  mateOf(world) {
    const b = this.blob;
    if (!world.blobs || world.blobs.length <= 2) return null;
    return world.blobs.find((o) => o !== b && o.team === b.team && !o.ghost) || null;
  }

  /**
   * 2'ye 2'de topu kim alacak? Topa daha yakın olan. Arkadaş insansa ona öncelik verilir
   * (yapay zeka ancak belirgin şekilde daha yakınsa gider); kararsızlıkta önceki karar korunur.
   */
  shouldTake(px, mate) {
    const b = this.blob;
    const my = Math.abs(px - b.x), his = Math.abs(px - mate.x);
    // Klon sadece yedektir: sahibi klonu yok sayıp her topa kendisi gider; klon ancak belirgin şekilde
    // daha yakınsa devreye girer (dokunuşu takımın hakkından yemediği için ikisi birden gidebilir).
    if (mate.isClone) { this.taking = true; return true; }
    // Klon: sahibi topa yetişemeyecek kadar uzaksa ve kendisi daha yakınsa gider, yoksa yerinde bekler
    if (b.isClone) { this.taking = his > 95 && my < his; return this.taking; }
    const margin = mate.human ? 45 : this.taking ? -12 : 12;
    this.taking = my + margin < his;
    return this.taking;
  }

  /**
   * Usta'nın vuruş planlayıcısı. Topun ve kendi blob'unun kopyalarını gerçek fizikle ileri sarar:
   * farklı duruş noktaları × (zıplamadan / farklı anlarda zıplayarak) adayların her birinde topa
   * nasıl vurulacağını ve topun karşıda nereye, ne kadar sürede ineceğini bulur. Rakibin
   * yetişme süresine göre en zor topu seçer. Karşıya geçen aday yoksa null (eski yöntem pas atar).
   */
  simPlan(world, toNet, serve = false) {
    const b = this.blob, ball = world.ball, me = b.team;
    const e2 = this.p.elite >= 2;
    const dt = CONFIG.physics.step;
    const [minX, maxX] = blobBounds(me, b.r);
    const opps = (world.blobs || []).filter((o) => o.team !== me && !o.ghost);
    if (!opps.length) return null;
    const head = blobCircles(b)[0];
    const hitY = W.groundY - (b.y - head.cy) - head.R - ball.r;
    const pred = serve ? { x: ball.x, t: 0 } : predictLanding(ball, hitY, 3);
    const T = Math.round(pred.t / dt);                    // yerden vuruşa kalan adım
    // Bu dokunuştan sonra takımın bir dokunuş hakkı daha kalıyor mu? (kurtarış pası için)
    const m = world.match, maxT = CONFIG.rules.maxTouches;
    const used = m && m.lastTouchTeam === me ? m.touches[me] : 0;
    const canPass = e2 && !serve && used + 1 < maxT;
    const home = b.homeX ?? CONFIG.blob.startX[me];
    const oppH = W.groundY - opps[0].r * 2.2 - CONFIG.ball.radius;
    let best = null, bestScore = -Infinity;
    const tryPlan = (tx, jumpAt, span = T + 40) => {
      tx = clamp(tx, minX, maxX);
      const c = Object.assign(Object.create(Object.getPrototypeOf(b)), b); c.fx = { ...b.fx };
      const s = Object.assign(Object.create(Object.getPrototypeOf(ball)), ball); s.decoys = [];
      const ev = [];
      let hitK = -1;
      for (let k = 0; k < span; k++) {
        const wantJump = jumpAt >= 0 && k >= jumpAt;
        stepBlob(c, { move: planMove(tx - c.x, this.p.moveMul), jump: wantJump && !(c.glide && c.vy > 0) }, dt);
        stepBall(s, [c], dt, null, ev);
        if (ev.length) { hitK = k; break; }
        if (s.y > W.groundY - s.r - 1 || sideOfX(s.x) !== me) return;   // kaçtı / karşıya geçti
      }
      if (hitK < 0) return;
      const land = predictLanding(s, W.groundY - CONFIG.ball.radius, 4);
      if (sideOfX(land.x) === me || Math.abs(land.x - W.netX) < 26) {
        // Karşıya geçmiyor: dokunuş hakkı varsa topu yüksek ve sahanın ortasına kaldıran bir
        // "kurtarış pası" olarak değerlendir (hiçbir hücum mümkün değilse bu uygulanır)
        if (canPass && sideOfX(land.x) === me && land.t > 0.55) {
          const sc = -1000 + Math.min(land.t, 1.6) * 200 - Math.abs(land.x - home) * 0.6;
          if (sc > bestScore) { bestScore = sc; best = { tx, jumpAt, k: 0, hitK, serve }; }
        }
        return;
      }
      const H = predictLanding(s, oppH, 4);
      let reach = Infinity;
      for (const o of opps) reach = Math.min(reach, Math.max(0, Math.abs(H.x - o.x) - o.r) / (CONFIG.blob.moveSpeed * o.speedMul));
      // Rakibin yetişme süresi − topun uçuş süresi: artıysa top yere düşer
      let score = clamp((reach - H.t) * 300, -250, 450) + Math.min(120, Math.hypot(H.vx, H.vy) * 0.12);
      if (jumpAt >= 0) score -= 12;   // eşitse yerden vuruş (daha güvenli)
      if (score > bestScore) { bestScore = score; best = { tx, jumpAt, k: 0, hitK, serve }; }
    };
    if (serve) {
      // Servis: topun arkasında farklı noktalara yürü, varınca (ya da biraz bekleyip) zıplayarak vur
      const sp = CONFIG.blob.moveSpeed * b.speedMul * dt;
      for (let off = 0; off <= 30; off += 3) {
        const tx = clamp(ball.x - toNet * off, minX, maxX);
        const walk = Math.ceil(Math.abs(tx - b.x) / sp) + 6;
        for (const extra of [0, 5, 10]) tryPlan(tx, walk + extra, walk + extra + 45);
      }
      return best;
    }
    for (let off = 6; off <= 34; off += 4) tryPlan(pred.x - toNet * off, -1);
    // Zıplayarak: topun arkasında, daha yüksekte ve daha erken karşıla → aşağı doğru sert vuruş
    for (const off of e2 ? [4, 10, 16, 22, 28, 34, 40, 48] : [8, 16, 24, 32, 40]) {
      for (const lead of e2 ? [0.12, 0.18, 0.24, 0.30, 0.36, 0.44] : [0.16, 0.24, 0.32, 0.40]) {
        const jumpAt = T - Math.round(lead / dt);
        if (jumpAt < 0) continue;
        tryPlan(pred.x - toNet * off, jumpAt);
      }
    }
    return best;
  }

  /** Rakibin topu karşılayacağı noktadan atabileceği vuruşların sahama düştüğü aralığın ortası. */
  anticipate(world, toNet) {
    const b = this.blob, ball = world.ball;
    const opp = this.nearestOpp(world, ball.x);
    if (!opp) return null;
    const oh = blobCircles(opp)[0];
    const oy = W.groundY - (opp.y - oh.cy) - oh.R - ball.r;
    const pr = predictLanding(ball, oy, 3);
    if (sideOfX(pr.x) === b.team) return null;
    const R = oh.R + CONFIG.ball.radius;
    let lo = Infinity, hi = -Infinity;
    for (let off = 4; off <= 36; off += 4) {
      const nx = (-toNet * off) / R, ny = -Math.sqrt(Math.max(0, 1 - nx * nx));
      _probe.x = pr.x; _probe.y = oy; _probe.r = CONFIG.ball.radius * MODS.ballRadius;
      _probe.vx = nx * CONFIG.ball.hitSpeed * MODS.hitSpeed; _probe.vy = ny * CONFIG.ball.hitSpeed * MODS.hitSpeed;
      _probe.active = true; _probe.hover = false; _probe.spin = 0; _probe.spinTimer = 0;
      const L = predictLanding(_probe, W.groundY - opp.r * 2.2, 4);
      if (sideOfX(L.x) !== b.team) continue;
      lo = Math.min(lo, L.x); hi = Math.max(hi, L.x);
    }
    return lo <= hi ? (lo + hi) / 2 : null;
  }

  /** En yakın rakip (1'e 1'de tek rakip). */
  nearestOpp(world, x) {
    let best = null, bd = Infinity;
    for (const o of world.blobs || []) {
      if (o.team === this.blob.team || o.ghost) continue;
      const d = Math.abs(o.x - x);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** Vuruş ofsetini, ortaya çıkacak top yörüngesini simüle ederek seçer. */
  chooseOffset(contactX, contactY, toNet, world) {
    const b = this.blob;
    // Vuruş baş dairesiyle yapılır: ofset, top merkezinin baş merkezine göre yatay uzaklığı
    const R = blobCircles(b)[0].R + CONFIG.ball.radius;
    const opps = (world.blobs || []).filter((o) => o.team !== b.team && !o.ghost);
    const opp = opps[0] || null;
    // Yumuşak Dokunuş: takımın ilk dokunuşunda top yavaşlar → tahmine de yansıt
    const firstTouch = (world.match?.lastTouchTeam ?? -1) !== b.team;
    const Y = CONFIG.abilities.yumusakDokunus;
    const fast = (this.predSpeed ?? Math.hypot(world.ball.vx, world.ball.vy)) > Y.minIncoming;
    // Falso hazırsa vuruş kıvrılacak: tahmine de kat (yoksa kendi falsolu topunu fileye gömer)
    const F = CONFIG.abilities.falso;
    const spinning = b.fx.spin > 0;
    const soft = b.passive?.id === 'yumusakDokunus' && firstTouch && fast ? 1 - Y.damping : 1;
    // Önce tüm ofsetler için topun düşeceği yeri hesapla.
    const offs = [], lands = [], times = [], heads = [];
    // Usta: rakibin topa yetişme süresi (yürüyerek) — uçuş süresinden uzunsa sayı neredeyse kesin
    const oppSpeed = opp ? CONFIG.blob.moveSpeed * opp.speedMul : 1;
    _probe.r = CONFIG.ball.radius * MODS.ballRadius;
    for (let off = 4; off <= 36; off += 3) {
      const nx = (toNet * off) / R;
      const ny = -Math.sqrt(Math.max(0, 1 - nx * nx));
      _probe.x = contactX; _probe.y = contactY;
      _probe.vx = nx * CONFIG.ball.hitSpeed * MODS.hitSpeed * soft; _probe.vy = ny * CONFIG.ball.hitSpeed * MODS.hitSpeed * soft;
      _probe.active = true; _probe.hover = false;
      _probe.spin = spinning ? Math.sign(_probe.vx || toNet) * F.spin : 0;
      _probe.spinTimer = spinning ? F.spinTime : 0;
      offs.push(off);
      const L = predictLanding(_probe, W.groundY - CONFIG.ball.radius, 4);
      lands.push(L.x);
      if (this.p.smart && opp) {
        // Rakip topu baş yüksekliğinde karşılar: o noktaya ne zaman, nerede iner?
        _probe.x = contactX; _probe.y = contactY;
        _probe.vx = nx * CONFIG.ball.hitSpeed * MODS.hitSpeed * soft; _probe.vy = ny * CONFIG.ball.hitSpeed * MODS.hitSpeed * soft;
        const H = predictLanding(_probe, W.groundY - opp.r * 2.2 - CONFIG.ball.radius, 4);
        heads.push(H.x);
        times.push(H.t);
      }
    }
    // Sonra puanla: karşıya geçen, komşu ofsetleri de geçen (hata payı olan) ve
    // rakipten uzağa düşen vuruş tercih edilir.
    const ok = (i) => i >= 0 && i < lands.length && sideOfX(lands[i]) !== b.team;
    let best = 20, bestScore = -Infinity;
    for (let i = 0; i < offs.length; i++) {
      let score;
      if (ok(i)) {
        score = 100 + (ok(i - 1) ? 40 : 0) + (ok(i + 1) ? 40 : 0);
        const gap = opps.length ? Math.min(...opps.map((o) => Math.abs(lands[i] - o.x))) : 0;   // en yakın rakibe uzaklık
        score += Math.min(250, gap) * 0.4 * this.p.jumpSkill;
        if (this.p.smart && opp) {
          const reach = Math.min(...opps.map((o) => Math.max(0, Math.abs(heads[i] - o.x) - o.r))) / oppSpeed;
          score += clamp((reach - times[i]) * 300, -150, 300);
        }
        score += (Math.random() - 0.5) * (1 - this.p.jumpSkill) * 260;
      } else {
        // Karşıya geçmiyorsa: topu kendi sahasının ortasına "pas" yap (sonraki vuruşa hazırlık).
        // Son dokunuş hakkıysa bile en azından fileden uzak, yüksek bir top olsun.
        score = -Math.abs(lands[i] - CONFIG.blob.startX[b.team]) * 0.2 - Math.abs(offs[i] - 14);
      }
      if (score > bestScore) { bestScore = score; best = offs[i]; }
    }
    return best;
  }

  considerAbility(world, toNet) {
    const b = this.blob;
    if (!b.active || b.cooldown > 0) return;
    if (Math.random() > this.p.abilityChance) return;
    const ball = world.ball;
    const me = b.team;
    const dx = ball.x - b.x;
    const dist = Math.hypot(dx, ball.y - blobTop(b));
    const mySide = sideOfX(ball.x) === me;
    switch (b.active.id) {
      case 'gucVurusu':
        if (mySide && ball.vy > 0 && Math.abs(dx) < 90) this.wantAbility = true;
        break;
      case 'havaAtilmasi':
        if (!b.grounded && mySide && Math.abs(dx) > 50 && Math.abs(dx) < 170 && Math.sign(dx) === b.lastMoveDir) this.wantAbility = true;
        break;
      case 'miknatis':
        // Top kendi sahama ama benden uzağa düşecekse çek
        if (mySide && ball.vy > 0 && dist > 70 && dist < 200 && Math.abs(this.predX - b.x) > 60) this.wantAbility = true;
        break;
      case 'isinlanma': {
        // Top kendi sahama ve gittiğim yönde uzağa düşecekse ışınlan
        const gap = this.predX - b.x;
        if (mySide && ball.vy > 0 && Math.abs(gap) > 120 && Math.sign(gap) === b.lastMoveDir) this.wantAbility = true;
        break;
      }
      case 'roketZiplama':
        // Fileye yakın, yüksek bir top üstümdeyse havaya fırla (yüksekten smaç)
        if (mySide && b.grounded && Math.abs(dx) < 40 && Math.abs(ball.x - CONFIG.world.netX) < 160 && ball.y < 200 && ball.vy > 0) this.wantAbility = true;
        break;
      case 'agirTop':
        // Topu karşıya yolladıktan sonra: top rakip sahasında, rakipten uzaklaşıyorsa ağırlaştır
        if (!mySide && Math.abs(ball.x - CONFIG.world.netX) > 60 && ball.vy < 100) this.wantAbility = true;
        break;
      case 'falso':
        // Falsolu top hızla aşağı kıvrılır: sadece fileye yakın vuruşta kullan (file üstünden düşürme)
        if (mySide && ball.vy > 0 && Math.abs(dx) < 90 && Math.abs(this.predX - CONFIG.world.netX) < 170) this.wantAbility = true;
        break;
      case 'kalkan': {
        // Top kendi sahama ve benden uzağa düşecekse kalkanı aç
        if (sideOfX(this.predX) === me && Math.abs(this.predX - b.x) > 70 && ball.vy > 0) this.wantAbility = true;
        break;
      }
      case 'sersemlet': {
        // Top rakip sahasına ve rakipten uzağa düşecekse rakibi yavaşlat
        const opp = this.nearestOpp(world, ball.x) || world.blobs[1 - me];
        if (ball.vx * toNet > 0 && sideOfX(this.predX) !== me && Math.abs(this.predX - opp.x) > 90) this.wantAbility = true;
        break;
      }
      case 'ruzgar': {
        // Karşıya giden yüksek topu rakibin arkasına (ya da boş tarafa) savur
        const opp = this.nearestOpp(world, ball.x) || world.blobs[1 - me];
        const farSide = (ball.x - opp.x) * toNet < 0;   // rakip topun önünde: itilirse arkasına düşer
        if (ball.vx * toNet > 0 && ball.y < 260 && Math.abs(ball.x - CONFIG.world.netX) < 170 && farSide) this.wantAbility = true;
        break;
      }
      case 'sisme':
        // Top üstüme iniyorsa büyü: daha geniş vuruş alanı, file önünde blok
        if (mySide && ball.vy > 0 && dist < 190 && Math.abs(this.predX - b.x) < 80) this.wantAbility = true;
        break;
      case 'tuyTop':
        // Top kendi sahama ama benden uzağa düşecekse hafiflet, yetişmeye zaman kazan
        if (mySide && ball.vy > 0 && sideOfX(this.predX) === me && Math.abs(this.predX - b.x) > 90) this.wantAbility = true;
        break;
      case 'turbo':
        // Top kendi sahama ama benden uzağa düşecekse koş
        if (sideOfX(this.predX) === me && ball.vy > -100 && Math.abs(this.predX - b.x) > 100) this.wantAbility = true;
        break;
      case 'sasirt':
      case 'kucult': {
        // Top rakibe gidiyorsa rakibi zorla (Şaşırt: uzağa düşecekse; Küçült: her karşılamada işe yarar)
        const opp = this.nearestOpp(world, ball.x) || world.blobs[1 - me];
        const far = Math.abs(this.predX - opp.x) > (b.active.id === 'sasirt' ? 70 : 30);
        if (ball.vx * toNet > 0 && sideOfX(this.predX) !== me && far) this.wantAbility = true;
        break;
      }
      case 'onsezi':
        if (ball.vx * toNet < 0 && sideOfX(this.predX) === me && Math.abs(this.predX - b.x) > 100) this.wantAbility = true;
        break;
      case 'kesikTop': {
        // Rakip arkadayken file üstünden geçen topu kes: dik düşer, rakip yetişemez
        const opp = this.nearestOpp(world, ball.x) || world.blobs[1 - me];
        const past = (ball.x - CONFIG.world.netX) * toNet;   // topun fileyi ne kadar geçtiği
        if (ball.vx * toNet > 0 && past > 20 && past < 120 && Math.abs(opp.x - CONFIG.world.netX) > 170) this.wantAbility = true;
        break;
      }
      case 'deprem': {
        // Top rakibe inerken yerdeki rakibi havaya savur
        const opp = this.nearestOpp(world, ball.x) || world.blobs[1 - me];
        if (!mySide && opp.grounded && ball.vy > 0 && ball.y > 140 && Math.abs(ball.x - opp.x) < 140) this.wantAbility = true;
        break;
      }
      case 'karaDelik':
        // Karşıya giden topu rakip sahanın ortasına (çoğu zaman rakibin ulaşamayacağı yere) çek
        if (ball.vx * toNet > 0 && Math.abs(ball.x - CONFIG.world.netX) < 140 && ball.y < 280) this.wantAbility = true;
        break;
      case 'ikinciSans': {
        // 3. dokunuşu yapmışken top hâlâ kendi sahamdaysa hakkı geri al
        const m = world.match;
        if (m && m.lastTouchTeam === me && m.touches[me] >= CONFIG.rules.maxTouches && mySide) this.wantAbility = true;
        break;
      }
      case 'ayna':
        // Top kendi sahama ve benden uzağa düşecekse yönünü ters çevir
        if (mySide && sideOfX(this.predX) === me && Math.abs(this.predX - b.x) > 110 && ball.y < 300 && ball.vx * toNet < 0) this.wantAbility = true;
        break;
      case 'dorukAtagi':
        // Fileye yakın yüksek topta sıçra ve sert vur
        if (mySide && b.grounded && Math.abs(dx) < 60 && ball.y < 240 && ball.vy > 0) this.wantAbility = true;
        break;
      case 'yakala':
        // Top bana iniyorsa yakala: rakibin yerleşmesine fırsat vermeden fırlatırım
        if (mySide && ball.vy > 0 && Math.abs(dx) < 80 && dist < 160) this.wantAbility = true;
        break;
      case 'hayalTop':
        // Topu karşıya yolladıktan hemen sonra sahtesini de yolla
        if (ball.vx * toNet > 0 && Math.abs(ball.x - CONFIG.world.netX) < 220 && (world.ball.decoys?.length || 0) === 0) this.wantAbility = true;
        break;
      case 'ejderNefesi': {
        // Uzanamayacağım top menzilde: üfle
        const far = Math.abs(this.predX - b.x) > 80;
        if (mySide && ball.vy > 0 && far && Math.hypot(ball.x - b.x, ball.y - (b.y - b.r * 1.4)) < CONFIG.abilities.ejderNefesi.range * 0.9) this.wantAbility = true;
        break;
      }
      case 'uyustur': {
        // Top rakibe gidiyor ve rakip yetişecek gibi: vuruşunu zayıflat
        const opp = this.nearestOpp(world, ball.x) || world.blobs[1 - me];
        if (ball.vx * toNet > 0 && sideOfX(this.predX) !== me && Math.abs(this.predX - opp.x) < 90) this.wantAbility = true;
        break;
      }
      case 'firtinaDarbesi': {
        // Top fileye yakın düşecek, rakip de file önünde: geriye savur
        const opp = this.nearestOpp(world, ball.x) || world.blobs[1 - me];
        const nearNet = Math.abs(this.predX - CONFIG.world.netX) < 170;
        if (ball.vx * toNet > 0 && sideOfX(this.predX) !== me && nearNet && Math.abs(opp.x - CONFIG.world.netX) < 200) this.wantAbility = true;
        break;
      }
      case 'arindir': {
        // Üzerimde olumsuz etki var ya da sahama etkili (falsolu, ağır, alevli…) top geliyor
        const debuffed = b.stunTimer > 0.6 || b.confuseTimer > 0.3 || b.shrinkTimer > 1 || b.weakTimer > 1 || b.freezeTimer > 0.3;
        const nasty = ball.spinTimer > 0 || ball.heavyTimer > 0 || ball.superTimer > 0 || ball.windTimer > 0 || ball.wellTimer > 0 || ball.fogTimer > 0;
        if (debuffed || (nasty && ball.vx * toNet < 0)) this.wantAbility = true;
        break;
      }
      case 'yuksekNota':
        // Yetişemeyeceğim top menzilde: havaya kaldır
        if (mySide && ball.vy > 0 && Math.abs(this.predX - b.x) > 70 && Math.hypot(ball.x - b.x, ball.y - (b.y - b.r * 1.4)) < CONFIG.abilities.yuksekNota.range * 0.9) this.wantAbility = true;
        break;
      case 'kutsama':
        // Olumsuz etki altındayım ya da top bana geliyor: kutsan
        if (b.stunTimer > 0.4 || b.confuseTimer > 0.2 || b.shrinkTimer > 0.5 || b.weakTimer > 0.5 || b.rootTimer > 0.4 || b.freezeTimer > 0.2 || (ball.vx * toNet < 0 && !mySide)) this.wantAbility = true;
        break;
      case 'korTop':
      case 'kokSal':
        // Top rakibe gidiyor: tam alacakları sırada
        if (ball.vx * toNet > 0 && sideOfX(this.predX) !== me) this.wantAbility = true;
        break;
      case 'hatVurusu':
        // Fileye yakın ve yüksekteyim: düz vuruş
        if (mySide && dist < 120 && Math.abs(b.x - CONFIG.world.netX) < 200) this.wantAbility = true;
        break;
      case 'kisaDevre': {
        // Rakibin yeteneği hazırsa ya da Hyper barı dolmak üzereyse boz
        const opp = this.nearestOpp(world, ball.x) || world.blobs[1 - me];
        if (opp && ((opp.active && opp.cooldown <= 0.5) || opp.hyperMeter > 0.6)) this.wantAbility = true;
        break;
      }
      case 'gokAskisi':
        // Kendi sahama düşecek topa yetişemeyeceğim: topu havada tut, zaman kazan
        if (mySide && ball.vy > 0 && Math.abs(this.predX - b.x) > 110 && !(world.match && world.match.lastTouchTeam === me && world.match.touches[me] >= 1)) this.wantAbility = true;
        break;
      case 'yavasZaman':
        if (ball.speed > 560 && ball.vx * toNet < 0 && Math.abs(ball.x - CONFIG.world.netX) < 200) this.wantAbility = true;
        break;
    }
  }
}
