// =============================================================================
//  menus.js — DOM menüler: ana menü, karakter seçimi (dövüş oyunu tarzı) ve VS ekranı,
//  turnuva (kurulum, ağaç, sonuç, şampiyon), istatistikler, ayarlar, duraklatma, maç sonu.
//  Klavye, fare ve dokunmatik ile kullanılabilir. Oyun alanıyla birlikte ölçeklenir.
// =============================================================================
import { CONFIG } from '../config.js';
import { getAbility } from '../game/abilities.js';
import { CHARACTERS, getCharacter } from '../game/characters.js';
import { getHyper } from '../game/hyper.js';
import { BYE } from '../game/tournament.js';
import { icon } from './icons.js';
import { L } from '../i18n.js';
import { KEYMAP, DEFAULT_KEYS, keyLabel } from '../input/keyboard.js';

const DIFFS = [['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor'], ['usta', 'Usta']];
const NAV_PREV = new Set(['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA']);
const NAV_NEXT = new Set(['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD']);
const ENTRANT_TYPES = [['human', 'İnsan'], ['kolay', 'YZ Kolay'], ['orta', 'YZ Orta'], ['zor', 'YZ Zor'], ['usta', 'YZ Usta']];
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const hx = (n) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Blob çizimi (oyundaki gövde + baş şekliyle aynı oranlar).
 * @param crop 'full' tüm gövde | 'portrait' baş ve omuzlar (seçim ızgarası)
 */
function blobSvg(c, crop = 'full', cls = 'bl') {
  const B = CONFIG.blob;
  const r = 20, cx = 30, base = 56;
  const body = base - B.bodyY * r, head = base - B.headY * r;
  const shape = (k, o, fill) => `
    <circle cx="${cx - o}" cy="${body - o}" r="${B.bodyR * r * k}" fill="${fill}"/>
    <circle cx="${cx - o}" cy="${head - o}" r="${B.headR * r * k}" fill="${fill}"/>
    <rect x="${cx - o - B.headR * r * k * 0.92}" y="${head - o}" width="${B.headR * r * k * 1.84}" height="${body - head}" fill="${fill}"/>`;
  const vb = crop === 'portrait' ? '9 5 42 42' : '0 0 60 60';
  return `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">
    ${crop === 'full' ? `<ellipse cx="${cx}" cy="${base + 1}" rx="18" ry="3" fill="rgba(0,0,0,.3)"/>` : ''}
    ${shape(1, 0, hx(c.dark))}${shape(0.9, 1, c.css)}
    <ellipse cx="${cx - 7}" cy="${body - 6}" rx="3.4" ry="6" fill="#fff" opacity=".28"/>
    <ellipse cx="${cx - 5}" cy="${head - 6}" rx="4" ry="2.4" fill="#fff" opacity=".8"/>
    <ellipse cx="${cx - 4}" cy="${head}" rx="1.5" ry="2.8" fill="#0d0f14"/>
    <ellipse cx="${cx + 4}" cy="${head}" rx="1.5" ry="2.8" fill="#0d0f14"/>
  </svg>`;
}

/** Logo işareti: dikişli voleybol topu. */
const LOGO = `<svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
  <circle cx="20" cy="20" r="17" fill="#f6f6f2"/>
  <path d="M20 3a17 17 0 0 1 9 31M6 12a17 17 0 0 1 29 2M8 31a17 17 0 0 1 2-25" fill="none" stroke="#9aa1aa" stroke-width="2"/>
  <ellipse cx="13" cy="12" rx="5" ry="3" fill="#fff"/>
  <circle cx="20" cy="20" r="17" fill="none" stroke="#5f6670" stroke-width="1.5"/>
</svg>`;

export class Menus {
  constructor(root, opts) {
    this.root = root;
    this.o = opts;
    this.screen = null;
    this.sel = null;
    this.vsTimer = null;
    root.addEventListener('pointerdown', () => this.o.sfx?.unlock());
  }

  get active() {
    return this.screen;
  }

  hide() {
    clearTimeout(this.vsTimer);
    this.screen = null;
    this.root.innerHTML = '';
    this.root.className = '';
    document.activeElement?.blur?.();
  }

  mount(name, html) {
    clearTimeout(this.vsTimer);
    this.screen = name;
    this.root.className = `show screen-${name}`;
    this.root.innerHTML = html;
  }

  focusFirst() {
    const el = this.root.querySelector('[data-nav]');
    el?.focus({ preventScroll: true });
  }

  /** data-act düğmelerini bağla: { act: fn } */
  bind(map) {
    for (const [act, fn] of Object.entries(map)) {
      this.root.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.addEventListener('click', () => {
        this.o.sfx.unlock();
        this.o.sfx.ui();
        fn(b);
      }));
    }
  }

  // ===================================================================== ANA MENÜ
  // Akış: 1) oyun modu → 2) kaç kişilik → 3) ayarlar (kural, rakip, hedef… ve saha) →
  // 4) karakter seçimi → VS → maç. Tek seçenekli adım (ör. Hayatta kalma: 1 kişi) atlanır.
  // Seçimler ayarlara kaydedilir; bir sonraki açılışta aynı seçenekler hazır gelir.
  // this.flow = { pick: menüde seçilen mod, players: '1'|'2'|'multi'|'train'|'watch',
  //               mode: 'match'|'coop'|'timed'|'survival'|'tournament'|'king'|'train'|'watch', count }

  /** Ekran üstündeki adım göstergesi ve sağ üstteki istatistik/ayar düğmeleri */
  homeChrome(step) {
    const steps = ['Mod', 'Oyuncu', 'Ayarlar', 'Karakter'];
    return `
      <div class="scrim"></div>
      <div class="brand">${LOGO}<span>HyperVolley</span><small class="by">By LegendKaymak</small></div>
      ${step ? `<div class="steps">${steps.map((n, i) => `<span class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}">${i + 1}. ${n}</span>`).join('<i></i>')}</div>` : ''}
      <div class="homeIcons">
        <button data-nav data-act="stats" class="iconBtn" title="İstatistikler" aria-label="İstatistikler">${icon('stats', 20)}</button>
        <button data-nav data-act="settings" class="iconBtn" title="Ayarlar" aria-label="Ayarlar">${icon('settings', 20)}</button>
      </div>`;
  }

  bindChrome() {
    this.bind({ stats: () => this.showStats(), settings: () => this.showSettings() });
  }

  /** Seçilen moda göre "kaç kişilik" seçenekleri: [players, mode, başlık, açıklama] ya da kişi sayıları */
  playerChoices(pick) {
    return {
      match: [['1', 'match', '1 Oyuncu', 'Yapay zekaya karşı'], ['2', 'match', '2 Oyuncu', 'Karşılıklı, aynı cihazda'],
        ['2', 'coop', '2 Oyuncu · Aynı takım', 'Siz ikiniz, yapay zeka ikilisine karşı']],
      timed: [['1', 'timed', '1 Oyuncu', 'Yapay zekaya karşı'], ['2', 'timed', '2 Oyuncu', 'Karşılıklı, aynı cihazda']],
      hyper: [['1', 'hyper', '1 Oyuncu', 'Yapay zekaya karşı'], ['2', 'hyper', '2 Oyuncu', 'Karşılıklı, aynı cihazda']],
      survival: [['1', 'survival']],
      train: [['train', 'train']],
      watch: [['watch', 'watch']],
    }[pick] || null;   // turnuva / kral sahası: kişi sayısı seçilir
  }

  /** 1. adım: oyun modu */
  showMain() {
    const c = this.o.career.data;
    const tour = this.o.tourStatus?.();
    const MODES = [
      ['match', 'Maç', 'Yapay zekaya ya da arkadaşına karşı'],
      ['hyper', 'HyperMatch', '15+2 sayı, iki taraf 5 karakter yasaklar'],
      ['survival', 'Hayatta kalma', `5 can, rakip giderek güçlenir · rekor ${c.survivalBest || 0}`],
      ['timed', 'Zamana karşı', 'Süre bitince önde olan kazanır'],
      ['tournament', 'Turnuva', tour || '2–8 kişi, eleme usulü'],
      ['king', 'Kral sahası', '3–8 kişi, kazanan sahada kalır'],
      ['train', 'Antrenman', 'Top makinesi, karakterleri dene'],
      ['watch', 'İzle', 'İki yapay zekayı izle, tahmin et'],
    ];
    this.mount('main', `
      <div class="home">
        ${this.homeChrome(1)}
        <nav class="menu">
          ${MODES.map(([id, n, sub]) => `<button data-nav data-pick="${id}" class="mItem"><b>${n}</b><small>${sub}</small></button>`).join('')}
        </nav>
        <div class="homeFoot">${c.matches ? `${c.matches} maç oynandı` : 'Hoş geldin'}${c.survivalBest ? ` · Hayatta kalma rekoru ${c.survivalBest}` : ''}</div>
      </div>`);
    this.root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      this.o.sfx.unlock(); this.o.sfx.ui();
      const pick = b.dataset.pick;
      // Devam eden turnuva varsa doğrudan eşleşme ağacına dön
      if (pick === 'tournament' && tour) { this.flow = { pick, players: 'multi', mode: 'tournament' }; this.o.onLaunch({ ...this.flow }); return; }
      const prev = this.flow?.pick === pick ? this.flow : null;
      this.flow = { pick, players: prev?.players, mode: prev?.mode, count: prev?.count };
      const ch = this.playerChoices(pick);
      if (ch && ch.length === 1) { [this.flow.players, this.flow.mode] = ch[0]; this.showOptionsStep(); }
      else this.showPlayersStep();
    }));
    this.bindChrome();
    const back = this.flow?.pick && this.root.querySelector(`[data-pick="${this.flow.pick}"]`);
    if (back) back.focus({ preventScroll: true });
    else if (!document.activeElement || document.activeElement === document.body) this.focusFirst();
  }

  /** 2. adım: kaç kişilik */
  showPlayersStep() {
    const f = this.flow;
    const title = { match: 'Maç', hyper: 'HyperMatch', timed: 'Zamana karşı', tournament: 'Turnuva', king: 'Kral sahası' }[f.pick];
    const ch = this.playerChoices(f.pick);
    let body;
    if (ch) {
      body = `<nav class="menu modeMenu">${ch.map(([pl, m, n, sub], i) => `
        <button data-nav data-ch="${i}" class="mItem ${f.players === pl && f.mode === m ? 'sel' : ''}"><b>${n}</b><small>${sub}</small></button>`).join('')}</nav>`;
    } else {
      const min = f.pick === 'king' ? 3 : 2;
      const saved = this.o.loadEntrants?.()?.length;
      const cur = f.count || Math.max(min, Math.min(8, saved || 4));
      body = `<div class="countWrap"><div class="countQ">Kaç kişi oynayacak?</div>
        <div class="countPick">${[2, 3, 4, 5, 6, 7, 8].filter((n) => n >= min).map((n) => `<button data-nav data-count="${n}" class="${n === cur ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="countSub">İsimleri ayarlardan sonra yazacaksınız; istediğiniz yere yapay zeka koyabilirsiniz.</div></div>`;
    }
    this.mount('players', `
      <div class="home">
        ${this.homeChrome(2)}
        <div class="stepTitle">${title}</div>
        ${body}
        <div class="stepNav">
          <button data-nav data-act="back" class="btn text">Geri</button>
        </div>
      </div>`);
    const go = () => { this.o.sfx.ui(); this.showOptionsStep(); };
    this.root.querySelectorAll('[data-ch]').forEach((b) => b.addEventListener('click', () => {
      [f.players, f.mode] = ch[+b.dataset.ch];
      go();
    }));
    this.root.querySelectorAll('[data-count]').forEach((b) => b.addEventListener('click', () => {
      f.players = 'multi'; f.mode = f.pick; f.count = +b.dataset.count;
      go();
    }));
    this.bind({ back: () => this.showMain() });
    this.bindChrome();
    const sel = this.root.querySelector('.mItem.sel, .countPick .on') || this.root.querySelector('[data-ch], [data-count]');
    sel?.focus({ preventScroll: true });
  }

  /** 3. adım: ayarlar (moda göre kural, takım, rakip, süre, hedef, taç) ve saha */
  showOptionsStep() {
    const s = this.o.settings;
    const f = this.flow;
    const title = {
      match: f.mode === 'coop' ? 'Maç · Aynı takım' : f.players === '2' ? 'Maç · 2 Oyuncu' : 'Maç · 1 Oyuncu',
      timed: f.players === '2' ? 'Zamana karşı · 2 Oyuncu' : 'Zamana karşı · 1 Oyuncu',
      hyper: f.players === '2' ? 'HyperMatch · 2 Oyuncu' : 'HyperMatch · 1 Oyuncu',
      survival: 'Hayatta kalma', tournament: 'Turnuva', king: 'Kral sahası', train: 'Antrenman', watch: 'İzle',
    }[f.pick];
    const segRow = (label, key, opts, cur) => `
      <div class="opt"><span class="ol">${label}</span>
        <div class="seg">${opts.map(([v, n, t]) => `<button data-nav data-o="${key}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" ${t ? `title="${t}"` : ''}>${n}</button>`).join('')}</div>
      </div>`;
    const m = f.mode;
    const rows = [];
    if (m !== 'train' && m !== 'hyper') {
      const limitedRules = m === 'tournament' || m === 'king';
      const RULES = [['char', 'Karakterli', 'Her karakterin pasif, aktif yeteneği ve Hyper\'ı var'], ['classic', 'Klasik', 'Yetenek yok, saf Blobby voleybolu'],
        ...(limitedRules ? [] : [['party', 'Parti', 'Her sayıda rastgele bir kural'], ['kaos', 'Kaos', 'Her sayıda karakterler rastgele değişir']])];
      if (limitedRules && !['char', 'classic'].includes(s.rule)) s.rule = 'char';
      rows.push(segRow('Kural', 'rule', RULES, s.rule || 'char'));
    }
    if (m === 'hyper') rows.push('<div class="optNote hm">Karakterli · 15 sayı + 2 fark · İki taraf da 5 karakter yasaklar</div>');
    if (m === 'match' || m === 'timed' || m === 'hyper') rows.push(segRow('Takım', 'teamSize', [[1, '1\'e 1'], [2, '2\'ye 2', 'Her takıma yapay zeka bir arkadaş']], s.teamSize || 1));
    if ((f.players === '1' && m !== 'survival') || m === 'coop' || m === 'watch') {
      rows.push(segRow(m === 'watch' ? 'Zorluk' : 'Rakip', 'difficulty', [['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor'], ['usta', 'Usta']], s.difficulty));
    }
    if (m === 'timed') rows.push(segRow('Süre', 'minutes', [[1, '1 dk'], [2, '2 dk'], [3, '3 dk']], s.minutes || 2));
    if (m === 'match' || m === 'coop' || m === 'tournament' || m === 'king' || m === 'watch') {
      if (m === 'king' && ![3, 5, 7].includes(s.points)) s.points = 5;
      if (m !== 'king' && ![5, 10, 15].includes(s.points)) s.points = 10;
      rows.push(`<div class="opt"><span class="ol">Hedef</span>
        <div class="seg">${(m === 'king' ? [3, 5, 7] : [5, 10, 15]).map((n) => `<button data-nav data-o="points" data-v="${n}" class="${s.points === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <button data-nav data-win2 class="tog ${s.winBy2 ? 'on' : ''}" aria-pressed="${s.winBy2}" title="Kazanmak için 2 sayı fark gerekir">${icon('check', 14)}2 fark</button>
      </div>`);
    }
    // Normal maçlarda karakter yasaklama (her oyuncu kaç karakter yasaklar)
    if (m === 'match' || m === 'coop' || m === 'timed') {
      rows.push(segRow('Yasaklar', 'bans', [[0, 'Kapalı'], [1, '1'], [3, '3'], [5, '5']], s.bans || 0));
    }
    if (m === 'king') rows.push(segRow('Taç', 'kingCrowns', [[2, '2'], [3, '3'], [5, '5']], s.kingCrowns || 3));
    if (!rows.length) rows.push('<div class="optNote">Atış türü ve bekleme süresi maç içinde, duraklatma menüsünden ayarlanır.</div>');
    const nextLabel = () => (f.players === 'multi' ? 'Oyuncuları gir' : m === 'hyper' ? 'Karakter seç'
      : (s.rule === 'classic' || s.rule === 'kaos') && f.players !== 'train' ? 'Başla' : 'Karakter seç');
    this.mount('options', `
      <div class="home">
        ${this.homeChrome(3)}
        <div class="stepTitle">${title}</div>
        <div class="optCols">
          <div class="optsCol">${rows.join('')}</div>
          <div class="arenaCol">
            <div class="ol">Saha</div>
            <div class="arenaPick">
              ${CONFIG.arenas.map((a) => `
                <button data-nav data-arena="${a.id}" class="arenaCard ${s.arena === a.id ? 'on' : ''}" aria-pressed="${s.arena === a.id}">
                  <span class="thumb" style="background:${a.thumb}"></span><b>${a.name}</b>
                </button>`).join('')}
            </div>
          </div>
        </div>
        <div class="stepNav">
          <button data-nav data-act="back" class="btn text">Geri</button>
          <button data-nav data-act="next" class="btn primary">${nextLabel()}</button>
        </div>
      </div>`);
    const box = this.root.querySelector('.optsCol');
    box.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.o;
      s[k] = ['teamSize', 'minutes', 'points', 'kingCrowns', 'bans'].includes(k) ? +b.dataset.v : b.dataset.v;
      if (k === 'rule') {
        s.classic = s.rule === 'classic'; s.party = s.rule === 'party';
        this.root.querySelector('[data-act="next"]').textContent = nextLabel();
      }
      box.querySelectorAll(`[data-o="${k}"]`).forEach((x) => x.classList.toggle('on', x === b));
      this.o.onSettingsChange();
      this.o.sfx.uiMove();
    }));
    const w2 = box.querySelector('[data-win2]');
    w2?.addEventListener('click', () => {
      s.winBy2 = !s.winBy2;
      w2.classList.toggle('on', s.winBy2);
      w2.setAttribute('aria-pressed', s.winBy2);
      this.o.onSettingsChange();
      this.o.sfx.uiMove();
    });
    this.root.querySelectorAll('[data-arena]').forEach((b) => b.addEventListener('click', () => {
      s.arena = b.dataset.arena;
      this.root.querySelectorAll('[data-arena]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      this.o.onSettingsChange();   // arkadaki gösteri maçı hemen bu sahaya geçer
      this.o.sfx.uiMove();
    }));
    const ch = this.playerChoices(f.pick);
    this.bind({
      back: () => (ch && ch.length === 1 ? this.showMain() : this.showPlayersStep()),
      next: () => this.o.onLaunch({ ...f }),
    });
    this.bindChrome();
    this.root.querySelector('[data-act="next"]')?.focus({ preventScroll: true });
  }

  // ================================================================= İSTATİSTİKLER
  showStats() {
    const c = this.o.career.data;
    const fmtTime = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)} sa ${Math.floor((sec % 3600) / 60)} dk` : `${Math.floor(sec / 60)} dk`);
    const big = (n, l) => `<div class="big"><b>${n}</b><span>${l}</span></div>`;
    const row = ([id, name]) => {
      const r = c.ai[id] || { w: 0, l: 0 };
      const tot = r.w + r.l;
      const pct = tot ? Math.round((r.w / tot) * 100) : 0;
      return `<tr><th>${name}</th><td>${r.w}</td><td>${r.l}</td><td><span class="bar"><i style="width:${pct}%"></i></span>${tot ? `%${pct}` : '–'}</td></tr>`;
    };
    this.mount('stats', `
      <div class="dialog stats">
        <div class="headline">İstatistikler</div>
        <div class="bigs">
          ${big(c.matches, 'maç')}
          ${big(c.longestRally, 'en uzun ralli')}
          ${big(c.spikes, 'smaç')}
          ${big(c.bestStreak, 'en uzun galibiyet serisi')}
          ${big(c.points, 'sayı')}
          ${big(fmtTime(c.seconds), 'oyun süresi')}
        </div>
        <table class="wl">
          <thead><tr><th>Yapay zekaya karşı</th><td>${L('G', 'W')}</td><td>${L('M', 'L')}</td><td>Oran</td></tr></thead>
          <tbody>${DIFFS.map(row).join('')}</tbody>
        </table>
        <div class="dactions">
          <button data-nav data-act="reset" class="btn text">Sıfırla</button>
          <button data-nav data-act="back" class="btn primary">Tamam</button>
        </div>
      </div>`);
    const reset = this.root.querySelector('[data-act="reset"]');
    reset.addEventListener('click', () => {
      if (reset.dataset.confirm) {
        this.o.career.reset();
        this.o.sfx.ui();
        this.showStats();
        return;
      }
      reset.dataset.confirm = '1';
      reset.textContent = 'Emin misin? Tekrar bas';
    });
    this.root.querySelector('[data-act="back"]').addEventListener('click', () => { this.o.sfx.ui(); this.showMain(); this.focusFirst(); });
    this.root.querySelector('[data-act="back"]').focus({ preventScroll: true });
  }

  // ================================================================= AYARLAR
  showSettings() {
    const s = this.o.settings;
    const sw = (key, text, sub, on) => `
      <button data-nav data-toggle="${key}" class="listItem" role="switch" aria-checked="${on}">
        <span class="liTx"><b>${text}</b><small>${sub}</small></span>
        <span class="switch ${on ? 'on' : ''}"><i>${on ? icon('check', 14) : ''}</i></span>
      </button>`;
    const vol = (key, text) => `
      <label class="listItem slider">
        <span class="liTx"><b>${text}</b></span>
        <input data-nav type="range" min="0" max="100" step="5" value="${Math.round(s[key] * 100)}" data-vol="${key}" aria-label="${text}">
        <span class="val">${Math.round(s[key] * 100)}</span>
      </label>`;
    this.mount('settings', `
      <div class="dialog settings">
        <div class="headline">Ayarlar</div>
        <div class="list">
          ${sw('lowFx', 'Efektleri azalt', 'Daha az parçacık, sarsıntı ve flaş', s.lowFx)}
          ${sw('replay', 'Sayı tekrarı', 'Her sayıdan sonra son 2 saniye', s.replay)}
          ${sw('showFps', 'FPS göstergesi', 'Köşede küçük kare hızı yazısı', !!s.showFps)}
          <div class="listItem qrow">
            <span class="liTx"><b>Dil</b><small>Dil değişince oyun yeniden yüklenir</small></span>
            <div class="seg" data-noi18n>${[['tr', 'Türkçe'], ['en', 'English']]
              .map(([id, n]) => `<button data-nav data-lang="${id}" class="${(s.lang || 'tr') === id ? 'on' : ''}">${n}</button>`).join('')}</div>
          </div>
          <div class="listItem qrow">
            <span class="liTx"><b>Grafik</b><small>Kasarsa Düşük</small></span>
            <div class="seg">${[['auto', 'Otomatik'], ['yuksek', 'Yüksek'], ['orta', 'Orta'], ['dusuk', 'Düşük'], ['enDusuk', 'En düşük']]
              .map(([id, n]) => `<button data-nav data-quality="${id}" class="${s.quality === id ? 'on' : ''}">${n}</button>`).join('')}</div>
          </div>
          ${vol('sfxVol', 'Efekt sesi')}
          ${vol('ambVol', 'Seyirci sesi')}
          <button data-nav data-act="controls" class="listItem">
            <span class="liTx"><b>Kontroller</b><small>Tuş atama, oyun kolu, dokunmatik butonlar</small></span>
            <span class="chev">${icon('chevron', 18)}</span>
          </button>
        </div>
        <div class="dactions"><span class="renderer">${this.o.rendererName}</span><button data-nav data-act="back" class="btn primary">Tamam</button></div>
      </div>`);
    this.root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.toggle;
      this.o.sfx.unlock();
      if (k === 'sound') this.o.sfx.setMuted(!this.o.sfx.muted);
      else s[k] = !s[k];
      this.o.onSettingsChange();
      this.o.sfx.ui();
      // Diyaloğu yeniden çizmeden sadece anahtarı güncelle (animasyon tekrar oynamasın)
      const on = k === 'sound' ? !this.o.sfx.muted : s[k];
      b.setAttribute('aria-checked', on);
      const swEl = b.querySelector('.switch');
      swEl.classList.toggle('on', on);
      swEl.querySelector('i').innerHTML = on ? icon('check', 14) : '';
    }));
    this.root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.lang === (s.lang || 'tr')) return;
      this.o.sfx.ui();
      this.o.onLangChange(b.dataset.lang);
    }));
    this.root.querySelectorAll('[data-quality]').forEach((b) => b.addEventListener('click', () => {
      s.quality = b.dataset.quality;
      this.root.querySelectorAll('[data-quality]').forEach((x) => x.classList.toggle('on', x === b));
      this.o.sfx.uiMove();
      this.o.onSettingsChange();
    }));
    this.root.querySelectorAll('[data-vol]').forEach((r) => {
      r.addEventListener('input', () => {
        s[r.dataset.vol] = r.value / 100;
        r.parentElement.querySelector('.val').textContent = r.value;
        this.o.sfx.unlock();
        this.o.onSettingsChange();
      });
      r.addEventListener('change', () => (r.dataset.vol === 'sfxVol' ? this.o.sfx.hit(600) : this.o.sfx.ui()));
    });
    this.root.querySelector('[data-act="back"]').addEventListener('click', () => { this.o.sfx.ui(); this.showMain(); this.focusFirst(); });
    this.root.querySelector('[data-act="controls"]').addEventListener('click', () => { this.o.sfx.ui(); this.showControls(); });
    this.focusFirst();
  }

  // ================================================================= MODLAR
  /** Hayatta kalma, zamana karşı ve izleme modlarının seçildiği pencere. */
  showModes({ best = 0 } = {}) {
    const st = this.modeOpts || (this.modeOpts = { minutes: 2, vs: 'ai', dw: 'zor' });
    const DIF = [['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor'], ['usta', 'Usta']];
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, n]) => `<button data-nav data-mopt="${key}" data-v="${v}" class="${String(st[key]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    this.mount('modes', `
      <div class="dialog modes">
        <div class="headline">Modlar</div>
        <div class="modeList">
          <div class="modeCard">
            <div class="mcTx"><b>Hayatta kalma</b><small>5 canın var; rakip her 3 sayında güçlenir ve karakter değiştirir. Rekor: <em>${best} sayı</em></small></div>
            <button data-nav data-act="survival" class="btn primary">Başla</button>
          </div>
          <div class="modeCard">
            <div class="mcTx"><b>Zamana karşı</b><small>Süre bitince önde olan kazanır; eşitlikte altın sayı.</small>
              <div class="mcOpts">${seg('minutes', [[1, '1 dk'], [2, '2 dk'], [3, '3 dk']])}${seg('vs', [['ai', 'Yapay zeka'], ['2p', '2 oyuncu']])}</div>
            </div>
            <button data-nav data-act="timed" class="btn primary">Başla</button>
          </div>
          <div class="modeCard">
            <div class="mcTx"><b>İzleme</b><small>İki karakter seç, tahmin et, yapay zekalar oynasın.</small>
              <div class="mcOpts"><span class="mcl">Zorluk</span>${seg('dw', DIF)}</div>
            </div>
            <button data-nav data-act="watch" class="btn primary">Başla</button>
          </div>
        </div>
        <div class="dactions"><button data-nav data-act="back" class="btn text">Geri</button></div>
      </div>`);
    this.root.querySelectorAll('[data-mopt]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.mopt;
      st[k] = k === 'minutes' ? +b.dataset.v : b.dataset.v;
      this.root.querySelectorAll(`[data-mopt="${k}"]`).forEach((x) => x.classList.toggle('on', x === b));
      this.o.sfx.uiMove();
    }));
    this.bind({
      survival: () => this.o.onStartMode('survival'),
      timed: () => this.o.onStartMode('timed', { minutes: st.minutes, vs: st.vs }),
      watch: () => this.o.onStartMode('watch', { d0: st.dw, d1: st.dw }),
      back: () => { this.showMain(); this.focusFirst(); },
    });
    this.focusFirst();
  }

  /** İzleme modu: kim kazanır? @param chars [sol, sağ] @param done(0|1|null) */
  showGuess(chars, done) {
    this.mount('guess', `
      <div class="dialog guess">
        <div class="headline">Kim kazanır?</div>
        <div class="supporting">Tahminini yap, maç sonunda tuttu mu görürsün.</div>
        <div class="guessRow">
          ${chars.map((c, i) => `<button data-nav class="guessBtn" data-g="${i}" style="--c:${c.ui}">${blobSvg(c, 'portrait', 'pt')}<b>${esc(c.name)}</b></button>`).join('<span class="vsTxt">VS</span>')}
        </div>
        <div class="dactions"><button data-nav data-g="none" class="btn text">Tahmin yok</button></div>
      </div>`);
    this.root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
      this.o.sfx.selectConfirm();
      done(b.dataset.g === 'none' ? null : +b.dataset.g);
    }));
    this.focusFirst();
  }

  // ================================================================= KONTROLLER
  /** Tuş atama (iki oyuncu), oyun kolu durumu ve dokunmatik buton ayarları. */
  showControls() {
    const s = this.o.settings;
    const ACTS = [['left', 'Sol'], ['right', 'Sağ'], ['jump', 'Zıpla'], ['ability', 'Yetenek']];
    const cur = () => [0, 1].map((p) => ({ ...DEFAULT_KEYS[p], ...(s.keys?.[p] || {}) }));
    const pads = this.o.pads;
    const padTxt = (p) => (pads?.state[p].connected ? 'Bağlı' : 'Bağlı değil');
    this.mount('controls', `
      <div class="dialog ctlDialog">
        <div class="headline">Kontroller</div>
        <div class="ctlGrid">
          ${[0, 1].map((p) => `
            <div class="ctlCol">
              <div class="ctlHead"><span class="dot ${p ? 'b' : 'o'}"></span>Oyuncu ${p + 1}</div>
              ${ACTS.map(([a, n]) => `<div class="ctlRow"><span>${n}</span><button data-nav class="keyBtn" data-p="${p}" data-a="${a}"></button></div>`).join('')}
              <div class="ctlPad">Oyun kolu: <b data-pad="${p}">${padTxt(p)}</b></div>
            </div>`).join('')}
        </div>
        <div class="ctlHint">Tuşa tıkla, yeni tuşa bas (Esc vazgeçer). Kol: çubuk hareket, A zıpla, X/B yetenek, Start duraklat.</div>
        <div class="list">
          <div class="listItem qrow">
            <span class="liTx"><b>Dokunmatik butonlar</b><small>Telefon ve tablet</small></span>
            <div class="seg">${[['kucuk', 'Küçük'], ['orta', 'Orta'], ['buyuk', 'Büyük']].map(([id, n]) => `<button data-nav data-tsize="${id}" class="${s.touchSize === id ? 'on' : ''}">${n}</button>`).join('')}</div>
          </div>
          <label class="listItem slider">
            <span class="liTx"><b>Buton saydamlığı</b></span>
            <input data-nav type="range" min="30" max="100" step="5" value="${Math.round((s.touchAlpha ?? 1) * 100)}" data-talpha aria-label="Buton saydamlığı">
            <span class="val">${Math.round((s.touchAlpha ?? 1) * 100)}</span>
          </label>
        </div>
        <div class="dactions"><button data-nav data-act="reset" class="btn secondary">Varsayılan tuşlar</button><button data-nav data-act="back" class="btn primary">Tamam</button></div>
      </div>`);
    const paint = () => {
      const k = cur();
      this.root.querySelectorAll('.keyBtn').forEach((b) => { b.textContent = keyLabel(k[+b.dataset.p][b.dataset.a]); b.classList.remove('wait'); });
    };
    paint();
    // Tuş yakalama: yeni basılan tuş bu eyleme atanır; başka eylemdeyse ikisi yer değiştirir
    this.root.querySelectorAll('.keyBtn').forEach((b) => b.addEventListener('click', () => {
      paint();
      b.textContent = 'Tuşa bas…';
      b.classList.add('wait');
      const p = +b.dataset.p, a = b.dataset.a;
      const onKey = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.removeEventListener('keydown', onKey, true);
        if (e.code !== 'Escape' && !['KeyM', 'MetaLeft', 'MetaRight'].includes(e.code)) {
          const k = cur();
          const old = k[p][a];
          for (let q = 0; q < 2; q++) for (const [x] of ACTS) if (k[q][x] === e.code) k[q][x] = old;   // çakışma: yer değiştir
          k[p][a] = e.code;
          s.keys = k;
          this.o.onSettingsChange();
          this.o.sfx.uiMove();
        }
        paint();
        b.focus({ preventScroll: true });
      };
      window.addEventListener('keydown', onKey, true);
      this.cancelCapture = () => window.removeEventListener('keydown', onKey, true);
    }));
    this.root.querySelectorAll('[data-tsize]').forEach((b) => b.addEventListener('click', () => {
      s.touchSize = b.dataset.tsize;
      this.root.querySelectorAll('[data-tsize]').forEach((x) => x.classList.toggle('on', x === b));
      this.o.sfx.uiMove();
      this.o.onSettingsChange();
    }));
    const ta = this.root.querySelector('[data-talpha]');
    ta.addEventListener('input', () => {
      s.touchAlpha = ta.value / 100;
      ta.parentElement.querySelector('.val').textContent = ta.value;
      this.o.onSettingsChange();
    });
    this.root.querySelector('[data-act="reset"]').addEventListener('click', () => { s.keys = null; this.o.onSettingsChange(); this.o.sfx.ui(); paint(); });
    this.root.querySelector('[data-act="back"]').addEventListener('click', () => { this.cancelCapture?.(); this.o.sfx.ui(); this.showSettings(); });
    // Oyun kolu takılırsa durum yazısı güncellensin
    this.padTimer = setInterval(() => {
      if (this.screen !== 'controls') { clearInterval(this.padTimer); return; }
      this.root.querySelectorAll('[data-pad]').forEach((el) => { el.textContent = padTxt(+el.dataset.pad); });
    }, 500);
    this.focusFirst();
  }

  // ============================================================== KARAKTER SEÇİMİ
  /**
   * Dövüş oyunu tarzı seçim: ortada portre ızgarası, iki yanda seçilen karakter büyük.
   * Oyuncu 1 imleci sarı "1", Oyuncu 2 imleci turkuaz "2" çerçeveyle gösterilir.
   * 2 oyunculuda aynı karakter iki tarafta olamaz. Tek oyunculuda yapay zeka,
   * oyuncu seçimini yapınca kalanlardan rastgele birini alır.
   * @param o.sides [{ name, ai }]   o.prev [charId|null, charId|null]
   */
  showSelect({ sides, prev = [null, null], solo = false, bans = 0, title = '' }) {
    document.activeElement?.blur?.();
    const start = (p) => {
      const i = prev[p] ? CHARACTERS.findIndex((c) => c.id === prev[p]) : -1;
      return i >= 0 ? i : p === 0 ? 0 : CHARACTERS.length - 1;
    };
    const anyAi = sides.some((x) => x.ai);
    this.sel = {
      mode: anyAi ? '1p' : '2p',
      done: false,
      phase: bans > 0 ? 'ban' : 'pick',   // yasaklama açıksa önce her oyuncu `bans` karakter yasaklar (turlar hâlinde)
      bans, banRound: 1,
      banned: new Set(),
      title: title || (solo ? 'Antrenman: karakterini seç' : 'Karakterini seç'),
      players: sides.map((x, p) => ({ idx: start(p), picked: null, ready: false, ai: x.ai, name: x.name, ban: null })),
    };

    const tile = (c, i) => `
      <button class="tile" data-i="${i}" style="--c:${c.ui}" aria-label="${c.name}">
        ${blobSvg(c, 'portrait', 'pt')}
        <span class="tag t1">1</span><span class="tag t2">2</span>
      </button>`;
    const fighter = (p) => `
      <div class="fighter f${p}">
        <div class="who">${esc(sides[p].name)}</div>
        <div class="fname"></div>
        <div class="fstyle"></div>
        <div class="fstage"><div class="fglow"></div><div class="fbody"></div><div class="stamp">Hazır</div></div>
        <div class="fbtns">
          <button class="btn fpick" data-p="${p}">${sides[p].ai ? 'Bekliyor' : 'Seç'}</button>
          ${sides[p].ai ? '' : `<button class="btn fdice" data-p="${p}" title="Rastgele karakter (${p ? 'Sağ Shift' : 'R'})" aria-label="Rastgele karakter">${icon('shuffle', 18)}</button>`}
        </div>
        <div class="fabs"></div>
      </div>`;
    const keys1 = '<kbd>A</kbd><kbd>D</kbd> gez <kbd>W</kbd> seç <kbd>S</kbd> geri <kbd>R</kbd> zar';
    const keys2 = '<kbd>←</kbd><kbd>→</kbd> gez <kbd>↑</kbd> seç <kbd>↓</kbd> geri';
    this.mount('select', `
      <div class="mk ${solo ? 'solo' : ''}">
        <div class="mkTitle">${this.banTitle()}</div>
        ${fighter(0)}
        <div class="mkCenter">
          <div class="mkGrid">${CHARACTERS.map(tile).join('')}</div>
          <div class="mkKeys">
            ${sides[0].ai ? '' : `<div><span class="kp k1">1</span>${keys1}</div>`}
            ${sides[1].ai ? '' : `<div><span class="kp k2">2</span>${anyAi ? keys2.replace('↑</kbd> seç', '↑</kbd> seç') : keys2}</div>`}
            <button class="btn text mkBack" data-act="back">Geri</button>
          </div>
        </div>
        ${fighter(1)}
      </div>`);
    // Butonlar odak almasın: aksi halde Oyuncu 2'nin Enter'ı odaktaki düğmeyi "tıklar".
    this.root.querySelectorAll('button').forEach((b) => {
      b.tabIndex = -1;
      b.addEventListener('mousedown', (e) => e.preventDefault());
    });
    this.bind({ back: () => this.o.onSelectBack() });

    // Fare/dokunma: karoya dokunmak, henüz hazır olmayan ilk insan oyuncunun imlecini taşır
    const picker = () => this.sel.players.findIndex((pl) => !pl.ai && !pl.ready);
    this.root.querySelectorAll('.tile').forEach((t) => {
      t.addEventListener('click', () => {
        const p = picker();
        if (p < 0 || this.sel.done) return;
        this.o.sfx.unlock();
        const i = +t.dataset.i;
        if (this.sel.players[p].idx !== i) { this.sel.players[p].idx = i; this.o.sfx.selectMove(); this.renderSelect(); }
      });
      t.addEventListener('dblclick', () => { const p = picker(); if (p >= 0) this.confirm(p); });
    });
    this.root.querySelectorAll('.fpick').forEach((b) => b.addEventListener('click', () => {
      const p = +b.dataset.p;
      this.o.sfx.unlock();
      if (this.sel.players[p].ready) this.back(p); else this.confirm(p);
    }));
    this.root.querySelectorAll('.fdice').forEach((b) => b.addEventListener('click', () => { this.o.sfx.unlock(); this.roll(+b.dataset.p); }));
    this.lastShown = [-1, -1];
    this.renderSelect();
  }

  banTitle() {
    const s = this.sel;
    if (s.phase !== 'ban') return s.title;
    return s.bans > 1 ? `Yasakla (${s.banRound}/${s.bans}): rakibin alamayacağı bir karakter seç` : 'Yasakla: rakibin alamayacağı bir karakter seç';
  }

  /** Bu karakteri diğer oyuncu zaten seçmiş mi ya da yasaklı mı? */
  isTaken(p, i) {
    if (this.sel.banned.has(i)) return true;
    const other = this.sel.players[1 - p];
    return other.ready && other.picked === i;
  }

  /** Seçilebilir karakter indeksleri (yasaklılar ve rakibin seçtiği hariç). */
  freeIdx(p) {
    return CHARACTERS.map((_, i) => i).filter((i) => !this.isTaken(p, i) && !(this.sel.phase === 'ban' && this.sel.players[1 - p].ban === i));
  }

  /** Zar at: imleç kısa bir süre rastgele karakterlerde gezinir, rastgele birinde durur (onaylamaz). */
  roll(p) {
    const pl = this.sel.players[p];
    if (!pl || pl.ai || pl.ready || this.sel.done || pl.rolling) return;
    const pool = this.freeIdx(p);
    if (!pool.length) return;
    pl.rolling = true;
    let k = 0;
    const stepRoll = () => {
      if (!this.sel || this.sel.players[p] !== pl) return;
      pl.idx = pool[Math.floor(Math.random() * pool.length)];
      this.o.sfx.selectMove();
      this.renderSelect();
      if (++k < 9) setTimeout(stepRoll, 45 + k * 12);
      else pl.rolling = false;
    };
    stepRoll();
  }

  renderSelect() {
    if (!this.sel) return;
    const P = this.sel.players;
    const chosen = (pl) => (this.sel.phase === 'ban' ? pl.ban : pl.picked);   // onaylanan karakter (yasak ya da seçim)
    this.root.querySelectorAll('.tile').forEach((t) => {
      const i = +t.dataset.i;
      const on1 = !P[0].ai && (P[0].ready ? chosen(P[0]) === i : P[0].idx === i);
      const on2 = !P[1].ai ? (P[1].ready ? chosen(P[1]) === i : P[1].idx === i) : P[1].ready && chosen(P[1]) === i;
      t.classList.toggle('c1', on1);
      t.classList.toggle('c2', on2);
      t.classList.toggle('locked', this.sel.phase === 'pick' && ((P[0].ready && P[0].picked === i) || (P[1].ready && P[1].picked === i)));
      t.classList.toggle('banned', this.sel.banned.has(i) || (this.sel.phase === 'ban' && P.some((pl) => pl.ready && pl.ban === i)));
    });
    const banning = this.sel.phase === 'ban';
    this.root.querySelector('.mk')?.classList.toggle('banning', banning);
    const tt = this.root.querySelector('.mkTitle');
    if (tt) tt.textContent = this.banTitle();
    P.forEach((pl, p) => {
      const el = this.root.querySelector(`.fighter.f${p}`);
      const waiting = pl.ai && !pl.ready;
      const ci = pl.ready ? chosen(pl) : pl.idx;
      const c = CHARACTERS[ci];
      el.classList.toggle('waiting', waiting);
      el.classList.toggle('isReady', pl.ready);
      el.style.setProperty('--c', waiting ? '#2a4e63' : c.ui);
      const btn = el.querySelector('.fpick');
      btn.disabled = pl.ai || (!pl.ready && this.isTaken(p, pl.idx));
      btn.textContent = pl.ai ? (pl.ready ? 'Hazır' : 'Bekliyor') : pl.ready ? 'Vazgeç'
        : this.isTaken(p, pl.idx) ? (this.sel.banned.has(pl.idx) ? 'Yasaklı' : 'Rakipte') : banning ? 'Yasakla' : 'Seç';
      el.querySelector('.stamp').textContent = banning ? 'Yasak' : 'Hazır';
      if (waiting) {
        if (this.lastShown[p] !== 'wait') {
          this.lastShown[p] = 'wait';
          el.querySelector('.fname').textContent = '?'; el.querySelector('.fname').classList.remove('long');
          el.querySelector('.fstyle').textContent = 'Sen seçince seçecek';
          el.querySelector('.fbody').innerHTML = '';
          el.querySelector('.fabs').innerHTML = '';
        }
        return;
      }
      if (this.lastShown[p] === ci) return;   // aynı karakter: yeniden çizme (animasyon sıfırlanmasın)
      this.lastShown[p] = ci;
      const ps = getAbility(c.passive), ac = getAbility(c.active), hy = getHyper(c.hyper);
      el.querySelector('.fname').textContent = c.name;
      el.querySelector('.fname').classList.toggle('long', c.name.length > 7);   // uzun adlar başlığa taşmasın
      el.querySelector('.fstyle').textContent = c.style;
      const body = el.querySelector('.fbody');
      body.innerHTML = blobSvg(c, 'full', 'big');
      body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');
      el.querySelector('.fabs').innerHTML = `
        <div class="ab"><span class="k">Pasif</span><b>${ps.name}</b><i>${ps.desc}</i></div>
        <div class="ab"><span class="k">Aktif</span><b>${ac.name}</b><i>${ac.desc}&nbsp;(${ac.cooldown}&nbsp;sn)</i></div>
        ${hy ? `<div class="ab hy"><span class="k">Hyper</span><b>${hy.name}</b><i>${hy.desc}</i></div>` : ''}`;
    });
  }

  move(p, d) {
    const pl = this.sel.players[p];
    if (pl.ai || pl.ready || this.sel.done) return;
    const n = CHARACTERS.length;
    pl.idx = (pl.idx + d + n) % n;
    // Seçim aşamasında yasaklı karakterlerin üstünden atla
    for (let k = 0; k < n && this.sel.banned.has(pl.idx); k++) pl.idx = (pl.idx + d + n) % n;
    this.o.sfx.selectMove();
    this.renderSelect();
  }

  confirm(p) {
    const pl = this.sel.players[p];
    if (pl.ai || pl.ready || this.sel.done) return;
    if (this.isTaken(p, pl.idx)) { this.o.sfx.uiMove(); return; }
    const other = this.sel.players[1 - p];
    if (this.sel.phase === 'ban') {
      if (other.ready && other.ban === pl.idx) { this.o.sfx.uiMove(); return; }   // aynısını iki kez yasaklama
      pl.ban = pl.idx;
      pl.ready = true;
      this.o.sfx.selectConfirm();
      if (other.ai && !other.ready) {
        const pool = CHARACTERS.map((_, i) => i).filter((i) => i !== pl.ban && !this.sel.banned.has(i));
        other.ban = pool[Math.floor(Math.random() * pool.length)];
        other.ready = true;
      }
      if (this.sel.players.every((x) => x.ready)) {
        // Bu turun yasakları kesinleşti → sonraki yasak turu ya da seçim aşaması;
        // imleç yasaklıdaysa boş bir karaktere kayar
        this.sel.players.forEach((x) => { this.sel.banned.add(x.ban); x.ban = null; });
        if (this.sel.banRound < this.sel.bans) this.sel.banRound++;
        else this.sel.phase = 'pick';
        this.sel.players.forEach((x, q) => {
          x.ready = false;
          if (this.sel.banned.has(x.idx)) {
            // İmleç yasaklı karakterdeyse en yakın serbest karaktere (2. oyuncu sondan) kayar
            const free = this.freeIdx(q);
            x.idx = (q === 0 ? free[0] : free[free.length - 1]) ?? 0;
          }
        });
        if (this.sel.phase === 'pick') this.o.sfx.vs?.();
        this.lastShown = [-1, -1];
      }
      this.renderSelect();
      return;
    }
    pl.picked = pl.idx;
    pl.ready = true;
    this.o.sfx.selectConfirm();
    // Yapay zeka: kalan karakterlerden birini alır (yasaklılar hariç)
    if (other.ai && !other.ready) {
      const pool = CHARACTERS.map((_, i) => i).filter((i) => i !== pl.picked && !this.sel.banned.has(i));
      other.picked = other.idx = pool[Math.floor(Math.random() * pool.length)];
      other.ready = true;
    }
    this.renderSelect();
    this.checkDone();
  }

  back(p) {
    const pl = this.sel.players[p];
    if (pl.ai || this.sel.done || !pl.ready) return;
    pl.ready = false;
    this.o.sfx.uiMove();
    this.renderSelect();
  }

  checkDone() {
    const s = this.sel;
    if (s.done || !s.players.every((pl) => pl.ready)) return;
    s.done = true;
    const picks = s.players.map((pl) => CHARACTERS[pl.picked].id);
    this.vsTimer = setTimeout(() => this.o.onSelectDone(picks), 650);
  }

  // ================================================================= VS EKRANI
  /** @param sides [{ name, char }]  @param done VS bitince çağrılır */
  showVs(sides, done) {
    const side = (x, p) => `
      <div class="vsSide s${p}" style="--c:${x.char.css}">
        <div class="vsBody">${blobSvg(x.char, 'full', 'big')}</div>
        <div class="vsName">${x.char.name}</div>
        <div class="vsWho">${esc(x.name)}</div>
      </div>`;
    this.mount('vs', `<div class="vs">${side(sides[0], 0)}<div class="vsMid">VS</div>${side(sides[1], 1)}</div>`);
    this.vsTimer = setTimeout(done, 1700);
  }

  // ================================================================= TURNUVA
  /** Kurulum: isimler, insan/yapay zeka seçimi. @param saved önceki katılımcılar */
  showTournamentSetup(saved, kind = 'tour', count = 0) {
    const isKing = kind === 'king';
    let list = (saved && saved.length >= 2 ? saved : [
      { name: 'Oyuncu 1', type: 'human' }, { name: 'Oyuncu 2', type: 'human' },
      { name: 'Oyuncu 3', type: 'human' }, { name: 'Oyuncu 4', type: 'human' },
    ]).map((e) => ({ ...e }));
    // Kişi sayısı adımında seçilen sayı kadar satır (eksikse "Oyuncu N" eklenir)
    if (count) {
      list = list.slice(0, count);
      while (list.length < count) list.push({ name: `Oyuncu ${list.length + 1}`, type: 'human' });
    }
    const s = this.o.settings;
    const render = () => {
      const row = (e, i) => `
        <div class="trow">
          <span class="tn">${i + 1}</span>
          <input type="text" maxlength="14" value="${esc(e.name)}" data-i="${i}" aria-label="${i + 1}. oyuncunun adı" spellcheck="false" autocomplete="off">
          <button class="ttype ${e.type === 'human' ? '' : 'ai'}" data-type="${i}" title="İnsan ya da yapay zeka">${ENTRANT_TYPES.find(([id]) => id === e.type)[1]}</button>
          <button class="tdel" data-del="${i}" title="Çıkar" ${list.length <= 2 ? 'disabled' : ''}>${icon('close', 16)}</button>
        </div>`;
      this.mount('tsetup', `
        <div class="dialog tsetup">
          <div class="headline">${isKing ? 'Kral sahası' : 'Turnuva'}</div>
          <div class="supporting">${isKing ? '3–8 oyuncu. Kazanan sahada kalır ve taç kazanır, kaybeden sıranın sonuna geçer.' : '2–8 oyuncu. İsimleri yazın; eksik kalan yerlere yapay zeka ekleyebilirsiniz. Eşleşmeler rastgele.'}</div>
          <div class="tlist">${list.map(row).join('')}</div>
          ${list.length < 8 ? `<button class="btn text tadd" data-act="add">${icon('add', 18)}Oyuncu ekle</button>` : ''}
          <div class="tfmt">${L(`Her maç ${s.points} sayı${s.winBy2 ? ', 2 fark' : ''}${s.classic ? ', klasik' : ', karakterli'}${isKing ? `, ${s.kingCrowns || 3} taç alan kral olur` : ''}. Ayarlar adımında değiştirilebilir.`, `Every match to ${s.points}${s.winBy2 ? ', win by 2' : ''}${s.classic ? ', classic' : ', with characters'}${isKing ? `, first to ${s.kingCrowns || 3} crowns is king` : ''}. Can be changed in the settings step.`)}</div>
          <div class="dactions left">
            <button class="btn primary" data-act="start" ${isKing && list.length < 3 ? 'disabled' : ''}>${isKing ? 'Başlat' : 'Turnuvayı başlat'}</button>
            <button class="btn text" data-act="cancel">Geri</button>
          </div>
        </div>`);
      this.root.querySelectorAll('input[data-i]').forEach((inp) => {
        inp.addEventListener('input', () => { list[+inp.dataset.i].name = inp.value; });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const next = this.root.querySelector(`input[data-i="${+inp.dataset.i + 1}"]`);
            if (next) next.focus({ preventScroll: true }); else this.root.querySelector('[data-act="start"]').focus({ preventScroll: true });
          }
        });
      });
      this.root.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
        const e = list[+b.dataset.type];
        const k = ENTRANT_TYPES.findIndex(([id]) => id === e.type);
        e.type = ENTRANT_TYPES[(k + 1) % ENTRANT_TYPES.length][0];
        // İsim hâlâ varsayılan ise türüne göre güncelle
        if (/^(Oyuncu|YZ) \d+$/.test(e.name.trim())) e.name = `${e.type === 'human' ? 'Oyuncu' : 'YZ'} ${+b.dataset.type + 1}`;
        this.o.sfx.uiMove();
        render();
        this.root.querySelector(`[data-type="${b.dataset.type}"]`)?.focus({ preventScroll: true });
      }));
      this.root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
        list.splice(+b.dataset.del, 1);
        this.o.sfx.uiMove();
        render();
      }));
      this.bind({
        add: () => {
          list.push({ name: `Oyuncu ${list.length + 1}`, type: 'human' });
          render();
          const inputs = this.root.querySelectorAll('input[data-i]');
          inputs[inputs.length - 1]?.focus({ preventScroll: true });
          inputs[inputs.length - 1]?.select();
        },
        cancel: () => (this.flow ? this.showOptionsStep() : this.o.onQuit()),
        start: () => {
          const entrants = list.map((e, i) => ({ name: e.name.trim() || `Oyuncu ${i + 1}`, type: e.type }));
          if (isKing) { if (entrants.length >= 3) this.o.onKingStart(entrants); }
          else this.o.onTournamentStart(entrants);
        },
      });
    };
    render();
    this.root.querySelector('input[data-i]')?.focus({ preventScroll: true });
  }

  /** Eleme ağacı ve sıradaki maç. */
  showBracket(t, fmt) {
    const nm = t.nextMatch();
    const nameOf = (id) => (id === BYE ? 'Bay' : id === undefined ? '?' : esc(t.entrants[id].name));
    const typeOf = (id) => (id >= 0 && t.entrants[id].type !== 'human' ? `<em>${ENTRANT_TYPES.find(([k]) => k === t.entrants[id].type)[1]}</em>` : '');
    const box = (m, r, i) => {
      const cur = nm && nm.r === r && nm.i === i;
      const line = (id, k) => {
        const won = m.winner !== undefined && m.winner === id && id >= 0;
        const lost = m.winner !== undefined && m.winner !== id;
        return `<div class="bl ${won ? 'won' : ''} ${lost ? 'lost' : ''} ${id === BYE || id === undefined ? 'tbd' : ''}">
          <span class="bn">${nameOf(id)}${typeOf(id)}</span><span class="bs">${m.score ? m.score[k] : ''}</span></div>`;
      };
      return `<div class="bm ${cur ? 'cur' : ''}">${line(m.a, 0)}${line(m.b, 1)}</div>`;
    };
    const cols = t.rounds.map((round, r) => `
      <div class="bcol">
        <div class="bhead">${t.roundName(r)}</div>
        <div class="bmatches">${round.map((m, i) => box(m, r, i)).join('')}</div>
      </div>`).join('');
    const A = nm && t.entrants[nm.match.a], B = nm && t.entrants[nm.match.b];
    const aiOnly = nm && t.humansIn(nm.match) === 0;
    this.mount('bracket', `
      <div class="dialog bracket">
        <div class="bTop">
          <div class="headline">Turnuva</div>
          <div class="supporting">${t.entrants.length} oyuncu, maçlar ${fmt.points} sayı${fmt.winBy2 ? ' (2 fark)' : ''}</div>
        </div>
        <div class="bgrid">${cols}</div>
        <div class="bNext">
          ${nm ? `<span class="bl2">${t.roundName(nm.r)}</span><b>${esc(A.name)}</b><span class="vsx">-</span><b>${esc(B.name)}</b>` : ''}
        </div>
        <div class="dactions left">
          <button data-nav class="btn primary" data-act="play">${aiOnly ? 'İzle' : 'Maça başla'}</button>
          ${aiOnly ? '<button data-nav class="btn secondary" data-act="quick">Hızlı sonuç</button>' : ''}
          <button data-nav class="btn text" data-act="new">Yeni turnuva</button>
          <button data-nav class="btn text" data-act="menu">Ana menü</button>
        </div>
      </div>`);
    this.bind({
      menu: () => this.o.onQuit(),
      new: () => this.o.onTournamentNew(),
      quick: () => this.o.onTournamentQuick(),
      play: () => this.o.onTournamentPlay(),
    });
    this.root.querySelector('[data-act="play"]')?.focus({ preventScroll: true });
  }

  /** Turnuva maçı bitti. */
  showTournamentResult({ winner, score, names, stats, isOver, kind = 'tour' }) {
    const isKing = kind === 'king';
    const w = score[0] > score[1] ? 0 : 1;
    this.mount('tresult', `
      <div class="dialog tresult" style="--team:${CONFIG.teams[w].css}">
        <div class="endTop">
          <div>
            <div class="headline">${esc(winner)} ${isKing ? (isOver ? 'kral oldu' : 'sahada kalıyor') : isOver ? 'turnuvayı kazandı' : 'turu geçti'}</div>
            <div class="supporting">${esc(names[0])} - ${esc(names[1])}, en uzun ralli ${stats.longestRally} vuruş</div>
          </div>
          <div class="finalScore"><span class="o">${score[0]}</span><span class="sep">–</span><span class="b">${score[1]}</span></div>
        </div>
        <div class="dactions"><button data-nav class="btn primary" data-act="next">${isOver ? (isKing ? 'Kralı gör' : 'Şampiyonu gör') : isKing ? 'Sıraya dön' : 'Ağaca dön'}</button></div>
      </div>`);
    this.bind({ next: () => (isKing ? this.o.onKingContinue() : this.o.onTournamentContinue()) });
    setTimeout(() => this.root.querySelector('[data-act="next"]')?.focus({ preventScroll: true }), 50);
  }

  /** Şampiyon ekranı (arkada havai fişekler). */
  // ================================================================= KRAL SAHASI
  showKing(k, fmt) {
    const m = k.nextMatch();
    const typeTxt = (e) => (e.type !== 'human' ? `<em>${ENTRANT_TYPES.find(([id]) => id === e.type)[1]}</em>` : '');
    const crowns = (e) => `<span class="crowns">${Array.from({ length: k.crownsToWin }, (_, i) => `<i class="${i < e.crowns ? 'on' : ''}"></i>`).join('')}</span>`;
    const K = k.entrants[m.a], C = k.entrants[m.b];
    const aiOnly = k.humansIn(m) === 0;
    this.mount('king', `
      <div class="dialog kingD">
        <div class="headline">Kral sahası</div>
        <div class="supporting">${k.crownsToWin} taç alan kral olur · maçlar ${fmt.points} sayı${fmt.winBy2 ? ' (2 fark)' : ''}</div>
        <div class="kMatch">
          <div class="kSide king"><span class="kl">Kral</span><b>${esc(K.name)}</b>${typeTxt(K)}${crowns(K)}</div>
          <span class="vsx">VS</span>
          <div class="kSide"><span class="kl">Rakip</span><b>${esc(C.name)}</b>${typeTxt(C)}${crowns(C)}</div>
        </div>
        <div class="kQueue"><span class="kl">Sıra</span>${k.queue.slice(1).map((id) => `<span class="kq">${esc(k.entrants[id].name)} ${crowns(k.entrants[id])}</span>`).join('') || '<span class="kq">—</span>'}</div>
        <div class="dactions left">
          <button data-nav class="btn primary" data-act="play">${aiOnly ? 'İzle' : 'Maça başla'}</button>
          ${aiOnly ? '<button data-nav class="btn secondary" data-act="quick">Hızlı sonuç</button>' : ''}
          <button data-nav class="btn text" data-act="menu">Ana menü</button>
        </div>
      </div>`);
    this.bind({ play: () => this.o.onKingPlay(), quick: () => this.o.onKingQuick(), menu: () => this.o.onQuit() });
    this.root.querySelector('[data-act="play"]')?.focus({ preventScroll: true });
  }

  showKingChampion(k) {
    const c = k.champion;
    const table = [...k.entrants].sort((a, b) => b.crowns - a.crowns || b.won - a.won)
      .map((e) => `<li><span>${esc(e.name)}</span><b>${e.crowns} taç</b><span>${e.won}/${e.played} galibiyet</span></li>`).join('');
    this.mount('champion', `
      <div class="champ">
        <div class="cTrophy">${icon('trophy', 64)}</div>
        <div class="cLabel">Kral</div>
        <div class="cName">${esc(c.name)}</div>
        <ul class="cPath">${table}</ul>
        <div class="dactions center">
          <button data-nav class="btn primary" data-act="menu">Ana menü</button>
        </div>
      </div>`);
    this.bind({ menu: () => this.o.onQuit() });
    this.root.querySelector('[data-act="menu"]')?.focus({ preventScroll: true });
  }

  showChampion(t) {
    const champ = t.champion;
    const path = [];
    t.rounds.forEach((round, r) => round.forEach((m) => {
      if (m.winner === champ.id && m.score) {
        const opp = m.a === champ.id ? m.b : m.a;
        const sc = m.a === champ.id ? m.score : [m.score[1], m.score[0]];
        path.push(`<li><span>${t.roundName(r)}</span><b>${sc[0]}–${sc[1]}</b><span>${esc(t.entrants[opp].name)}</span></li>`);
      }
    }));
    this.mount('champion', `
      <div class="champ">
        <div class="cTrophy">${icon('trophy', 64)}</div>
        <div class="cLabel">Şampiyon</div>
        <div class="cName">${esc(champ.name)}</div>
        <ul class="cPath">${path.join('')}</ul>
        <div class="dactions center">
          <button data-nav class="btn text" data-act="menu">Ana menü</button>
          <button data-nav class="btn primary" data-act="new">Yeni turnuva</button>
        </div>
      </div>`);
    this.bind({ menu: () => this.o.onQuit(), new: () => this.o.onTournamentNew() });
    this.root.querySelector('[data-act="new"]')?.focus({ preventScroll: true });
  }

  // ================================================================= DURAKLATMA
  showPause() {
    const T = this.o.trainOpts?.();
    const SHOTS = [['karisik', 'Karışık'], ['yuksek', 'Yüksek'], ['sert', 'Sert'], ['file', 'File önü'], ['derin', 'Derin']];
    this.mount('pause', `
      <div class="dialog">
        <div class="headline">${T ? 'Antrenman' : 'Duraklatıldı'}</div>
        ${T ? `
        <div class="trainOpts">
          <div class="opt"><span class="ol">Atış</span><div class="seg">${SHOTS.map(([id, n]) => `<button data-nav data-shot="${id}" class="${T.shot === id ? 'on' : ''}">${n}</button>`).join('')}</div></div>
          <div class="opt"><span class="ol">Yetenek</span><div class="seg">
            <button data-nav data-nocd="0" class="${!T.noCd ? 'on' : ''}">Normal bekleme</button>
            <button data-nav data-nocd="1" class="${T.noCd ? 'on' : ''}">Beklemesiz</button>
          </div></div>
        </div>` : ''}
        <div class="controls">
          ${[0, 1].map((p) => `<div><span class="dot ${p ? 'b' : 'o'}"></span><kbd>${keyLabel(KEYMAP[p].left[0])}</kbd><kbd>${keyLabel(KEYMAP[p].right[0])}</kbd> hareket <kbd>${keyLabel(KEYMAP[p].jump[0])}</kbd> zıpla <kbd>${keyLabel(KEYMAP[p].ability[0])}</kbd> yetenek</div>`).join('')}
          <div class="dim"><kbd>Esc</kbd> duraklat <kbd>M</kbd> ses</div>
        </div>
        <div class="pauseTools">
          <button data-nav data-act="mute" class="btn secondary"></button>
          ${this.o.canFs?.() ? '<button data-nav data-act="fs" class="btn secondary"></button>' : ''}
        </div>

        <div class="dactions">
          <button data-nav data-act="quit" class="btn text">Ana menü</button>
          <button data-nav data-act="resume" class="btn primary">Devam et</button>
        </div>
      </div>`);
    this.root.querySelector('[data-act="resume"]').addEventListener('click', () => { this.o.sfx.ui(); this.o.onResume(); });
    this.root.querySelector('[data-act="quit"]').addEventListener('click', () => { this.o.sfx.ui(); this.o.onQuit(); });
    const mute = this.root.querySelector('[data-act="mute"]');
    const fs = this.root.querySelector('[data-act="fs"]');
    const paint = () => {
      mute.innerHTML = `${icon(this.o.sfx.muted ? 'volumeOff' : 'volumeOn', 18)}<span>${this.o.sfx.muted ? 'Ses kapalı' : 'Ses açık'}</span>`;
      if (fs) fs.innerHTML = `${icon(this.o.isFs() ? 'fsExit' : 'fs', 18)}<span>${this.o.isFs() ? 'Tam ekrandan çık' : 'Tam ekran'}</span>`;
    };
    paint();
    this.repaintPause = paint;
    mute.addEventListener('click', () => { this.o.toggleMute(); paint(); });
    fs?.addEventListener('click', () => { this.o.toggleFs(); setTimeout(paint, 300); });
    if (T) {
      const seg = (attr, key, val) => this.root.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => {
        this.o.onTrainOpt(key, val(b));
        this.o.sfx.uiMove();
        this.root.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle('on', x === b));
      }));
      seg('data-shot', 'trainShot', (b) => b.dataset.shot);
      seg('data-nocd', 'trainNoCd', (b) => b.dataset.nocd === '1');
    }
    this.root.querySelector('[data-act="resume"]').focus({ preventScroll: true });
  }

  // ================================================================= MAÇ SONU
  showEnd({ winner, score, subtitle = '', stats = null, mode = '2p', classic = false, title = '' }) {
    const T = CONFIG.teams[winner];
    const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    const names = mode === '1p' ? ['Sen', 'Yapay zeka'] : [CONFIG.teams[0].name, CONFIG.teams[1].name];
    const row = (label, arr) => `<tr><th>${label}</th><td class="o">${arr[0]}</td><td class="b">${arr[1]}</td></tr>`;
    this.mount('end', `
      <div class="dialog end" style="--team:${T.css}">
        <div class="endTop">
          <div>
            <div class="headline">${title || `${T.name} kazandı`}</div>
            ${subtitle ? `<div class="supporting">${subtitle}</div>` : ''}
          </div>
          <div class="finalScore"><span class="o">${score[0]}</span><span class="sep">–</span><span class="b">${score[1]}</span></div>
        </div>
        ${stats ? `
        <table class="mstats">
          <thead><tr><th></th><td class="o">${names[0]}</td><td class="b">${names[1]}</td></tr></thead>
          <tbody>
            ${row('Smaç', stats.spikes)}
            ${row('Vuruş', stats.hits)}
            ${classic ? '' : row('Yetenek kullanımı', stats.abilities)}
          </tbody>
        </table>
        <div class="mfoot">En uzun ralli <b>${stats.longestRally} vuruş</b><span class="sp"></span>Süre <b>${fmt(stats.seconds)}</b></div>` : ''}
        <div class="dactions">
          <button data-nav data-act="quit" class="btn text">Ana menü</button>
          ${classic ? '' : '<button data-nav data-act="change" class="btn secondary">Karakter değiştir</button>'}
          <button data-nav data-act="rematch" class="btn primary">Tekrar oyna</button>
        </div>
      </div>`);
    this.root.querySelector('[data-act="rematch"]').addEventListener('click', () => { this.o.sfx.ui(); this.o.onRematch(); });
    this.root.querySelector('[data-act="change"]')?.addEventListener('click', () => { this.o.sfx.ui(); this.o.onChangeAbilities(); });
    this.root.querySelector('[data-act="quit"]').addEventListener('click', () => { this.o.sfx.ui(); this.o.onQuit(); });
    setTimeout(() => this.root.querySelector('[data-act="rematch"]')?.focus({ preventScroll: true }), 50);
  }

  // ================================================================= KLAVYE
  /** @returns true ise tuş menü tarafından kullanıldı */
  handleKey(code) {
    if (!this.screen) return false;
    if (this.screen === 'select') {
      const map = {
        KeyA: [0, 'L'], KeyD: [0, 'R'], KeyW: [0, 'OK'], KeyS: [0, 'BACK'], KeyR: [0, 'DICE'], ShiftRight: [1, 'DICE'],
        ArrowLeft: [1, 'L'], ArrowRight: [1, 'R'], ArrowUp: [1, 'OK'], Enter: [1, 'OK'], NumpadEnter: [1, 'OK'], ArrowDown: [1, 'BACK'],
      };
      let m = map[code];
      if (!m) return false;
      // Tek oyunculuda ok tuşları da insan oyuncuyu yönetsin
      if (this.sel.mode === '1p') m = [this.sel.players[0].ai ? 1 : 0, m[1]];
      const [p, act] = m;
      if (act === 'DICE') this.roll(p);
      else if (act === 'L') this.move(p, -1);
      else if (act === 'R') this.move(p, 1);
      else if (act === 'OK') this.confirm(p);
      else this.back(p);
      return true;
    }
    if (this.screen === 'vs' || this.screen === 'tsetup') return false;
    // Ses kaydırıcısı odaktaysa sol/sağ oklar değeri değiştirir
    if (document.activeElement?.type === 'range' && (code === 'ArrowLeft' || code === 'ArrowRight')) return false;
    // Diğer ekranlar: odak gezintisi
    const items = [...this.root.querySelectorAll('[data-nav]')];
    if (!items.length) return false;
    const i = items.indexOf(document.activeElement);
    if (NAV_PREV.has(code)) { (items[i - 1] || items[items.length - 1]).focus({ preventScroll: true }); this.o.sfx.uiMove(); return true; }
    if (NAV_NEXT.has(code)) { (items[i + 1] || items[0]).focus({ preventScroll: true }); this.o.sfx.uiMove(); return true; }
    if ((code === 'Enter' || code === 'Space' || code === 'NumpadEnter') && i < 0) { items[0].focus({ preventScroll: true }); return true; }
    return false;
  }
}
