// =============================================================================
//  stats.js — Maç içi istatistikler ve tarayıcıda saklanan kalıcı (kariyer) istatistikler.
// =============================================================================

/** Tek bir maçın istatistikleri. */
export class MatchStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.hits = [0, 0];        // topa dokunuşlar
    this.spikes = [0, 0];      // smaç: havadayken topu aşağı doğru hızlı gönderen vuruş
    this.abilities = [0, 0];   // aktif yetenek kullanımı
    this.rally = 0;            // şu anki rallideki vuruş sayısı
    this.longestRally = 0;
    this.seconds = 0;          // oynanan süre (sayı efektleri hariç)
  }

  onHit(team, isSpike) {
    this.hits[team]++;
    if (isSpike) this.spikes[team]++;
    this.rally++;
    this.longestRally = Math.max(this.longestRally, this.rally);
  }

  onAbility(team) {
    this.abilities[team]++;
  }

  onPoint() {
    this.rally = 0;
  }
}

const KEY = 'hv_career';
const blank = () => ({
  matches: 0,
  local: 0,                                        // 2 oyunculu maçlar
  ai: { kolay: { w: 0, l: 0 }, orta: { w: 0, l: 0 }, zor: { w: 0, l: 0 }, usta: { w: 0, l: 0 } },
  streak: 0, bestStreak: 0,                        // yapay zekaya karşı üst üste galibiyet
  longestRally: 0,
  spikes: 0,
  points: 0,
  seconds: 0,
  survivalBest: 0,                                 // hayatta kalma rekoru (sayı)
  survivalRuns: 0,
});

/** Kalıcı istatistikler (localStorage). */
export const Career = {
  data: blank(),

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d) this.data = { ...blank(), ...d, ai: { ...blank().ai, ...(d.ai || {}) } };
    } catch { this.data = blank(); }
    return this.data;
  },

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* yok say */ }
  },

  reset() {
    this.data = blank();
    this.save();
  },

  /** @param o { mode:'1p'|'2p', difficulty, winner, score:[a,b], stats:MatchStats } */
  recordMatch(o) {
    const d = this.data;
    d.matches++;
    d.longestRally = Math.max(d.longestRally, o.stats.longestRally);
    d.spikes += o.stats.spikes[0] + (o.mode === '2p' ? o.stats.spikes[1] : 0);
    d.points += o.score[0] + (o.mode === '2p' ? o.score[1] : 0);
    d.seconds += Math.round(o.stats.seconds);
    if (o.mode === '2p') {
      d.local++;
    } else {
      const rec = d.ai[o.difficulty] || (d.ai[o.difficulty] = { w: 0, l: 0 });
      if (o.winner === 0) {
        rec.w++;
        d.streak++;
        d.bestStreak = Math.max(d.bestStreak, d.streak);
      } else {
        rec.l++;
        d.streak = 0;
      }
    }
    this.save();
  },
};
