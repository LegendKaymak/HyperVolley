// =============================================================================
//  rules.js — Maç kuralları: 3 dokunuş hakkı, sayı, servis, seri, 5/10/15'te bitiş (isteğe bağlı 2 fark).
// =============================================================================
import { CONFIG } from '../config.js';
import { sideOfX } from './physics.js';

export class Match {
  constructor() {
    this.reset(0);
  }

  /**
   * @param serving  servis atan takım
   * @param format   { pointsToWin, winBy2 } — menüden seçilen maç formatı
   */
  reset(serving = 0, format = {}) {
    this.pointsToWin = format.pointsToWin || CONFIG.rules.pointsToWin;
    this.winBy2 = !!format.winBy2;
    this.score = [0, 0];
    this.touches = [0, 0];     // Takımların o anki dokunuş sayısı
    this.lastTouchTeam = -1;   // Topa en son dokunan takım (aynı sahada kaldığı sürece)
    this.serving = serving;    // Servis atan takım
    this.streakTeam = -1;
    this.streak = 0;
    this.winner = -1;
  }

  /**
   * Bir takımın topa dokunuşunu kaydeder.
   * @returns {{count:number, first:boolean, fault:boolean}}
   *   first = takımın bu "topa sahip olma"sındaki ilk dokunuş (Yumuşak Dokunuş için)
   *   fault = 4. dokunuş → hata, sayı rakibe
   */
  registerTouch(team) {
    if (this.lastTouchTeam !== team) this.touches[team] = 0;
    this.touches[1 - team] = 0;
    this.touches[team]++;
    this.lastTouchTeam = team;
    const count = this.touches[team];
    return { count, first: count === 1, fault: count > CONFIG.rules.maxTouches };
  }

  /** Top fileyi geçtiğinde, terk ettiği takımın dokunuş sayacı sıfırlanır. */
  onCross(fromTeam) {
    this.touches[fromTeam] = 0;
    this.lastTouchTeam = -1;
  }

  /** Top yere değdiğinde sayıyı kazanan takım: topun düşmediği taraf. */
  scorerForGround(x) {
    return 1 - sideOfX(x);
  }

  /**
   * Sayıyı işler. Servis, sayıyı alan takıma geçer.
   * @returns {{team, streak, isMatchWin, score}}
   */
  awardPoint(team) {
    this.score[team]++;
    if (this.streakTeam === team) this.streak++;
    else { this.streakTeam = team; this.streak = 1; }
    this.serving = team;
    this.touches = [0, 0];
    this.lastTouchTeam = -1;
    // Hedef sayıya ulaşan kazanır; "2 fark" açıksa rakipten en az 2 önde olmalı.
    const lead = this.score[team] - this.score[1 - team];
    if (this.score[team] >= this.pointsToWin && (!this.winBy2 || lead >= 2)) this.winner = team;
    return {
      team,
      streak: this.streak,
      isMatchWin: this.winner === team,
      score: [...this.score],
    };
  }

  get isOver() {
    return this.winner !== -1;
  }
}
