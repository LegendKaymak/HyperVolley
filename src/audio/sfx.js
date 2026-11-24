// =============================================================================
//  sfx.js — Tüm sesler Web Audio API ile anlık sentezlenir (harici dosya yok).
//  AudioContext tarayıcı kuralı gereği ilk kullanıcı etkileşiminde açılır.
//
//  Ses yolları:  efektler → sfxBus ┐
//                ortam    → ambBus ┼→ master (ses aç/kapat) → kompresör → hoparlör
//                seyirci  → crowdBus┘ (ortam düzeyiyle birlikte ölçeklenir)
//
//  Gerçekçilik için: vuruşlar bip değil "tok darbe + kısa doku sesi"; her çalışta
//  ton/şiddet hafifçe rastgele değişir (aynı ses tekrar ediyormuş gibi gelmez).
// =============================================================================

const rnd = (a, b) => a + Math.random() * (b - a);

// Arenaya göre ortam sesi ve zemin türü. Düzeyler bilerek düşük tutuldu (arka planda kalsın).
const AMBIENCE = {
  plaj:      { kind: 'waves', level: 0.10, floor: 'sand' },
  gunbatimi: { kind: 'waves', level: 0.07, floor: 'sand' },
  kar:       { kind: 'wind',  level: 0.07, floor: 'snow' },
  salon:     { kind: 'hall',  level: 0.06, floor: 'wood' },
};

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.sfxVol = 0.8;
    this.ambVol = 0.5;
    this.arena = 'plaj';
    this.amb = null;          // çalan ortam sesi düğümleri
    this.crowd = null;        // sürekli seyirci uğultusu
    this.lastOoh = 0;
    try { this.muted = localStorage.getItem('hv_muted') === '1'; } catch { /* yok say */ }
  }

  /** Kullanıcı etkileşiminde çağrılır (tıklama/tuş). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(comp).connect(c.destination);
      this.sfxBus = c.createGain();
      this.ambBus = c.createGain();
      this.crowdBus = c.createGain();
      this.sfxBus.connect(this.master);
      this.ambBus.connect(this.master);
      this.crowdBus.connect(this.master);
      this.applyVolumes();
      // 2 sn beyaz gürültü tamponu (doku sesleri, rüzgâr, dalga, seyirci için)
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startAmbience();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('hv_muted', m ? '1' : '0'); } catch { /* yok say */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.03);
  }

  /** 0..1 arası efekt ve ortam (seyirci dahil) ses düzeyleri. */
  setVolumes(sfx, amb) {
    this.sfxVol = sfx;
    this.ambVol = amb;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, t, 0.03);
    this.ambBus.gain.setTargetAtTime(this.ambVol, t, 0.05);
    this.crowdBus.gain.setTargetAtTime(this.ambVol, t, 0.05);
  }

  setArena(id) {
    if (id === this.arena && this.amb) return;
    this.arena = id;
    if (this.ctx) this.startAmbience();
  }

  get ok() {
    return !!this.ctx && !this.muted;
  }

  // --------------------------------------------------------------- yapı taşları
  /** Frekansı kayabilen osilatör sesi. */
  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.15, vol = 0.3, attack = 0.004, delay = 0, bus = null }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Filtrelenmiş gürültü; filtre frekansı kayabilir. */
  noise({ dur = 0.2, vol = 0.3, type = 'lowpass', f0 = 1000, f1 = null, q = 1, attack = 0.004, delay = 0, release = null, bus = null }) {
    if (!this.ok) return null;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    if (f1 !== null) filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    const end = release ?? dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + end);
    src.connect(filt).connect(g).connect(bus || this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + Math.max(dur, end) + 0.05);
    return { src, filt, g, t };
  }

  /** Sürekli çalan, filtreli gürültü katmanı (ortam/seyirci). */
  loopLayer(bus, { type = 'lowpass', f = 600, q = 0.7, level = 0.1 }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = type; filt.frequency.value = f; filt.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(level, c.currentTime, 0.8);   // yavaşça belirsin
    src.connect(filt).connect(g).connect(bus);
    src.start(0, Math.random() * 1.5);
    return { src, filt, g, level };
  }

  /** Yavaş salınım (dalga kabarması, rüzgâr esintisi). */
  lfo(target, rate, depth) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
    return o;
  }

  // --------------------------------------------------------------- ortam sesi
  /**
   * Sürekli ortam sesi (dalga, rüzgâr, salon uğultusu, seyirci uğultusu) kaldırıldı:
   * uzun süre dinlenince "fsss" diye kulağı yoruyordu. Seyircinin kısa tepkileri
   * (ooh, alkış) olay bazlı çalmaya devam eder ve "Seyirci sesi" ayarıyla kısılır.
   */
  startAmbience() {
    this.stopAmbience();
  }

  stopAmbience() {
    if (!this.amb || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (const n of this.amb) {
      if (n.g) { n.g.gain.cancelScheduledValues(t); n.g.gain.setTargetAtTime(0.0001, t, 0.3); n.src.stop(t + 1.5); }
      if (n.osc) n.osc.stop(t + 1.5);
    }
    this.amb = null;
    this.crowd = null;
  }

  // --------------------------------------------------------------- seyirci (hafif)
  /** Ralli uzadıkça uğultu biraz yükselir (6. vuruştan sonra, tavanı düşük). */
  rally(hits) {
    if (!this.ctx || !this.crowd) return;
    const extra = Math.min(0.06, Math.max(0, hits - 5) * 0.008);
    this.crowd.layer.g.gain.setTargetAtTime(Math.max(0.0001, this.crowd.base + extra), this.ctx.currentTime, 0.6);
  }

  rallyEnd() {
    if (!this.ctx || !this.crowd) return;
    this.crowd.layer.g.gain.setTargetAtTime(Math.max(0.0001, this.crowd.base), this.ctx.currentTime, 1.2);
  }

  /** Top fileye çarpınca kısa bir "ooo" (sık tekrarlanmaz). */
  ooh() {
    if (!this.ok) return;
    const now = this.ctx.currentTime;
    if (now - this.lastOoh < 2.5 || Math.random() < 0.4) return;
    this.lastOoh = now;
    // İki formant bandı: "o" sesine yakın (≈450 Hz ve ≈800 Hz), hafifçe alçalır
    this.noise({ dur: 0.9, vol: 0.05, type: 'bandpass', f0: 480, f1: 380, q: 5, attack: 0.18, release: 0.9, bus: this.crowdBus });
    this.noise({ dur: 0.9, vol: 0.03, type: 'bandpass', f0: 820, f1: 700, q: 5, attack: 0.2, release: 0.85, bus: this.crowdBus });
  }

  // --------------------------------------------------------------- oyun sesleri
  /** Vuruş: tok bas darbe + kısa doku sesi. Hız arttıkça daha dolgun ve parlak. */
  hit(speed = 600) {
    const k = Math.min(1.5, speed / 600);
    const p = rnd(0.94, 1.06);
    this.tone({ type: 'sine', f0: 170 * p, f1: 62 * p, dur: 0.11, vol: 0.5 * Math.min(1.2, 0.7 + k * 0.35) });
    this.tone({ type: 'triangle', f0: 340 * p, f1: 180 * p, dur: 0.05, vol: 0.12 });
    this.noise({ dur: 0.045, vol: 0.16 + 0.1 * k, type: 'bandpass', f0: (1300 + 700 * k) * p, q: 1.1 });
  }

  powerHit() {
    this.tone({ type: 'sine', f0: 140, f1: 45, dur: 0.3, vol: 0.55 });
    this.noise({ dur: 0.35, vol: 0.28, type: 'lowpass', f0: 5000, f1: 300, q: 0.7 });
  }

  /** Metal direk: uyumsuz iki sinüsle kısa "tıng". */
  net() {
    const p = rnd(0.97, 1.03);
    this.tone({ type: 'sine', f0: 1180 * p, dur: 0.35, vol: 0.07 });
    this.tone({ type: 'sine', f0: 1730 * p, dur: 0.22, vol: 0.04 });
    this.noise({ dur: 0.02, vol: 0.06, type: 'highpass', f0: 3000 });
  }

  wall() {
    this.tone({ type: 'sine', f0: 120, f1: 60, dur: 0.09, vol: 0.18 });
    this.noise({ dur: 0.04, vol: 0.05, type: 'lowpass', f0: 900 });
  }

  /** Zıplama: bip yerine kısa, kısık bir hava sesi. */
  jump() {
    this.noise({ dur: 0.09, vol: 0.035, type: 'bandpass', f0: 500, f1: 1100, q: 1.2 });
  }

  /** İniş: zemine göre (kum / parke / kar). */
  land() {
    const floor = (AMBIENCE[this.arena] || AMBIENCE.plaj).floor;
    if (floor === 'wood') {
      this.tone({ type: 'sine', f0: 110, f1: 70, dur: 0.07, vol: 0.14 });
      if (Math.random() < 0.35) this.tone({ type: 'sine', f0: rnd(2100, 2700), f1: rnd(1700, 2000), dur: 0.08, vol: 0.02 }); // ayakkabı gıcırtısı
    } else if (floor === 'snow') {
      this.noise({ dur: 0.1, vol: 0.06, type: 'highpass', f0: 2200 });
      this.noise({ dur: 0.08, vol: 0.05, type: 'lowpass', f0: 500 });
    } else {
      this.noise({ dur: 0.1, vol: 0.07, type: 'lowpass', f0: 650, f1: 300 });
    }
  }

  ability(id) {
    switch (id) {
      case 'gucVurusu':
        this.noise({ dur: 0.35, vol: 0.14, type: 'bandpass', f0: 400, f1: 2400, q: 1.4, attack: 0.15, release: 0.35 });
        this.tone({ type: 'sine', f0: 220, f1: 440, dur: 0.3, vol: 0.08 });
        break;
      case 'havaAtilmasi':
        this.noise({ dur: 0.22, vol: 0.22, type: 'bandpass', f0: 700, f1: 3200, q: 1.1 });
        break;
      case 'miknatis':
        this.tone({ type: 'sine', f0: 180, f1: 240, dur: 0.6, vol: 0.12 });
        this.tone({ type: 'sine', f0: 183, f1: 244, dur: 0.6, vol: 0.1 });   // hafif vuru (dalgalanma)
        break;
      case 'isinlanma':
        this.tone({ type: 'sine', f0: 1400, f1: 300, dur: 0.18, vol: 0.1 });
        this.noise({ dur: 0.15, vol: 0.12, type: 'highpass', f0: 3000, delay: 0.02 });
        break;
      case 'roketZiplama':
        this.noise({ dur: 0.4, vol: 0.25, type: 'bandpass', f0: 300, f1: 2500, q: 1 });
        this.tone({ type: 'sine', f0: 120, f1: 520, dur: 0.35, vol: 0.14 });
        break;
      case 'agirTop':
        this.tone({ type: 'sine', f0: 220, f1: 70, dur: 0.6, vol: 0.2 });
        this.tone({ type: 'triangle', f0: 110, f1: 45, dur: 0.6, vol: 0.1 });
        break;
      case 'kalkan':
        this.tone({ type: 'sine', f0: 520, f1: 780, dur: 0.4, vol: 0.1 });
        this.tone({ type: 'sine', f0: 780, f1: 1170, dur: 0.4, vol: 0.05, delay: 0.04 });
        break;
      case 'falso':
        this.noise({ dur: 0.3, vol: 0.12, type: 'bandpass', f0: 1800, f1: 600, q: 3 });
        this.tone({ type: 'sine', f0: 600, f1: 900, dur: 0.25, vol: 0.06 });
        break;
      case 'yavasZaman':
        this.tone({ type: 'sine', f0: 700, f1: 160, dur: 0.8, vol: 0.12 });
        this.noise({ dur: 0.8, vol: 0.08, type: 'lowpass', f0: 3000, f1: 200, q: 2 });
        break;
      case 'sersemlet':
        // Kafa karıştıran, inip çıkan iki ton
        this.tone({ type: 'triangle', f0: 660, f1: 330, dur: 0.25, vol: 0.09 });
        this.tone({ type: 'triangle', f0: 495, f1: 990, dur: 0.25, vol: 0.06, delay: 0.12 });
        this.tone({ type: 'sine', f0: 160, f1: 90, dur: 0.4, vol: 0.12 });
        break;
      case 'sisme':
        // Balon şişmesi: yükselen, kalınlaşan ton
        this.tone({ type: 'sine', f0: 120, f1: 320, dur: 0.45, vol: 0.16 });
        this.tone({ type: 'triangle', f0: 240, f1: 640, dur: 0.4, vol: 0.05 });
        break;
      case 'tuyTop':
        // Hafif, havalı bir çınlama
        this.tone({ type: 'sine', f0: 900, f1: 1500, dur: 0.5, vol: 0.07 });
        this.tone({ type: 'sine', f0: 1350, f1: 2250, dur: 0.45, vol: 0.035, delay: 0.06 });
        this.noise({ dur: 0.5, vol: 0.05, type: 'highpass', f0: 3500 });
        break;
      case 'turbo':
        this.noise({ dur: 0.35, vol: 0.16, type: 'bandpass', f0: 600, f1: 3000, q: 1.5 });
        this.tone({ type: 'sawtooth', f0: 110, f1: 330, dur: 0.3, vol: 0.05 });
        break;
      case 'sasirt':
        this.tone({ type: 'triangle', f0: 880, f1: 440, dur: 0.18, vol: 0.07 });
        this.tone({ type: 'triangle', f0: 440, f1: 880, dur: 0.18, vol: 0.07, delay: 0.15 });
        this.tone({ type: 'triangle', f0: 880, f1: 440, dur: 0.18, vol: 0.05, delay: 0.3 });
        break;
      case 'kucult':
        this.tone({ type: 'sine', f0: 900, f1: 260, dur: 0.4, vol: 0.1 });
        this.noise({ dur: 0.3, vol: 0.06, type: 'highpass', f0: 2500 });
        break;
      case 'onsezi':
        this.tone({ type: 'sine', f0: 520, f1: 1560, dur: 0.22, vol: 0.09 });
        this.tone({ type: 'sine', f0: 780, f1: 2340, dur: 0.2, vol: 0.05, delay: 0.05 });
        break;
      case 'kesikTop':
        this.noise({ dur: 0.12, vol: 0.2, type: 'highpass', f0: 2000, f1: 5000 });
        this.tone({ type: 'sine', f0: 1200, f1: 400, dur: 0.15, vol: 0.06 });
        break;
      case 'deprem':
        this.tone({ type: 'sine', f0: 70, f1: 38, dur: 0.7, vol: 0.32 });
        this.noise({ dur: 0.6, vol: 0.18, type: 'lowpass', f0: 300, f1: 90 });
        break;
      case 'karaDelik':
        this.tone({ type: 'sine', f0: 300, f1: 55, dur: 0.9, vol: 0.2 });
        this.noise({ dur: 0.8, vol: 0.1, type: 'lowpass', f0: 1200, f1: 120, q: 3 });
        break;
      case 'ikinciSans':
        this.tone({ type: 'sine', f0: 660, dur: 0.12, vol: 0.09 });
        this.tone({ type: 'sine', f0: 990, dur: 0.25, vol: 0.09, delay: 0.1 });
        break;
      case 'ayna':
        this.tone({ type: 'triangle', f0: 1400, f1: 700, dur: 0.15, vol: 0.08 });
        this.tone({ type: 'triangle', f0: 700, f1: 1400, dur: 0.2, vol: 0.07, delay: 0.1 });
        break;
      case 'dorukAtagi':
        this.noise({ dur: 0.4, vol: 0.2, type: 'bandpass', f0: 400, f1: 3000, q: 1 });
        this.tone({ type: 'sine', f0: 220, f1: 880, dur: 0.35, vol: 0.12 });
        this.tone({ type: 'sine', f0: 330, f1: 1320, dur: 0.3, vol: 0.06, delay: 0.05 });
        break;
      case 'ruzgar':
        // Yükselip alçalan rüzgâr uğultusu
        this.noise({ dur: 0.9, vol: 0.18, type: 'bandpass', f0: 400, f1: 1600, q: 0.8, attack: 0.2, release: 0.6 });
        this.noise({ dur: 0.6, vol: 0.06, type: 'highpass', f0: 2500, delay: 0.1 });
        break;
      default:
        this.tone({ type: 'sine', f0: 500, f1: 700, dur: 0.12, vol: 0.08 });
    }
  }

  /** Kalkan topu geri çevirdi: parlak, metalik bir "ding" + hava sesi. */
  shieldBlock() {
    this.tone({ type: 'sine', f0: 880, dur: 0.6, vol: 0.12 });
    this.tone({ type: 'sine', f0: 1320, dur: 0.45, vol: 0.06 });
    this.noise({ dur: 0.3, vol: 0.12, type: 'bandpass', f0: 600, f1: 2400, q: 1 });
    this.tone({ type: 'sine', f0: 140, f1: 70, dur: 0.15, vol: 0.25 });
  }

  /** Falsolu vuruş: vuruş + kısa ıslık gibi dönen ses. */
  spinHit() {
    this.hit(700);
    this.noise({ dur: 0.45, vol: 0.08, type: 'bandpass', f0: 2600, f1: 1200, q: 6, delay: 0.03 });
  }

  /** Karakter seçimi sonrası "VS": derin vuruş + yükselen hava sesi. */
  vs() {
    this.tone({ type: 'sine', f0: 110, f1: 40, dur: 0.9, vol: 0.6 });
    this.noise({ dur: 0.6, vol: 0.22, type: 'bandpass', f0: 300, f1: 3000, q: 1.5, attack: 0.3, release: 0.65 });
    this.noise({ dur: 0.5, vol: 0.3, type: 'lowpass', f0: 4000, f1: 200, delay: 0.45 });
    this.tone({ type: 'sine', f0: 80, f1: 35, dur: 0.8, vol: 0.5, delay: 0.45 });
  }

  /** Karakter seçimi: imleç ve onay. */
  selectMove() {
    this.tone({ type: 'triangle', f0: 660, dur: 0.05, vol: 0.05 });
  }

  selectConfirm() {
    this.tone({ type: 'sine', f0: 160, f1: 60, dur: 0.3, vol: 0.4 });
    this.noise({ dur: 0.15, vol: 0.12, type: 'bandpass', f0: 1500, q: 1 });
  }

  softTouch() {
    this.noise({ dur: 0.06, vol: 0.05, type: 'lowpass', f0: 1200 });
  }

  /** Geri sayım: yumuşak sinüs, son vuruş bir oktav yukarı. */
  countdown(n) {
    const f = n > 0 ? 660 : 1320;
    this.tone({ type: 'sine', f0: f, dur: 0.18, vol: 0.12 });
    this.tone({ type: 'triangle', f0: f * 2, dur: 0.08, vol: 0.025 });
  }

  spawn() {
    [1318, 1760].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.25, vol: 0.06, delay: i * 0.06 }));
  }

  /** Menü: kısa, yumuşak tıklama (kare dalga yok). */
  ui() {
    this.noise({ dur: 0.018, vol: 0.05, type: 'highpass', f0: 2500 });
    this.tone({ type: 'sine', f0: 880, f1: 1100, dur: 0.05, vol: 0.05 });
  }

  uiMove() {
    this.noise({ dur: 0.012, vol: 0.03, type: 'highpass', f0: 3200 });
  }

  streak() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.06, delay: i * 0.07 }));
  }

  confetti() {
    for (let i = 0; i < 2; i++) this.noise({ dur: 0.16, vol: 0.12, type: 'highpass', f0: 2200, delay: i * 0.06 });
  }

  firework() {
    this.noise({ dur: 0.6, vol: 0.08, type: 'lowpass', f0: 1400, f1: 180 });
    this.tone({ type: 'sine', f0: 110, f1: 45, dur: 0.35, vol: 0.12 });
  }

  /**
   * GOL PATLAMASI:
   *  1) düşen frekanslı sinüs "boom"   2) filtreli beyaz gürültü patlaması
   *  3) yükselen whoosh sweep           4) ~2 sn seyirci sevinci (kısık, modüle edilmiş gürültü)
   *  5) kısa zafer arpeji
   */
  explosion(big = 1) {
    if (!this.ok) return;
    const v = Math.min(1.3, big);
    const c = this.ctx;
    this.tone({ type: 'sine', f0: 150, f1: 32, dur: 1.0, vol: 0.85 * v });
    this.tone({ type: 'triangle', f0: 90, f1: 28, dur: 0.7, vol: 0.3 * v });
    this.noise({ dur: 0.9, vol: 0.55 * v, type: 'lowpass', f0: 6000, f1: 180, q: 0.7 });
    this.noise({ dur: 0.7, vol: 0.2, type: 'bandpass', f0: 250, f1: 4500, q: 2, attack: 0.5, release: 0.75, delay: 0.05 });
    // Seyirci sevinci — seyirci yolundan (ortam ses düzeyiyle birlikte kısılabilir)
    const t0 = c.currentTime + 0.15;
    for (const [f, q, vol] of [[650, 0.9, 0.16], [1250, 1.2, 0.1]]) {
      const n = this.noise({ dur: 2.0, vol: vol * v, type: 'bandpass', f0: f, q, attack: 0.3, release: 2.0, delay: 0.15, bus: this.crowdBus });
      if (!n) continue;
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 3 + Math.random() * 3;
      lg.gain.value = 200;
      lfo.connect(lg).connect(n.filt.frequency);
      lfo.start(t0);
      lfo.stop(t0 + 2.2);
    }
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.12, delay: 0.3 + i * 0.09 }));
    this.rallyEnd();
  }

  win() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, i) => {
      this.tone({ type: 'triangle', f0: f, dur: 0.24, vol: 0.09, delay: i * 0.13 });
      this.tone({ type: 'sine', f0: f / 2, dur: 0.28, vol: 0.1, delay: i * 0.13 });
    });
  }
}
