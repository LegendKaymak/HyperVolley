// =============================================================================
//  tournament.js — Tek elemeli turnuva (2–8 oyuncu). Pixi'den ve DOM'dan bağımsız.
//
//  Katılımcı: { name, type: 'human' | 'kolay' | 'orta' | 'zor' | 'usta' }
//  Ağaç: rounds[r] = [{ a, b, winner, score }]
//    a / b: katılımcı indeksi, BYE (-1: rakipsiz tur atlama) ya da TBD (undefined: henüz belli değil)
// =============================================================================

export const BYE = -1;
const AI_STRENGTH = { kolay: 1, orta: 1.6, zor: 2.4, usta: 3.2 };

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class Tournament {
  /**
   * @param entrants [{ name, type }]
   * @param opts { shuffle: true }
   */
  constructor(entrants, opts = {}) {
    this.entrants = entrants.map((e, i) => ({ ...e, id: i }));
    const n = this.entrants.length;
    const size = n <= 2 ? 2 : n <= 4 ? 4 : 8;
    const order = opts.shuffle === false ? this.entrants.map((e) => e.id) : shuffle(this.entrants.map((e) => e.id));

    // İlk tur: rakipsiz kalanlar (BYE) ilk eşleşmelerin ikinci sırasına konur; iki BYE asla eşleşmez.
    const byes = size - n;
    const first = [];
    let k = 0;
    for (let m = 0; m < size / 2; m++) {
      const a = order[k++];
      const b = m < byes ? BYE : order[k++];
      first.push({ a, b, winner: undefined, score: null });
    }
    this.rounds = [first];
    for (let len = size / 4; len >= 1; len /= 2) {
      this.rounds.push(Array.from({ length: len }, () => ({ a: undefined, b: undefined, winner: undefined, score: null })));
    }
    this.resolveByes();
  }

  get roundCount() {
    return this.rounds.length;
  }

  /** Tur adı (son tur "Final"). */
  roundName(r) {
    const left = this.rounds.length - r;
    return left === 1 ? 'Final' : left === 2 ? 'Yarı final' : left === 3 ? 'Çeyrek final' : `${r + 1}. tur`;
  }

  /** Rakipsiz eşleşmeleri otomatik ilerlet. */
  resolveByes() {
    let changed = true;
    while (changed) {
      changed = false;
      this.rounds.forEach((round, r) => round.forEach((m, i) => {
        if (m.winner !== undefined) return;
        if (m.a !== undefined && m.b === BYE) { this.setWinner(r, i, m.a, null); changed = true; }
        else if (m.b !== undefined && m.a === BYE) { this.setWinner(r, i, m.b, null); changed = true; }
      }));
    }
  }

  setWinner(r, i, winner, score) {
    const m = this.rounds[r][i];
    m.winner = winner;
    m.score = score;
    if (r + 1 < this.rounds.length) {
      const next = this.rounds[r + 1][Math.floor(i / 2)];
      if (i % 2 === 0) next.a = winner; else next.b = winner;
    }
  }

  /** Sıradaki oynanacak maç: { r, i, match } ya da null (turnuva bitti). */
  nextMatch() {
    for (let r = 0; r < this.rounds.length; r++) {
      for (let i = 0; i < this.rounds[r].length; i++) {
        const m = this.rounds[r][i];
        if (m.winner === undefined && m.a >= 0 && m.b >= 0) return { r, i, match: m };
      }
    }
    return null;
  }

  /**
   * Maç sonucunu kaydet.
   * @param score [a'nın sayısı, b'nin sayısı]
   */
  report(r, i, score) {
    const m = this.rounds[r][i];
    const winner = score[0] > score[1] ? m.a : m.b;
    this.setWinner(r, i, winner, score);
    this.resolveByes();
  }

  get champion() {
    const final = this.rounds[this.rounds.length - 1][0];
    return final.winner !== undefined && final.winner >= 0 ? this.entrants[final.winner] : null;
  }

  get isOver() {
    return !!this.champion;
  }

  /** Bu maçtaki insan sayısı. */
  humansIn(m) {
    return [m.a, m.b].filter((id) => this.entrants[id].type === 'human').length;
  }
}

/**
 * İki yapay zeka arasındaki maçın hızlı sonucu: sayı sayı, zorluk gücüne göre olasılıkla.
 * (Tam fizik simülasyonu zayıf bilgisayarlarda saniyeler sürebilir; bu anlık.)
 */
export function quickResult(typeA, typeB, pointsToWin, winBy2) {
  const sa = AI_STRENGTH[typeA] || 1.6, sb = AI_STRENGTH[typeB] || 1.6;
  const pA = sa / (sa + sb);
  const s = [0, 0];
  for (let guard = 0; guard < 200; guard++) {
    s[Math.random() < pA ? 0 : 1]++;
    const lead = Math.abs(s[0] - s[1]);
    if (Math.max(...s) >= pointsToWin && (!winBy2 || lead >= 2)) break;
  }
  return s;
}
