import { icon } from '../ui/icons.js';

// =============================================================================
//  touch.js — Mobil dokunmatik butonlar (ekranın iki yanında).
//  1 Oyuncu: sol tarafta sol/sağ, sağ tarafta zıpla + yetenek
//  2 Oyuncu: sol küme Oyuncu 1, sağ küme Oyuncu 2
//  Çoklu dokunuş desteklenir (her buton kendi pointer'ını yakalar).
// =============================================================================

export const isTouchDevice = () =>
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

export class TouchControls {
  constructor(root) {
    this.root = root;
    this.state = [this.blank(), this.blank()];
    this.edges = [{ ability: false }, { ability: false }];
    this.enabled = isTouchDevice();
    this.mode = '1p';
    this.visible = false;
    this.reserve = { l: 0, r: 0 };   // ekranın iki yanında butonlar için ayrılması gereken genişlik (px)
    this.btn = TouchControls.BTN;    // buton boyutu (Ayarlar → Dokunmatik butonlar)
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  static BTN = 58;
  static SIZES = { kucuk: 50, orta: 58, buyuk: 68 };

  /** Buton boyutu ve saydamlığı (Ayarlar). Görünüm CSS değişkenleriyle değişir. */
  setLook(size = 'orta', alpha = 1) {
    this.btn = TouchControls.SIZES[size] || TouchControls.BTN;
    document.documentElement.style.setProperty('--tb', `${this.btn}px`);
    document.documentElement.style.setProperty('--tbB', `${Math.round(this.btn * 1.1)}px`);
    document.documentElement.style.setProperty('--tbAlpha', String(alpha));
    if (this.lastBuild) this.build(...this.lastBuild);
    if (this.lastShown) this.onVisibility?.(true);   // yan sütun genişliği değişti: yerleşimi yenile
  }

  static GAP = 8;
  static MARGIN = 6;

  blank() {
    return { left: false, right: false, jump: false, ability: false };
  }

  build(mode, classic = false) {
    this.lastBuild = [mode, classic];
    this.mode = mode;
    this.root.innerHTML = '';
    this.state = [this.blank(), this.blank()];
    if (!this.enabled || mode === 'ai') return;   // iki yapay zeka: buton yok

    const cluster = (side, shape, buttons) => {
      const c = document.createElement('div');
      c.className = `tcluster ${side} ${shape}`;
      for (const [player, action, label] of buttons) {
        const b = document.createElement('button');
        b.className = `tbtn t-${action} p${player}`;
        if (shape === 'grid' && classic && action === 'jump') b.classList.add('wide');   // klasik 2P: zıpla üstte tam genişlik
        b.innerHTML = icon(label, 28);
        b.setAttribute('aria-label', action);
        const set = (v) => (e) => {
          e.preventDefault();
          if (v) {
            b.setPointerCapture?.(e.pointerId);
            if (action === 'ability' && !this.state[player].ability) this.edges[player].ability = true;
          }
          this.state[player][action] = v;
          b.classList.toggle('on', v);
        };
        b.addEventListener('pointerdown', set(true));
        b.addEventListener('pointerup', set(false));
        b.addEventListener('pointercancel', set(false));
        b.addEventListener('lostpointercapture', set(false));
        c.appendChild(b);
      }
      this.root.appendChild(c);
    };

    // Kümeler olabildiğince dar tutulur ki oyun alanı büyük kalsın:
    //   1P: solda ◀ ▶ yan yana, sağda yetenek üstte / zıpla altta (tek sütun)
    //   2P: her iki yanda 2x2 (üstte zıpla + yetenek, altta ◀ ▶)
    const B = this.btn, G = TouchControls.GAP, M = TouchControls.MARGIN;
    if (mode === '2p') {
      const set = (p) => [...(classic ? [] : [[p, 'ability', 'bolt']]), [p, 'jump', 'up'], [p, 'left', 'left'], [p, 'right', 'right']];
      cluster('left', 'grid', set(0));
      cluster('right', 'grid', set(1));
      this.reserve = { l: B * 2 + G + M * 2, r: B * 2 + G + M * 2 };
    } else {
      cluster('left', 'row', [[0, 'left', 'left'], [0, 'right', 'right']]);
      cluster('right', 'col', classic ? [[0, 'jump', 'up']] : [[0, 'ability', 'bolt'], [0, 'jump', 'up']]);
      this.reserve = { l: B * 2 + G + M * 2, r: B + M * 2 };
    }
    this.setVisible(this.visible);
  }

  setVisible(v) {
    this.visible = v;
    const shown = v && this.enabled && this.mode !== 'ai';
    this.root.classList.toggle('show', shown);
    if (this.lastShown !== shown) { this.lastShown = shown; this.onVisibility?.(shown); }
    if (!v) this.state = [this.blank(), this.blank()];
  }

  consumeAbility(player) {
    const e = this.edges[player].ability;
    this.edges[player].ability = false;
    return e;
  }

  clearEdges() {
    this.edges[0].ability = this.edges[1].ability = false;
  }
}
