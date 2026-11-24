// =============================================================================
//  characters.js — Karakterler. Her karakterin kendi rengi, bir pasif ve bir aktif
//  yeteneği vardır (yetenek kimlikleri abilities.js'teki tanımlara bağlanır).
//  Maçta seçilen karakterin rengi o tarafın "takım rengi" olur (skor, efektler, HUD).
// =============================================================================
import { CONFIG } from '../config.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const lum = (c) => (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
// ui: yazı ve koyu yazılı düğmeler için okunur renk (çok koyu karakterlerde açık tonu kullanılır)
const mk = (id, name, color, dark, light, passive, active, style, hyper) =>
  ({ id, name, color, dark, light, css: hex(color), ui: hex(lum(color) < 0.42 ? light : color), passive, active, style, hyper });

// Kimlikler (id) kayıtlı verilerle uyum için sabit kalır; ekranda görünen ad "name"dir.
export const CHARACTERS = [
  mk('alev',     'Volkan',    0xff8a1f, 0xc85a00, 0xffc27a, 'hizliAyaklar',   'gucVurusu',    'Hücumcu', 'lavYagmuru'),
  mk('dalga',    'Tufan',     0x2f8dff, 0x1556c0, 0x9cc9ff, 'hizliAyaklar',   'yavasZaman',   'Kontrolcü', 'zamanDurdur'),
  mk('yosun',    'Atmaca',    0x34c46a, 0x1d8445, 0x9ff0bd, 'zipir',          'havaAtilmasi', 'Akrobat', 'pike'),
  mk('ametist',  'Ametist',   0xa46bff, 0x6a3bc4, 0xd8c2ff, 'hizliAyaklar',   'falso',        'Hilekâr', 'buyuluKivrim'),
  mk('mercan',   'Hisar',     0xef4a5a, 0xa8202f, 0xffb3ba, 'devBlob',        'kalkan',       'Savunmacı', 'kaleDuvari'),
  mk('limon',    'Kehribar',  0xf2c930, 0xb08a00, 0xfff0a6, 'zipir',          'miknatis',     'Pasör', 'superMiknatis'),
  mk('kaya',     'Granit',    0x8f949e, 0x575c66, 0xd3d7de, 'sertVurus',      'agirTop',      'Bombacı', 'gokTasi'),
  mk('golge',    'Kuzgun',    0x5a5f8c, 0x33365a, 0xb4b8e6, 'hizliAyaklar',   'isinlanma',    'Ninja', 'golgeAdimi'),
  mk('seker',    'Meteor',    0xff6fb5, 0xc23b80, 0xffc4e1, 'suzulme',        'roketZiplama', 'Uçan', 'yildizSicrayisi'),
  mk('buz',      'Ayaz',      0x46d3df, 0x168f9a, 0xb8f4f8, 'hizliAyaklar',   'kalkan',       'Duvar', 'buzDevri'),
  mk('komur',    'Kâbus',     0x454852, 0x1f2126, 0xa3a8b3, 'devBlob',        'sersemlet',    'Bozucu', 'kabus'),
  mk('esinti',   'Poyraz',    0xa6d63c, 0x6b9416, 0xdcf5a0, 'zipir',          'ruzgar',       'Taktisyen', 'kasirga'),
  mk('tarcin',   'Tunç',      0xb8733d, 0x7a4519, 0xe8b98f, 'sertVurus',      'sisme',        'Tank', 'devTunc'),
  mk('pamuk',    'Bulut',     0xe8e4da, 0x9c968a, 0xffffff, 'hizliAyaklar',   'tuyTop',       'Çevik', 'bulutYastigi'),
  mk('yildirim', 'Yıldırım',  0x9fd2ff, 0x4f8ccc, 0xdcefff, 'zipir',          'turbo',        'Sürat', 'isikHizi'),
  mk('sis',      'Sis',       0x139e8f, 0x0b6359, 0x8ee0d4, 'suzulme',        'sasirt',       'Aldatıcı', 'sisPerdesi'),
  mk('efsun',    'Cadı',      0xd62f9c, 0x8e1566, 0xf5a3d8, 'suzulme',        'kucult',       'Büyücü', 'lanet'),
  mk('kahin',    'Kâhin',     0x2c4aa6, 0x182a66, 0x9fb3ee, 'zipir',          'onsezi',       'Okuyucu', 'kehanet'),
  mk('ustura',   'Ustura',    0x9b2242, 0x5e1026, 0xe58ba3, 'sertVurus',      'kesikTop',     'Keskin', 'keskinKesim'),
  mk('kolos',    'Titan',     0x8b8f3c, 0x565a1f, 0xd4d79a, 'devBlob',        'deprem',       'Dev', 'yerSarsintisi'),
  mk('nova',     'Nova',      0xff8f6b, 0xc4502d, 0xffc9b5, 'hizliAyaklar',   'karaDelik',    'Yıldız', 'supernova'),
  mk('yesim',    'Yeşim',     0x6fe0b0, 0x2f9a6e, 0xc4f7e0, 'yumusakDokunus', 'ikinciSans',   'Kurtarıcı', 'yenilenme'),
  mk('zirh',     'Zırh',      0x4f7f9a, 0x2b4f63, 0xa9cde0, 'devBlob',        'ayna',         'Kaleci', 'aynaZirh'),
  mk('zenith',   'Zenith',    0xffb627, 0xb8740a, 0xffe3a3, 'zirve',          'dorukAtagi',   'Efsane', 'zirveFormu'),
  mk('pars',     'Pars',      0xc9a66b, 0x8a6a35, 0xf0dab0, 'ciftZiplama',    'yakala',       'Avcı', 'avPencesi'),
  mk('serap',    'Phantom',   0x8a7dff, 0x5246c4, 0xcfc9ff, 'suzulme',        'hayalTop',     'İllüzyonist', 'aynalarSalonu'),
  mk('ejder',    'Ejder',     0x0f7a46, 0x084a2a, 0x7fd9a8, 'sertVurus',      'ejderNefesi',  'Yıkıcı', 'alevFirtinasi'),
  mk('akrep',    'Akrep',     0x5c2a7a, 0x381848, 0xc39ad8, 'zipir',          'uyustur',      'Zehirli', 'zehir'),
  mk('atlas',    'Atlas',     0x0e8fa8, 0x075a6b, 0x86dbe8, 'hizliAyaklar',   'gokAskisi',    'Taşıyıcı', 'gokKilidi'),
  mk('cura',     'Cura',      0xffe9a8, 0xc9a85a, 0xfff6d6, 'sertVurus',      'kutsama',         'Şifacı', 'kutsalAlan'),
  mk('diva',     'Diva',      0xff4f79, 0xb82a4d, 0xffc0cf, 'hizliAyaklar',   'yuksekNota',   'Solist', 'finalSahnesi'),
  mk('kor',      'Kor',       0xd9431e, 0x8f2408, 0xffb199, 'sertVurus',      'korTop',       'Kızgın', 'kizginTop'),
  mk('mizrak',   'Mızrak',    0xa9b8c6, 0x66788a, 0xe6edf3, 'zipir',          'hatVurusu',    'Nişancı', 'yildirimMizragi'),
  mk('cinar',    'Diken',     0x4c7a2a, 0x2c4d14, 0xb7d99a, 'devBlob',        'kokSal',       'Köklü', 'derinKok'),
  mk('kivilcim', 'Kıvılcım',  0xfff23d, 0xb8aa00, 0xfffbb8, 'hizliAyaklar',   'kisaDevre',    'Sabotajcı', 'karartma'),
  mk('bora',     'Bora',      0x4a63c9, 0x2a3d8a, 0xb3c1f5, 'devBlob',        'firtinaDarbesi', 'Ezici', 'karaBora'),
];

export const getCharacter = (id) => CHARACTERS.find((c) => c.id === id) || null;

// Menüdeki gösteri maçı ve Klasik mod için varsayılan görünüm (turuncu ve mavi)
const DEFAULT_LOOK = CONFIG.teams.map((t) => ({ ...t }));

/**
 * Bir tarafın görünümünü (renk, ad) karaktere göre ayarlar. CONFIG.teams nesnesi
 * yerinde değiştirilir; çizim kodu renkleri her karede oradan okur.
 * CSS'teki --p0 / --p1 değişkenleri de güncellenir (menüler, dokunmatik butonlar).
 */
export function setTeamLook(team, char) {
  const src = char || DEFAULT_LOOK[team];
  Object.assign(CONFIG.teams[team], {
    name: src.name, color: src.color, dark: src.dark, light: src.light, css: src.ui || src.css,
  });
  if (typeof document !== 'undefined') document.documentElement.style.setProperty(`--p${team}`, src.ui || src.css);
}

export function resetTeamLooks() {
  setTeamLook(0, null);
  setTeamLook(1, null);
}
