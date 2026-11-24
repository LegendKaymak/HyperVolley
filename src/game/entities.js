// =============================================================================
//  entities.js — Saf veri sınıfları (Pixi'den bağımsız). Render tarafı bunları okur.
// =============================================================================
import { CONFIG } from '../config.js';
import { MODS } from './mods.js';

export class Blob {
  constructor(team, slot = 0) {
    this.team = team;              // 0 = sol (Turuncu), 1 = sağ (Mavi)
    this.slot = slot;              // 0 = ana oyuncu, 1 = 2'ye 2'de takım arkadaşı
    this.homeX = null;             // başlangıç / bekleme konumu (null → takımın varsayılanı)
    this.human = false;            // insan mı (yapay zeka takım arkadaşı buna göre davranır)
    this.hyper = null;             // Hyper tanımı (hyper.js)
    this.hyperMeter = 0;           // 0–1, dolunca HYPER HAZIR: sonraki aktif kullanımı güçlenir
    this.hyperArmed = false;       // vuruş Hyper'ı bir sonraki vuruşu bekliyor
    this.hyperTimer = 0;           // süren Hyper'ın kalan süresi
    this.hyperShow = 0;            // HUD'da Hyper adının görüneceği süre
    this.hSpeed = 1; this.hJump = 1; this.hHit = 1;   // Hyper çarpanları
    this.passive = null;           // Yetenek tanımları (abilities.js)
    this.active = null;
    this.cooldown = 0;             // Aktif yeteneğin kalan bekleme süresi
    this.activeTimer = 0;          // Aktif yeteneğin etkisinin kalan süresi (HUD için)
    this.resetStats();
    this.reset();
  }

  /** Pasif yeteneklerin değiştirdiği çarpanlar */
  resetStats() {
    this.speedMul = 1;
    this.jumpMul = 1;    // Zıplama YÜKSEKLİĞİ çarpanı
    this.radiusMul = 1;
    this.extraJumps = 0;   // Çift Zıplama pasifi 1 yapar
    this.glide = false;    // Süzülme pasifi
    this.hitMul = 1;       // Sert Vuruş pasifi
  }

  reset(x = this.homeX ?? CONFIG.blob.startX[this.team]) {
    this.x = x;
    this.y = CONFIG.world.groundY;  // y = gövdenin TABANI (yarım dairenin düz kenarı)
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.facing = this.team === 0 ? 1 : -1;
    this.lastMoveDir = this.facing;
    this.dashTimer = 0;
    this.dashVx = 0;
    this.touchLock = 0;
    this.airJumps = 0;          // Çift Zıplama: kalan havada zıplama hakkı
    this.prevJump = false;      // zıplama tuşunun önceki adımdaki durumu (yeni basışı algılamak için)
    this.fx = { power: 0, magnet: 0, shield: 0, spin: 0, doruk: 0, catch: 0 };
    this.stunTimer = 0;         // Sersemlet: rakip bu süre boyunca yavaş
    this.growTimer = 0;         // Şişme: kalan süre
    this.growMul = 1;           // Şişme / Küçült: yumuşak geçişli boyut çarpanı
    this.turboTimer = 0;        // Turbo
    this.blessTimer = 0;        // Kutsama (Cura)
    this.confuseTimer = 0;      // Şaşırt: sol/sağ ters
    this.shrinkTimer = 0;       // Küçült
    this.freezeTimer = 0;       // Hyper: Zaman Durdur (donma)
    this.weakTimer = 0;         // Uyuştur: vuruşlar zayıf
    this.rootTimer = 0;         // Kök Sal: zıplayamaz
    this.knockTimer = 0;        // Fırtına Darbesi: geriye savrulma
    this.knockVx = 0;
  }

  /** Etkin yarıçap (Dev Blob pasifi büyütür) */
  get r() {
    return CONFIG.blob.radius * this.radiusMul * (this.growMul || 1) * MODS.blobRadius;
  }
}

export class Ball {
  constructor() {
    this.r = CONFIG.ball.radius;
    this.reset();
  }

  reset() {
    this.x = 400; this.y = 150;
    this.prevX = this.x; this.prevY = this.y;
    this.vx = 0; this.vy = 0;
    this.ax = 0; this.ay = 0;    // Dış ivme (Mıknatıs) — her adımda sıfırlanır
    this.rot = 0; this.prevRot = 0;
    this.active = false;         // Fizik çalışıyor mu
    this.visible = false;
    this.hover = false;          // Servis topu havada asılı mı
    this.hoverY = this.y;
    this.hoverTime = 0;
    this.slowTimer = 0;          // Yavaş Zaman etkisi
    this.stallTimer = 0;         // Gök Askısı: top havada asılı
    this.hotTimer = 0;           // Kor Top: rakibin dokunuşu 2 sayılır
    this.hotTeam = -1;
    this.hotAll = false;
    this.lineTimer = 0;          // Hat Vuruşu: yerçekimsiz düz uçuş
    this.fireTimer = 0;          // Güç Vuruşu alevli iz
    this.boostTimer = 0;         // Güç Vuruşu sonrası artırılmış hız sınırı
    this.spin = 0;               // Falso: Magnus kuvveti katsayısı (işaret = kıvrılma yönü)
    this.spinTimer = 0;
    this.heavyTimer = 0;         // Ağır Top: yerçekimi artar
    this.windTimer = 0;          // Rüzgâr: yatay itme süresi
    this.windDir = 0;            // +1 sağa, -1 sola
    this.floatTimer = 0;         // Tüy Top: yerçekimi azalır
    this.wellTimer = 0;          // Kara Delik: çekim süresi ve noktası
    this.wellX = 0;
    this.wellY = 0;
    this.superTimer = 0;         // Hyper dalışı (ağır düşüş + altın iz)
    this.fogTimer = 0;           // Hyper Sis Perdesi: top rakip sahada görünmez
    this.fogTeam = -1;
    this.cutTeam = -1;           // Hyper Keskin Kesim: bu takımın vuruşu fileyi geçince dik düşer
    this.holdTimer = 0;          // Yakala: top bir blob'un üstünde tutuluyor
    this.holder = null;
    this.throwMul = 1;
    this.decoys = [];            // Hayal Top: sahte toplar {x,y,vx,vy,t,team,...}
    this.r = CONFIG.ball.radius * MODS.ballRadius;   // Parti: Dev / Mini Top
  }

  /** Servis: top verilen noktada havada asılı doğar, ilk dokunuşta serbest kalır. */
  placeForServe(x, y) {
    this.reset();
    this.x = this.prevX = x;
    this.y = this.prevY = this.hoverY = y;
    this.active = true;
    this.visible = true;
    this.hover = true;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }
}
