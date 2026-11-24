// =============================================================================
//  keyboard.js — Tuş durumları (basılı tutma) + "yeni basıldı" kenar olayları.
//  e.code kullanılır → klavye düzeninden (Q/F, Türkçe) bağımsız fiziksel tuşlar.
// =============================================================================

const GAME_KEYS = new Set([
  'KeyA', 'KeyD', 'KeyW', 'KeyQ', 'KeyS',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'ShiftRight', 'Enter', 'NumpadEnter', 'Space',
]);

export class Keyboard {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();     // bu kareden beri yeni basılanlar
    this.listeners = [];
    window.addEventListener('keydown', (e) => {
      // Menülerdeki form öğelerine yazı yazılmıyor ama yine de odak butondaysa Space/Enter'ı bozmayalım
      const inInput = e.target instanceof HTMLInputElement;   // ses kaydırıcıları ok tuşlarını kullanır
      if (!inInput && GAME_KEYS.has(e.code) && !(e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter'))) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this.down.add(e.code);
        this.pressed.add(e.code);
        for (const fn of this.listeners) fn(e.code, e);
      }
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  onKey(fn) {
    this.listeners.push(fn);
  }

  isDown(code) {
    return this.down.has(code);
  }

  /** Kenar olayını tüket: basıldıysa true döner ve temizler. */
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  clearPressed() {
    this.pressed.clear();
  }
}

/** Varsayılan tuşlar (Ayarlar → Tuşlar ile değiştirilebilir). */
export const DEFAULT_KEYS = [
  { left: 'KeyA', right: 'KeyD', jump: 'KeyW', ability: 'KeyS' },
  { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', ability: 'ArrowDown' },
];
// Varsayılan tuşlara ek yedek tuşlar (sadece o eylem varsayılan tuşundayken geçerli)
const EXTRA = [
  { ability: ['KeyQ'] },
  { ability: ['ShiftRight', 'Enter', 'NumpadEnter'] },
];

/** Oyuncu tuş eşlemeleri (applyKeyBindings ile güncellenir) */
export const KEYMAP = [{}, {}];

/** Tuş kodundan kısa etiket: KeyS → S, ArrowDown → ↓, Digit1 → 1 ... */
export function keyLabel(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `N${code.slice(6).replace('Enter', '⏎')}`;
  const map = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Boşluk', Enter: 'Enter',
    ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'AltGr',
    Comma: ',', Period: '.', Slash: '/', Semicolon: 'Ş', Quote: 'İ', BracketLeft: 'Ğ', BracketRight: 'Ü', Backslash: ',', Minus: '*', Equal: '-',
    Backspace: '⌫', Tab: 'Tab', IntlBackslash: '<',
  };
  return map[code] || code;
}

/** Tuş atamalarını uygula. @param bindings [{left,right,jump,ability}, {...}] (eksikse varsayılan) */
export function applyKeyBindings(bindings) {
  for (let p = 0; p < 2; p++) {
    const b = { ...DEFAULT_KEYS[p], ...(bindings?.[p] || {}) };
    const m = KEYMAP[p];
    for (const act of ['left', 'right', 'jump', 'ability']) {
      const extra = b[act] === DEFAULT_KEYS[p][act] ? EXTRA[p][act] || [] : [];
      m[act] = [b[act], ...extra];
      for (const c of m[act]) GAME_KEYS.add(c);
    }
    m.label = keyLabel(b.ability);
  }
}
applyKeyBindings(null);
