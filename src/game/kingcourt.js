// =============================================================================
//  kingcourt.js — Kral sahası: 3–8 kişi. Sahada "kral" ve bir rakip oynar; kazanan
//  sahada kalır ve bir taç kazanır, kaybeden sıranın sonuna geçer. Belirlenen taç
//  sayısına ilk ulaşan kral olur. Katılımcı: { name, type: 'human' | 'kolay' | ... }
// =============================================================================

export class KingCourt {
  /** @param entrants [{name,type}]  @param crownsToWin kazanmak için gereken taç */
  constructor(entrants, crownsToWin = 3) {
    this.entrants = entrants.map((e, i) => ({ ...e, id: i, crowns: 0, played: 0, won: 0 }));
    this.crownsToWin = crownsToWin;
    // Sıra rastgele; ilk iki kişi ilk maçı oynar (ilki "kral" sayılır)
    this.queue = this.entrants.map((e) => e.id).sort(() => Math.random() - 0.5);
    this.king = this.queue.shift();
    this.history = [];   // { a, b, score, winner }
    this.championId = -1;
  }

  /** Sıradaki maç: [kral, rakip] */
  nextMatch() {
    if (this.isOver) return null;
    return { a: this.king, b: this.queue[0] };
  }

  /** @param score [kral, rakip] */
  report(score) {
    const m = this.nextMatch();
    if (!m) return;
    const winner = score[0] > score[1] ? m.a : m.b;
    const loser = winner === m.a ? m.b : m.a;
    this.queue.shift();
    this.queue.push(loser);
    this.king = winner;
    const W = this.entrants[winner];
    W.crowns++; W.won++;
    W.played++; this.entrants[loser].played++;
    this.history.push({ a: m.a, b: m.b, score, winner });
    if (W.crowns >= this.crownsToWin) this.championId = winner;
  }

  get isOver() {
    return this.championId >= 0;
  }

  get champion() {
    return this.isOver ? this.entrants[this.championId] : null;
  }

  humansIn(m) {
    return [m.a, m.b].filter((id) => this.entrants[id].type === 'human').length;
  }
}
