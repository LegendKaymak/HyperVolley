// =============================================================================
//  abilities.js — Veri odaklı yetenek tanımları.
//
//  Her yetenek: { id, name, desc, type: 'passive'|'active', cooldown?, duration?,
//                 apply(blob), remove(blob), activate(blob, ctx) → bool,
//                 update(blob, ctx, dt), onHit(blob, ball, ctx, info) }
//  Hiçbir yetenek doğrudan sayı kazandırmaz; hepsi kontrol/his üzerinde küçük oynamalar yapar.
//  Sayısal değerler config.js → CONFIG.abilities içinde.
//
//  ctx = { ball, emit(event) }   info = { first:boolean (takımın ilk dokunuşu), nx, ny }
// =============================================================================
import { CONFIG } from '../config.js';
import { blobBounds, predictLanding, blobCircles, blobTop } from './physics.js';
import { MODS } from './mods.js';

const A = CONFIG.abilities;
const pct = (m) => Math.round(Math.abs(m - 1) * 100);
/**
 * Topun baş yüksekliğine ineceği noktanın (biraz arkasının) altına ışınla.
 * Top kendi sahana düşmeyecekse ya da zaten oradaysan false (hak harcanmaz).
 */
export function teleportUnderBall(b, ctx) {
  const ball = ctx.ball;
  if (!ball.active || ball.hover) return false;
  const head = blobCircles(b)[0];
  const hitY = CONFIG.world.groundY - (b.y - head.cy) - head.R - ball.r;
  const land = predictLanding(ball, hitY, 3).x;
  const [minX, maxX] = blobBounds(b.team, b.r);
  if (land < minX - 30 || land > maxX + 30) return false;
  const from = b.x;
  const to = Math.max(minX, Math.min(maxX, land - (b.team === 0 ? 10 : -10)));   // topun biraz arkası: karşıya vurabilsin
  if (Math.abs(to - from) < 25) return false;
  b.x = b.prevX = to;
  ctx.emit({ type: 'teleport', blob: b, from, to });
  return true;
}

/** Rakip: 1'e 1'de karşıdaki blob; 2'ye 2'de topa en yakın rakip. */
function foeOf(b, ctx) {
  let best = null, bd = Infinity;
  for (const o of ctx.blobs) {
    if (o.team === b.team || o.ghost) continue;
    const d = Math.abs(o.x - ctx.ball.x);
    if (d < bd) { bd = d; best = o; }
  }
  return best || ctx.blobs[1 - b.team];
}

export const ABILITIES = [
  // ---------------------------------------------------------------- PASİFLER
  {
    id: 'zipir', type: 'passive', name: 'Zıpır',
    desc: `%${pct(A.zipir.jumpHeightMul)} daha yüksek zıplama`,
    apply(b) { b.jumpMul *= A.zipir.jumpHeightMul; },
    remove(b) { b.jumpMul /= A.zipir.jumpHeightMul; },
  },
  {
    id: 'hizliAyaklar', type: 'passive', name: 'Hızlı Ayaklar',
    desc: `%${pct(A.hizliAyaklar.speedMul)} daha hızlı hareket`,
    apply(b) { b.speedMul *= A.hizliAyaklar.speedMul; },
    remove(b) { b.speedMul /= A.hizliAyaklar.speedMul; },
  },
  {
    id: 'yumusakDokunus', type: 'passive', name: 'Yumuşak Dokunuş',
    desc: `Sert gelen topu ilk dokunuşta %${Math.round(A.yumusakDokunus.damping * 100)} yavaşlatır`,
    onHit(b, ball, ctx, info) {
      if (!info.first || !(info.inSpeed > A.yumusakDokunus.minIncoming)) return;
      const k = 1 - A.yumusakDokunus.damping;
      ball.vx *= k;
      ball.vy *= k;
      ctx.emit({ type: 'softTouch', blob: b, x: ball.x, y: ball.y });
    },
  },
  {
    id: 'devBlob', type: 'passive', name: 'Dev Blob',
    desc: `%${pct(A.devBlob.radiusMul)} büyük, %${pct(A.devBlob.speedMul)} yavaş`,
    apply(b) { b.radiusMul *= A.devBlob.radiusMul; b.speedMul *= A.devBlob.speedMul; },
    remove(b) { b.radiusMul /= A.devBlob.radiusMul; b.speedMul /= A.devBlob.speedMul; },
  },

  {
    id: 'sertVurus', type: 'passive', name: 'Sert Vuruş',
    desc: `Vuruşlar %${pct(A.sertVurus.hitMul)} daha güçlü`,
    apply(b) { b.hitMul = A.sertVurus.hitMul; },
    remove(b) { b.hitMul = 1; },
    onHit(b, ball) { ball.vx *= b.hitMul; ball.vy *= b.hitMul; },
  },
  {
    id: 'suzulme', type: 'passive', name: 'Süzülme',
    desc: 'Zıplamayı basılı tut, yavaş in',
    apply(b) { b.glide = true; },
    remove(b) { b.glide = false; },
  },
  {
    id: 'ciftZiplama', type: 'passive', name: 'Çift Zıplama',
    desc: 'Düşerken bir kez daha zıpla',
    apply(b) { b.extraJumps = 1; },
    remove(b) { b.extraJumps = 0; b.airJumps = 0; },
  },

  {
    id: 'zirve', type: 'passive', name: 'Zirve',
    desc: `Hem hız hem zıplama %${pct(A.zirve.speedMul)} fazla`,
    apply(b) { b.speedMul *= A.zirve.speedMul; b.jumpMul *= A.zirve.jumpHeightMul; },
    remove(b) { b.speedMul /= A.zirve.speedMul; b.jumpMul /= A.zirve.jumpHeightMul; },
  },

  // ---------------------------------------------------------------- AKTİFLER
  {
    id: 'isinlanma', type: 'active', name: 'Işınlanma',
    cooldown: A.isinlanma.cooldown, duration: 0,
    desc: 'Baktığın yöne anında kısa ışınlanma',
    activate(b, ctx) {
      const dir = b.lastMoveDir || (b.team === 0 ? 1 : -1);
      const [minX, maxX] = blobBounds(b.team, b.r);
      const from = b.x;
      const to = Math.max(minX, Math.min(maxX, b.x + dir * A.isinlanma.distance));
      if (Math.abs(to - from) < 20) return false;   // duvara/fileye yapışıkken hak harcanmasın
      b.x = b.prevX = to;                             // prevX de değişir: çizimde kayma değil, anında geçiş
      ctx.emit({ type: 'teleport', blob: b, from, to });
      return true;
    },
  },
  {
    id: 'roketZiplama', type: 'active', name: 'Roket Zıplama',
    cooldown: A.roketZiplama.cooldown, duration: 0,
    desc: 'Yerden anında çok yükseğe zıpla',
    activate(b, ctx) {
      if (!b.grounded) return false;
      b.vy = -CONFIG.blob.jumpVelocity * Math.sqrt(b.jumpMul) * A.roketZiplama.jumpMul;
      b.grounded = false;
      b.airJumps = b.extraJumps;
      ctx.emit({ type: 'rocketJump', blob: b });
      return true;
    },
  },
  {
    id: 'agirTop', type: 'active', name: 'Ağır Top',
    cooldown: A.agirTop.cooldown, duration: A.agirTop.duration,
    desc: `Top ${A.agirTop.duration} sn ağırlaşır, hızlı düşer`,
    activate(b, ctx) {
      if (!ctx.ball.active || ctx.ball.hover) return false;
      ctx.ball.heavyTimer = A.agirTop.duration;
      ctx.ball.floatTimer = 0;
      return true;
    },
  },
  {
    id: 'kalkan', type: 'active', name: 'Kalkan',
    cooldown: A.kalkan.cooldown, duration: A.kalkan.duration,
    desc: 'Sahana düşen topu bir kez geri çevirir',
    // Asıl etki world.js'te: süre içinde top bu takımın kumuna değerse sayı olmaz, top yukarı seker.
    activate(b) { b.fx.shield = A.kalkan.duration; return true; },
    update(b, ctx, dt) { b.fx.shield = Math.max(0, b.fx.shield - dt); },
    remove(b) { b.fx.shield = 0; },
  },
  {
    id: 'falso', type: 'active', name: 'Falso',
    cooldown: A.falso.cooldown, duration: A.falso.window,
    desc: 'Sonraki vuruşta top havada kıvrılır',
    activate(b) { b.fx.spin = A.falso.window; return true; },
    update(b, ctx, dt) { b.fx.spin = Math.max(0, b.fx.spin - dt); },
    onHit(b, ball, ctx) {
      if (b.fx.spin <= 0) return;
      b.fx.spin = 0;
      b.activeTimer = 0;
      // Topspin: topun gittiği yöne göre aşağı doğru kıvrılsın
      const dir = Math.sign(ball.vx) || (b.team === 0 ? 1 : -1);
      ball.spin = dir * A.falso.spin;
      ball.spinTimer = A.falso.spinTime;
      ctx.emit({ type: 'spinHit', blob: b, x: ball.x, y: ball.y });
    },
    remove(b) { b.fx.spin = 0; },
  },
  {
    id: 'gucVurusu', type: 'active', name: 'Güç Vuruşu',
    cooldown: A.gucVurusu.cooldown, duration: A.gucVurusu.window,
    desc: `Sonraki vuruş %${pct(A.gucVurusu.speedMul)} güçlü`,
    activate(b) { b.fx.power = A.gucVurusu.window; return true; },
    update(b, ctx, dt) { b.fx.power = Math.max(0, b.fx.power - dt); },
    onHit(b, ball, ctx) {
      if (b.fx.power <= 0) return;
      b.fx.power = 0;
      b.activeTimer = 0;
      ball.boostTimer = A.gucVurusu.boostTime;   // hız sınırı geçici olarak yükselir
      ball.vx *= A.gucVurusu.speedMul;
      ball.vy *= A.gucVurusu.speedMul;
      ball.fireTimer = A.gucVurusu.fireTime;
      ctx.emit({ type: 'powerHit', blob: b, x: ball.x, y: ball.y });
    },
    remove(b) { b.fx.power = 0; },
  },
  {
    id: 'havaAtilmasi', type: 'active', name: 'Hava Atılması',
    cooldown: A.havaAtilmasi.cooldown, duration: A.havaAtilmasi.dashTime,
    desc: 'Havada yatay atılma',
    activate(b) {
      if (b.grounded) return false;          // Sadece havada; hak harcanmaz.
      const dir = b.lastMoveDir || (b.team === 0 ? 1 : -1);
      b.dashTimer = A.havaAtilmasi.dashTime;
      b.dashVx = dir * A.havaAtilmasi.dashSpeed;
      return true;
    },
    remove(b) { b.dashTimer = 0; },
  },
  {
    id: 'miknatis', type: 'active', name: 'Mıknatıs',
    cooldown: A.miknatis.cooldown, duration: A.miknatis.duration,
    desc: `Topu ${A.miknatis.duration} sn sana çeker`,
    activate(b) { b.fx.magnet = A.miknatis.duration; return true; },
    update(b, ctx, dt) {
      if (b.fx.magnet <= 0) return;
      b.fx.magnet = Math.max(0, b.fx.magnet - dt);
      const ball = ctx.ball;
      if (!ball.active || ball.hover) return;
      // Çekim merkezi: gövdenin biraz üstü. Kuvvet mesafeyle doğrusal azalır.
      const tx = b.x, ty = b.y - b.r * 1.6;
      const dx = tx - ball.x, dy = ty - ball.y;
      const d = Math.hypot(dx, dy);
      if (d < 1 || d > A.miknatis.radius) return;
      const f = A.miknatis.strength * (1 - d / A.miknatis.radius);
      ball.ax += (dx / d) * f;
      ball.ay += (dy / d) * f;
    },
    // Topa dokununca çekim biter (yoksa vurduğun topu geri çeker, fazladan dokunuş olur)
    onHit(b) { if (b.fx.magnet > 0) { b.fx.magnet = 0; b.activeTimer = 0; } },
    remove(b) { b.fx.magnet = 0; },
  },
  {
    id: 'yavasZaman', type: 'active', name: 'Yavaş Zaman',
    cooldown: A.yavasZaman.cooldown, duration: A.yavasZaman.duration,
    desc: `Top ${A.yavasZaman.duration} sn yavaşlar`,
    activate(b, ctx) {
      if (!ctx.ball.active) return false;
      ctx.ball.slowTimer = A.yavasZaman.duration;
      return true;
    },
  },
  {
    id: 'sersemlet', type: 'active', name: 'Sersemlet',
    cooldown: A.sersemlet.cooldown, duration: A.sersemlet.duration,
    desc: `Rakip ${A.sersemlet.duration} sn yavaş hareket eder`,
    activate(b, ctx) {
      if (!ctx.ball.active) return false;
      const foe = foeOf(b, ctx);
      foe.stunTimer = A.sersemlet.duration;
      ctx.emit({ type: 'stun', blob: b, target: foe });
      return true;
    },
  },
  {
    id: 'sisme', type: 'active', name: 'Şişme',
    cooldown: A.sisme.cooldown, duration: A.sisme.duration,
    desc: `${A.sisme.duration} sn boyunca %${pct(A.sisme.radiusMul)} büyür`,
    activate(b, ctx) {
      b.growTimer = A.sisme.duration;
      ctx.emit({ type: 'grow', blob: b });
      return true;
    },
    remove(b) { b.growTimer = 0; b.growMul = 1; },
  },
  {
    id: 'tuyTop', type: 'active', name: 'Tüy Top',
    cooldown: A.tuyTop.cooldown, duration: A.tuyTop.duration,
    desc: `Top ${A.tuyTop.duration} sn hafifler, yavaş düşer`,
    activate(b, ctx) {
      if (!ctx.ball.active || ctx.ball.hover) return false;
      ctx.ball.floatTimer = A.tuyTop.duration;
      ctx.ball.heavyTimer = 0;
      return true;
    },
  },
  {
    id: 'turbo', type: 'active', name: 'Turbo',
    cooldown: A.turbo.cooldown, duration: A.turbo.duration,
    desc: `${A.turbo.duration} sn boyunca %${pct(A.turbo.speedMul)} hızlı koşar`,
    activate(b) { b.turboTimer = A.turbo.duration; return true; },
    remove(b) { b.turboTimer = 0; },
  },
  {
    id: 'sasirt', type: 'active', name: 'Şaşırt',
    cooldown: A.sasirt.cooldown, duration: A.sasirt.duration,
    desc: `Rakibin sağı solu ${A.sasirt.duration} sn ters döner`,
    activate(b, ctx) {
      if (!ctx.ball.active) return false;
      const foe = foeOf(b, ctx);
      foe.confuseTimer = A.sasirt.duration;
      ctx.emit({ type: 'confuse', blob: b, target: foe });
      return true;
    },
  },
  {
    id: 'kucult', type: 'active', name: 'Küçült',
    cooldown: A.kucult.cooldown, duration: A.kucult.duration,
    desc: `Rakip ${A.kucult.duration} sn boyunca küçülür`,
    activate(b, ctx) {
      if (!ctx.ball.active) return false;
      const foe = foeOf(b, ctx);
      foe.shrinkTimer = A.kucult.duration;
      ctx.emit({ type: 'shrink', blob: b, target: foe });
      return true;
    },
  },
  {
    id: 'onsezi', type: 'active', name: 'Önsezi',
    cooldown: A.onsezi.cooldown, duration: 0,
    desc: 'Topun düşeceği yerin altına ışınlanır',
    activate(b, ctx) { return teleportUnderBall(b, ctx); },
  },
  {
    id: 'kesikTop', type: 'active', name: 'Kesik Top',
    cooldown: A.kesikTop.cooldown, duration: 0,
    desc: 'Topun yatay hızı kesilir, top dik düşer',
    activate(b, ctx) {
      const ball = ctx.ball;
      if (!ball.active || ball.hover || Math.abs(ball.vx) < 60) return false;
      ball.vx *= A.kesikTop.vxMul;
      ball.spinTimer = 0;
      ball.windTimer = 0;
      ctx.emit({ type: 'cut', blob: b, x: ball.x, y: ball.y });
      return true;
    },
  },
  {
    id: 'deprem', type: 'active', name: 'Deprem',
    cooldown: A.deprem.cooldown, duration: 0,
    desc: 'Yerdeki rakip sarsılıp havaya savrulur',
    activate(b, ctx) {
      if (!ctx.ball.active) return false;
      const foe = foeOf(b, ctx);
      if (!foe.grounded) return false;   // havadaki rakibe etkisi yok: hak harcanmasın
      foe.vy = -CONFIG.blob.jumpVelocity * Math.sqrt(A.deprem.liftMul);
      foe.grounded = false;
      foe.airJumps = 0;
      ctx.emit({ type: 'quake', blob: b, target: foe });
      return true;
    },
  },
  {
    id: 'karaDelik', type: 'active', name: 'Kara Delik',
    cooldown: A.karaDelik.cooldown, duration: A.karaDelik.duration,
    desc: `Top ${A.karaDelik.duration} sn rakip sahanın ortasına çekilir`,
    activate(b, ctx) {
      const ball = ctx.ball;
      if (!ball.active || ball.hover) return false;
      ball.wellTimer = A.karaDelik.duration;
      ball.wellX = b.team === 0 ? CONFIG.width * 0.75 : CONFIG.width * 0.25;
      ball.wellY = CONFIG.world.groundY;
      ctx.emit({ type: 'well', blob: b, x: ball.wellX, y: ball.wellY });
      return true;
    },
  },
  {
    id: 'ikinciSans', type: 'active', name: 'İkinci Şans',
    cooldown: A.ikinciSans.cooldown, duration: 0,
    desc: 'Takımın dokunuş hakkından 1 geri alır',
    activate(b, ctx) {
      const m = ctx.match;
      if (!m || m.lastTouchTeam !== b.team || m.touches[b.team] < 2) return false;   // gerekmiyorsa hak harcanmasın
      m.touches[b.team]--;
      ctx.emit({ type: 'secondChance', blob: b });
      return true;
    },
  },
  {
    id: 'ayna', type: 'active', name: 'Ayna',
    cooldown: A.ayna.cooldown, duration: 0,
    desc: 'Topun yönünü anında tersine çevirir',
    activate(b, ctx) {
      const ball = ctx.ball;
      if (!ball.active || ball.hover || Math.abs(ball.vx) < 60) return false;
      ball.vx = -ball.vx;
      ball.spin = -ball.spin;
      ball.windTimer = 0;
      ctx.emit({ type: 'mirror', blob: b, x: ball.x, y: ball.y });
      return true;
    },
  },
  {
    id: 'dorukAtagi', type: 'active', name: 'Doruk Atağı',
    cooldown: A.dorukAtagi.cooldown, duration: A.dorukAtagi.window,
    desc: `Yükseğe sıçrar, sonraki vuruş %${pct(A.dorukAtagi.speedMul)} güçlü`,
    activate(b, ctx) {
      if (!b.grounded) return false;
      b.vy = -CONFIG.blob.jumpVelocity * Math.sqrt(b.jumpMul) * A.dorukAtagi.jumpMul;
      b.grounded = false;
      b.airJumps = b.extraJumps;
      b.fx.doruk = A.dorukAtagi.window;
      ctx.emit({ type: 'rocketJump', blob: b });
      return true;
    },
    update(b, ctx, dt) { b.fx.doruk = Math.max(0, (b.fx.doruk || 0) - dt); },
    onHit(b, ball, ctx) {
      if (!(b.fx.doruk > 0)) return;
      b.fx.doruk = 0;
      b.activeTimer = 0;
      ball.boostTimer = 0.6;
      ball.vx *= A.dorukAtagi.speedMul;
      ball.vy *= A.dorukAtagi.speedMul;
      ball.fireTimer = 0.6;
      ctx.emit({ type: 'powerHit', blob: b, x: ball.x, y: ball.y });
    },
    remove(b) { b.fx.doruk = 0; },
  },
  {
    id: 'ruzgar', type: 'active', name: 'Rüzgâr',
    cooldown: A.ruzgar.cooldown, duration: A.ruzgar.duration,
    desc: `Top ${A.ruzgar.duration} sn rakip sahaya doğru savrulur`,
    activate(b, ctx) {
      if (!ctx.ball.active || ctx.ball.hover) return false;
      ctx.ball.windTimer = A.ruzgar.duration;
      ctx.ball.windDir = b.team === 0 ? 1 : -1;
      ctx.emit({ type: 'wind', blob: b, dir: ctx.ball.windDir });
      return true;
    },
  },
  {
    id: 'yakala', type: 'active', name: 'Yakala',
    cooldown: A.yakala.cooldown, duration: A.yakala.window,
    desc: `Sonraki topu yakalar, ${A.yakala.hold} sn sonra rakibe fırlatır`,
    activate(b) { b.fx.catch = A.yakala.window; return true; },
    update(b, ctx, dt) { if (!(b.hyperTimer > 0 && b.hyper?.id === 'avPencesi')) b.fx.catch = Math.max(0, b.fx.catch - dt); },
    onHit(b, ball, ctx) {
      if (!(b.fx.catch > 0) || ball.holdTimer > 0) return;
      const hyper = b.hyperTimer > 0 && b.hyper?.id === 'avPencesi';
      if (!hyper) { b.fx.catch = 0; b.activeTimer = 0; }
      catchBall(b, ball, ctx, hyper ? 1.25 : 1);
    },
    remove(b) { b.fx.catch = 0; },
  },
  {
    id: 'hayalTop', type: 'active', name: 'Hayal Top',
    cooldown: A.hayalTop.cooldown, duration: 0,
    desc: 'Gerçeğinden ayırt edilemeyen sahte bir top başka yöne uçar',
    activate(b, ctx) {
      const ball = ctx.ball;
      if (!ball.active || ball.hover || ball.holdTimer > 0) return false;
      spawnDecoy(ball, b.team, Math.random() < 0.5 ? 0.55 : 1.45, A.hayalTop.life);
      ctx.emit({ type: 'decoy', blob: b, x: ball.x, y: ball.y });
      return true;
    },
  },
  {
    id: 'ejderNefesi', type: 'active', name: 'Ejder Nefesi',
    cooldown: A.ejderNefesi.cooldown, duration: 0,
    desc: 'Yakındaki topu ateşle rakip sahaya üfler (uzanamadığın topu kurtarır)',
    activate(b, ctx) {
      const ball = ctx.ball;
      if (!ball.active || ball.hover || ball.holdTimer > 0) return false;
      const hx = b.x, hy = b.y - b.r * 1.4;
      if (Math.hypot(ball.x - hx, ball.y - hy) > A.ejderNefesi.range) return false;   // menzil dışı: hak harcanmasın
      if ((ball.x < CONFIG.world.netX) !== (b.team === 0)) return false;              // sadece kendi sahandaki top
      const dir = b.team === 0 ? 1 : -1;
      ball.vx = dir * A.ejderNefesi.vx;
      ball.vy = -A.ejderNefesi.vy;
      ball.spinTimer = 0;
      ball.fireTimer = Math.max(ball.fireTimer, A.ejderNefesi.fireTime);
      ctx.emit({ type: 'breath', blob: b, x: ball.x, y: ball.y, fx: hx, fy: hy });
      return true;
    },
  },
  {
    id: 'uyustur', type: 'active', name: 'Uyuştur',
    cooldown: A.uyustur.cooldown, duration: A.uyustur.duration,
    desc: `Rakibin vuruşları ${A.uyustur.duration} sn %${Math.round((1 - A.uyustur.hitMul) * 100)} zayıflar`,
    activate(b, ctx) {
      if (!ctx.ball.active) return false;
      for (const f of ctx.blobs) if (f.team !== b.team && !f.ghost) {
        f.weakTimer = Math.max(f.weakTimer, A.uyustur.duration);
        ctx.emit({ type: 'poison', blob: b, target: f });
      }
      return true;
    },
  },
  {
    id: 'firtinaDarbesi', type: 'active', name: 'Fırtına Darbesi',
    cooldown: A.firtinaDarbesi.cooldown, duration: 0,
    desc: 'Rakibi fileden geriye savurur',
    activate(b, ctx) {
      if (!ctx.ball.active) return false;
      for (const f of ctx.blobs) if (f.team !== b.team && !f.ghost) knockBack(f, 1);
      ctx.emit({ type: 'knock', blob: b, dir: b.team === 0 ? 1 : -1, targets: ctx.blobs.filter((f) => f.team !== b.team && !f.ghost) });
      return true;
    },
  },
];

ABILITIES.push({
  id: 'gokAskisi', type: 'active', name: 'Gök Askısı',
  cooldown: A.gokAskisi.cooldown, duration: 0,
  desc: `Top ${A.gokAskisi.duration} sn havada asılı kalır (yetişemediğin topa zaman kazandırır)`,
  activate(b, ctx) {
    const ball = ctx.ball;
    if (!ball.active || ball.hover || ball.holdTimer > 0) return false;
    ball.stallTimer = Math.max(ball.stallTimer, A.gokAskisi.duration);
    ctx.emit({ type: 'stall', blob: b, x: ball.x, y: ball.y });
    return true;
  },
});

/** Takımın üzerindeki olumsuz etkileri sil (sersemleme, şaşırma, küçülme, zayıflama, donma, savrulma). */
export function cleanseTeam(team, ctx) {
  for (const f of ctx.blobs) {
    if (f.team !== team) continue;
    f.stunTimer = f.confuseTimer = f.shrinkTimer = f.weakTimer = f.freezeTimer = f.knockTimer = f.rootTimer = 0;
  }
}

ABILITIES.push({
  id: 'arindir', type: 'active', name: 'Arındır',
  cooldown: A.arindir.cooldown, duration: 0,
  desc: `Topun ve takımının üzerindeki bütün etkileri siler, topu %${Math.round((1 - A.arindir.slowMul) * 100)} yavaşlatır`,
  activate(b, ctx) {
    const ball = ctx.ball;
    if (!ball.active || ball.hover || ball.holdTimer > 0) return false;
    cleanseTeam(b.team, ctx);
    // Top: falso, rüzgâr, kara delik, ağırlık, alev/dalış, sis, kesik, sahte toplar → hepsi gider
    ball.spinTimer = ball.windTimer = ball.wellTimer = ball.heavyTimer = ball.fireTimer = ball.superTimer = ball.fogTimer = ball.boostTimer = 0;
    ball.cutTeam = -1;
    ball.decoys.length = 0;
    if ((ball.x < CONFIG.world.netX) === (b.team === 0) || (ball.vx > 0) === (b.team === 1)) { ball.vx *= A.arindir.slowMul; ball.vy *= A.arindir.slowMul; }
    ctx.emit({ type: 'cleanse', blob: b, x: ball.x, y: ball.y });
    return true;
  },
}, {
  id: 'yuksekNota', type: 'active', name: 'Yüksek Nota',
  cooldown: A.yuksekNota.cooldown, duration: 0,
  desc: 'Ses dalgası kendi sahandaki yakın topu dikine havaya kaldırır (düşen topu kurtarır)',
  activate(b, ctx) {
    const ball = ctx.ball;
    if (!ball.active || ball.hover || ball.holdTimer > 0) return false;
    if ((ball.x < CONFIG.world.netX) !== (b.team === 0)) return false;
    if (Math.hypot(ball.x - b.x, ball.y - (b.y - b.r * 1.4)) > A.yuksekNota.range) return false;   // menzil dışı: hak harcanmasın
    ball.vy = -A.yuksekNota.lift;
    ball.vx *= 0.25;
    ball.spinTimer = ball.superTimer = 0;
    ctx.emit({ type: 'note', blob: b, x: ball.x, y: ball.y });
    return true;
  },
});

ABILITIES.push({
  id: 'kutsama', type: 'active', name: 'Kutsama',
  cooldown: A.kutsama.cooldown, duration: A.kutsama.duration,
  desc: `${A.kutsama.duration} sn hızlanır, yükseğe zıplar, sert vurur; olumsuz etki almaz`,
  activate(b, ctx) {
    b.blessTimer = A.kutsama.duration;
    cleanseTeam(b.team, ctx);
    ctx.emit({ type: 'cleanse', blob: b, x: b.x, y: b.y - b.r });
    return true;
  },
  // Kutsama sürerken üzerindeki olumsuz etkiler anında silinir (bağışıklık)
  update(b, ctx, dt) {
    if (!(b.blessTimer > 0)) return;
    b.blessTimer = Math.max(0, b.blessTimer - dt);
    b.stunTimer = b.confuseTimer = b.shrinkTimer = b.weakTimer = b.freezeTimer = b.knockTimer = b.rootTimer = 0;
  },
  remove(b) { b.blessTimer = 0; },
}, {
  id: 'korTop', type: 'active', name: 'Kor Top',
  cooldown: A.korTop.cooldown, duration: A.korTop.duration,
  desc: `Top ${A.korTop.duration} sn kızar: rakibin ilk dokunuşu 2 dokunuş sayılır`,
  activate(b, ctx) {
    const ball = ctx.ball;
    if (!ball.active || ball.hover) return false;
    ball.hotTimer = A.korTop.duration; ball.hotTeam = b.team; ball.hotAll = false;
    ball.fireTimer = Math.max(ball.fireTimer, A.korTop.duration);
    ctx.emit({ type: 'hot', blob: b, x: ball.x, y: ball.y });
    return true;
  },
}, {
  id: 'hatVurusu', type: 'active', name: 'Hat Vuruşu',
  cooldown: A.hatVurusu.cooldown, duration: A.hatVurusu.window,
  desc: 'Sonraki vuruş kısa süre yerçekimsiz, dümdüz gider',
  activate(b) { b.fx.line = A.hatVurusu.window; return true; },
  update(b, ctx, dt) { b.fx.line = Math.max(0, (b.fx.line || 0) - dt); },
  onHit(b, ball, ctx) {
    if (!(b.fx.line > 0)) return;
    b.fx.line = 0; b.activeTimer = 0;
    ball.lineTimer = A.hatVurusu.line;
    ball.vx *= A.hatVurusu.speedMul; ball.vy *= A.hatVurusu.speedMul;
    ball.spinTimer = 0;
    ctx.emit({ type: 'powerHit', blob: b, x: ball.x, y: ball.y });
  },
  remove(b) { b.fx.line = 0; },
}, {
  id: 'kokSal', type: 'active', name: 'Kök Sal',
  cooldown: A.kokSal.cooldown, duration: A.kokSal.duration,
  desc: `Rakip ${A.kokSal.duration} sn zıplayamaz`,
  activate(b, ctx) {
    if (!ctx.ball.active) return false;
    for (const f of ctx.blobs) if (f.team !== b.team && !f.ghost) { f.rootTimer = Math.max(f.rootTimer, A.kokSal.duration); ctx.emit({ type: 'root', blob: b, target: f }); }
    return true;
  },
}, {
  id: 'kisaDevre', type: 'active', name: 'Kısa Devre',
  cooldown: A.kisaDevre.cooldown, duration: 0,
  desc: `Rakibin aktif yeteneği baştan beklemeye girer, Hyper barı %${Math.round(A.kisaDevre.meterCut * 100)} azalır`,
  activate(b, ctx) {
    if (!ctx.ball.active) return false;
    for (const f of ctx.blobs) if (f.team !== b.team && !f.ghost) {
      if (f.active) f.cooldown = Math.max(f.cooldown, f.active.cooldown);
      if (!f.hyperArmed && f.hyperTimer <= 0) f.hyperMeter = Math.max(0, f.hyperMeter - A.kisaDevre.meterCut);
      ctx.emit({ type: 'short', blob: b, target: f });
    }
    return true;
  },
});

/** Yakala: top blob'un üstünde tutulur; world.js süre bitince fırlatır. */
export function catchBall(b, ball, ctx, mul = 1) {
  ball.holdTimer = A.yakala.hold;
  ball.holder = b;
  ball.throwMul = mul;
  ball.vx = ball.vy = 0;
  ball.spinTimer = ball.windTimer = ball.wellTimer = 0;
  ctx.emit({ type: 'catch', blob: b, x: ball.x, y: ball.y });
}

/** Yakalanan topun konumu (blob'un tepesinde) */
export function holdBall(ball) {
  const b = ball.holder;
  ball.x = b.x + (b.team === 0 ? 6 : -6);
  ball.y = blobTop(b) - ball.r - 4;
  ball.vx = ball.vy = 0;
}

/** Yakalanan top rakibe fırlatılır. */
export function throwBall(ball, ctx) {
  const b = ball.holder;
  const dir = b.team === 0 ? 1 : -1;
  const m = ball.throwMul * (b.hHit || 1) * (b.weakTimer > 0 ? A.uyustur.hitMul : 1) * MODS.hitSpeed;
  ball.vx = dir * A.yakala.throwVx * m;
  ball.vy = -A.yakala.throwVy * Math.min(1.1, m);
  if (ball.throwMul > 1) { ball.boostTimer = 0.6; ball.fireTimer = 0.6; }
  b.touchLock = 0.35;   // fırlatan blob'a hemen yeniden değmesin
  ball.holdTimer = 0;
  ball.holder = null;
  ctx.emit({ type: 'throw', blob: b, x: ball.x, y: ball.y });
}

/** Hayal Top: topun konumundan, yatay hızı k katı olan sahte bir top. */
export function spawnDecoy(ball, team, k, life) {
  if (ball.decoys.length >= 4) ball.decoys.shift();
  let vx = ball.vx * k;
  if (Math.abs(vx) < 80) vx = (team === 0 ? 1 : -1) * 260 * k;
  ball.decoys.push({ x: ball.x, y: ball.y, prevX: ball.x, prevY: ball.y, vx, vy: ball.vy * (0.85 + Math.random() * 0.3), rot: ball.rot, prevRot: ball.rot, t: life, team,
    r: ball.r, active: true, visible: true, hover: false, slowTimer: 0, boostTimer: 0, spin: 0, spinTimer: 0, windTimer: 0, heavyTimer: 0, floatTimer: 0, wellTimer: 0, superTimer: 0 });
}

/** Fırtına Darbesi: blob fileden uzağa savrulur. */
export function knockBack(f, mul) {
  f.knockVx = (f.team === 0 ? -1 : 1) * A.firtinaDarbesi.knockVx * mul;
  f.knockTimer = A.firtinaDarbesi.knockTime * Math.sqrt(mul);
  f.dashTimer = 0;
  if (f.grounded) { f.vy = -A.firtinaDarbesi.hop; f.grounded = false; }
}

export const PASSIVES = ABILITIES.filter((a) => a.type === 'passive');
export const ACTIVES = ABILITIES.filter((a) => a.type === 'active');
export const getAbility = (id) => ABILITIES.find((a) => a.id === id) || null;

/** Blob'a 1 pasif + 1 aktif tak. Eski yetenekler önce temizlenir. */
export function equip(blob, passiveId, activeId) {
  unequip(blob);
  blob.passive = getAbility(passiveId);
  blob.active = getAbility(activeId);
  blob.passive?.apply?.(blob);
  blob.active?.apply?.(blob);
  blob.cooldown = 0;
  blob.activeTimer = 0;
}

export function unequip(blob) {
  blob.passive?.remove?.(blob);
  blob.active?.remove?.(blob);
  blob.passive = null;
  blob.active = null;
  blob.resetStats();   // çarpanları kesin olarak 1'e döndür (kayan nokta hatası birikmesin)
  blob.cooldown = 0;
  blob.activeTimer = 0;
}

/** Aktif yeteneği kullanmayı dener. Başarılıysa cooldown başlar. */
export function tryActivate(blob, ctx) {
  const a = blob.active;
  if (!a || blob.cooldown > 0) return false;
  if (!a.activate(blob, ctx)) return false;
  blob.cooldown = a.cooldown;
  blob.activeTimer = a.duration || 0;
  ctx.emit({ type: 'ability', blob, id: a.id });
  return true;
}

/** Cooldown — sayı efekti ve geri sayımda da işler; sayı tekrarında main.js durdurur. Etki sürerken işlemez. */
export function tickCooldown(blob, dt) {
  // Yeteneğin etkisi sürerken bekleme süresi işlemez; etki bitince (ya da kullanılınca) azalmaya başlar
  if (blob.activeTimer > 0) blob.activeTimer = Math.max(0, blob.activeTimer - dt);
  else blob.cooldown = Math.max(0, blob.cooldown - dt * MODS.cooldown);   // Parti: Yetenek Yağmuru
}

/** Sürekli etkiler (Mıknatıs çekimi, Güç Vuruşu penceresi). */
export function updateAbilities(blob, ctx, dt) {
  blob.passive?.update?.(blob, ctx, dt);
  blob.active?.update?.(blob, ctx, dt);
}

/** Vuruş anında: önce pasif, sonra aktif değiştirir. */
export function onHitAbilities(blob, ball, ctx, info) {
  blob.passive?.onHit?.(blob, ball, ctx, info);
  blob.active?.onHit?.(blob, ball, ctx, info);
}

/** Sayı olunca süren etkileri iptal et (cooldown'a dokunmaz). */
export function cancelEffects(blob) {
  blob.rootTimer = 0;
  blob.blessTimer = 0;
  blob.fx.line = 0;
  blob.fx.power = 0;
  blob.fx.magnet = 0;
  blob.fx.shield = 0;
  blob.fx.spin = 0;
  blob.fx.doruk = 0;
  blob.dashTimer = 0;
  blob.activeTimer = 0;
  blob.stunTimer = 0;
  blob.growTimer = 0;
  blob.turboTimer = 0;
  blob.confuseTimer = 0;
  blob.shrinkTimer = 0;
  blob.fx.catch = 0;
  blob.weakTimer = 0;
  blob.knockTimer = 0;
}
