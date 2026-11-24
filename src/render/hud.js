// =============================================================================
//  hud.js — Yayın grafiği tarzı HUD: ortada skor tabelası (flip + pop); her tarafta
//  oyuncu kartı (isim, aktif/pasif yetenek, dokunuş hakkı); TEKRAR etiketi.
// =============================================================================
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { CONFIG } from '../config.js';
import { Ease } from './tween.js';
import { UI_FONT } from './fonts.js';
import { t as tr, L } from '../i18n.js';

const SURFACE = 0x0f2433;
const ON_SURFACE = 0xf4f1e8;
const ON_SURFACE_VAR = 0xd9c49a;

function label(text, size, fill = ON_SURFACE, weight = '700') {
  const t = new Text({ text: tr(text), style: { fontFamily: UI_FONT, fontWeight: weight, fontSize: size, fill, letterSpacing: 0.2 } });
  t.anchor.set(0, 0.5);
  return t;
}

/** Algılanan parlaklık (0–1). */
function luminance(c) {
  return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
}

/** Koyu renkli karakterlerde (Kâbus, Kâhin) HUD vurguları için açık ton. */
const accent = (T) => (luminance(T.color) < 0.42 ? T.light : T.color);

/** Yazıyı en fazla maxW genişliğe sığdır (gerekirse sonuna … koyarak kısalt). */
function fitText(t, str, maxW) {
  str = tr(str);
  t.text = str;
  if (t.width <= maxW) return;
  let s = str;
  while (s.length > 1 && t.width > maxW) {
    s = s.slice(0, -1).trimEnd();
    t.text = `${s}…`;
  }
}

/**
 * Oyuncu kartı — skor tabelasıyla aynı yükseklikte ve aynı dilde (koyu zemin + altta takım
 * rengi şerit), böylece üst bant tek parça bir yayın grafiği gibi durur:
 *
 *   ┌──────┬──────────────────────── ● ● ○ ┐
 *   │  S   │ Kâbus                           │   ← ad + dokunuş hakkı
 *   │ (4)  │ Sersemlet                       │   ← aktif yetenek (takım renginde)
 *   └──────┴─────────────────────────────────┘
 *     PASİF  Dev Blob                            ← kartın altına asılı küçük etiket
 *
 * Soldaki kare aktif yetenek göstergesi: bekleme süresinde saat gibi dolar ve kalan saniyeyi
 * yazar; hazır olunca takım renginde yanar ve tuşunu (S / ↓) ya da şimşek işaretini gösterir.
 * Sağ taraftaki kart aynalanır. Klasik modda sadece ad ve dokunuş hakkı görünür.
 */
class SideCard {
  constructor(team) {
    this.team = team;
    this.T = CONFIG.teams[team];
    this.W = 246;
    this.right = team === 1;
    this.root = new Container();
    this.tab = new Graphics();      // pasif etiketi (kartın arkasında, altından sarkar)
    this.bg = new Graphics();
    this.tile = new Graphics();
    this.pips = new Graphics();
    // Hyper barı (kartın alt şeridi), altın çerçeve ve "HAZIR" halkası: hepsi BİR KEZ çizilir,
    // her karede sadece ölçek/renk/saydamlık değişir (yeniden çizim yok).
    this.hyperBar = new Graphics().rect(0, 0, 1, 4).fill(0xffffff);
    this.hyperFrame = new Graphics();
    this.hyperHalo = new Graphics();
    this.activeFrame = new Graphics();   // yetenek etkisi sürerken beyaz çerçeve
    this.pulseRing = new Graphics();     // yetenek hazır olunca altın halka
    for (const o of [this.hyperBar, this.hyperFrame, this.hyperHalo, this.activeFrame, this.pulseRing]) o.visible = false;
    const t = (size, weight, fill, ls = 0.2) => {
      const x = new Text({ text: '', style: { fontFamily: UI_FONT, fontWeight: weight, fontSize: size, fill, letterSpacing: ls } });
      x.anchor.set(this.right ? 1 : 0, 0.5);
      return x;
    };
    this.name = t(19, '700', ON_SURFACE);
    this.sub = t(14, '600', 0x9fb0b9);          // turnuvada oyuncu adının yanında karakter adı
    this.abName = t(14, '700', ON_SURFACE);
    this.tabLbl = t(10, '700', 0x9fb0b9, 1.2);
    this.tabTxt = t(12, '600', ON_SURFACE);
    this.tileTxt = new Text({ text: '', style: { fontFamily: UI_FONT, fontWeight: '700', fontSize: 17, fill: ON_SURFACE } });
    this.tileTxt.anchor.set(0.5);
    this.root.addChild(this.tab, this.tabLbl, this.tabTxt, this.bg, this.hyperBar, this.hyperFrame, this.hyperHalo, this.tile, this.activeFrame, this.pulseRing, this.tileTxt, this.pips, this.name, this.sub, this.abName);
    this.classic = false;
    this.keyLabel = '';
    this.shownTouches = -1;
    this.pipPop = 0;
    this.wasReady = true;
    this.pulse = 0;
    this.tileState = '';
    this.layout();
  }

  /** x koordinatını tarafa göre aynala (sol kartta soldan, sağ kartta sağdan ölçülür). */
  X(x) {
    return this.right ? this.W - x : x;
  }

  get H() {
    return this.classic ? 36 : 48;
  }

  /** Kartın ekranda kapladığı toplam yükseklik (asılı etiket dahil) */
  get fullH() {
    return this.classic ? 36 : 66;
  }

  layout() {
    const { W } = this;
    this.root.position.set(this.right ? 800 - 12 - W : 12, 8);
    const tx = this.classic ? 14 : 52;
    this.name.position.set(this.X(tx), this.classic ? 17 : 15);
    this.abName.position.set(this.X(tx), 33);
    this.tileTxt.position.set(this.X(24), 22);
    for (const o of [this.abName, this.tile, this.tileTxt, this.tab, this.tabLbl, this.tabTxt]) o.visible = !this.classic;
    this.drawBg();
    this.layoutName();
  }

  drawBg() {
    const { W, H } = this;
    const acc = accent(this.T);
    // Takım rengi zemin, üstüne koyu kart: altta 4 px renkli şerit kalır (skor tabelası gibi).
    // Hyper'ı olan karakterde şerit soluk durur ve Hyper barı olarak dolar.
    this.bg.clear()
      .roundRect(0, 0, W, H, 8).fill(this.hasHyper ? 0x08161f : acc)
      .roundRect(0, 0, W, H, 8).fill({ color: acc, alpha: this.hasHyper ? 0.3 : 0 })
      .roundRect(0, 0, W, H - 4, 8).fill(SURFACE)
      .rect(0, H - 12, W, 8).fill(SURFACE);
    this.abName.style.fill = acc;
    // Sabit şekiller (boyut değişince yeniden çizilir)
    const x0 = this.X(this.right ? 42 : 6), y0 = 4, S = 36;
    this.hyperFrame.clear().roundRect(0, 0, W, H, 8).stroke({ width: 2, color: 0xffd23f });
    this.hyperHalo.clear().roundRect(x0 - 2.5, 1.5, 41, 41, 9).stroke({ width: 2.5, color: 0xffd23f });
    this.activeFrame.clear().roundRect(x0 - 1, y0 - 1, S + 2, S + 2, 8).stroke({ width: 2, color: 0xffffff });
    // Halka karenin merkezinden ölçeklenir
    this.pulseRing.clear().roundRect(-S / 2, -S / 2, S, S, 9).stroke({ width: 2, color: 0xffd23f });
    this.pulseRing.position.set(x0 + S / 2, y0 + S / 2);
    this.hyperBar.y = H - 4;
    this.tileKey = '';
    this.drawTab();
  }

  drawTab() {
    if (this.classic) { this.tab.clear(); return; }
    const lw = this.tabLbl.width, tw = this.tabTxt.width;
    const w = 14 + lw + 6 + tw + 12;
    const x = this.right ? this.W - 10 - w : 10;
    this.tab.clear().roundRect(x, this.H - 10, w, 28, 7).fill({ color: 0x17384c, alpha: 0.95 });
    // Sağ kartta da okuma sırası "PASİF  Ad" kalsın (sadece hizalama aynalanır)
    if (this.right) {
      this.tabTxt.position.set(this.W - 22, this.H + 9);
      this.tabLbl.position.set(this.W - 22 - tw - 6, this.H + 9);
    } else {
      this.tabLbl.position.set(24, this.H + 9);
      this.tabTxt.position.set(24 + lw + 6, this.H + 9);
    }
  }

  /** @param main büyük yazılan ad  @param sub yanında küçük yazı (turnuvada karakter adı) */
  setName(main, sub = '') {
    this.nameMain = main;
    this.nameSub = sub;
    this.layoutName();
  }

  layoutName() {
    if (this.nameMain == null) return;
    const tx = this.classic ? 14 : 52;
    const avail = this.W - tx - 56;   // sağda dokunuş noktalarına yer bırak
    // Öncelik oyuncu adında: sığmazsa önce karakter adı kısalır, gerekirse hiç gösterilmez
    fitText(this.name, this.nameMain, avail);
    fitText(this.sub, this.nameSub, avail - this.name.width - 8);
    if (this.sub.width < 34) this.sub.text = '';
    const nx = this.X(tx);
    this.sub.position.set(this.right ? nx - this.name.width - 7 : nx + this.name.width + 7, this.name.y + 1);
  }

  setAbilities(blob, keyLabel) {
    this.keyLabel = keyLabel;
    this.blob = blob;
    this.hasHyper = !!blob.hyper && !this.classic;
    this.hyperShown = null;
    this.drawBg();
    if (blob.active) fitText(this.abName, blob.active.name, this.W - 52 - 12);
    if (blob.passive) {
      this.tabLbl.text = tr('PASİF');
      fitText(this.tabTxt, blob.passive.name, this.W - 70);
      this.drawTab();
    }
    this.tileState = '';
  }

  setClassic(v) {
    this.classic = v;
    if (v) this.hasHyper = false;
    this.layout();
  }

  refresh() {
    this.drawBg();
    this.shownTouches = -1;
    this.tileState = '';
  }

  update(dt, blob, touches) {
    // --- Dokunuş hakkı: 3 nokta. Dolanlar takım renginde; 3'ü de dolunca kırmızı (top karşıya gitmeli).
    if (touches !== this.shownTouches) {
      if (touches > this.shownTouches && this.shownTouches >= 0) this.pipPop = 1;
      this.shownTouches = touches;
      const g = this.pips.clear();
      const max = CONFIG.rules.maxTouches;
      const y = this.classic ? 17 : 15;
      for (let k = 0; k < max; k++) {
        const x = this.X(this.W - 16 - (max - 1 - k) * 15);
        const color = touches >= max ? 0xff5449 : accent(this.T);
        if (k < touches) g.circle(x, y, 5).fill(color);
        else g.circle(x, y, 4.3).stroke({ width: 1.6, color: 0xffffff, alpha: 0.32 });
      }
    }
    this.pipPop = Math.max(0, this.pipPop - dt * 5);
    this.pips.alpha = 1 - this.pipPop * 0.5 + this.pipPop * 0.5 * Math.sin(this.pipPop * 20);

    // --- Hyper barı (alt şerit): dolarken takım renginde; dolunca "HYPER HAZIR" (altın, nabız gibi
    //     yanıp söner, yetenek karesinin çevresi altın); aktif kullanılınca Hyper başlar:
    //     süreliyse şerit altın renkte azalır, vuruş Hyper'ı bekliyorsa şerit dolu altın kalır.
    let hState = '';
    const showHyper = this.hasHyper && !!blob.hyper;
    this.hyperBar.visible = this.hyperFrame.visible = this.hyperHalo.visible = false;
    if (showHyper) {
      const w = this.W - 6, y = this.H - 4;
      const running = blob.hyperTimer > 0 && blob.hyper.duration > 0;
      const ready = !running && !blob.hyperArmed && blob.hyperMeter >= 1;
      hState = running || blob.hyperArmed || blob.hyperShow > 0 ? 'on' : ready ? 'ready' : '';
      const f = running ? blob.hyperTimer / blob.hyper.duration : blob.hyperArmed ? 1 : blob.hyperMeter;
      const fw = Math.max(0, w * f);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
      const gold = running || blob.hyperArmed || ready;
      if (fw > 0.5) {
        const hb = this.hyperBar;
        hb.visible = true;
        hb.x = this.right ? 3 + w - fw : 3;
        hb.y = y;
        hb.scale.x = fw;
        hb.tint = gold ? 0xffd23f : accent(this.T);
        hb.alpha = ready ? 0.55 + 0.45 * pulse : 1;
      }
      if (hState) { this.hyperFrame.visible = true; this.hyperFrame.alpha = Math.min(1, (ready ? 0.3 : 0.5) + 0.5 * pulse); }
      // HAZIR: yetenek karesinin çevresinde altın halka (aktifi kullanınca Hyper devreye girer)
      if (ready && !this.classic && blob.active) { this.hyperHalo.visible = true; this.hyperHalo.alpha = 0.45 + 0.55 * pulse; }
    }
    // Yetenek satırı: HAZIR'da "HYPER HAZIR", Hyper sürerken/beklerken "HYPER · ad" (altın)
    if (hState !== this.hyperShown && blob.active) {
      this.hyperShown = hState;
      fitText(this.abName, hState === 'on' ? `HYPER · ${blob.hyper.name}` : hState === 'ready' ? 'HYPER HAZIR' : blob.active.name, this.W - 52 - 12);
      this.abName.style.fill = hState ? 0xffd23f : accent(this.T);
    }

    if (this.classic || !blob.active) { this.activeFrame.visible = this.pulseRing.visible = false; return; }
    // --- Aktif yetenek karesi
    const acc = accent(this.T);
    const x0 = this.X(this.right ? 42 : 6), y0 = 4, S = 36, cx = this.X(24), cy = 22;
    const max = blob.active.cooldown || 1;
    const cd = blob.cooldown;
    const ready = cd <= 0;
    if (ready && !this.wasReady) this.pulse = 1;
    this.wasReady = ready;
    this.pulse = Math.max(0, this.pulse - dt * 2.2);
    // Kare sadece görünümü değişince yeniden çizilir: hazır/değil ve dolum dilimi (64 kademe)
    const fq = ready ? 64 : Math.floor((1 - cd / max) * 64);
    const key = `${ready}|${fq}|${this.useKey}|${acc}`;
    const redraw = key !== this.tileKey;
    this.tileKey = key;
    const g = redraw ? this.tile.clear() : null;
    if (!redraw) { /* aynı görünüm: çizim yok */ } else if (ready) {
      g.roundRect(x0, y0, S, S, 7).fill(acc);
      if (!this.useKey) {
        // Şimşek işareti (mobilde tuş yerine)
        const k = luminance(acc) > 0.42 ? 0x14100a : 0xffffff;
        g.poly([cx + 2, cy - 11, cx - 6, cy + 2, cx - 1, cy + 2, cx - 3, cy + 11, cx + 6, cy - 2, cx + 1, cy - 2]).fill(k);
      }
    } else {
      g.roundRect(x0, y0, S, S, 7).fill(0x08161f);
      // Saat gibi dolan dilim (12'den başlayıp saat yönünde)
      const f = fq / 64;
      if (f > 0.01) {
        const a0 = -Math.PI / 2, a1 = a0 + f * Math.PI * 2;
        g.moveTo(cx, cy).arc(cx, cy, 15, a0, a1).lineTo(cx, cy).fill({ color: acc, alpha: 0.4 });
      }
      g.circle(cx, cy, 15).stroke({ width: 1.5, color: acc, alpha: 0.5 });
    }
    // Etki sürerken beyaz çerçeve
    this.activeFrame.visible = blob.activeTimer > 0;
    if (this.activeFrame.visible) this.activeFrame.alpha = 0.6 + 0.4 * Math.sin(performance.now() * 0.015);
    this.pulseRing.visible = this.pulse > 0;
    if (this.pulse > 0) { this.pulseRing.scale.set((S + 8 * this.pulse) / S); this.pulseRing.alpha = this.pulse; }
    // Kare içindeki yazı sadece değişince güncellenir
    const label = ready ? (this.useKey ? this.keyLabel : '') : String(Math.ceil(cd));
    const state = `${ready}|${label}`;
    if (state !== this.tileState) {
      this.tileState = state;
      this.tileTxt.text = tr(label);
      this.tileTxt.style.fill = ready ? (luminance(acc) > 0.42 ? 0x14100a : 0xffffff) : ON_SURFACE;
      this.tileTxt.style.fontSize = ready ? 20 : 17;
    }
  }

  /** Kısa tuş adı (S, ↓, YZ) kare içine yazılır; uzun olanların ("Hazır") yerine şimşek çizilir. */
  get useKey() {
    return this.keyLabel && this.keyLabel.length <= 2;
  }
}

/** Oyuncunun başının üstünde küçük dokunuş noktaları (top kendi sahasındayken). */
function drawHeadPips(g, blob, touches, color) {
  g.visible = touches > 0;
  if (touches <= 0) return;
  const max = CONFIG.rules.maxTouches;
  const key = `${touches}|${color}`;
  if (key !== g.key) {
    g.key = key;
    g.clear();
    for (let k = 0; k < max; k++) {
      const x = (k - (max - 1) / 2) * 11;
      if (k < touches) g.circle(x, 0, 3.6).fill(touches >= max ? 0xff5449 : color);
      else g.circle(x, 0, 3).fill({ color: 0xffffff, alpha: 0.35 });
    }
  }
  g.position.set(blob.x, blob.y - (CONFIG.blob.headY + CONFIG.blob.headR) * blob.r - 12);
}

export class Hud {
  constructor(layer, textures, tweener) {
    this.tw = tweener;
    this.root = new Container();
    layer.addChild(this.root);

    // --- Skor kartı ---
    this.panel = new Container();
    this.panel.position.set(400, 32);
    // Yayın tarzı skor tabelası: iki takım bloğu + ortada hedef sayı
    this.bug = new Graphics();
    this.panel.addChild(this.bug);
    this.drawBug();
    // Ortada: üstte hedef ("Hedef 15+2"), altında maç süresi
    this.target = new Text({ text: 'Hedef 15', style: { fontFamily: UI_FONT, fontWeight: '600', fontSize: 11, fill: 0x9fb0b9, letterSpacing: 0.3 } });
    this.target.anchor.set(0.5);
    this.target.position.set(0, -11);
    this.clock = new Text({ text: '0:00', style: { fontFamily: UI_FONT, fontWeight: '700', fontSize: 17, fill: ON_SURFACE_VAR, letterSpacing: 0.5 } });
    this.clock.anchor.set(0.5);
    this.clock.position.set(0, 5);
    this.clockSec = -1;
    this.panel.addChild(this.target, this.clock);
    this.sides = [0, 1].map((team) => {
      const T = CONFIG.teams[team];
      const c = new Container();
      c.position.set(team === 0 ? -72 : 72, -2);
      const glow = new Sprite(textures.glow);
      glow.anchor.set(0.5); glow.blendMode = 'add'; glow.tint = T.color; glow.alpha = 0; glow.scale.set(0.8);
      const digit = new Text({ text: '0', style: { fontFamily: UI_FONT, fontWeight: '700', fontSize: 36, fill: ON_SURFACE } });
      digit.anchor.set(0.5);
      c.addChild(glow, digit);
      this.panel.addChild(c);
      return { c, glow, digit, team };
    });
    this.root.addChild(this.panel);

    // --- Oyuncu kartları ---
    this.cards = [new SideCard(0), new SideCard(1)];
    this.root.addChild(this.cards[0].root, this.cards[1].root);
    // Baş üstü dokunuş noktaları: blob başına bir Graphics; sadece sayı değişince çizilir,
    // her karede yalnızca konumu güncellenir
    this.headPips = new Container();
    this.pipViews = [0, 1, 2, 3].map(() => { const g = new Graphics(); g.visible = false; g.key = ''; this.headPips.addChild(g); return g; });
    this.root.addChild(this.headPips);
    this.trainInfo = new Text({ text: '', style: { fontFamily: UI_FONT, fontWeight: '700', fontSize: 17, fill: ON_SURFACE, letterSpacing: 0.4,
      dropShadow: { color: 0x000000, alpha: 0.45, blur: 3, distance: 1, angle: Math.PI / 2 } } });
    this.trainInfo.anchor.set(1, 0.5);
    this.trainInfo.position.set(786, 32);
    this.trainInfo.visible = false;
    this.root.addChild(this.trainInfo);

    // --- TEKRAR etiketi + sinema şeritleri ---
    this.replayLayer = new Container();
    const bars = new Graphics().rect(0, 0, 800, 34).fill(0x000000).rect(0, 416, 800, 34).fill(0x000000);
    const chip = new Graphics().roundRect(16, 6, 110, 22, 5).fill({ color: 0xffffff, alpha: 0.12 });
    this.recDot = new Graphics().circle(0, 0, 5).fill(0xff5449);
    this.recDot.position.set(30, 17);
    const lab = label(`Tekrar ${CONFIG.replay.speed}x`, 15, 0xffffff);
    lab.position.set(42, 17);
    this.skipHint = label('Atlamak için Boşluk tuşuna bas veya dokun', 14, ON_SURFACE_VAR, '500');
    this.skipHint.anchor.set(0.5);
    this.skipHint.position.set(400, 433);
    // Sayıyı getiren vuruşun hızı (sağ üst, sinema şeridinde)
    this.shotSpeed = label('', 17, 0xffd23f, '700');
    this.shotSpeed.anchor.set(1, 0.5);
    this.shotSpeed.position.set(784, 17);
    this.replayLayer.addChild(bars, chip, this.recDot, lab, this.skipHint, this.shotSpeed);
    this.replayLayer.visible = false;
    this.root.addChild(this.replayLayer);

    this.time = 0;
  }

  setVisible(v) {
    this.panel.visible = v;
    this.headPips.visible = v;
    this.cards.forEach((c, i) => { c.root.visible = v && !(this.train && i === 1); });
    this.trainInfo.visible = v && !!this.train;
  }

  /** Antrenman: sağ kart gizlenir, tabelada isabet – kaçan ve sağ üstte seri yazar. */
  setTrainMode(on) {
    this.train = on;
    this.cards[1].root.visible = !on && this.panel.visible;
    this.trainInfo.visible = on && this.panel.visible;
    this.target.text = on ? tr('İsabet · Kaçan') : this.customTarget ?? this.targetText ?? '';
    if (on) this.setTrainStreak(0, 0);
  }

  setTrainStreak(streak, best) {
    this.trainInfo.text = tr(`Seri ${streak}   ·   Rekor ${best}`);
  }

  /** Klasik modda kartlar sadece isim ve dokunuş noktalarını gösterir. */
  setPillsVisible(v) {
    for (const c of this.cards) c.setClassic(!v);
  }

  setAbilities(blobs, keyLabels) {
    this.cards.forEach((c, i) => c.setAbilities(blobs[i], keyLabels[i]));
  }

  drawBug() {
    this.bug.clear()
      .roundRect(-116, -24, 232, 48, 8).fill(SURFACE)
      .rect(-116, 20, 92, 4).fill(accent(CONFIG.teams[0]))
      .rect(24, 20, 92, 4).fill(accent(CONFIG.teams[1]));
  }

  /** Kartlardaki taraf adları (karakter adı; turnuvada oyuncu adı ve karakter). */
  setNames(names) {
    names.forEach((n, i) => (Array.isArray(n) ? this.cards[i].setName(n[0], n[1]) : this.cards[i].setName(n)));
  }

  /** Karakter seçimiyle takım renkleri değişince çağrılır. */
  refreshTeams() {
    this.drawBug();
    for (const s of this.sides) s.glow.tint = CONFIG.teams[s.team].color;
    for (const c of this.cards) c.refresh();
  }

  /** Skor tabelasının ortasındaki hedef sayı (ör. 15, ya da 2 fark kuralında "15+2"). */
  setTarget(points, winBy2) {
    this.targetText = tr(`Hedef ${winBy2 ? `${points}+2` : points}`);
    if (!this.train) this.target.text = this.customTarget ?? this.targetText;
  }

  /** Ortadaki üst yazıyı değiştir (hayatta kalma, zamana karşı); null → hedef sayı. */
  setTargetText(text) {
    this.customTarget = text == null ? text : tr(text);
    if (!this.train) this.target.text = this.customTarget ?? this.targetText ?? '';
  }

  /**
   * Maç süresi (dk:sn). Yazı sadece saniye değişince güncellenir.
   * @param countdown zamana karşı modunda kalan süre: son 10 sn kırmızı
   */
  setTime(seconds, countdown = false) {
    const s = countdown ? Math.ceil(seconds) : Math.floor(seconds);
    const warn = countdown && s <= 10;
    if (s === this.clockSec && warn === this.clockWarn) return;
    this.clockSec = s;
    this.clockWarn = warn;
    this.clock.text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.clock.style.fill = warn ? 0xff5449 : ON_SURFACE_VAR;
  }

  setScores(a, b) {
    [a, b].forEach((v, i) => { this.sides[i].digit.text = String(v); });
  }

  /** Skor "pop" + rakam flip animasyonu + takım renginde kısa parlama. */
  flipScore(team, value) {
    const s = this.sides[team];
    const d = s.digit;
    this.tw.add({ dur: 0.12, ease: Ease.easeInQuad, onUpdate: (e) => { d.scale.y = 1 - e; },
      onComplete: () => {
        d.text = String(value);
        this.tw.add({ dur: 0.3, ease: Ease.easeOutBack, onUpdate: (e) => { d.scale.y = e; } });
      } });
    this.tw.add({ dur: 0.5, ease: Ease.easeOutElastic, onUpdate: (e) => { s.c.scale.set(1.4 - 0.4 * e); } });
    this.tw.add({ dur: 0.8, ease: Ease.easeOutQuad, onUpdate: (e) => { s.glow.alpha = 0.7 * (1 - e); s.glow.scale.set(0.8 + e * 0.6); } });
    this.tw.add({ dur: 0.35, ease: Ease.easeOutBack, onUpdate: (e) => { this.panel.scale.set(1.08 - 0.08 * e); } });
  }

  /** @param shot { kmh, kind } sayıyı getiren vuruş (yoksa null) */
  showReplay(v, shot = null) {
    this.replayLayer.visible = v;
    this.shotSpeed.text = shot ? `${tr(shot.kind)}  ${shot.kmh} ${L('km/sa', 'km/h')}` : '';
  }

  update(dt, gw, showTouches = true) {
    this.time += dt;
    for (let i = 0; i < 2; i++) {
      const touches = showTouches ? gw.match.touches[i] : 0;
      const card = this.cards[i];
      card.update(dt, gw.blobs[i], touches);
      // Top ya da oyuncu kartın arkasına girerse kart saydamlaşır (oyunu kapatmasın)
      const b = gw.ball, bl = gw.blobs[i];
      const x0 = card.root.x - 24, x1 = card.root.x + card.W + 24, y1 = card.root.y + card.fullH + 24;
      const hidden = (b.y < y1 && b.x > x0 && b.x < x1) || (bl.y - bl.r * 2.4 < y1 && bl.x > x0 && bl.x < x1);
      card.root.alpha += ((hidden ? 0.35 : 1) - card.root.alpha) * Math.min(1, dt * 10);
      drawHeadPips(this.pipViews[i], gw.blobs[i], showTouches ? touches : 0, CONFIG.teams[i].light);
    }
    // 2'ye 2: takım arkadaşlarının başında da takımın dokunuş sayısı
    for (let i = 2; i < 4; i++) {
      const bl = gw.blobs[i];
      if (!bl || bl.ghost) { this.pipViews[i].visible = false; continue; }
      drawHeadPips(this.pipViews[i], bl, showTouches ? gw.match.touches[bl.team] : 0, CONFIG.teams[bl.team].light);
    }
    if (this.replayLayer.visible) {
      this.recDot.alpha = Math.sin(this.time * 6) > 0 ? 1 : 0.25;
    }
  }
}
