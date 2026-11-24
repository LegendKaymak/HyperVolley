// =============================================================================
//  i18n.js — Dil desteği (Türkçe / English). Ayarlar → Dil.
//
//  Kaynak dil Türkçe'dir; arayüz Türkçe yazılır. İngilizce seçiliyse:
//   - kod içindeki yazılar t('Türkçe metin', {değişkenler}) ile çevrilir,
//   - menülerin HTML'i ekrana konduktan sonra translateDom() metin düğümlerini ve
//     title / aria-label özniteliklerini sözlükten çevirir (menü kodunu sade tutar).
//  Sözlükte bulunmayan metin olduğu gibi (Türkçe) kalır.
//  Yetenek, Hyper, karakter tarzı, saha ve parti kuralı çevirileri kendi dosyalarında
//  tanımlanır ve register() ile buraya eklenir.
// =============================================================================

export const I18N = { lang: 'tr' };

export function setLang(lang) {
  I18N.lang = lang === 'en' ? 'en' : 'tr';
  if (typeof document !== 'undefined') document.documentElement.lang = I18N.lang;
}

const EN = new Map();
/** Kalıplı çeviriler (sayı, isim içeren metinler): [RegExp, İngilizce ($1, $2 ...)] */
const PATTERNS = [];

/** Sözlüğe ekle: { 'Türkçe': 'English' } */
export function register(pairs) {
  for (const [k, v] of Object.entries(pairs)) if (k && v) EN.set(k, v);
}
export function registerPattern(re, en) {
  PATTERNS.push([re, en]);
}

/** Çeviri. vars: {ad: değer} → metindeki {ad} yerine konur (önce çeviri, sonra yerleştirme). */
export function t(s, vars) {
  if (s == null) return s;
  let out = String(s);
  if (I18N.lang === 'en') out = translateText(out);
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return out;
}

function translateText(s) {
  const key = s.trim();
  if (!key) return s;
  const hit = EN.get(key);
  if (hit != null) return s.replace(key, hit);
  for (const [re, en] of PATTERNS) {
    if (re.test(key)) return s.replace(key, key.replace(re, (...m) => en.replace(/\$(\d)/g, (_, i) => translateText(m[+i] ?? ''))));
  }
  return s;
}

/** İki dilli kısa metin: L('G', 'W') — sözlüğe konamayacak kadar kısa/belirsiz metinler için. */
export const L = (tr, en) => (I18N.lang === 'en' ? en : tr);

/**
 * İngilizce'de DOM'u izle: menülere, bildirimlere, butonlara sonradan eklenen ya da
 * değişen her metni çevir. (Çevrilmiş metin sözlükte olmadığı için döngü oluşmaz.)
 */
export function watchDom(root = document.body) {
  if (I18N.lang !== 'en' || typeof MutationObserver === 'undefined') return;
  translateDom(root);
  const ATTRS = ['title', 'aria-label'];
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) translateDom(n);
          else if (n.nodeType === 3 && !n.parentElement?.closest('input, [data-noi18n]')) {
            const tr = translateText(n.nodeValue);
            if (tr !== n.nodeValue) n.nodeValue = tr;
          }
        });
      } else if (m.type === 'characterData') {
        const n = m.target;
        if (n.parentElement?.closest('[data-noi18n]')) continue;
        const tr = translateText(n.nodeValue);
        if (tr !== n.nodeValue) n.nodeValue = tr;
      } else if (m.type === 'attributes') {
        const v = m.target.getAttribute(m.attributeName);
        if (v) { const tr = translateText(v); if (tr !== v) m.target.setAttribute(m.attributeName, tr); }
      }
    }
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** Bir DOM ağacındaki metinleri ve title/aria-label özniteliklerini çevir (sadece İngilizce'de). */
export function translateDom(root) {
  if (I18N.lang !== 'en' || !root) return;
  if (root.closest?.('[data-noi18n]')) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const v = n.nodeValue;
    if (v && /\S/.test(v) && !n.parentElement?.closest('input, [data-noi18n]')) {
      const tr = translateText(v);
      if (tr !== v) n.nodeValue = tr;
    }
  }
  const els = [...(root.querySelectorAll?.('[title], [aria-label]') || [])];
  if (root.getAttribute) els.push(root);
  els.forEach((el) => {
    for (const a of ['title', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v) { const tr = translateText(v); if (tr !== v) el.setAttribute(a, tr); }
    }
  });
}
