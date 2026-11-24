// =============================================================================
//  gamepad.js — Oyun kolu desteği (Gamepad API, "standard" eşleme: Xbox / PlayStation).
//
//  Maçta:   sol çubuk ya da yön tuşları = hareket, A / ✕ = zıpla,
//           X / □, B / ○ ya da RB / R1 = yetenek, Start / Options = duraklat.
//  Menüde:  yön tuşları / sol çubuk = gezinti, A = seç, B = geri.
//  Bağlanan ilk kol Oyuncu 1'e, ikinci kol Oyuncu 2'ye atanır.
//  Tarayıcı kolları ancak bir tuşa basıldıktan sonra gösterir (güvenlik gereği).
// =============================================================================

const DEAD = 0.35;          // çubuk ölü bölgesi
const REPEAT_DELAY = 0.38;  // menüde basılı tutunca tekrar
const REPEAT_RATE = 0.12;

// standard eşleme tuş indeksleri
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export class Gamepads {
  constructor() {
    this.supported = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
    /** Oyuncu başına durum: [P1, P2] */
    this.state = [0, 1].map(() => ({ connected: false, left: false, right: false, jump: false, ability: false, id: '' }));
    this.prev = [[], []];          // önceki karenin tuşları (kenar algılama için)
    this.navHeld = [{}, {}];       // menü yönlerinin basılı tutulma süreleri
    this.onNav = null;             // (player, action) — action: up/down/left/right/ok/back/pause
    this.onConnect = null;         // (player, connected, id)
    this.slots = [null, null];     // oyuncu → kol indeksi
    if (this.supported) {
      window.addEventListener('gamepadconnected', (e) => this.assign(e.gamepad, true));
      window.addEventListener('gamepaddisconnected', (e) => this.assign(e.gamepad, false));
    }
  }

  assign(pad, connected) {
    if (connected) {
      if (this.slots.includes(pad.index)) return;
      const p = this.slots.indexOf(null);
      if (p < 0) return;
      this.slots[p] = pad.index;
      this.state[p].connected = true;
      this.state[p].id = pad.id;
      this.onConnect?.(p, true, pad.id);
    } else {
      const p = this.slots.indexOf(pad.index);
      if (p < 0) return;
      this.slots[p] = null;
      Object.assign(this.state[p], { connected: false, left: false, right: false, jump: false, ability: false });
      this.onConnect?.(p, false, pad.id);
    }
  }

  get any() {
    return this.state[0].connected || this.state[1].connected;
  }

  /** Her karede bir kez çağrılır. */
  poll(dt) {
    if (!this.supported) return;
    const pads = navigator.getGamepads();
    // Olay gelmeden görünen kollar (bazı tarayıcılar) için de ata
    for (const pad of pads) if (pad && pad.connected && !this.slots.includes(pad.index)) this.assign(pad, true);
    for (let p = 0; p < 2; p++) {
      const idx = this.slots[p];
      const pad = idx == null ? null : pads[idx];
      const s = this.state[p];
      if (!pad) { s.left = s.right = s.jump = false; continue; }
      const btn = (i) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      s.left = btn(B.LEFT) || ax < -DEAD;
      s.right = btn(B.RIGHT) || ax > DEAD;
      s.jump = btn(B.A) || btn(B.UP) || ay < -0.75;
      // Yetenek ve menü tuşları kenar olayı (yeni basıldıysa)
      const prev = this.prev[p];
      const edge = (i) => btn(i) && !prev[i];
      if (edge(B.X) || edge(B.B) || edge(B.RB) || edge(B.RT) || edge(B.Y)) s.ability = true;
      if (edge(B.START)) this.onNav?.(p, 'pause');
      if (edge(B.A)) this.onNav?.(p, 'ok');
      if (edge(B.B) || edge(B.BACK)) this.onNav?.(p, 'back');
      // Menü yönleri: basılı tutunca tekrarlı
      const dirs = {
        up: btn(B.UP) || ay < -0.6, down: btn(B.DOWN) || ay > 0.6,
        left: btn(B.LEFT) || ax < -0.6, right: btn(B.RIGHT) || ax > 0.6,
      };
      const held = this.navHeld[p];
      for (const [d, on] of Object.entries(dirs)) {
        if (!on) { held[d] = 0; continue; }
        const t0 = held[d] || 0;
        const t1 = t0 + dt;
        if (t0 === 0 || (t1 > REPEAT_DELAY && Math.floor((t1 - REPEAT_DELAY) / REPEAT_RATE) !== Math.floor((t0 - REPEAT_DELAY) / REPEAT_RATE))) {
          this.onNav?.(p, d);
        }
        held[d] = t1 || 1e-6;
      }
      for (let i = 0; i < pad.buttons.length; i++) prev[i] = btn(i);
    }
  }

  /** Yetenek kenar olayını tüket. */
  consumeAbility(p) {
    const s = this.state[p];
    const v = s.ability;
    s.ability = false;
    return v;
  }

  clearEdges() {
    for (const s of this.state) s.ability = false;
  }

  /** Kısa titreşim (destekleyen kollarda). */
  rumble(p, strong = 0.4, ms = 80) {
    if (!this.supported) return;
    const idx = this.slots[p];
    const pad = idx == null ? null : navigator.getGamepads()[idx];
    pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong * 0.6 }).catch?.(() => {});
  }
}
