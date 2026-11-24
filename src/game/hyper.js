// =============================================================================
//  hyper.js — Her karakterin kendine özel güçlendirmesi: HYPER.
//
//  Her blob'un kendi Hyper barı vardır; blob topa her vurduğunda dolar (uzun rallide
//  daha hızlı). Bar dolunca "HYPER HAZIR" olur ve oyuncunun BİR SONRAKİ AKTİF YETENEK
//  kullanımını güçlendirir: aktif yetenek normal çalışır, üstüne karakterin Hyper'ı gelir.
//  Süreli Hyper'lar o anda başlar; vuruşa etki edenler (onHit) bir sonraki vuruşu bekler.
//  Sayı bitince süren Hyper'lar sona erer; bar ve bekleyen vuruş Hyper'ı korunur.
//
//  Tanım alanları:
//    name, desc, en:{name,desc}   — ekranda görünen ad ve kısa açıklama
//    duration                      — süre (sn); 0 = anlık
//    onHit                         — true: etki aktiften sonraki ilk vuruştaki topa uygulanır
//    start(b, ctx, ball)           — bir kez (süreli: aktif kullanılınca; onHit: o vuruşta)
//    update(b, ctx, dt)            — sürerken her adım
//    end(b, ctx)                   — süre bitince ya da sayı bitince
//    onCross(b, ctx, fromTeam)     — top fileyi geçince (sürerken)
// =============================================================================
import { CONFIG } from '../config.js';
import { teleportUnderBall, spawnDecoy, knockBack, cleanseTeam } from './abilities.js';
import { predictPath } from './physics.js';

const H = () => CONFIG.hyper;
const foes = (b, ctx) => ctx.blobs.filter((o) => o.team !== b.team && !o.ghost);
const toward = (b) => (b.team === 0 ? 1 : -1);   // fileye (rakibe) doğru yön
const onMySide = (b, x) => (b.team === 0 ? x < CONFIG.world.netX : x > CONFIG.world.netX);

/** Vuruştaki topu hızlandır + "dalış" (bir süre ağır düşer, altın iz). */
function smash(ball, mul, dive = H().diveTime) {
  ball.vx *= mul;
  ball.vy *= mul;
  ball.superTimer = Math.max(ball.superTimer || 0, dive);
  ball.fireTimer = Math.max(ball.fireTimer, dive);
}

/** Süreli kişisel güçlendirme (hız / zıplama / vuruş çarpanları). */
const buff = (speed = 1, jump = 1, hit = 1) => ({
  start(b) { b.hSpeed = speed; b.hJump = jump; b.hHit = hit; },
  end(b) { b.hSpeed = b.hJump = b.hHit = 1; },
});

export const HYPERS = {
  lavYagmuru: {
    name: 'Lav Yağmuru', desc: 'Sonraki vuruş %45 hızlı, top uzun süre alevle dalar', duration: 0, onHit: true,
    en: { name: 'Lava Rain', desc: 'Next hit 45% faster, the ball dives in flames' },
    start(b, ctx, ball) { smash(ball, 1.45, 1.3); },
  },
  zamanDurdur: {
    name: 'Zaman Durdur', desc: 'Rakip 1.5 sn tamamen donar', duration: 0,
    en: { name: 'Time Stop', desc: 'Opponent freezes for 1.5 s' },
    start(b, ctx) { for (const f of foes(b, ctx)) f.freezeTimer = 1.5; },
  },
  pike: {
    name: 'Pike', desc: '9 sn çok yüksek zıplar, hızlı koşar', duration: 9,
    en: { name: 'Dive Bomb', desc: 'Jumps very high and runs fast for 9 s' },
    ...buff(1.2, 1.4, 1),
  },
  buyuluKivrim: {
    name: 'Büyülü Kıvrım', desc: 'Sonraki vuruşta top uzun süre sert kıvrılır', duration: 0, onHit: true,
    en: { name: 'Magic Curve', desc: 'Next hit curves hard for a long time' },
    start(b, ctx, ball) {
      ball.vx *= 1.15; ball.vy *= 1.15;
      ball.spin = Math.sign(ball.vx || toward(b)) * 1.15;
      ball.spinTimer = 2.2;
    },
  },
  kaleDuvari: {
    name: 'Kale Duvarı', desc: '8 sn top senin sahana düşemez', duration: 8,
    en: { name: 'Fortress Wall', desc: 'For 8 s the ball cannot land on your side' },
  },
  superMiknatis: {
    name: 'Süper Mıknatıs', desc: '8 sn kendi sahandaki topu sana çeker', duration: 8,
    en: { name: 'Super Magnet', desc: 'Pulls the ball to you on your side for 8 s' },
    update(b, ctx) {
      const ball = ctx.ball;
      if (!ball.active || ball.hover || !onMySide(b, ball.x)) return;
      const dx = b.x - ball.x, dy = b.y - b.r * 2.4 - ball.y, d = Math.hypot(dx, dy) || 1;
      if (d > 320) return;
      ball.ax += (dx / d) * 820;
      ball.ay += (dy / d) * 820 * 0.6;
    },
  },
  gokTasi: {
    name: 'Göktaşı', desc: 'Sonraki vuruşta top taş gibi ağırlaşıp dalar', duration: 0, onHit: true,
    en: { name: 'Meteorite', desc: 'Next hit turns the ball to stone and it plunges' },
    start(b, ctx, ball) { smash(ball, 1.25, 1.6); ball.heavyTimer = 1.6; },
  },
  golgeAdimi: {
    name: 'Gölge Adımı', desc: '10 sn içinde gelen topun altına kendiliğinden ışınlanır', duration: 10,
    en: { name: 'Shadow Step', desc: 'Auto-teleports under the next incoming ball (10 s)' },
    onCross(b, ctx, from) {
      if (from === b.team) return;
      if (teleportUnderBall(b, ctx)) b.hyperTimer = Math.min(b.hyperTimer, 0.4);
    },
  },
  yildizSicrayisi: {
    name: 'Yıldız Sıçrayışı', desc: '9 sn her zıplayış roket gibi', duration: 9,
    en: { name: 'Star Leap', desc: 'Every jump is a rocket jump for 9 s' },
    ...buff(1, 1.7, 1),
  },
  buzDevri: {
    name: 'Buz Devri', desc: 'Rakip 4.5 sn yavaşlar, alçak zıplar', duration: 0,
    en: { name: 'Ice Age', desc: 'Opponent slowed and grounded for 4.5 s' },
    start(b, ctx) { for (const f of foes(b, ctx)) f.stunTimer = Math.max(f.stunTimer, 4.5); },
  },
  kabus: {
    name: 'Kâbus', desc: 'Rakibin yönleri 2.2 sn ters döner', duration: 0,
    en: { name: 'Nightmare', desc: 'Opponent controls flip for 2.2 s' },
    start(b, ctx) { for (const f of foes(b, ctx)) { f.confuseTimer = 2.2; f.stunTimer = Math.max(f.stunTimer, 2.2); } },
  },
  kasirga: {
    name: 'Kasırga', desc: 'Sonraki vuruştan sonra top 3 sn rakip sahaya savrulur', duration: 0, onHit: true,
    en: { name: 'Hurricane', desc: 'After your next hit the ball is blown across for 3 s' },
    start(b, ctx, ball) { ball.windTimer = 3; ball.windDir = toward(b); },
  },
  devTunc: {
    name: 'Dev Tunç', desc: '9 sn kocaman olur, vuruşları sertleşir', duration: 9,
    en: { name: 'Bronze Giant', desc: 'Becomes huge with harder hits for 9 s' },
    start(b) { b.growTimer = Math.max(b.growTimer, 9); b.hHit = 1.2; },
    end(b) { b.hHit = 1; },
  },
  bulutYastigi: {
    name: 'Bulut Yastığı', desc: '9 sn kendi sahanda top yavaş düşer', duration: 9,
    en: { name: 'Cloud Pillow', desc: 'The ball falls slowly on your side for 9 s' },
    update(b, ctx) {
      const ball = ctx.ball;
      if (ball.active && onMySide(b, ball.x)) ball.floatTimer = Math.max(ball.floatTimer, 0.05);
    },
  },
  isikHizi: {
    name: 'Işık Hızı', desc: '8 sn şimşek gibi koşar', duration: 8,
    en: { name: 'Light Speed', desc: 'Runs like lightning for 8 s' },
    ...buff(1.7, 1, 1),
  },
  sisPerdesi: {
    name: 'Sis Perdesi', desc: 'Sonraki vuruşta top rakip sahada 2.5 sn görünmez olur', duration: 0, onHit: true,
    en: { name: 'Fog Veil', desc: 'After your next hit the ball is invisible on their side (2.5 s)' },
    start(b, ctx, ball) { ball.fogTimer = 2.5; ball.fogTeam = b.team; },
  },
  lanet: {
    name: 'Lanet', desc: 'Rakip 7 sn küçülür ve yavaşlar', duration: 0,
    en: { name: 'Curse', desc: 'Opponent shrinks and slows for 7 s' },
    start(b, ctx) { for (const f of foes(b, ctx)) { f.shrinkTimer = Math.max(f.shrinkTimer, 7); f.stunTimer = Math.max(f.stunTimer, 3.5); } },
  },
  kehanet: {
    name: 'Kehanet', desc: '11 sn sana gelen topun yolunu görür, hızlanır', duration: 11,
    en: { name: 'Prophecy', desc: 'Sees the incoming ball\'s path and runs faster (11 s)' },
    start(b) { b.hSpeed = 1.2; b.hyperPath = []; },
    update(b, ctx) {
      const ball = ctx.ball;
      // Top bana doğru geliyorsa yolu çizilir (birkaç adımda bir hesaplanır)
      b.pathTick = ((b.pathTick || 0) + 1) % 4;
      if (b.pathTick) return;
      const coming = ball.active && !ball.hover && (onMySide(b, ball.x) || Math.sign(ball.vx) === -toward(b));
      if (coming) predictPath(ball, b.hyperPath, 4);
      else b.hyperPath.length = 0;
    },
    end(b) { b.hSpeed = 1; if (b.hyperPath) b.hyperPath.length = 0; },
  },
  keskinKesim: {
    name: 'Keskin Kesim', desc: 'Sonraki vuruşta top fileyi geçer geçmez dik düşer', duration: 0, onHit: true,
    en: { name: 'Razor Cut', desc: 'Next hit drops straight down past the net' },
    start(b, ctx, ball) { ball.cutTeam = b.team; },
  },
  yerSarsintisi: {
    name: 'Yer Sarsıntısı', desc: 'Rakip havaya savrulur ve sersemler', duration: 0,
    en: { name: 'Earthquake', desc: 'Opponent is thrown up and dazed' },
    start(b, ctx) {
      for (const f of foes(b, ctx)) {
        if (f.grounded) { f.vy = -CONFIG.blob.jumpVelocity * 0.8; f.grounded = false; f.airJumps = 0; }
        f.stunTimer = Math.max(f.stunTimer, 2);
      }
      ctx.emit({ type: 'quake', blob: b, target: foes(b, ctx)[0] || b });
    },
  },
  supernova: {
    name: 'Süpernova', desc: 'Sonraki vuruşta top hızlanır ve arka köşeye çekilir', duration: 0, onHit: true,
    en: { name: 'Supernova', desc: 'Next hit is faster and pulled to the far corner' },
    start(b, ctx, ball) {
      smash(ball, 1.25);
      ball.wellTimer = 1.8;
      ball.wellX = b.team === 0 ? CONFIG.width - 70 : 70;
      ball.wellY = CONFIG.world.groundY;
    },
  },
  yenilenme: {
    name: 'Yenilenme', desc: 'Aktif yetenek hemen dolar, dokunuş hakkı sıfırlanır', duration: 0,
    en: { name: 'Renewal', desc: 'Active ability refills, touches reset' },
    start(b, ctx) {
      for (const o of ctx.blobs) if (o.team === b.team) o.cooldown = 0;
      if (ctx.match) ctx.match.touches[b.team] = 0;
    },
  },
  aynaZirh: {
    name: 'Ayna Zırh', desc: '10 sn içinde sana gelen ilk top geri seker', duration: 10,
    en: { name: 'Mirror Armor', desc: 'The next incoming ball bounces back (10 s)' },
    onCross(b, ctx, from) {
      if (from === b.team) return;
      const ball = ctx.ball;
      ball.vx = -ball.vx * 1.1;
      ball.vy = Math.min(ball.vy, -120);
      ctx.emit({ type: 'mirror', blob: b, x: ball.x, y: ball.y });
      b.hyperTimer = Math.min(b.hyperTimer, 0.3);
    },
  },
  zirveFormu: {
    name: 'Zirve Formu', desc: '9 sn daha hızlı, daha yüksek, daha sert', duration: 9,
    en: { name: 'Peak Form', desc: 'Faster, higher, harder for 9 s' },
    ...buff(1.25, 1.3, 1.2),
  },
  // ---- Yeni karakterler
  avPencesi: {
    name: 'Av Pençesi', desc: '9 sn her topu yakalar, %25 daha sert fırlatır', duration: 9,
    en: { name: 'Hunter\'s Claw', desc: 'Catches every ball and throws it 25% harder for 9 s' },
    start(b) { b.fx.catch = 9; },
    end(b) { b.fx.catch = 0; },
  },
  aynalarSalonu: {
    name: 'Aynalar Salonu', desc: 'Topun yanında 3 sahte top birden uçar', duration: 0,
    en: { name: 'Hall of Mirrors', desc: 'Three fake balls fly alongside the real one' },
    start(b, ctx) {
      const ball = ctx.ball;
      if (!ball.active || ball.hover) return;
      for (const k of [0.5, 1.3, 1.7]) spawnDecoy(ball, b.team, k, 3.2);
    },
  },
  alevFirtinasi: {
    name: 'Alev Fırtınası', desc: 'Üflenen top alevle dalar, rakip 2 sn sersemler', duration: 0,
    en: { name: 'Firestorm', desc: 'The blown ball dives in flames, opponent dazed for 2 s' },
    start(b, ctx) {
      smash(ctx.ball, 1.15, 1.2);
      for (const f of foes(b, ctx)) f.stunTimer = Math.max(f.stunTimer, 2);
    },
  },
  zehir: {
    name: 'Zehir', desc: 'Rakibin vuruşları 9 sn zayıflar, 2.5 sn yavaşlar', duration: 0,
    en: { name: 'Venom', desc: 'Opponent hits weakened for 9 s, slowed for 2.5 s' },
    start(b, ctx) {
      for (const f of foes(b, ctx)) { f.weakTimer = Math.max(f.weakTimer, 9); f.stunTimer = Math.max(f.stunTimer, 2.5); }
    },
  },
  kutsalAlan: {
    name: 'Kutsal Alan', desc: '8 sn takımın olumsuz etki almaz, hızlanır; dokunuş hakkı yenilenir', duration: 8,
    en: { name: 'Sanctuary', desc: 'For 8 s your team is immune to negative effects and faster; touches reset' },
    start(b, ctx) { b.hSpeed = 1.15; if (ctx.match?.touches) ctx.match.touches[b.team] = 0; },
    update(b, ctx) { cleanseTeam(b.team, ctx); },
    end(b) { b.hSpeed = 1; },
  },
  finalSahnesi: {
    name: 'Final Sahnesi', desc: '9 sn daha yükseğe zıplar, daha sert vurur', duration: 9,
    en: { name: 'Grand Finale', desc: 'Jumps higher and hits harder for 9 s' },
    ...buff(1.1, 1.25, 1.18),
  },
  kizginTop: {
    name: 'Kızgın Top', desc: '6 sn rakibin HER dokunuşu 2 dokunuş sayılır', duration: 6,
    en: { name: 'Scorching Ball', desc: 'For 6 s EVERY opponent touch counts as two' },
    start(b, ctx) { const ball = ctx.ball; ball.hotTimer = 6; ball.hotTeam = b.team; ball.hotAll = true; ball.fireTimer = Math.max(ball.fireTimer, 6); },
    end(b, ctx) { ctx.ball.hotTimer = 0; ctx.ball.hotAll = false; },
  },
  yildirimMizragi: {
    name: 'Yıldırım Mızrağı', desc: 'Sonraki vuruş daha uzun süre dümdüz ve %20 hızlı gider', duration: 0, onHit: true,
    en: { name: 'Lightning Spear', desc: 'Next hit flies dead straight for longer and 20% faster' },
    start(b, ctx, ball) { ball.lineTimer = 0.7; smash(ball, 1.2, 0.2); },
  },
  derinKok: {
    name: 'Derin Kök', desc: 'Rakip 5 sn zıplayamaz ve 2 sn yavaşlar', duration: 0,
    en: { name: 'Deep Roots', desc: 'Opponent can\'t jump for 5 s and is slowed for 2 s' },
    start(b, ctx) { for (const f of foes(b, ctx)) { f.rootTimer = Math.max(f.rootTimer, 5); f.stunTimer = Math.max(f.stunTimer, 2); } },
  },
  karartma: {
    name: 'Karartma', desc: 'Rakibin Hyper barı sıfırlanır, 2 sn sersemler', duration: 0,
    en: { name: 'Blackout', desc: 'Opponent\'s Hyper bar is emptied and they are dazed for 2 s' },
    start(b, ctx) { for (const f of foes(b, ctx)) { if (f.hyperTimer <= 0) { f.hyperMeter = 0; f.hyperArmed = false; } f.stunTimer = Math.max(f.stunTimer, 2); } },
  },
  gokKilidi: {
    name: 'Gök Kilidi', desc: 'Top 1.6 sn asılı kalır, rakip 1 sn donar', duration: 0,
    en: { name: 'Sky Lock', desc: 'The ball hangs for 1.6 s and the opponent freezes for 1 s' },
    start(b, ctx) {
      ctx.ball.stallTimer = Math.max(ctx.ball.stallTimer, 1.6);
      for (const f of foes(b, ctx)) f.freezeTimer = Math.max(f.freezeTimer, 1);
    },
  },
  karaBora: {
    name: 'Kara Bora', desc: 'Rakip çok daha uzağa savrulur ve 2.5 sn sersemler', duration: 0,
    en: { name: 'Black Squall', desc: 'Opponent is blown much further and dazed for 2.5 s' },
    start(b, ctx) {
      for (const f of foes(b, ctx)) { knockBack(f, 1.6); f.stunTimer = Math.max(f.stunTimer, 2.5); }
    },
  },
};

export const getHyper = (id) => HYPERS[id] || null;

/** Blob'un Hyper durumunu sıfırla (maç başında). */
export function resetHyper(b) {
  b.hyperMeter = 0;
  b.hyperArmed = false;
  b.hyperTimer = 0;
  b.hyperShow = 0;
  b.hSpeed = b.hJump = b.hHit = 1;
}

/** Bar dolu mu (aktif yetenek kullanılınca Hyper devreye girer)? */
export const hyperReady = (b) => !!b.hyper && b.hyperMeter >= 1 && !b.hyperArmed && b.hyperTimer <= 0;

/**
 * Bar doluyken aktif yetenek kullanıldı: Hyper devreye girer.
 * Süreli/rakibe etki eden Hyper hemen başlar; vuruş Hyper'ı (onHit) bir sonraki vuruşu bekler.
 */
export function triggerHyper(b, ctx) {
  const h = b.hyper;
  if (!h) return;
  b.hyperMeter = 0;
  b.hyperShow = Math.max(h.duration || 0, 2);   // HUD'da adının görünme süresi
  if (h.onHit) b.hyperArmed = true;
  else {
    b.hyperTimer = h.duration || 0;
    h.start?.(b, ctx, ctx.ball);
  }
  ctx.emit({ type: 'hyper', blob: b, id: h.id, x: b.x, y: b.y - b.r * 1.3 });
}

/** Bekleyen vuruş Hyper'ı bu vuruşta topa uygulanır. */
export function hitHyper(b, ctx, ball) {
  const h = b.hyper;
  b.hyperArmed = false;
  if (!h) return;
  if (h.onHit) h.start?.(b, ctx, ball);
  else { b.hyperTimer = h.duration || 0; h.start?.(b, ctx, ball); }   // (Kaos'ta karakter değiştiyse)
  b.hyperShow = Math.max(b.hyperShow, 1.2);
  ctx.emit({ type: 'hyperHit', blob: b, id: h.id, x: ball.x, y: ball.y });
}

/** Süren Hyper'ı bitir (süre ya da sayı sonu). */
export function endHyper(b, ctx) {
  if (b.hyperTimer > 0 || b.hSpeed !== 1 || b.hJump !== 1 || b.hHit !== 1) b.hyper?.end?.(b, ctx);
  b.hyperTimer = 0;
  b.hSpeed = b.hJump = b.hHit = 1;
}

// Kimliği tanımın içine yaz
for (const [id, h] of Object.entries(HYPERS)) h.id = id;
