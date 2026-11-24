// =============================================================================
//  mods.js — Parti modu kuralları. Fizik bu çarpanları okur; normal maçta hepsi 1.
//  Her sayıdan önce rastgele yeni bir kural seçilir (main.js → pickPartyRule).
// =============================================================================

/** Fiziğin okuduğu çarpanlar (normalde etkisiz). */
export const MODS = {
  ballGravity: 1,    // top yerçekimi
  blobGravity: 1,    // blob yerçekimi
  ballRadius: 1,     // top boyutu
  blobRadius: 1,     // blob boyutu
  jump: 1,           // zıplama yüksekliği
  hitSpeed: 1,       // vuruş hızı (ve hız sınırı)
  cooldown: 1,       // yetenek bekleme süresinin akış hızı (3 = 3 kat hızlı dolar)
  windX: 0,          // topa sürekli yatay ivme (px/s²)
  slippery: false,   // kaygan zemin: blob yavaş hızlanır, yavaş durur
};
const DEFAULTS = { ...MODS };

export function resetMods() {
  Object.assign(MODS, DEFAULTS);
}

/** Parti kuralları: ad, kısa açıklama, çarpanlar. */
export const PARTY_RULES = [
  { id: 'dusukYercekimi', name: 'Düşük Yerçekimi', desc: 'Her şey süzülüyor', set: { ballGravity: 0.55, blobGravity: 0.6 } },
  { id: 'devTop', name: 'Dev Top', desc: 'Top kocaman', set: { ballRadius: 1.55 } },
  { id: 'miniTop', name: 'Mini Top', desc: 'Top minicik ve hızlı', set: { ballRadius: 0.65, hitSpeed: 1.12 } },
  { id: 'devler', name: 'Devler', desc: 'Blob\'lar iri', set: { blobRadius: 1.28 } },
  { id: 'superZiplama', name: 'Süper Zıplama', desc: 'Herkes çok yükseğe zıplıyor', set: { jump: 1.55 } },
  { id: 'hizliTop', name: 'Hızlı Top', desc: 'Vuruşlar çok sert', set: { hitSpeed: 1.25 } },
  { id: 'agirTop', name: 'Ağır Top', desc: 'Top taş gibi düşüyor', set: { ballGravity: 1.45 } },
  { id: 'yetenekYagmuru', name: 'Yetenek Yağmuru', desc: 'Yetenekler 4 kat hızlı doluyor', set: { cooldown: 4 } },
  { id: 'firtina', name: 'Fırtına', desc: 'Rüzgâr topu savuruyor', set: {}, wind: true },
  { id: 'kayganZemin', name: 'Kaygan Zemin', desc: 'Buz pateni gibi', set: { slippery: true } },
];

/** Kuralı uygula (önce sıfırlar). Fırtınada rüzgâr yönü rastgele seçilir. @returns açıklama metni */
export function applyRule(rule) {
  resetMods();
  Object.assign(MODS, rule.set);
  if (rule.wind) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    MODS.windX = dir * 230;
    return `${rule.desc}: ${dir < 0 ? 'sola' : 'sağa'} esiyor`;
  }
  return rule.desc;
}
