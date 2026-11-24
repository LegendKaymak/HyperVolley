// =============================================================================
//  main.js — Giriş noktası: Pixi kurulumu, letterbox ölçekleme, durum makinesi ve
//  SABİT ZAMAN ADIMLI oyun döngüsü.
// =============================================================================
import { Application } from 'pixi.js';
import { CONFIG } from './config.js';
import { GameWorld } from './game/world.js';
import { AIController } from './game/ai.js';
import { equip, unequip } from './game/abilities.js';
import { TimeScale } from './game/timeScale.js';
import { Stage } from './render/stage.js';
import { Hud } from './render/hud.js';
import { GoalExplosion } from './render/goalExplosion.js';
import { makeTextures } from './render/textures.js';
import { Tweener } from './render/tween.js';
import { Sfx } from './audio/sfx.js';
import { Keyboard, KEYMAP, applyKeyBindings } from './input/keyboard.js';
import { Gamepads } from './input/gamepad.js';
import { MODS, PARTY_RULES, applyRule, resetMods } from './game/mods.js';
import { getHyper } from './game/hyper.js';
import { TouchControls, isTouchDevice } from './input/touch.js';
import { Menus } from './ui/menus.js';
import { MatchStats, Career } from './game/stats.js';
import { CHARACTERS, getCharacter, setTeamLook, resetTeamLooks } from './game/characters.js';
import { Tournament, quickResult } from './game/tournament.js';
import { KingCourt } from './game/kingcourt.js';
import { icon } from './ui/icons.js';
import { I18N, setLang, watchDom, t } from './i18n.js';
import { localizeData } from './lang/en.js';

const STEP = CONFIG.physics.step;                  // 1/60 sn — fizik adımı HİÇ değişmez
const MAX_STEPS = CONFIG.physics.maxStepsPerFrame; // bir karede en fazla 5 adım
const IS_MOBILE = isTouchDevice();
// iPad/iPhone (iPadOS kendini Mac gibi tanıtır; dokunma noktası sayısından ayırt edilir)
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_LINUX = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

// ----------------------------------------------------------------- ayarlar
const settings = { difficulty: 'orta', lowFx: false, replay: CONFIG.replay.enabled, arena: CONFIG.arenas[0].id, sfxVol: 0.8, ambVol: 0.5, points: 15, winBy2: false, classic: false, party: false, rule: null, minutes: 2, kingCrowns: 3, teamSize: 1, quality: 'auto', keys: null, touchSize: 'orta', touchAlpha: 1, lang: 'tr', showFps: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('hv_settings') || '{}')); } catch { /* yok say */ }
// Eski 'Karakter yasaklama' anahtarı → yasak sayısı
if (settings.bans == null) settings.bans = settings.draft ? 1 : 0;
delete settings.draft;
// Eski kayıtlardan kural ayarını çıkar (classic / party → rule)
if (!settings.rule) settings.rule = settings.classic ? 'classic' : settings.party ? 'party' : 'char';
// Dil: İngilizce'de oyun verisi çevrilir ve DOM izlenir (dil değişince sayfa yeniden yüklenir)
setLang(settings.lang);
if (I18N.lang === 'en') localizeData();
watchDom(document.body);
const saveSettings = () => { try { localStorage.setItem('hv_settings', JSON.stringify(settings)); } catch { /* yok say */ } };

// ----------------------------------------------------------------- DOM
const gameEl = document.getElementById('game');
const btnSound = document.getElementById('btnSound');
const btnPause = document.getElementById('btnPause');
const btnFull = document.getElementById('btnFull');
// FPS göstergesi: köşede küçük, sadece yazı (Ayarlar → FPS göstergesi)
const fpsEl = document.createElement('div');
fpsEl.id = 'fps';
fpsEl.setAttribute('data-noi18n', '');
fpsEl.hidden = !settings.showFps;
gameEl.appendChild(fpsEl);
const fps = { n: 0, t: 0 };

// ----------------------------------------------------------------- PIXI
/** WebGPU varsa onu, yoksa (veya başlatma hata verirse) WebGL2'yi kullan. */
async function createApp(resolution) {
  // Dokunmatik cihazlarda MSAA kenar yumuşatma kapalı (yüksek çözünürlükte çok pahalı).
  const base = {
    width: CONFIG.width, height: CONFIG.height, antialias: !IS_MOBILE,
    background: 0x0b1d33, resolution, autoDensity: true, powerPreference: 'high-performance',
  };
  let app = new Application();
  // Masaüstünde WebGPU denenir. Mobilde (özellikle iPad/iPhone Safari) Pixi'nin WebGL
  // yolu daha olgun ve genelde daha hızlıdır.
  // Linux'ta (ör. Pardus) WebGPU sürücü desteği çoğu zaman eksik/yavaş olduğu için yine WebGL.
  const prefer = IS_MOBILE || IS_IOS || IS_LINUX ? 'webgl' : 'webgpu';
  try {
    await app.init({ ...base, preference: prefer });
  } catch (e) {
    console.warn('WebGPU başlatılamadı, WebGL kullanılıyor:', e);
    app = new Application();
    await app.init({ ...base, preference: 'webgl' });
  }
  return app;
}

// ----------------------------------------------------------------- grafik kalitesi
// 'auto': masaüstü yüksek, dokunmatik orta başlar; kasarsa kendiliğinden düşer.
let qualityName = 'yuksek';
const QUALITY_CHAIN = ['yuksek', 'orta', 'dusuk', 'enDusuk'];

/**
 * Donanımı kabaca tanı: yazılımsal çizim (ekran kartı sürücüsü yok/kapalı), az bellek,
 * az çekirdek. Örn. 4 GB RAM'li, tümleşik grafikli bir Pardus PC'de 'orta' ya da
 * yazılımsal çizimde 'enDusuk' ile başlar.
 */
function detectHardware() {
  const info = { software: false, weak: false, renderer: '' };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) { info.software = true; return info; }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    info.renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    info.software = /llvmpipe|softpipe|swiftshader|software|basic render/i.test(info.renderer);
    // Eski Intel tümleşik grafikler (HD 2000–5000, GMA)
    if (/GMA|HD Graphics( [2-5]\d{3})?\b|Sandybridge|Ivybridge|Haswell/i.test(info.renderer)) info.weak = true;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* yok say */ }
  if ((navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)) info.weak = true;
  return info;
}
const HW = detectHardware();

function initialQuality(setting) {
  if (setting && setting !== 'auto' && CONFIG.effects.quality[setting]) return setting;
  if (HW.software) return 'enDusuk';
  if (IS_MOBILE || IS_IOS || HW.weak) return 'orta';
  return 'yuksek';
}
const currentQuality = () => CONFIG.effects.quality[qualityName];

function targetResolution(scale) {
  return Math.max(0.5, Math.min(currentQuality().maxRes, (window.devicePixelRatio || 1) * scale));
}

// Yerleşim: menülerde oyun ekranı sığabildiği kadar büyük. Maçta dokunmatik butonlar
// görünürken iki seçenek hesaplanır ve oyunu daha büyük gösteren seçilir:
//  • 'side'   — butonlar iki yandaki sütunlarda (geniş telefon ekranları)
//  • 'bottom' — butonlar oyunun altında (iPad gibi 4:3 ekranlar; oyun tam genişlikte, üstte)
// Ölçüler style.css'teki .tcluster ile uyumludur.
const TOUCH_BOTTOM = 150;
let touchShown = false;
let touchReserve = { l: 136, r: 136 };
/** Çentikli telefonlarda yatay modda kenar güvenli alanları (px). */
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
document.body.appendChild(safeProbe);
const safeInsets = () => {
  const cs = getComputedStyle(safeProbe);
  return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
};
/**
 * Oyun alanının ölçeği ve konumu. Dokunmatik butonlar görünürken:
 *  - 'side': butonlar iki yandaki sütunlarda; oyun sadece gerektiği kadar daralır ve
 *    ekran zaten yüksekliğe göre sınırlıysa (telefonlar) hiç küçülmez, sadece kayar.
 *  - 'bottom': iPad gibi 4:3 ekranlarda butonlar oyunun altındaki şeritte.
 */
function computeLayout() {
  const W = window.innerWidth, H = window.innerHeight;
  const full = Math.min(W / CONFIG.width, H / CONFIG.height);
  if (!IS_MOBILE || !touchShown) return { s: full, mode: 'none', top: H / 2, left: W / 2 };
  const ins = safeInsets();
  const l = touchReserve.l + Math.max(0, ins.l - 4), r = touchReserve.r + Math.max(0, ins.r - 4);
  const side = Math.min((W - l - r) / CONFIG.width, H / CONFIG.height);
  const bottom = Math.min(W / CONFIG.width, (H - TOUCH_BOTTOM) / CONFIG.height);
  if (bottom > side * 1.02) return { s: bottom, mode: 'bottom', top: (H - TOUCH_BOTTOM) / 2, left: W / 2 };
  const gw = CONFIG.width * side;
  // Ortala; butonlarla çakışacaksa çakışmayacak kadar kaydır
  const left = Math.min(Math.max(W / 2, l + gw / 2), W - r - gw / 2);
  return { s: side, mode: 'side', top: H / 2, left };
}
const viewScale = () => computeLayout().s;

async function boot() {
  qualityName = initialQuality(settings.quality);
  // Pixi yazıları ilk çizimde yazı tipini kullanabilsin diye önce yükle (en fazla 1.5 sn bekle)
  try {
    await Promise.race([
      Promise.all([
        ...['600', '700', '800'].map((w) => document.fonts.load(`${w} 16px "Barlow Condensed"`)),
        document.fonts.load('italic 800 16px "Barlow Condensed"'),
        document.fonts.load('500 16px "Barlow"'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch { /* yazı tipi yoksa sistem yazı tipi kullanılır */ }
  const app = await createApp(targetResolution(viewScale()));
  document.getElementById('pixi').appendChild(app.canvas);
  const rname = String(app.renderer.name || '').toLowerCase().includes('gpu') ? 'WebGPU' : 'WebGL2';

  // Letterbox: 800x450 sanal alan, ekrana sığacak şekilde orantılı ölçeklenir (kenarlar boş kalır).
  let curRes = app.renderer.resolution;
  const layout = (force = false) => {
    const L = computeLayout();
    const s = L.s;
    gameEl.style.top = `${L.top}px`;
    gameEl.style.left = `${L.left}px`;
    gameEl.style.transform = `translate(-50%, -50%) scale(${s})`;
    document.body.classList.toggle('ctl-bottom', L.mode === 'bottom');
    document.body.classList.toggle('ctl-side', L.mode === 'side');
    const res = targetResolution(s);
    if (force || Math.abs(res - curRes) > 0.05) { app.renderer.resize(CONFIG.width, CONFIG.height, res); curRes = res; }
  };
  window.addEventListener('resize', () => layout());
  // Odaklanan bir yazı kutusu, taşmayı gizleyen oyun alanını kaydırmasın
  gameEl.addEventListener('scroll', () => { gameEl.scrollTop = 0; gameEl.scrollLeft = 0; });
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));
  layout();

  // ----------------------------------------------------------------- sistemler
  const textures = makeTextures(app.renderer);
  const tweener = new Tweener();
  const time = new TimeScale();
  const sfx = new Sfx();
  sfx.setVolumes(settings.sfxVol, settings.ambVol);
  sfx.setArena(settings.arena);
  let rallyHits = 0;
  const matchStats = new MatchStats();
  Career.load();
  const kb = new Keyboard();
  applyKeyBindings(settings.keys);
  const pads = new Gamepads();
  const touch = new TouchControls(document.getElementById('touch'));
  touch.onVisibility = (v) => { touchShown = v; touchReserve = touch.reserve; layout(); };
  touch.setLook(settings.touchSize, settings.touchAlpha);
  const stage = new Stage(app, textures, { arena: settings.arena });
  const hud = new Hud(stage.hud, textures, tweener);
  const goalFx = new GoalExplosion({ stage, tweener, time, sfx, textures });
  const gw = new GameWorld();
  stage.setFx(settings.lowFx, currentQuality());

  /** Kaliteyi uygula: çözünürlük + filtreler + parçacıklar. */
  function applyQuality(name) {
    qualityName = name;
    stage.setFx(settings.lowFx, currentQuality());
    layout(true);
  }
  /** Ayarlardaki kalite seçimi değiştiyse uygula. */
  let lastQualitySetting = settings.quality;
  function syncQuality() {
    if (settings.quality === lastQualitySetting) return;
    lastQualitySetting = settings.quality;
    applyQuality(initialQuality(settings.quality));
  }
  // Otomatik kalite: 2 sn'lik pencerelerde ortalama kare süresini ölç; yavaşsa bir seviye düşür.
  const perf = { acc: 0, n: 0, slow: 0 };
  function watchPerf(deltaMS) {
    if (settings.quality !== 'auto' || qualityName === 'enDusuk' || document.hidden) return;
    if (deltaMS > 250) return;          // sekme değişimi gibi tek seferlik takılmaları sayma
    perf.acc += deltaMS; perf.n++;
    if (perf.acc < 2000) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0; perf.n = 0;
    perf.slow = avg > CONFIG.effects.autoDowngradeMs ? perf.slow + 1 : 0;
    if (perf.slow >= 2) {               // üst üste iki yavaş pencere
      perf.slow = 0;
      applyQuality(QUALITY_CHAIN[Math.min(QUALITY_CHAIN.length - 1, QUALITY_CHAIN.indexOf(qualityName) + 1)]);
      console.info('Grafik kalitesi düşürüldü:', qualityName, `(ortalama ${avg.toFixed(1)} ms/kare)`);
    }
  }

  let state = 'menu';
  let prevState = 'playing';
  let mode = '1p';            // '1p' (insan solda, YZ sağda) | '2p' | 'ai' (iki YZ, turnuvada izleme)
  let classic = false;
  let party = false;          // parti modu: her sayıda rastgele kural
  let partyRule = null;
  /**
   * Maç kurulumu: iki taraf için { kind: 'human'|'ai', difficulty, name, charId }.
   * tour: turnuva maçıysa { r, i, swapped } (swapped: ağaçtaki a/b taraf değiştirdiyse)
   */
  let setup = null;
  let tour = null;            // devam eden turnuva (Tournament)
  let stateT = 0;
  let acc = 0;
  let replayFrames = null;
  let replayT = 0;
  let demoRespawn = 0;
  let ais = [null, null];
  let mateAis = [];           // 2'ye 2: takım arkadaşlarının yapay zekası
  let train = null;           // antrenman durumu: { hits, misses, timer, streak, best }
  let king = null;            // kral sahası (KingCourt)
  // Tekrarda gösterilen vuruş hızı: son vuruşun ardından kısa süre içindeki en yüksek top hızı
  let lastHit = null;         // { team, speed, steps, spike, super }
  let pointShot = null;       // { kmh, kind }
  const PX_PER_M = 32;        // hız ölçer ölçeği: 32 px = 1 m (blob yaklaşık 2,4 m görünür)
  const replayFrame = {
    blobs: Array.from({ length: 4 }, () => ({ x: 0, y: 0, r: 32, power: false, magnet: false })),
    ball: { x: 0, y: 0, rot: 0, visible: false, fire: false, slow: false },
  };

  const updateSoundBtn = () => { btnSound.innerHTML = icon(sfx.muted ? 'volumeOff' : 'volumeOn', 18); };
  btnPause.innerHTML = icon('pause', 18);
  // Tam ekran (iPad Safari'de webkit önekli; iPhone'da desteklenmez → düğme gizlenir)
  const fsEl = document.documentElement;
  const canFs = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const updateFullBtn = () => { btnFull.innerHTML = icon(isFs() ? 'fsExit' : 'fs', 18); };
  btnFull.hidden = !canFs;
  document.body.classList.toggle('no-fs', !canFs);
  updateFullBtn();
  const toggleFs = () => {
    if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    else (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen)?.call(fsEl)?.catch?.(() => {});
  };
  btnFull.addEventListener('click', (e) => { e.stopPropagation(); btnFull.blur(); toggleFs(); });
  document.addEventListener('fullscreenchange', () => { updateFullBtn(); setTimeout(layout, 50); });
  document.addEventListener('webkitfullscreenchange', () => { updateFullBtn(); setTimeout(layout, 50); });
  updateSoundBtn();
  const setHudButtons = (inMatch) => gameEl.classList.toggle('inMatch', inMatch);

  // ----------------------------------------------------------------- menüler
  const menus = new Menus(document.getElementById('ui'), {
    sfx, settings, rendererName: rname, career: Career,
    canFs: () => canFs, isFs, toggleFs,
    toggleMute: () => { sfx.unlock(); sfx.setMuted(!sfx.muted); updateSoundBtn(); },
    loadEntrants: () => loadEntrants(),
    tourStatus: () => (tour && !tour.isOver ? `Devam eden turnuva: ${tour.roundName(tour.nextMatch().r)}` : null),
    /** Menü akışının sonu: { players: '1'|'2'|'multi'|'watch'|'train', mode } */
    onLaunch: (f) => {
      settings.classic = settings.rule === 'classic';
      settings.party = settings.rule === 'party';
      saveSettings();
      const human = (i) => ({ kind: 'human', name: `Oyuncu ${i + 1}`, charId: null });
      const ai = (name = `Yapay zeka (${diffName()})`) => ({ kind: 'ai', difficulty: settings.difficulty, name, charId: null });
      const mins = settings.minutes || 2;
      if (f.players === 'train') { menus.o.onStart('train'); return; }
      if (f.players === 'watch') { newSetup([ai('Sol'), ai('Sağ')], null, { watch: { guess: null } }); return; }
      if (f.players === 'multi') {
        if (f.mode === 'king') menus.showTournamentSetup(loadEntrants(), 'king', f.count);
        else if (tour && !tour.isOver) showBracket();
        else menus.showTournamentSetup(loadEntrants(), 'tour', f.count);
        return;
      }
      // HyperMatch: karakterli, 15 sayı + 2 fark, iki taraf da 5 karakter yasaklar
      if (f.mode === 'hyper') {
        newSetup([human(0), f.players === '2' ? human(1) : ai()], null, { hyperMatch: true, points: 15, winBy2: true, bans: 5 });
        return;
      }
      if (f.players === '1') {
        if (f.mode === 'survival') newSetup([human(0), ai('Yapay zeka')], null, { survival: {} });
        else if (f.mode === 'timed') newSetup([human(0), ai()], null, { timed: mins * 60 });
        else newSetup([human(0), ai()], null);
        return;
      }
      // 2 oyuncu
      if (f.mode === 'coop') newSetup([human(0), ai()], null, { coop: { p2: human(1) }, size: 2 });
      else if (f.mode === 'timed') newSetup([human(0), human(1)], null, { timed: mins * 60 });
      else newSetup([human(0), human(1)], null);
    },
    // Kral sahası
    onKingStart: (entrants) => {
      saveEntrants(entrants);
      king = new KingCourt(entrants, settings.kingCrowns || 3);
      showKing();
    },
    onKingPlay: () => playKingMatch(),
    onKingQuick: () => {
      const m = king.nextMatch();
      king.report(quickResult(king.entrants[m.a].type, king.entrants[m.b].type, settings.points, settings.winBy2));
      sfx.ui();
      king.isOver ? showKingChampion() : showKing();
    },
    onKingContinue: () => (king.isOver ? showKingChampion() : showKing()),
    onStart: (m) => {
      const prev = setup && !setup.tour ? setup.sides.map((x) => x.charId) : [null, null];
      const human = (i) => ({ kind: 'human', name: `Oyuncu ${i + 1}`, charId: prev[i] });
      if (m === 'train') {
        classic = false;
        setup = { sides: [human(0), { kind: 'machine', name: 'Top makinesi', charId: CHARACTERS[0].id }], tour: null, train: true };
        mode = '1p';
        goSelect();
        return;
      }
      const ai = { kind: 'ai', difficulty: settings.difficulty, name: `Yapay zeka (${diffName()})`, charId: null };
      newSetup([human(0), m === '2p' ? human(1) : ai], null);
    },
    onSelectDone: (ids) => {
      if (setup.coop) {
        // 1. seçim Oyuncu 1'in, 2. seçim takım arkadaşı Oyuncu 2'nin; rakip yapay zeka rastgele
        setup.sides[0].charId = ids[0];
        setup.coop.p2.charId = ids[1];
        const pool = CHARACTERS.filter((c) => !ids.includes(c.id));
        setup.sides[1].charId = pool[Math.floor(Math.random() * pool.length)].id;
        showVs();
        return;
      }
      setup.sides.forEach((x, i) => { if (x.kind !== 'machine') x.charId = ids[i]; });
      if (setup.train) startTraining();
      else if (setup.watch) {
        // Tahmin: kim kazanır? (sonra VS ve maç)
        menus.showGuess(setup.sides.map((x) => getCharacter(x.charId)), (g) => { setup.watch.guess = g; showVs(); });
      } else showVs();
    },
    onModes: () => menus.showModes({ best: Career.data.survivalBest, settings }),
    onStartMode: (kind, o = {}) => {
      const human = (i) => ({ kind: 'human', name: `Oyuncu ${i + 1}`, charId: null });
      const ai = (d, name) => ({ kind: 'ai', difficulty: d, name, charId: null });
      if (kind === 'survival') newSetup([human(0), ai('kolay', 'Yapay zeka')], null, { survival: {} });
      else if (kind === 'timed') newSetup([human(0), o.vs === '2p' ? human(1) : ai(settings.difficulty, `Yapay zeka (${diffName()})`)], null, { timed: (o.minutes || 2) * 60 });
      else if (kind === 'watch') newSetup([ai(o.d0 || 'zor', 'Sol'), ai(o.d1 || 'zor', 'Sağ')], null, { watch: { guess: null } });
    },
    trainOpts: () => (setup?.train ? { shot: settings.trainShot || 'karisik', noCd: !!settings.trainNoCd } : null),
    onTrainOpt: (k, v) => { settings[k] = v; saveSettings(); },
    onResume: () => resume(),
    onQuit: () => goMenu(),
    onRematch: () => startMatch(),
    onChangeAbilities: () => { goalFx.clearAll(); touch.setVisible(false); goSelect(); },
    onSelectBack: () => {
      if (setup?.king) showKing();
      else if (setup?.tour) showBracket();
      else { goMenu(); if (menus.flow) menus.showOptionsStep(); }   // menü akışında bir adım geri: ayarlar
    },
    // Turnuva
    onTournament: () => {
      if (tour && !tour.isOver) showBracket();
      else menus.showTournamentSetup(loadEntrants());
    },
    onTournamentNew: () => { tour = null; menus.showTournamentSetup(loadEntrants()); },
    onTournamentStart: (entrants) => {
      saveEntrants(entrants);
      tour = new Tournament(entrants);
      showBracket();
    },
    onTournamentPlay: () => playTournamentMatch(),
    onTournamentQuick: () => {
      const nm = tour.nextMatch();
      const [A, B] = [tour.entrants[nm.match.a], tour.entrants[nm.match.b]];
      tour.report(nm.r, nm.i, quickResult(A.type, B.type, settings.points, settings.winBy2));
      sfx.ui();
      tour.isOver ? showChampion() : showBracket();
    },
    onTournamentContinue: () => (tour.isOver ? showChampion() : showBracket()),
    pads,
    onLangChange: (lang) => {
      settings.lang = lang;
      saveSettings();
      try { sessionStorage.setItem('hv_reopen', 'settings'); } catch { /* yok say */ }
      location.reload();
    },
    onSettingsChange: () => { saveSettings(); fpsEl.hidden = !settings.showFps; syncQuality(); applyKeyBindings(settings.keys); touch.setLook(settings.touchSize, settings.touchAlpha);
      stage.setFx(settings.lowFx, currentQuality()); stage.setArena(settings.arena); sfx.setArena(settings.arena); sfx.setVolumes(settings.sfxVol, settings.ambVol); updateSoundBtn(); },
  });
  /** Takım renkleri değişince renkleri önbelleğe alan çizimleri yenile. */
  /** Bir blob'un görünümü (2'ye 2'de arkadaşlar 2 ve 3 numaralı görünümlerde). */
  function viewOf(blob) {
    const i = gw.blobs.indexOf(blob);
    return stage.blobViews[i >= 0 ? i : blob.team];
  }

  function refreshLooks() {
    for (const v of stage.blobViews) v.drawnR = 0;   // gövde bir sonraki karede yeniden çizilir
    hud.refreshTeams();
  }
  const DIFF_NAMES = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor', usta: 'Usta' };
  const diffName = (d = settings.difficulty) => DIFF_NAMES[d] || 'Orta';

  // ----------------------------------------------------------------- maç kurulumu
  /** Yeni maç kurulumu: Klasik'te doğrudan maç, değilse karakter seçimi. */
  function newSetup(sides, tourRef, extra = {}) {
    classic = settings.classic && !extra.hyperMatch;
    party = !!settings.party && !classic && !tourRef && !extra.survival && !extra.watch && !extra.hyperMatch;
    const plain = !tourRef && !extra.survival && !extra.watch && !extra.king;
    setup = { sides, tour: tourRef, size: plain && settings.teamSize === 2 ? 2 : 1, ...extra };
    setup.kaos = settings.rule === 'kaos' && !classic && !tourRef && !extra.king && !extra.hyperMatch;
    const humans = sides.filter((x) => x.kind === 'human').length + (extra.coop ? 1 : 0);
    mode = humans === 2 ? '2p' : humans === 1 ? '1p' : 'ai';
    if (classic) { startMatch(); return; }
    if (setup.kaos) {
      // Kaos: karakter seçimi yok, herkes rastgele (her sayıda da değişir)
      const pool = [...CHARACTERS].sort(() => Math.random() - 0.5);
      sides.forEach((x, i) => { x.charId = pool[i].id; });
      if (setup.coop) setup.coop.p2.charId = pool[2].id;
      showVs();
      return;
    }
    if (mode === 'ai' && !setup.watch) {
      // İki yapay zeka: rastgele, farklı karakterler
      const pool = [...CHARACTERS].sort(() => Math.random() - 0.5);
      sides[0].charId = pool[0].id; sides[1].charId = pool[1].id;
      showVs();
      return;
    }
    goSelect();
  }

  function goSelect() {
    resetDemo();             // arkada gösteri maçı oynasın
    state = 'select';
    gameEl.classList.add('inVs');   // köşe düğmeleri seçim ekranını kapatmasın (ses için M tuşu)
    menus.showSelect({
      solo: !!setup.train,
      // Yasak sayısı: HyperMatch'te 5; normal maç ve zamana karşı modunda ayarlardan
      bans: setup.bans ?? (!setup.train && !setup.watch && !setup.survival && !setup.tour && !setup.king ? settings.bans || 0 : 0),
      title: setup.hyperMatch ? 'HyperMatch: karakterini seç' : setup.watch ? 'İzle: iki karakter seç' : setup.survival ? 'Hayatta kalma: karakterini seç' : setup.coop ? 'İkiniz bir takım: karakterlerinizi seçin' : '',
      // İzleme modunda iki tarafı da kullanıcı seçer; İkiniz bir takım'da iki oyuncu seçer
      sides: setup.coop
        ? [{ name: 'Oyuncu 1', ai: false }, { name: 'Oyuncu 2', ai: false }]
        : setup.sides.map((x) => ({ name: x.name, ai: setup.watch ? false : x.kind !== 'human' })),
      prev: setup.sides.map((x) => x.charId),
    });
  }

  /** Mortal Kombat tarzı "VS" ekranı, ardından maç. */
  function showVs() {
    state = 'vs';
    gameEl.classList.add('inVs');
    sfx.vs();
    const vs = setup.sides.map((x) => ({ name: x.name, char: getCharacter(x.charId) }));
    if (setup.coop) vs[0].name = `Oyuncu 1 + 2 (${getCharacter(setup.coop.p2.charId).name})`;
    menus.showVs(vs, () => startMatch());
  }

  // ----------------------------------------------------------------- turnuva
  function loadEntrants() {
    try { return JSON.parse(localStorage.getItem('hv_entrants') || 'null'); } catch { return null; }
  }
  function saveEntrants(list) {
    try { localStorage.setItem('hv_entrants', JSON.stringify(list)); } catch { /* yok say */ }
  }
  function showBracket() {
    state = 'menu-tour';
    resetDemo();
    menus.showBracket(tour, { points: settings.points, winBy2: settings.winBy2 });
  }
  // ----------------------------------------------------------------- kral sahası
  function showKing() {
    state = 'menu-tour';
    resetDemo();
    menus.showKing(king, { points: settings.points, winBy2: settings.winBy2 });
  }
  function playKingMatch() {
    const m = king.nextMatch();
    if (!m) return;
    let A = king.entrants[m.a], B = king.entrants[m.b];
    let swapped = false;
    if (A.type !== 'human' && B.type === 'human') { [A, B] = [B, A]; swapped = true; }   // insan solda
    const side = (e) => (e.type === 'human'
      ? { kind: 'human', name: e.name, charId: null }
      : { kind: 'ai', difficulty: e.type, name: e.name, charId: null });
    newSetup([side(A), side(B)], null, { king: { swapped } });
  }
  function showKingChampion() {
    resetDemo();
    state = 'champion';
    menus.showKingChampion(king);
    sfx.win();
  }

  function showChampion() {
    resetDemo();
    state = 'champion';
    menus.showChampion(tour);
    sfx.win();
  }
  /** Sıradaki turnuva maçını kur. İnsan - YZ maçında insan sol tarafa (A/D ve ok tuşları) geçer. */
  function playTournamentMatch() {
    const nm = tour.nextMatch();
    if (!nm) return;
    let A = tour.entrants[nm.match.a], B = tour.entrants[nm.match.b];
    let swapped = false;
    if (A.type !== 'human' && B.type === 'human') { [A, B] = [B, A]; swapped = true; }
    const side = (e) => (e.type === 'human'
      ? { kind: 'human', name: e.name, charId: null }
      : { kind: 'ai', difficulty: e.type, name: e.name, charId: null });
    newSetup([side(A), side(B)], { r: nm.r, i: nm.i, swapped });
  }

  // ----------------------------------------------------------------- akış
  function goMenu() {
    if (train) stopTraining();
    clearPartyRule();
    state = 'menu';
    time.reset();
    tweener.clear();
    goalFx.clearAll();
    stage.resetFx();
    hud.showReplay(false);
    hud.setVisible(false);
    touch.setVisible(false);
    setHudButtons(false);
    resetDemo();
    menus.showMain();
  }

  /** Hyper başlayınca blob'un üstünde yükselip kaybolan "HYPER / ad" yazısı (DOM, oyun koordinatında). */
  function hyperPop(blob, h) {
    const el = document.createElement('div');
    el.className = 'hyperPop';
    el.innerHTML = `<small>HYPER</small><b>${h.name}</b>`;
    el.style.left = `${Math.max(90, Math.min(CONFIG.width - 90, blob.x))}px`;
    el.style.top = `${Math.max(70, blob.y - blob.r * 2.6 - 40)}px`;
    gameEl.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ----------------------------------------------------------------- hayatta kalma / zamana karşı
  const SURVIVAL_LIVES = 5;
  const SURVIVAL_LEVELS = ['kolay', 'orta', 'zor', 'usta'];
  let timeUp = false;
  /** Skor tabelasının ortasındaki yazı: hedef / can ve seviye / süre */
  function updateModeHud() {
    if (setup?.survival) {
      const s = setup.survival;
      hud.setTargetText(`Can ${s.lives} · Seviye ${s.level + 1}`);
    } else if (setup?.timed) {
      hud.setTargetText(timeUp ? (gw.match.score[0] === gw.match.score[1] ? 'Altın sayı' : 'Son sayı') : 'Kalan süre');
    } else {
      hud.setTargetText(null);
    }
  }
  /** Büyük duyuru (parti kuralı, seviye atlama vb.); 2 sn sonra tabelanın altında küçük kalır ya da kaybolur */
  function showBanner(label, title, desc, stay = false) {
    ruleEl.innerHTML = `<small>${label}</small><b>${title}</b><span>${desc}</span>`;
    ruleEl.className = 'show big';
    clearTimeout(ruleTimer);
    ruleTimer = setTimeout(() => { ruleEl.className = stay ? 'show' : ''; }, 2000);
  }
  /** Hayatta kalma: seviye atlayınca rakip güçlenir ve yeni bir karaktere geçer */
  function survivalLevelUp() {
    const s = setup.survival;
    s.pendingLevel = false;
    s.level++;
    const d = SURVIVAL_LEVELS[Math.min(s.level, SURVIVAL_LEVELS.length - 1)];
    setup.sides[1].difficulty = d;
    ais[1]?.setDifficulty(d);
    let desc = `Rakip: ${diffName(d)}`;
    if (!classic) {
      const pool = CHARACTERS.filter((c) => c.id !== setup.sides[0].charId && c.id !== setup.sides[1].charId);
      const c = pool[Math.floor(Math.random() * pool.length)];
      setup.sides[1].charId = c.id;
      equip(gw.blobs[1], c.passive, c.active);
      gw.blobs[1].hyper = getHyper(c.hyper);
      gw.blobs[1].hyperMeter = 0;
      setTeamLook(1, c);
      refreshLooks();
      hud.setNames([getCharacter(setup.sides[0].charId).name, c.name]);
      refreshKeyLabels();
      desc += ` · ${c.name}`;
    }
    updateModeHud();
    showBanner('Seviye atladın', `Seviye ${s.level + 1}`, desc);
  }

  // ----------------------------------------------------------------- parti modu
  const ruleEl = document.createElement('div');
  ruleEl.id = 'rule';
  gameEl.appendChild(ruleEl);
  let ruleTimer = 0;
  /** Her sayıdan önce önceki kuraldan farklı rastgele bir kural seç ve büyükçe duyur. */
  function pickPartyRule() {
    const pool = PARTY_RULES.filter((r) => r !== partyRule);
    partyRule = pool[Math.floor(Math.random() * pool.length)];
    const desc = applyRule(partyRule);
    ruleEl.innerHTML = `<small>Kural</small><b>${partyRule.name}</b><span>${desc}</span>`;
    ruleEl.className = 'show big';
    clearTimeout(ruleTimer);
    ruleTimer = setTimeout(() => { ruleEl.className = 'show'; }, 2000);   // sonra tabelanın altında küçük kalır
    sfx.selectConfirm?.();
  }
  function clearPartyRule() {
    partyRule = null;
    resetMods();
    clearTimeout(ruleTimer);
    ruleEl.className = '';
  }

  // ----------------------------------------------------------------- antrenman
  // Karşı tarafta blob yok; top makinesi sağdan seçilen türde toplar atar. Skor yerine
  // isabet (top karşı sahaya düştü) ve kaçan sayılır. Ayarlar duraklatma ekranında.
  function startTraining() {
    gameEl.classList.remove('inVs');
    menus.hide();
    tweener.clear();
    goalFx.clearAll();
    stage.resetFx();
    time.reset();
    hud.showReplay(false);
    clearPartyRule();
    gw.setTeamSize(1);
    gw.hyperOn = false;
    mateAis = [];
    const ch = getCharacter(setup.sides[0].charId);
    equip(gw.blobs[0], ch.passive, ch.active);
    gw.blobs[0].hyper = getHyper(ch.hyper);
    setTeamLook(0, ch);
    unequip(gw.blobs[1]);
    gw.blobs[1].ghost = true;
    refreshLooks();
    hud.setNames([ch.name, 'Top makinesi']);
    ais = [null, null];
    gw.match.reset(0, { pointsToWin: 9999 });
    gw.hyperOn = true;
    gw.resetHyper();
    matchStats.reset();
    gw.replay.clear();
    gw.resetPositions();
    gw.ball.reset();
    train = { hits: 0, misses: 0, timer: 1.0, streak: 0, best: 0 };
    hud.setTrainMode(true);
    hud.setScores(0, 0);
    refreshKeyLabels();
    hud.setPillsVisible(true);
    hud.setVisible(true);
    touch.build('1p', false);
    touch.setVisible(true);
    setHudButtons(true);
    state = 'playing';
  }

  /** Top makinesi: topu sağ taraftan, seçilen türde bir yörüngeyle sol sahaya atar. */
  function launchTrainingBall() {
    const ball = gw.ball;
    const kinds = ['yuksek', 'sert', 'file', 'derin'];
    const shot = settings.trainShot && settings.trainShot !== 'karisik' ? settings.trainShot : kinds[Math.floor(Math.random() * kinds.length)];
    const g = CONFIG.ball.gravity;
    const x0 = CONFIG.width - 90, y0 = 230;
    // Hedef: topun sol sahada baş yüksekliğine ineceği nokta ve yörüngenin tepe yüksekliği
    const T = {
      yuksek: { x: rand(90, 330), apex: rand(30, 70) },
      sert:   { x: rand(80, 300), apex: rand(150, 175) },
      file:   { x: rand(300, 350), apex: rand(120, 160) },
      derin:  { x: rand(50, 110), apex: rand(70, 120) },
    }[shot];
    const yl = CONFIG.world.groundY - 90;
    const vy = -Math.sqrt(2 * g * (y0 - T.apex));
    const t = -vy / g + Math.sqrt((2 * (yl - T.apex)) / g);
    ball.reset();
    ball.x = ball.prevX = x0;
    ball.y = ball.prevY = y0;
    ball.vx = (T.x - x0) / t;
    ball.vy = vy;
    ball.active = ball.visible = true;
    gw.match.touches = [0, 0];
    gw.match.lastTouchTeam = -1;
    sfx.hit(420);
    ringBurst(x0, y0, 0xffffff, 10, 150);
  }

  /** Antrenmanda topun düşüşü: karşı sahaya düştüyse isabet, değilse kaçan. */
  function onTrainingPoint(e) {
    const ok = e.reason === 'ground' && e.x > CONFIG.world.netX;
    gw.ball.visible = false;
    dustPuff(e.x, CONFIG.world.groundY, 10);
    if (ok) {
      train.hits++;
      train.streak++;
      train.best = Math.max(train.best, train.streak);
      hud.flipScore(0, train.hits);
      ringBurst(e.x, CONFIG.world.groundY - 10, CONFIG.teams[0].color, 18, 220);
      sfx.ability('ikinciSans');
    } else {
      train.misses++;
      train.streak = 0;
      hud.flipScore(1, train.misses);
    }
    hud.setTrainStreak(train.streak, train.best);
    train.timer = 1.1;
  }

  function stopTraining() {
    train = null;
    gw.blobs[1].ghost = false;
    hud.setTrainMode(false);
  }

  /** Menülerin arkasındaki gösteri maçı: rastgele iki karakterin görünümüyle (yeteneksiz) YZ - YZ. */
  function resetDemo() {
    if (!DEMO_STATES.has(state)) state = 'menu';
    gameEl.classList.remove('inVs');
    time.reset();
    tweener.clear();
    goalFx.clearAll();
    stage.resetFx();
    hud.showReplay(false);
    hud.setVisible(false);
    touch.setVisible(false);
    setHudButtons(false);
    gw.setTeamSize(1);
    gw.hyperOn = false;
    mateAis = [];
    for (const b of gw.blobs) unequip(b);
    const pool = [...CHARACTERS].sort(() => Math.random() - 0.5);
    setTeamLook(0, pool[0]);
    setTeamLook(1, pool[1]);
    refreshLooks();
    gw.match.reset(0);
    gw.resetPositions();
    gw.serve(Math.random() < 0.5 ? 0 : 1);
    ais = [new AIController(gw.blobs[0], 'orta'), new AIController(gw.blobs[1], 'orta')];
  }

  function startMatch() {
    clearPartyRule();
    gameEl.classList.remove('inVs');
    menus.hide();
    tweener.clear();
    goalFx.clearAll();
    stage.resetFx();
    time.reset();
    hud.showReplay(false);
    if (classic) {
      // Klasik: yetenek yok, varsayılan turuncu ve mavi blob'lar
      unequip(gw.blobs[0]);
      unequip(gw.blobs[1]);
      resetTeamLooks();
    } else {
      // Karakterli: her taraf seçtiği karakterin rengini ve yeteneklerini alır
      for (let i = 0; i < 2; i++) {
        const ch = getCharacter(setup.sides[i].charId);
        equip(gw.blobs[i], ch.passive, ch.active);
        gw.blobs[i].hyper = getHyper(ch.hyper);
        setTeamLook(i, ch);
      }
    }
    // 2'ye 2: her takıma yapay zeka bir arkadaş (kendi karakteriyle, ana oyunculardan farklı)
    gw.setTeamSize(setup.size || 1);
    gw.blobs.forEach((b, i) => { b.human = i < 2 && setup.sides[i].kind === 'human'; });
    mateAis = [null, null];   // takım başına arkadaşın yapay zekası (İkiniz bir takım'da sol arkadaş insan)
    setup.mates = null;
    if (gw.teamSize === 2) {
      const used = new Set([...setup.sides.map((x) => x.charId), setup.coop?.p2.charId]);
      const pool = CHARACTERS.filter((c) => !used.has(c.id)).sort(() => Math.random() - 0.5);
      setup.mates = [setup.coop ? getCharacter(setup.coop.p2.charId) : pool[0], pool[1]];
      for (let t = 0; t < 2; t++) {
        const b = gw.blobs[2 + t], c = setup.mates[t];
        if (classic) { unequip(b); b.hyper = null; stage.blobViews[2 + t].setLook(null); }
        else { equip(b, c.passive, c.active); b.hyper = getHyper(c.hyper); stage.blobViews[2 + t].setLook(c); }
        if (setup.coop && t === 0) b.human = true;   // 2. oyuncu
        else mateAis[t] = new AIController(b, setup.sides[1].difficulty || settings.difficulty);
      }
    }
    if (classic) for (const b of gw.blobs) b.hyper = null;
    gw.resetHyper();
    // Turnuvada ekranda oyuncu adları görünür (sayı yazısı, skor tabelası, kazanan ekranı)
    if (setup.tour || setup.king || classic) setup.sides.forEach((x, i) => { CONFIG.teams[i].name = x.name; });
    refreshLooks();
    refreshNames();
    if (setup.survival) {
      // Hayatta kalma: 5 can, rakip Kolay başlar ve her 3 sayıda bir güçlenir
      Object.assign(setup.survival, { lives: SURVIVAL_LIVES, level: 0, pendingLevel: false });
      setup.sides[1].difficulty = SURVIVAL_LEVELS[0];
    }
    ais = setup.sides.map((x, i) => (x.kind === 'ai' ? new AIController(gw.blobs[i], x.difficulty) : null));
    const open = setup.survival || setup.timed;   // hedef sayı yok: can ya da süre bitince biter
    gw.match.reset(Math.random() < 0.5 ? 0 : 1, open ? { pointsToWin: 99999 } : { pointsToWin: setup.points ?? settings.points, winBy2: setup.winBy2 ?? settings.winBy2 });
    gw.hyperOn = !classic;
    timeUp = false;
    if (setup.kaos) setup.kaosFirst = true;   // ilk sayıda seçilen (rastgele) karakterler kalır
    matchStats.reset();
    gw.replay.clear();
    hud.setScores(0, 0);
    hud.setTarget(setup.points ?? settings.points, setup.winBy2 ?? settings.winBy2);
    updateModeHud();
    refreshKeyLabels();
    hud.setPillsVisible(!classic);
    hud.setVisible(true);
    touch.build(mode, classic);
    touch.setVisible(true);
    setHudButtons(true);
    startCountdown();
  }

  /** Kart adları: karakter adı; turnuvada oyuncu adı + küçük karakter adı; 2'ye 2'de "+ arkadaş" */
  function refreshNames() {
    hud.setNames(setup.sides.map((x, i) => {
      const mate = setup.mates ? `+ ${classic ? (setup.coop && i === 0 ? 'Oyuncu 2' : 'YZ') : setup.mates[i].name}` : '';
      if (classic) return mate ? [x.name, mate] : x.name;
      const cn = getCharacter(x.charId).name;
      if (setup.tour || setup.king) return [x.name, cn];
      return mate ? [cn, mate] : cn;
    }));
  }

  /** Kaos: bütün blob'lara rastgele, birbirinden farklı karakter (her sayıdan önce). */
  function applyKaos(announce) {
    const pool = [...CHARACTERS].sort(() => Math.random() - 0.5);
    gw.blobs.forEach((b, i) => {
      if (b.ghost || b.isClone) return;   // boş yuva / klon: karakter almaz
      const c = pool[i];
      const meter = b.hyperMeter;
      equip(b, c.passive, c.active);
      b.hyper = getHyper(c.hyper);
      b.hyperMeter = b.hyperArmed ? 1 : meter;   // bar korunur, Hyper değişir (bekleyen Hyper yine HAZIR olur)
      b.hyperArmed = false;
      if (i < 2) { setup.sides[i].charId = c.id; setTeamLook(i, c); } else { setup.mates[i - 2] = c; stage.blobViews[i].setLook(c); }
    });
    refreshLooks();
    refreshNames();
    refreshKeyLabels();
    if (announce) showBanner('Kaos', `${getCharacter(setup.sides[0].charId).name} – ${getCharacter(setup.sides[1].charId).name}`, 'Karakterler değişti');
  }

  /** HUD'daki yetenek tuşu etiketleri: YZ / oyun kolu (X) / mobil / klavye tuşu */
  function refreshKeyLabels() {
    if (!setup) return;
    const label = setup.sides.map((x, i) => {
      if (x.kind === 'ai') return 'YZ';
      const pad = pads.state[i].connected || (mode === '1p' && pads.any);
      if (pad) return 'X';
      return IS_MOBILE ? 'Hazır' : KEYMAP[i].label;
    });
    hud.setAbilities(gw.blobs, label);
  }

  /** Blob'lar yerine döner, 3-2-1, sonra top sayıyı alan (servis) tarafta parıltıyla doğar. */
  function startCountdown() {
    state = 'countdown';
    stateT = 0;
    if (party) pickPartyRule();
    if (setup?.kaos && !classic) { if (setup.kaosFirst) setup.kaosFirst = false; else applyKaos(true); }
    if (setup?.survival?.pendingLevel) survivalLevelUp();
    hud.showReplay(false);
    gw.resetPositions();
    gw.ball.active = false;
    gw.ball.visible = false;
    goalFx.playCountdown(() => {
      gw.serve(gw.match.serving);
      goalFx.playSpawn(gw.ball.x, gw.ball.y, CONFIG.teams[gw.match.serving].color);
      state = 'playing';
      kb.clearPressed();
      touch.clearEdges();
    });
  }

  function startReplay() {
    state = 'replay';
    replayT = 0;
    goalFx.clearWorldFx();
    stage.cam.zoom = 1;
    hud.showReplay(true, pointShot);
  }

  function endReplay() {
    replayFrames = null;
    startCountdown();
  }

  function showMatchEnd() {
    state = 'matchEnd';
    clearPartyRule();
    touch.setVisible(false);
    setHudButtons(false);
    const w = gw.match.winner;
    const score = [...gw.match.score];
    const aiSide = setup.sides[1];
    if (setup.survival) {
      // Hayatta kalma: rekor
      const pts = score[0], best = Career.data.survivalBest;
      const isNew = pts > best;
      Career.data.survivalBest = Math.max(best, pts);
      Career.data.survivalRuns++;
      Career.save();
      sfx.win();
      menus.showEnd({ winner: 0, score, stats: matchStats, mode, classic, title: 'Hayatta kalma bitti',
        subtitle: `${pts} sayı · Seviye ${setup.survival.level + 1} · ${isNew ? 'Yeni rekor!' : `Rekor: ${best}`}` });
      return;
    }
    if (mode !== 'ai' && !setup.coop) Career.recordMatch({ mode, difficulty: aiSide.difficulty || settings.difficulty, winner: w, score, stats: matchStats });
    sfx.win();
    if (setup.king) {
      const sc = setup.king.swapped ? [score[1], score[0]] : score;   // [kral, rakip]
      king.report(sc);
      menus.showTournamentResult({
        winner: setup.sides[w].name, loser: setup.sides[1 - w].name, score, names: setup.sides.map((x) => x.name),
        stats: matchStats, isOver: king.isOver, kind: 'king',
      });
      return;
    }
    if (setup.tour) {
      // Turnuva: sonucu ağaca yaz (taraflar değiştiyse skoru geri çevir)
      const { r, i, swapped } = setup.tour;
      tour.report(r, i, swapped ? [score[1], score[0]] : score);
      menus.showTournamentResult({
        winner: setup.sides[w].name, loser: setup.sides[1 - w].name, score, names: setup.sides.map((x) => x.name),
        stats: matchStats, isOver: tour.isOver,
      });
      return;
    }
    let subtitle = '';
    if (setup.watch) {
      const g = setup.watch.guess;
      subtitle = g == null ? 'Yapay zeka maçı' : g === w ? 'Tahminin tuttu!' : 'Tahminin tutmadı.';
    } else if (mode === '1p') subtitle = w === 0 ? `Yapay zekayı (${diffName(aiSide.difficulty)}) yendin.` : `Yapay zeka (${diffName(aiSide.difficulty)}) bu sefer kazandı.`;
    menus.showEnd({ winner: w, score, subtitle, stats: matchStats, mode, classic });
  }

  function pause() {
    if (!['playing', 'scored', 'replay', 'countdown'].includes(state)) return;
    prevState = state;
    state = 'paused';
    touch.setVisible(false);
    menus.showPause();
  }

  function resume() {
    if (state !== 'paused') return;
    menus.hide();
    state = prevState;
    touch.setVisible(true);
    kb.clearPressed();
  }

  // ----------------------------------------------------------------- girişler
  const unlock = () => sfx.unlock();
  window.addEventListener('pointerdown', unlock);
  kb.onKey((code, e) => handleKeyCode(code, e));
  function handleKeyCode(code, e) {
    unlock();
    const typing = e?.target instanceof HTMLInputElement && e.target.type === 'text';
    if (typing && code !== 'Escape') return;   // isim yazarken kısayollar çalışmasın
    if (code === 'Escape') {
      if (state === 'select') { sfx.ui(); menus.o.onSelectBack(); return; }
      if (state === 'vs') return;
      if (state === 'menu-tour' || state === 'champion') { sfx.ui(); goMenu(); return; }
      if (state === 'menu' && menus.active === 'controls') { sfx.ui(); menus.cancelCapture?.(); menus.showSettings(); return; }
      if (state === 'menu' && (menus.active === 'options' || menus.active === 'players')) { menus.root.querySelector('[data-act="back"]')?.click(); return; }
      if (state === 'menu' && menus.active !== 'main') { sfx.ui(); menus.showMain(); return; }
      if (state === 'paused') resume();
      else pause();
      return;
    }
    if (code === 'KeyM' && state !== 'select') { sfx.setMuted(!sfx.muted); updateSoundBtn(); if (state === 'paused') menus.repaintPause?.(); return; }
    if (state === 'replay' && code === 'Space') { endReplay(); return; }
    menus.handleKey(code);
  }

  // ----------------------------------------------------------------- oyun kolu
  // Menü gezintisi kol tuşlarını klavye kodlarına çevirerek aynı yoldan geçer.
  const toast = document.createElement('div');
  toast.id = 'toast';
  gameEl.appendChild(toast);
  let toastTimer = 0;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
  pads.onConnect = (p, on) => {
    showToast(on ? `Oyun kolu bağlandı: Oyuncu ${p + 1}` : `Oyun kolu ayrıldı: Oyuncu ${p + 1}`);
    if (state === 'playing' || state === 'countdown' || state === 'paused' || state === 'scored') refreshKeyLabels();
  };
  pads.onNav = (p, act) => {
    if (act === 'pause') {
      if (state === 'playing' || state === 'countdown' || state === 'scored') pause();
      else if (state === 'paused') resume();
      return;
    }
    if (state === 'playing' || state === 'countdown' || state === 'scored') return;   // maçta tuşlar oyunda
    if (state === 'replay') { if (act === 'ok') endReplay(); return; }
    if (menus.active === 'select') {
      // Karakter seçimi: kol 1 → W/A/S/D, kol 2 → ok tuşları
      const m = p === 0
        ? { left: 'KeyA', right: 'KeyD', ok: 'KeyW', back: 'KeyS' }
        : { left: 'ArrowLeft', right: 'ArrowRight', ok: 'ArrowUp', back: 'ArrowDown' };
      if (m[act]) handleKeyCode(m[act], null);
      return;
    }
    if (act === 'ok') {
      const el = document.activeElement;
      if (el && el !== document.body && (el.tagName === 'BUTTON' || el.tagName === 'INPUT')) { unlock(); el.click(); }
      else handleKeyCode('Enter', null);
      return;
    }
    if (act === 'back') { handleKeyCode('Escape', null); return; }
    const dir = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[act];
    if (dir) handleKeyCode(dir, null);
  };
  gameEl.addEventListener('pointerdown', (e) => {
    if (state === 'replay' && !e.target.closest('button')) endReplay();
  });
  btnSound.addEventListener('click', (e) => { e.stopPropagation(); sfx.unlock(); sfx.setMuted(!sfx.muted); updateSoundBtn(); btnSound.blur(); });
  btnPause.addEventListener('click', (e) => { e.stopPropagation(); btnPause.blur(); state === 'paused' ? resume() : pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  /** Klavye + dokunmatik + oyun kolu → oyuncu kontrolü */
  function playerControl(p) {
    const solo = mode === '1p' && p === 0;   // tek oyuncuda her iki tuş seti ve her iki kol
    const maps = solo ? [KEYMAP[0], KEYMAP[1]] : [KEYMAP[p]];
    const t = touch.state[p];
    let left = t.left, right = t.right, jump = t.jump, ability = touch.consumeAbility(p);
    for (const k of solo ? [0, 1] : [p]) {
      const g = pads.state[k];
      left ||= g.left; right ||= g.right; jump ||= g.jump;
      if (pads.consumeAbility(k)) ability = true;
    }
    for (const m of maps) {
      left ||= m.left.some((c) => kb.isDown(c));
      right ||= m.right.some((c) => kb.isDown(c));
      jump ||= m.jump.some((c) => kb.isDown(c));
      for (const c of m.ability) if (kb.consume(c)) ability = true;
    }
    return { move: (right ? 1 : 0) - (left ? 1 : 0), jump, ability };
  }

  // ----------------------------------------------------------------- efekt yardımcıları
  const P = stage.particles;
  function hitBurst(x, y, color, speed) {
    const n = P.n(CONFIG.effects.hitSparks * Math.min(1.6, speed / 600));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(80, 260);
      P.emit({ tex: textures.spark, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.18, 0.35), drag: 3,
        scale: rand(0.35, 0.6), scaleEnd: 0.1, tint: pick([0xffffff, color]), blend: 'add', align: true, stretch: 0.004 });
    }
    P.emit({ tex: textures.glow, x, y, life: 0.18, scale: 0.15, scaleEnd: 0.5, alpha: 0.8, tint: 0xffffff, blend: 'add' });
  }
  function dustPuff(x, y, n = 4) {
    for (let i = 0; i < P.n(n); i++) {
      P.emit({ tex: textures.smoke, x: x + rand(-14, 14), y: y - 2, vx: rand(-60, 60), vy: rand(-40, -10), life: rand(0.35, 0.6), drag: 2,
        scale: rand(0.3, 0.5), scaleEnd: 0.9, alpha: 0.45, tint: stage.arena.dust });
    }
  }
  function ringBurst(x, y, color, n = 14, sp = 160) {
    for (let i = 0; i < P.n(n); i++) {
      const a = (i / n) * Math.PI * 2;
      P.emit({ tex: textures.dot, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, drag: 3, scale: 0.7, scaleEnd: 0, tint: color, blend: 'add' });
    }
  }

  function onPoint(e) {
    const ball = gw.ball;
    ball.visible = false;
    if (state !== 'playing') {
      // Gösteri maçında (menü arkası) patlama yok; küçük bir toz ve yeniden servis
      dustPuff(e.x, CONFIG.world.groundY, 10);
      demoRespawn = 0.9;
      return;
    }
    rallyHits = 0;
    matchStats.onPoint();
    // Tekrar için: sayıyı getiren vuruş (yere düşen sayılarda, vuruşu yapan sayıyı alan takımsa)
    pointShot = e.reason === 'ground' && lastHit && lastHit.team === e.team
      ? { kmh: Math.round((lastHit.speed / PX_PER_M) * 3.6), kind: lastHit.hyper ? `Hyper: ${lastHit.hyper}` : lastHit.spike ? 'Smaç' : 'Vuruş' }
      : null;
    lastHit = null;
    const res = e.result;
    const T = CONFIG.teams[e.team];
    state = 'scored';
    stateT = 0;
    replayFrames = settings.replay ? gw.replay.snapshot() : null;
    let subText = `${T.name} +1`;
    if (e.reason === 'fault') subText = `${T.name} +1, rakip 3 dokunuş hakkını aştı`;
    if (setup.survival) {
      const s = setup.survival;
      if (e.team === 1) {
        s.lives--;
        subText = s.lives > 0 ? `Can kaybettin, ${s.lives} can kaldı` : 'Canın bitti';
        if (s.lives <= 0) { gw.match.winner = 1; res.isMatchWin = true; }
      } else if (res.score[0] % 3 === 0) {
        s.pendingLevel = true;
        subText = `${res.score[0]} sayı, seviye atladın!`;
      }
    }
    if (setup.timed && timeUp) {
      if (res.score[0] !== res.score[1]) {
        gw.match.winner = res.score[0] > res.score[1] ? 0 : 1;
        res.isMatchWin = true;
      } else subText = 'Eşitlik! Altın sayı: sonraki sayıyı alan kazanır';
    }
    updateModeHud();
    if (res.isMatchWin && !setup.survival) subText = `${CONFIG.teams[gw.match.winner].name} maçı kazandı!`;
    goalFx.play({
      x: e.x, y: e.y, teamColor: T.color, team: e.team,
      streak: res.streak, isMatchPoint: res.isMatchWin, subText,
      onScorePop: () => hud.flipScore(e.team, res.score[e.team]),
    });
  }

  function handleEvents(ev) {
    for (const e of ev) {
      switch (e.type) {
        case 'hit': {
          const T = CONFIG.teams[e.blob.team];
          lastHit = { team: e.blob.team, speed: gw.ball.speed, steps: 0, spike: !e.blob.grounded && gw.ball.vy > 150, hyper: null };
          sfx.hit(e.speed);
          if (state === 'playing' && setup?.sides[e.blob.team]?.kind === 'human') pads.rumble(e.blob.team, 0.2, 40);
          if (state === 'playing') {
            sfx.rally(++rallyHits);   // uzun rallide seyirci hafifçe hareketlenir
            // Smaç: havadaki blob topu aşağı doğru ve hızlı göndermişse
            matchStats.onHit(e.blob.team, !e.blob.grounded && gw.ball.vy > 150 && e.speed > 600);
          }
          hitBurst(e.x, e.y, T.color, e.speed);
          viewOf(e.blob).impulse(-3.2);
          if (e.speed > 760) stage.addTrauma(0.12);
          break;
        }
        case 'jump':
          viewOf(e.blob).impulse(4.5);
          if (state !== 'menu') sfx.jump();
          break;
        case 'land': {
          const k = Math.min(1, e.impact / 800);
          viewOf(e.blob).impulse(-5 * k);
          dustPuff(e.blob.x, CONFIG.world.groundY, 3);
          if (state !== 'menu') sfx.land();
          break;
        }
        case 'net':
          sfx.net();
          if (state === 'playing') sfx.ooh();
          ringBurst(e.x, e.y, 0xffd23f, 8, 120);
          break;
        case 'wall':
          sfx.wall();
          break;
        case 'ability': {
          const b = e.blob;
          if (state === 'playing') matchStats.onAbility(b.team);
          sfx.ability(e.id);
          const color = { gucVurusu: 0xff7a1a, havaAtilmasi: 0xffffff, miknatis: 0xb388ff, yavasZaman: 0x7fd8ff, kalkan: 0x7fe0ff, falso: 0xd28bff, isinlanma: 0x9aa0ff, roketZiplama: 0xff8ac8, agirTop: 0x8f949e, sersemlet: 0xc9a7ff, ruzgar: 0xdcf5a0, sisme: 0xe8b98f, tuyTop: 0xffffff, turbo: 0x9fd2ff, sasirt: 0x8ee0d4, kucult: 0xf5a3d8, onsezi: 0x9fb3ee, kesikTop: 0xe58ba3, deprem: 0xd4d79a, karaDelik: 0xff8f6b, ikinciSans: 0x6fe0b0, ayna: 0xa9cde0, dorukAtagi: 0xffd36b }[e.id] || 0xffffff;
          ringBurst(b.x, b.y - b.r * 0.6, color, 18, 220);
          if (e.id === 'yavasZaman') ringBurst(gw.ball.x, gw.ball.y, color, 22, 260);
          break;
        }
        case 'hyper': {
          // Hyper başladı: altın patlama, kısa ağır çekim ve blob'un üstünde adı
          const h = e.blob.hyper;
          sfx.powerHit();
          sfx.ability('dorukAtagi');
          stage.addTrauma(0.35);
          time.hitStop({ freezeMs: 60, slowScale: 0.45, slowMs: 150, recoverMs: 130 });
          ringBurst(e.blob.x, e.blob.y - e.blob.r * 1.3, 0xffd23f, 26, 300);
          for (let i = 0; i < P.n(26); i++) {
            const a = Math.random() * Math.PI * 2, sp = rand(140, 420);
            P.emit({ tex: textures.dot, x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.35, 0.7), drag: 2.5,
              scale: rand(0.8, 1.4), scaleEnd: 0, tint: pick([0xffd23f, 0xffffff, 0xffe9a3]), blend: 'add' });
          }
          if (h) hyperPop(e.blob, h);
          break;
        }
        case 'hyperHit': {
          // Bekleyen vuruş Hyper'ı topa uygulandı: tekrarda "Hyper: ad" yazar
          if (lastHit) lastHit.hyper = e.blob.hyper?.name;
          sfx.powerHit();
          stage.addTrauma(0.25);
          time.hitStop({ freezeMs: 50, slowScale: 0.5, slowMs: 120, recoverMs: 110 });
          ringBurst(e.x, e.y, 0xffd23f, 20, 240);
          break;
        }
        case 'powerHit':
          sfx.powerHit();
          stage.addTrauma(0.35);
          for (let i = 0; i < P.n(24); i++) {
            const a = Math.random() * Math.PI * 2, sp = rand(120, 420);
            P.emit({ tex: textures.dot, x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.6), drag: 2.5,
              scale: rand(0.8, 1.4), scaleEnd: 0, tint: pick([0xffd23f, 0xff7a1a, 0xff3b1a]), blend: 'add' });
          }
          break;
        case 'doubleJump':
          viewOf(e.blob).impulse(4);
          ringBurst(e.blob.x, e.blob.y, 0xffffff, 10, 120);
          sfx.jump();
          break;
        case 'teleport': {
          // Kalkış ve varış noktasında parıltı, arada kısa bir iz
          const b = e.blob, y = b.y - b.r;
          ringBurst(e.from, y, 0x9aa0ff, 16, 160);
          ringBurst(e.to, y, 0xffffff, 16, 220);
          for (let k = 1; k < 6; k++) {
            P.emit({ tex: textures.glow, x: e.from + ((e.to - e.from) * k) / 6, y, life: 0.3, scale: 0.25, scaleEnd: 0.05, alpha: 0.6, tint: 0x9aa0ff, blend: 'add' });
          }
          viewOf(b).impulse(4);
          break;
        }
        case 'rocketJump':
          viewOf(e.blob).impulse(6);
          dustPuff(e.blob.x, CONFIG.world.groundY, 12);
          ringBurst(e.blob.x, CONFIG.world.groundY - 4, 0xff8ac8, 18, 240);
          stage.addTrauma(0.15);
          break;
        case 'stun': {
          // Rakibin başında halka + küçük sıçrama
          const t = e.target;
          ringBurst(t.x, t.y - t.r * 1.9, 0xc9a7ff, 16, 160);
          viewOf(t).impulse(3);
          break;
        }
        case 'confuse':
          ringBurst(e.target.x, e.target.y - e.target.r * 1.9, 0x8ee0d4, 16, 160);
          viewOf(e.target).impulse(3);
          break;
        case 'shrink':
          ringBurst(e.target.x, e.target.y - e.target.r, 0xf5a3d8, 22, 180);
          viewOf(e.target).impulse(4);
          break;
        case 'cut':
          ringBurst(e.x, e.y, 0xffffff, 14, 240);
          for (let k = 0; k < P.n(10); k++) {
            P.emit({ tex: textures.spark, x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(150, 320), life: rand(0.2, 0.35),
              scale: rand(0.6, 1), scaleEnd: 0.1, alpha: 0.8, tint: 0xe58ba3, align: true, stretch: 0.004 });
          }
          break;
        case 'quake':
          stage.addTrauma(0.4);
          dustPuff(e.target.x, CONFIG.world.groundY, 16);
          ringBurst(e.target.x, CONFIG.world.groundY - 4, 0xd4d79a, 22, 260);
          break;
        case 'well':
          ringBurst(e.x, e.y - 20, 0xff8f6b, 22, 220);
          break;
        case 'secondChance':
          ringBurst(e.blob.x, e.blob.y - e.blob.r * 2.3, 0x6fe0b0, 14, 120);
          break;
        case 'mirror':
          ringBurst(e.x, e.y, 0xffffff, 20, 260);
          stage.addTrauma(0.1);
          break;
        case 'grow':
          viewOf(e.blob).impulse(5);
          ringBurst(e.blob.x, e.blob.y - e.blob.r, 0xe8b98f, 20, 200);
          break;
        case 'wind':
          // Ekran boyunca rüzgâr çizgileri
          for (let k = 0; k < P.n(18); k++) {
            const y = rand(60, 330);
            P.emit({ tex: textures.spark, x: e.dir > 0 ? rand(0, 300) : rand(500, 800), y, vx: e.dir * rand(500, 800), vy: rand(-20, 20), life: rand(0.35, 0.6),
              scale: rand(0.8, 1.4), scaleEnd: 0.3, alpha: 0.55, tint: 0xffffff, align: true, stretch: 0.006 });
          }
          break;
        case 'clone': {
          // Cura'nın klonu: sahibinin görünümünde, yeteneksiz, yapay zekayla oynar
          const slot = gw.blobs.indexOf(e.blob), t = e.blob.team;
          unequip(e.blob); e.blob.hyper = null; e.blob.human = false;
          stage.blobViews[slot].setLook(setup?.sides?.[t]?.charId ? getCharacter(setup.sides[t].charId) : null);
          mateAis[t] = new AIController(e.blob, 'usta');
          ringBurst(e.blob.x, e.blob.y - e.blob.r, 0xffe9a8, 22, 260);
          dustPuff(e.blob.x, CONFIG.world.groundY, 10);
          sfx.powerHit();
          break;
        }
        case 'cloneEnd':
          if (gw.size !== 2) mateAis[e.blob.team] = null;
          for (let k = 0; k < P.n(10); k++) {
            P.emit({ tex: textures.smoke, x: e.x, y: e.y, vx: rand(-70, 70), vy: rand(-80, 10), life: rand(0.3, 0.55), drag: 3, scale: rand(0.25, 0.4), scaleEnd: 0.7, alpha: 0.5, tint: 0xffe9a8 });
          }
          break;
        case 'hot':
          ringBurst(e.x, e.y, 0xff5a1f, 20, 240);
          break;
        case 'hotTouch':
          ringBurst(e.x, e.y, 0xff3b1a, 18, 200);
          stage.addTrauma(0.15);
          break;
        case 'root':
          dustPuff(e.target.x, CONFIG.world.groundY, 12);
          ringBurst(e.target.x, CONFIG.world.groundY - 6, 0x7fbf4a, 16, 160);
          viewOf(e.target).impulse(3);
          break;
        case 'short':
          ringBurst(e.target.x, e.target.y - e.target.r * 1.6, 0xfff23d, 18, 200);
          viewOf(e.target).impulse(4);
          break;
        case 'cleanse':
          ringBurst(e.x, e.y, 0xd9f7e5, 22, 260);
          ringBurst(e.blob.x, e.blob.y - e.blob.r * 1.3, 0xffe9a8, 18, 200);
          break;
        case 'note':
          ringBurst(e.blob.x, e.blob.y - e.blob.r * 1.6, 0xffc0cf, 20, 320);
          ringBurst(e.x, e.y, 0xff4f79, 16, 200);
          viewOf(e.blob).impulse(5);
          stage.addTrauma(0.12);
          break;
        case 'catch':
          // Yakala: top blob'un tepesinde tutulur
          ringBurst(e.x, e.y, 0xf0dab0, 16, 160);
          viewOf(e.blob).impulse(4);
          sfx.hit(320);
          break;
        case 'throw':
          ringBurst(e.x, e.y, 0xc9a66b, 18, 260);
          stage.addTrauma(0.12);
          sfx.powerHit();
          break;
        case 'decoy':
          ringBurst(e.x, e.y, 0xcfc9ff, 16, 200);
          break;
        case 'decoyPop':
          // Sahte top kaybolur: küçük bir duman
          for (let k = 0; k < P.n(8); k++) {
            P.emit({ tex: textures.smoke, x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 20), life: rand(0.3, 0.5), drag: 3,
              scale: rand(0.2, 0.35), scaleEnd: 0.6, alpha: 0.5, tint: 0xcfc9ff });
          }
          break;
        case 'breath': {
          // Ejder Nefesi: ağızdan topa doğru alev
          const dx = e.x - e.fx, dy = e.y - e.fy, d = Math.hypot(dx, dy) || 1;
          for (let k = 0; k < P.n(26); k++) {
            const t = Math.random(), sp = rand(200, 420);
            P.emit({ tex: textures.dot, x: e.fx + dx * t * 0.8, y: e.fy + dy * t * 0.8, vx: (dx / d) * sp + rand(-60, 60), vy: (dy / d) * sp + rand(-60, 60),
              life: rand(0.25, 0.5), drag: 2.5, scale: rand(0.9, 1.6), scaleEnd: 0, tint: pick([0xffd23f, 0xff7a1a, 0xff3b1a, 0x7fd9a8]), blend: 'add' });
          }
          ringBurst(e.x, e.y, 0xff7a1a, 18, 220);
          sfx.powerHit();
          stage.addTrauma(0.2);
          break;
        }
        case 'poison':
          ringBurst(e.target.x, e.target.y - e.target.r * 1.9, 0x9be36b, 16, 160);
          viewOf(e.target).impulse(3);
          break;
        case 'knock':
          // Fırtına Darbesi: rüzgâr çizgileri + savrulan rakibin ayağında toz
          for (let k = 0; k < P.n(14); k++) {
            const y = rand(200, 400);
            P.emit({ tex: textures.spark, x: e.dir > 0 ? rand(300, 420) : rand(380, 500), y, vx: e.dir * rand(600, 900), vy: rand(-20, 20), life: rand(0.3, 0.5),
              scale: rand(0.8, 1.4), scaleEnd: 0.3, alpha: 0.6, tint: 0xb3c1f5, align: true, stretch: 0.006 });
          }
          for (const t of e.targets) { dustPuff(t.x, CONFIG.world.groundY, 10); viewOf(t).impulse(5); }
          stage.addTrauma(0.2);
          break;
        case 'shieldBlock':
          sfx.shieldBlock();
          stage.addTrauma(0.25);
          ringBurst(e.x, e.y - 10, 0x7fe0ff, 26, 300);
          break;
        case 'spinHit':
          sfx.spinHit();
          ringBurst(e.x, e.y, 0xd28bff, 16, 200);
          break;
        case 'softTouch':
          sfx.softTouch();
          ringBurst(e.x, e.y, 0xe8fff6, 10, 90);
          break;
        case 'point':
          onPoint(e);
          break;
      }
    }
  }

  /** Her fizik adımında sürekli parçacıklar (alevli iz, dash rüzgârı, mıknatıs). */
  function continuousFx() {
    const ball = gw.ball;
    if (ball.visible && ball.spinTimer > 0 && Math.random() < 0.7) {
      const a = Math.random() * Math.PI * 2, r = ball.r + 4;
      P.emit({ tex: textures.dot, x: ball.x + Math.cos(a) * r, y: ball.y + Math.sin(a) * r, vx: -Math.sin(a) * 120 * Math.sign(ball.spin), vy: Math.cos(a) * 120 * Math.sign(ball.spin),
        life: 0.35, scale: 0.5, scaleEnd: 0, tint: 0xd28bff, blend: 'add' });
    }
    if (ball.visible && ball.wellTimer > 0) {
      // Kara Delik: çekim noktasına doğru akan parçacıklar
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(50, 90);
        P.emit({ tex: textures.dot, x: ball.wellX + Math.cos(a) * r, y: ball.wellY - 20 + Math.sin(a) * r * 0.5, vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 1.1,
          life: 0.45, scale: 0.5, scaleEnd: 0.05, alpha: 0, alphaEnd: 0.9, tint: 0xff8f6b, blend: 'add' });
      }
    }
    if (ball.visible && ball.floatTimer > 0 && Math.random() < 0.4) {
      // Tüy Top: topun etrafından yavaşça süzülen açık renkli tüycükler
      P.emit({ tex: textures.dot, x: ball.x + rand(-ball.r, ball.r), y: ball.y + rand(-ball.r, ball.r), vx: rand(-25, 25), vy: rand(-40, -10),
        life: rand(0.5, 0.9), scale: rand(0.4, 0.7), scaleEnd: 0, alpha: 0.8, tint: 0xffffff, blend: 'add' });
    }
    if (ball.visible && ball.windTimer > 0 && Math.random() < 0.6) {
      P.emit({ tex: textures.spark, x: ball.x - ball.windDir * ball.r, y: ball.y + rand(-ball.r, ball.r), vx: ball.windDir * 380, vy: 0, life: 0.3,
        scale: rand(0.6, 1), scaleEnd: 0.2, alpha: 0.6, tint: 0xeaffc0, align: true, stretch: 0.005 });
    }
    if (ball.visible && ball.fireTimer > 0) {
      for (let i = 0; i < 2; i++) {
        P.emit({ tex: textures.glow, x: ball.x + rand(-6, 6), y: ball.y + rand(-6, 6), vx: rand(-30, 30) - ball.vx * 0.1, vy: rand(-80, -20) - ball.vy * 0.1,
          life: rand(0.25, 0.45), scale: rand(0.22, 0.32), scaleEnd: 0.04, alpha: 0.9, tint: pick([0xffd23f, 0xff7a1a, 0xff3b1a]), blend: 'add' });
      }
    }
    for (const b of gw.blobs) {
      if (b.dashTimer > 0) {
        P.emit({ tex: textures.spark, x: b.x - Math.sign(b.dashVx) * b.r, y: b.y - rand(5, b.r), vx: -b.dashVx * 0.3, vy: 0, life: 0.25,
          scale: rand(0.8, 1.3), scaleEnd: 0.2, alpha: 0.7, tint: 0xffffff, align: true, stretch: 0.004 });
      }
      if (b.fx.power > 0 && Math.random() < 0.5) {
        P.emit({ tex: textures.dot, x: b.x + rand(-b.r, b.r) * 0.8, y: b.y - rand(0, b.r), vx: rand(-15, 15), vy: rand(-90, -40), life: rand(0.3, 0.6),
          scale: rand(0.4, 0.8), scaleEnd: 0, tint: pick([0xffd23f, 0xff7a1a]), blend: 'add' });
      }
      if (b.turboTimer > 0 && Math.abs(b.x - b.prevX) > 0.5 && Math.random() < 0.7) {
        // Turbo: arkada hız çizgileri
        const dir = Math.sign(b.x - b.prevX);
        P.emit({ tex: textures.spark, x: b.x - dir * b.r, y: b.y - rand(6, b.r * 1.6), vx: -dir * 260, vy: 0, life: 0.22,
          scale: rand(0.7, 1.1), scaleEnd: 0.2, alpha: 0.6, tint: 0xdcefff, align: true, stretch: 0.004 });
      }
      if (b.confuseTimer > 0 && Math.random() < 0.5) {
        const a = performance.now() * -0.011 + Math.random() * 0.5, cy = b.y - b.r * 2.25;
        P.emit({ tex: textures.dot, x: b.x + Math.cos(a) * b.r * 0.6, y: cy + Math.sin(a) * 5, vx: 0, vy: -10, life: 0.3,
          scale: 0.5, scaleEnd: 0, tint: 0x8ee0d4, blend: 'add' });
      }
      if (b.stunTimer > 0 && Math.random() < 0.5) {
        // Sersemlet: başın üstünde dönen küçük parıltılar
        const a = performance.now() * 0.009 + Math.random() * 0.5, cy = b.y - b.r * 2.25;
        P.emit({ tex: textures.dot, x: b.x + Math.cos(a) * b.r * 0.6, y: cy + Math.sin(a) * 5, vx: 0, vy: -10, life: 0.3,
          scale: 0.5, scaleEnd: 0, tint: 0xc9a7ff, blend: 'add' });
      }
      if (b.fx.magnet > 0 && Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2, r = CONFIG.abilities.miknatis.radius * rand(0.6, 1);
        const cx = b.x, cy = b.y - b.r * 1.6;
        P.emit({ tex: textures.dot, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 1.8, vy: -Math.sin(a) * r * 1.8,
          life: 0.5, scale: 0.5, scaleEnd: 0.1, alpha: 0, alphaEnd: 0.9, tint: 0xb388ff, blend: 'add' });
      }
    }
  }

  // ----------------------------------------------------------------- SABİT ADIM
  const NONE = { move: 0, jump: false, ability: false };
  // Arkada gösteri maçının oynadığı ekranlar
  const DEMO_STATES = new Set(['menu', 'menu-tour', 'select', 'vs', 'champion']);
  function fixedUpdate(dt) {
    let controls = [NONE, NONE];
    if (DEMO_STATES.has(state)) {
      controls = [ais[0].update(dt, gw), ais[1].update(dt, gw)];
      if (!gw.ball.active && demoRespawn > 0) {
        demoRespawn -= dt;
        if (demoRespawn <= 0) gw.serve(Math.random() < 0.5 ? 0 : 1);
      }
    } else if (state === 'playing' && train) {
      controls = [playerControl(0), NONE];
      matchStats.seconds += dt;
      if (settings.trainNoCd && gw.blobs[0].cooldown > 0.25) gw.blobs[0].cooldown = 0.25;
      if (!gw.ball.active) {
        train.timer -= dt;
        if (train.timer <= 0) launchTrainingBall();
      }
      const ev = gw.step(dt, controls, { input: true, cooldowns: true, scoring: false, touches: true });
      for (const e of ev) if (e.type === 'point') onTrainingPoint(e);
      handleEvents(ev.filter((e) => e.type !== 'point'));
      continuousFx();
      return;
    } else if (state === 'playing') {
      controls = [ais[0] ? ais[0].update(dt, gw) : playerControl(0), ais[1] ? ais[1].update(dt, gw) : playerControl(1)];
      if (gw.blobs.length > 2) for (let t = 0; t < 2; t++) controls.push(gw.blobs[2 + t].ghost ? null : mateAis[t] ? mateAis[t].update(dt, gw) : playerControl(1));
      matchStats.seconds += dt;
      if (setup.timed && !timeUp && matchStats.seconds >= setup.timed) {
        timeUp = true;
        updateModeHud();
        showToast(gw.match.score[0] === gw.match.score[1] ? 'Süre doldu: altın sayı!' : 'Süre doldu: bu ralli son sayı');
      }
    }
    const inMatch = state === 'playing' || state === 'scored' || state === 'replay' || state === 'countdown';
    const isDemo = DEMO_STATES.has(state);
    const ev = gw.step(dt, controls, {
      input: state === 'playing' || isDemo,
      cooldowns: inMatch && state !== 'replay',   // sayı tekrarı oynarken yetenek süreleri durur
      scoring: state === 'playing', // gösteri maçı skoru etkilemez
    });
    handleEvents(ev);
    // Vuruştan sonraki ~0,25 sn içindeki en yüksek top hızı = vuruş hızı (yetenek ve süper etkileri dahil)
    if (lastHit && lastHit.steps < 15) { lastHit.steps++; lastHit.speed = Math.max(lastHit.speed, gw.ball.speed); }
    continuousFx();
  }

  // ----------------------------------------------------------------- tekrar karesi
  function sampleReplay() {
    const frames = replayFrames;
    const f = Math.min(frames.length - 1.001, replayT / STEP);
    const i = Math.floor(f), k = f - i;
    const a = frames[i], b = frames[i + 1];
    for (let j = 0; j < gw.blobs.length; j++) {
      const o = replayFrame.blobs[j], A = a.blobs[j], B = b.blobs[j];
      o.x = A.x + (B.x - A.x) * k; o.y = A.y + (B.y - A.y) * k; o.r = A.r;
      o.power = A.power; o.magnet = A.magnet;
    }
    const o = replayFrame.ball;
    o.x = a.ball.x + (b.ball.x - a.ball.x) * k;
    o.y = a.ball.y + (b.ball.y - a.ball.y) * k;
    o.rot = a.ball.rot + (b.ball.rot - a.ball.rot) * k;
    o.visible = a.ball.visible; o.fire = a.ball.fire; o.slow = a.ball.slow;
    return replayFrame;
  }

  // ----------------------------------------------------------------- durum zamanlayıcıları
  function updateState(realDt) {
    stateT += realDt;
    const ms = stateT * 1000;
    if (state === 'scored') {
      if (gw.match.isOver) {
        if (ms >= CONFIG.goalFx.matchEndDelayMs) showMatchEnd();
      } else if (replayFrames && replayFrames.length > 20) {
        if (ms >= CONFIG.replay.startDelayMs) startReplay();
      } else if (ms >= CONFIG.goalFx.countdownDelayMs) {
        startCountdown();
      }
    } else if (state === 'replay') {
      replayT += realDt * CONFIG.replay.speed;
      if (replayT / STEP >= replayFrames.length - 1) endReplay();
    } else if (state === 'matchEnd') {
      const w = gw.match.winner;
      if (w >= 0) goalFx.fireworks(realDt, [CONFIG.teams[w].color, CONFIG.teams[w].light, 0xffd23f, 0xffffff, 0xff4d8d]);
    } else if (state === 'champion') {
      goalFx.fireworks(realDt, [0xffd23f, 0xffffff, 0xff8a1f, 0x46d3df, 0xff6fb5]);
    }
  }

  // ----------------------------------------------------------------- ANA DÖNGÜ
  //
  //  FIXED TIMESTEP (accumulator pattern):
  //   1) Geçen gerçek süre (realDt) ölçülür, timeScale ile çarpılıp "acc" (accumulator) kovasına eklenir.
  //      → Hit-stop'ta scale = 0 (kova dolmaz, oyun donar), slow-motion'da 0.25 (kova yavaş dolar).
  //   2) Kovada 1/60 sn biriktikçe bir fizik adımı atılır ve 1/60 düşülür. Fizik HER ZAMAN 1/60 ile çalışır.
  //   3) Bir karede en fazla 5 adım atılır. Sekme arka plandan dönünce dev bir realDt gelirse
  //      oyun yüzlerce adımla "yetişmeye" çalışıp kilitlenmesin diye fazlası çöpe atılır.
  //   4) Kovada kalan (< 1 adım) süre alpha = acc / STEP olarak render'a verilir; çizim
  //      önceki ve şimdiki fizik durumu arasında enterpole edilir → her yenileme hızında akıcı.
  //
  app.ticker.add((ticker) => {
    watchPerf(ticker.deltaMS);
    if (settings.showFps) {
      fps.n++; fps.t += ticker.deltaMS;
      if (fps.t >= 500) { fpsEl.textContent = `${Math.round((fps.n * 1000) / fps.t)} FPS`; fps.n = 0; fps.t = 0; }
    }
    const realDt = Math.min(ticker.deltaMS / 1000, 0.25);
    pads.poll(realDt);
    if (state === 'paused') return;

    time.update(realDt);
    tweener.update(realDt);
    updateState(realDt);

    acc += realDt * time.scale;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      fixedUpdate(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps >= MAX_STEPS && acc >= STEP) acc = 0;   // birikmiş fazlalığı at
    const alpha = acc / STEP;

    const simDt = realDt * time.scale;
    stage.particles.update(simDt);
    stage.uiParticles.update(realDt);
    goalFx.update(realDt, simDt);
    stage.update(realDt, simDt);
    stage.renderWorld(gw, alpha, realDt, state === 'replay' && replayFrames ? sampleReplay() : null);
    hud.setTime(setup?.timed ? Math.max(0, setup.timed - matchStats.seconds) : matchStats.seconds, !!setup?.timed && !train);
    hud.update(realDt, gw, state === 'playing');

    if (state !== 'playing') { kb.clearPressed(); touch.clearEdges(); pads.clearEdges(); }
  });

  document.getElementById('loading')?.remove();
  // Konsoldan hata ayıklama için küçük bir tutamaç (ör. __blob.gw.match.score)
  window.__blob = { get tour() { return tour; }, mods: MODS, get stats() { return matchStats; }, get setup() { return setup; }, hw: HW, gw, get state() { return state; }, get quality() { return qualityName; }, settings, time, sfx };
  goMenu();
  // Dil değiştirildiyse sayfa yenilendi: ayarlara geri dön
  try {
    if (sessionStorage.getItem('hv_reopen') === 'settings') { sessionStorage.removeItem('hv_reopen'); menus.showSettings(); }
  } catch { /* yok say */ }
}

// PWA: çevrimdışı açılış ve "Ana ekrana ekle" için service worker (sadece https'te)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.textContent = `${t('Oyun başlatılamadı:')} ${e?.message || e}`;
});
