// =============================================================================
//  physics.js — Kendi yazdığımız basit 2B fizik.
//
//  ÖNEMLİ: Bu fonksiyonlar HER ZAMAN sabit dt = 1/60 sn ile çağrılır (bkz. main.js
//  içindeki accumulator döngüsü). Sabit adım sayesinde:
//   • zıplama yüksekliği / top yayı her bilgisayarda birebir aynıdır (FPS'ten bağımsız),
//   • çarpışmalar öngörülebilir olur, yapay zeka aynı fonksiyonla geleceği simüle edebilir,
//   • tekrar (replay) kaydı adım adım tutarlıdır.
//  Slow-motion fizik adımını küçültmez; sadece saniyede KAÇ adım atılacağını azaltır.
//
//  Koordinatlar: y aşağı doğru artar. Blob.y = gövdenin tabanı, Ball.(x,y) = topun merkezi.
// =============================================================================
import { CONFIG } from '../config.js';
import { MODS } from './mods.js';

const W = CONFIG.world;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Blob'un çarpışma şekli: Blobby Volley'deki gibi üst üste iki daire (gövde + baş).
 * Her ikisi de blob.r ile ölçeklenir (Dev Blob pasifi hepsini büyütür).
 */
export function blobCircles(blob) {
  const B = CONFIG.blob, r = blob.r;
  return [
    { cx: blob.x, cy: blob.y - B.headY * r, R: B.headR * r },
    { cx: blob.x, cy: blob.y - B.bodyY * r, R: B.bodyR * r },
  ];
}

/** Blob'un en üst noktasının y'si. */
export const blobTop = (blob) => blob.y - (CONFIG.blob.headY + CONFIG.blob.headR) * blob.r;

/** Bir x koordinatının hangi takımın sahasında olduğu (0 = sol, 1 = sağ). */
export const sideOfX = (x) => (x < W.netX ? 0 : 1);

/** Blob'un kendi sahasında kalabileceği x aralığı (duvar ↔ file). */
export function blobBounds(team, r) {
  return team === 0
    ? [r, W.netX - W.netHalfWidth - r]
    : [W.netX + W.netHalfWidth + r, CONFIG.width - r];
}

// -----------------------------------------------------------------------------
//  BLOB HAREKETİ
// -----------------------------------------------------------------------------
/**
 * @param ctrl {move:-1..1, jump:bool}
 * @param events olay listesi (ses/efekt için: 'jump', 'land')
 */
export function stepBlob(blob, ctrl, dt, events) {
  const B = CONFIG.blob;
  blob.prevX = blob.x;
  blob.prevY = blob.y;
  blob.touchLock = Math.max(0, blob.touchLock - dt);

  const frozen = blob.freezeTimer > 0;   // Hyper: Zaman Durdur
  const move = frozen ? 0 : clamp(ctrl.move || 0, -1, 1) * (blob.confuseTimer > 0 ? -1 : 1);   // Şaşırt: yönler ters
  const prevJump = blob.prevJump;
  blob.prevJump = !!ctrl.jump;
  if (move !== 0) {
    blob.facing = Math.sign(move);
    blob.lastMoveDir = blob.facing;
  }

  if (blob.knockTimer > 0) {
    // Fırtına Darbesi: kısa süre kontrol yok, fileden uzağa savrulur (hız azalarak)
    blob.knockTimer -= dt;
    blob.vx = blob.knockVx;
    blob.knockVx *= Math.max(0, 1 - dt * 4);
    blob.vy += B.gravity * MODS.blobGravity * dt;
  } else if (blob.dashTimer > 0) {
    // Hava Atılması: kısa süre yerçekimsiz, sabit yatay hız.
    blob.dashTimer -= dt;
    blob.vx = blob.dashVx;
    blob.vy = 0;
  } else {
    // Blobby'deki gibi anlık (ivmesiz) yatay hareket: kontrol keskin hissettirir.
    const stun = blob.stunTimer > 0 ? CONFIG.abilities.sersemlet : null;   // Sersemlet
    const turbo = blob.turboTimer > 0 ? CONFIG.abilities.turbo.speedMul : 1;   // Turbo
    const bless = blob.blessTimer > 0 ? CONFIG.abilities.kutsama : null;   // Kutsama
    const targetVx = move * B.moveSpeed * blob.speedMul * turbo * (bless ? bless.speedMul : 1) * (blob.hSpeed || 1) * (stun ? stun.speedMul : 1);
    // Parti "Kaygan Zemin": yerdeyken hız hedefe yavaşça yaklaşır (kayma)
    if (MODS.slippery && blob.grounded) blob.vx += (targetVx - blob.vx) * Math.min(1, dt * 3.2);
    else blob.vx = targetVx;

    const rooted = blob.rootTimer > 0;   // Kök Sal: zıplayamaz
    if (ctrl.jump && blob.grounded && !frozen && !rooted) {
      // Yükseklik h = v²/2g olduğundan, yüksekliği k katına çıkarmak için hız √k ile çarpılır.
      blob.vy = -B.jumpVelocity * Math.sqrt(blob.jumpMul * MODS.jump * (blob.hJump || 1) * (bless ? bless.jumpMul : 1) * (stun ? stun.jumpMul : 1));
      blob.grounded = false;
      blob.airJumps = blob.extraJumps;
      events?.push({ type: 'jump', blob });
    } else if (ctrl.jump && !rooted && !prevJump && !blob.grounded && blob.airJumps > 0 && blob.vy >= CONFIG.abilities.ciftZiplama.minFall) {
      // Çift Zıplama: zirveden sonra (düşerken) tuşa YENİDEN basınca ikinci, daha alçak zıplama
      blob.airJumps--;
      blob.vy = -B.jumpVelocity * Math.sqrt(blob.jumpMul * MODS.jump) * CONFIG.abilities.ciftZiplama.secondJumpMul;
      events?.push({ type: 'doubleJump', blob });
    }

    // Değişken zıplama: tuş bırakılırsa yükselirken yerçekimi artar → daha alçak zıplama.
    let g = B.gravity * MODS.blobGravity;
    if (!ctrl.jump && blob.vy < 0) g *= B.jumpReleaseGravityMul;
    // Süzülme: düşerken zıplama tuşu basılı tutulursa yavaş iner
    if (blob.glide && ctrl.jump && blob.vy > 0) g *= CONFIG.abilities.suzulme.fallGravityMul;
    blob.vy += g * dt;
  }

  // Semi-implicit Euler: önce hız, sonra konum güncellenir (sabit dt ile kararlı).
  blob.x += blob.vx * dt;
  blob.y += blob.vy * dt;

  // Duvar ve file sınırı
  const [minX, maxX] = blobBounds(blob.team, blob.r);
  if (blob.x < minX) { blob.x = minX; blob.dashTimer = 0; }
  if (blob.x > maxX) { blob.x = maxX; blob.dashTimer = 0; }

  // Zemin
  if (blob.y >= W.groundY) {
    if (!blob.grounded) events?.push({ type: 'land', blob, impact: blob.vy });
    blob.y = W.groundY;
    blob.vy = 0;
    blob.grounded = true;
  } else {
    blob.grounded = false;
  }
}

// -----------------------------------------------------------------------------
//  TOP
// -----------------------------------------------------------------------------
function speedLimit(ball) {
  const C = CONFIG.ball;
  const boost = ball.boostTimer > 0 ? CONFIG.abilities.gucVurusu.speedMul : 1;
  const sup = ball.superTimer > 0 ? CONFIG.hyper.speedCap : 1;   // Hyper dalışı
  return C.maxSpeed * Math.max(boost, sup) * MODS.hitSpeed;
}

/** Topu maksimum hız sınırına kırp (yönü koruyarak). */
export function clampBallSpeed(ball) {
  const max = speedLimit(ball);
  const s = Math.hypot(ball.vx, ball.vy);
  if (s > max) {
    const k = max / s;
    ball.vx *= k;
    ball.vy *= k;
  }
}

/**
 * Topu bir adım ilerletir ve tüm çarpışmaları çözer.
 * @param blobs  çarpışılacak blob'lar (yapay zeka tahmininde boş dizi)
 * @param hooks  { onHit(blob, ball, info) } — kurallar ve yetenekler buradan devreye girer
 * @param events olay listesi: 'hit', 'wall', 'net', 'cross', 'ground'
 */
export function stepBall(ball, blobs, dt, hooks, events) {
  const C = CONFIG.ball;
  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.prevRot = ball.rot;
  if (!ball.active) return;

  // --- Servis: top havada asılı bekler; sadece blob çarpışmasına bakılır ---
  if (ball.hover) {
    ball.hoverTime += dt;
    ball.y = ball.hoverY + Math.sin(ball.hoverTime * 3) * 4;
    ball.vx = ball.vy = 0;
    for (const b of blobs) if (!b.ghost && collideBlob(ball, b, hooks, events)) break;
    if (ball.hover && ball.hoverTime > C.hoverTimeout) ball.hover = false;
    return;
  }

  // Yavaş Zaman: SADECE topun zamanı yavaşlar (blob'lar normal hızda).
  const h = dt * (ball.slowTimer > 0 ? CONFIG.abilities.yavasZaman.ballTimeScale : 1);

  // Kuvvetler: yerçekimi + dış ivme (Mıknatıs) + hava sürtünmesi
  // Falso (Magnus etkisi): hıza dik bir ivme; top yay çizerek kıvrılır.
  if (ball.spinTimer > 0) {
    ball.ax += -ball.spin * ball.vy;
    ball.ay += ball.spin * ball.vx;
  }
  if (ball.windTimer > 0) ball.ax += ball.windDir * CONFIG.abilities.ruzgar.accel;   // Rüzgâr
  if (MODS.windX && !ball.hover) ball.ax += MODS.windX;   // Parti: Fırtına
  if (ball.wellTimer > 0) {
    // Kara Delik: sabit büyüklükte, çekim noktasına doğru ivme
    const dx = ball.wellX - ball.x, dy = ball.wellY - ball.y, d = Math.hypot(dx, dy) || 1;
    ball.ax += (dx / d) * CONFIG.abilities.karaDelik.strength;
    ball.ay += (dy / d) * CONFIG.abilities.karaDelik.strength;
  }
  if (ball.lineTimer > 0) ball.lineTimer -= h;
  const gMul = ball.lineTimer > 0 ? 0                                        // Hat Vuruşu: düz uçuş
    : ball.heavyTimer > 0 ? CONFIG.abilities.agirTop.gravityMul              // Ağır Top
    : ball.floatTimer > 0 ? CONFIG.abilities.tuyTop.gravityMul               // Tüy Top
    : ball.superTimer > 0 ? CONFIG.hyper.diveGravity : 1;                    // Hyper dalışı
  ball.vy += (C.gravity * gMul * MODS.ballGravity + ball.ay) * h;
  ball.vx += ball.ax * h;
  ball.ax = ball.ay = 0;
  const drag = Math.max(0, 1 - C.airDrag * h);
  ball.vx *= drag;
  ball.vy *= drag;
  clampBallSpeed(ball);

  // Alt adımlar: hızlı top bir adımda ince direğin içinden "tünel" geçmesin diye
  // hareket N parçaya bölünür ve her parçadan sonra çarpışmalar çözülür.
  const n = CONFIG.physics.ballSubsteps;
  const sh = h / n;
  for (let i = 0; i < n; i++) {
    const sideBefore = ball.x < W.netX ? -1 : 1;
    ball.x += ball.vx * sh;
    ball.y += ball.vy * sh;

    collideWalls(ball, events);
    collideNet(ball, sideBefore, events);
    for (const b of blobs) collideBlob(ball, b, hooks, events);
    // Blob topu fileye sıkıştırmış olabilir: file son sözü söylesin (top direğin içinde kalmasın).
    collideNet(ball, ball.x < W.netX ? -1 : 1, null);

    const sideAfter = ball.x < W.netX ? -1 : 1;
    if (sideAfter !== sideBefore) events?.push({ type: 'cross', from: sideBefore < 0 ? 0 : 1 });

    // Zemin: top bir sahanın kumuna değdi → sayı (kurallar main/rules tarafında).
    if (ball.y + ball.r >= W.groundY) {
      ball.y = W.groundY - ball.r;
      ball.active = false;
      events?.push({ type: 'ground', x: ball.x, y: W.groundY });
      break;
    }
  }

  // Yuvarlanma: kat edilen yatay yol / yarıçap = dönüş açısı (radyan)
  ball.rot += (ball.vx * h) / ball.r;
}

// --- Duvarlar ve tavan: eksene hizalı düzlemler; konumu düzelt, hızı yansıt. ---
function collideWalls(ball, events) {
  const C = CONFIG.ball;
  if (ball.x < ball.r) {
    ball.x = ball.r;
    if (ball.vx < 0) { ball.vx = -ball.vx * C.wallRestitution; events?.push({ type: 'wall', x: ball.x, y: ball.y }); }
  } else if (ball.x > CONFIG.width - ball.r) {
    ball.x = CONFIG.width - ball.r;
    if (ball.vx > 0) { ball.vx = -ball.vx * C.wallRestitution; events?.push({ type: 'wall', x: ball.x, y: ball.y }); }
  }
  if (ball.y < W.ceilingY + ball.r) {
    ball.y = W.ceilingY + ball.r;
    if (ball.vy < 0) { ball.vy = -ball.vy * C.ceilingRestitution; events?.push({ type: 'wall', x: ball.x, y: ball.y }); }
  }
}

// --- File: (1) ince dikey direk = dikdörtgen, (2) üstte yuvarlak başlık = daire. ---
function collideNet(ball, sideBefore, events) {
  const C = CONFIG.ball;

  // (1) Direk: başlık merkezinin altında kalan kısım. Top direğin içine girdiyse
  //     geldiği tarafa itilir ve yatay hızı yansıtılır.
  if (ball.y > W.netTopY) {
    const lim = W.netHalfWidth + ball.r;
    if (Math.abs(ball.x - W.netX) < lim) {
      ball.x = W.netX + sideBefore * lim;
      if (ball.vx * sideBefore < 0) {
        ball.vx = -ball.vx * C.netRestitution;
        events?.push({ type: 'net', x: ball.x, y: ball.y });
      }
    }
  }

  // (2) Yuvarlak üst uç: daire–daire çarpışması.
  const dx = ball.x - W.netX;
  const dy = ball.y - W.netTopY;
  const R = W.netCapRadius + ball.r;
  const d2 = dx * dx + dy * dy;
  if (d2 < R * R) {
    const d = Math.sqrt(d2) || 1e-4;
    let nx = dx / d;
    let ny = dy / d;
    // Top tam tepeye denk gelirse sonsuza dek dikey sekmesin: minik bir sapma ekle.
    if (Math.abs(nx) < 0.03) {
      nx += (Math.random() < 0.5 ? -1 : 1) * 0.06;
      const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    }
    // Konum düzeltmesi: topu tam temas mesafesine geri it.
    ball.x = W.netX + nx * R;
    ball.y = W.netTopY + ny * R;
    // Hız yansıması: v' = v - (1+e)(v·n)n  (sadece içeri doğru hareket ediyorsa)
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= (1 + C.netRestitution) * vn * nx;
      ball.vy -= (1 + C.netRestitution) * vn * ny;
      events?.push({ type: 'net', x: ball.x, y: ball.y });
    }
  }
}

/**
 * TOP–BLOB ÇARPIŞMASI (dairesel).
 * Blob'un şekli iki dairedir (gövde + baş). Top her ikisiyle de daire–daire testine girer;
 * en derin batan daire çarpışmayı belirler ve normal o dairenin merkezinden topa doğrudur.
 * Blob "sonsuz kütleli" kabul edilir: blob itilmez, top dışarı taşınır.
 *
 * Klasik Blobby hissi: top, gelen hızından bağımsız olarak çarpışma NORMALİ doğrultusunda
 * sabit bir hızla (hitSpeed) fırlar; buna blob'un kendi hızının bir kısmı eklenir.
 * Böylece topu blob'un neresiyle vurduğun yönü belirler; koşup zıplamak ekstra güç katar.
 */
function collideBlob(ball, blob, hooks, events) {
  const C = CONFIG.ball;
  let best = null, bestDepth = 0;
  for (const c of blobCircles(blob)) {
    const dx = ball.x - c.cx, dy = ball.y - c.cy;
    const R = c.R + ball.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    const d = Math.sqrt(d2) || 1e-4;
    const depth = R - d;
    if (depth > bestDepth) { bestDepth = depth; best = { c, dx, dy, d, R }; }
  }
  if (!best) return false;

  const { c, d, R } = best;
  let nx = best.dx / d, ny = best.dy / d;
  if (best.d < 1e-3) { nx = 0; ny = -1; }

  // 1) Konum düzeltmesi: top tam temas noktasına taşınır (iç içe geçme kalmaz).
  ball.x = c.cx + nx * R;
  ball.y = c.cy + ny * R;

  const inSpeed = Math.hypot(ball.vx, ball.vy);   // gelen topun hızı (Yumuşak Dokunuş için)

  // 2) Yeni hız = normal * sabit vuruş hızı + blob hızının bir kısmı
  const hm = MODS.hitSpeed * (blob.hHit || 1) * (blob.blessTimer > 0 ? CONFIG.abilities.kutsama.hitMul : 1) * (blob.weakTimer > 0 ? CONFIG.abilities.uyustur.hitMul : 1);   // Parti, Hyper ve Uyuştur çarpanları
  ball.vx = nx * C.hitSpeed * hm + blob.vx * C.blobVelocityInfluence;
  ball.vy = ny * C.hitSpeed * hm + blob.vy * C.blobVelocityInfluence;

  // 3) Normal doğrultusundaki bileşen en az minOutwardSpeed olsun (top blob'dan uzaklaşmalı).
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < C.minOutwardSpeed) {
    ball.vx += (C.minOutwardSpeed - vn) * nx;
    ball.vy += (C.minOutwardSpeed - vn) * ny;
  }

  ball.hover = false;

  // 4) Kurallar ve yetenekler (Güç Vuruşu, Yumuşak Dokunuş vb.) hızı burada değiştirebilir.
  hooks?.onHit?.(blob, ball, { nx, ny, inSpeed });
  clampBallSpeed(ball);

  events?.push({
    type: 'hit', blob,
    x: c.cx + nx * c.R, y: c.cy + ny * c.R,   // temas noktası (efekt için)
    speed: Math.hypot(ball.vx, ball.vy),
  });
  return true;
}

// -----------------------------------------------------------------------------
//  YAPAY ZEKA İÇİN TAHMİN
// -----------------------------------------------------------------------------
/**
 * Topun kopyasını aynı fizikle (blob'lar olmadan) ileri simüle eder ve topun
 * aşağı inerken targetY yüksekliğine ulaştığı x'i döndürür.
 */
const _sim = { r: 16 };
export function predictLanding(ball, targetY, maxTime = 3) {
  if (ball.hover) return { x: ball.x, t: 0 };
  Object.assign(_sim, {
    x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.r,
    ax: 0, ay: 0, rot: 0, prevX: 0, prevY: 0, prevRot: 0,
    active: ball.active, hover: false, hoverTime: 0, hoverY: 0,
    slowTimer: ball.slowTimer, boostTimer: ball.boostTimer, spin: ball.spin, spinTimer: ball.spinTimer, heavyTimer: ball.heavyTimer,
    windTimer: ball.windTimer || 0, windDir: ball.windDir || 0, floatTimer: ball.floatTimer || 0,
    wellTimer: ball.wellTimer || 0, wellX: ball.wellX || 0, wellY: ball.wellY || 0, superTimer: ball.superTimer || 0,
  });
  const dt = CONFIG.physics.step;
  let t = 0;
  while (t < maxTime && _sim.active) {
    stepBall(_sim, [], dt, null, null);
    _sim.slowTimer = Math.max(0, _sim.slowTimer - dt);
    _sim.boostTimer = Math.max(0, _sim.boostTimer - dt);
    _sim.spinTimer = Math.max(0, _sim.spinTimer - dt);
    _sim.heavyTimer = Math.max(0, _sim.heavyTimer - dt);
    _sim.windTimer = Math.max(0, _sim.windTimer - dt);
    _sim.floatTimer = Math.max(0, _sim.floatTimer - dt);
    _sim.wellTimer = Math.max(0, _sim.wellTimer - dt);
    _sim.superTimer = Math.max(0, _sim.superTimer - dt);
    t += dt;
    if (_sim.vy > 0 && _sim.y >= targetY) break;
  }
  return { x: _sim.x, t, vx: _sim.vx, vy: _sim.vy };
}

/**
 * Topun yolunu nokta nokta tahmin et (Kâhin'in Hyper'ı çizer). Yere değene kadar.
 * @param out düz dizi [x0,y0,x1,y1,...] — yeniden kullanılır (bellek tahsisi yok)
 */
export function predictPath(ball, out, stride = 4, maxTime = 2.5) {
  out.length = 0;
  if (!ball.active || ball.hover) return out;
  Object.assign(_sim, {
    x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.r,
    ax: 0, ay: 0, rot: 0, prevX: 0, prevY: 0, prevRot: 0,
    active: true, hover: false, hoverTime: 0, hoverY: 0,
    slowTimer: ball.slowTimer, boostTimer: ball.boostTimer, spin: ball.spin, spinTimer: ball.spinTimer, heavyTimer: ball.heavyTimer,
    windTimer: ball.windTimer || 0, windDir: ball.windDir || 0, floatTimer: ball.floatTimer || 0,
    wellTimer: ball.wellTimer || 0, wellX: ball.wellX || 0, wellY: ball.wellY || 0, superTimer: ball.superTimer || 0,
  });
  const dt = CONFIG.physics.step;
  for (let i = 0, t = 0; t < maxTime && _sim.active; i++, t += dt) {
    stepBall(_sim, [], dt, null, null);
    _sim.spinTimer = Math.max(0, _sim.spinTimer - dt);
    _sim.heavyTimer = Math.max(0, _sim.heavyTimer - dt);
    _sim.windTimer = Math.max(0, _sim.windTimer - dt);
    _sim.floatTimer = Math.max(0, _sim.floatTimer - dt);
    _sim.wellTimer = Math.max(0, _sim.wellTimer - dt);
    _sim.superTimer = Math.max(0, _sim.superTimer - dt);
    if (i % stride === 0) out.push(_sim.x, _sim.y);
    if (_sim.y + _sim.r >= CONFIG.world.groundY - 1) { out.push(_sim.x, _sim.y); break; }
  }
  return out;
}
