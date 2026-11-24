// =============================================================================
//  lang/en.js — İngilizce çeviriler.
//   - UI: Türkçe metin → İngilizce sözlük ve sayı/isim içeren kalıplar (i18n.js)
//   - Veri: yetenek, Hyper, karakter tarzı, saha ve parti kuralı adları/açıklamaları
//     localizeData() ile yerinde İngilizceye çevrilir (dil değişince sayfa yeniden yüklenir).
// =============================================================================
import { CONFIG } from '../config.js';
import { register, registerPattern } from '../i18n.js';
import { ABILITIES } from '../game/abilities.js';
import { HYPERS } from '../game/hyper.js';
import { CHARACTERS } from '../game/characters.js';
import { PARTY_RULES } from '../game/mods.js';

const A = CONFIG.abilities;
const pct = (mul) => Math.round(Math.abs(mul - 1) * 100);

register({
  // --- genel
  'Tamam': 'OK', 'Geri': 'Back', 'Devam': 'Next', 'Başla': 'Start', 'Başlat': 'Start', 'Vazgeç': 'Cancel',
  'Ana menü': 'Main menu', 'Ayarlar': 'Settings', 'İstatistikler': 'Statistics', 'Sıfırla': 'Reset',
  'Emin misin? Tekrar bas': 'Are you sure? Press again', 'Devam et': 'Resume', 'Sıfırlansın mı?': 'Reset?', 'Hoş geldin': 'Welcome',
  'Yükleniyor…': 'Loading…', 'Daha iyi oynamak için telefonu yatay çevir': 'Rotate your phone to landscape for the best experience',
  'Duraklat (Esc)': 'Pause (Esc)', 'Duraklat': 'Pause', 'Ses aç/kapat (M)': 'Sound on/off (M)', 'Ses': 'Sound',
  'Tam ekran': 'Fullscreen', 'Tam ekrandan çık': 'Exit fullscreen', 'Ses kapalı': 'Sound off', 'Ses açık': 'Sound on',
  'Kolay': 'Easy', 'Orta': 'Medium', 'Zor': 'Hard', 'Usta': 'Master',
  'Sen': 'You', 'Yapay zeka': 'AI', 'YZ': 'AI', 'İnsan': 'Human', 'Sol': 'Left', 'Sağ': 'Right',
  'YZ Kolay': 'AI Easy', 'YZ Orta': 'AI Medium', 'YZ Zor': 'AI Hard', 'YZ Usta': 'AI Master',
  'Turuncu': 'Orange', 'Mavi': 'Blue',
  'Hazır': 'Ready', 'Top makinesi': 'Ball machine', 'VS': 'VS',

  // --- adımlar ve ana menü
  'Oyuncu': 'Players', 'Mod': 'Mode', 'Saha': 'Arena', 'Karakter': 'Character',
  '1 Oyuncu': '1 Player', '2 Oyuncu': '2 Players', '3–8 Oyuncu': '3–8 Players', 'Antrenman': 'Training', 'İzle': 'Watch',
  'Yapay zekaya karşı, hayatta kalma, zamana karşı': 'Versus AI, survival, time attack',
  'Karşılıklı ya da aynı takımda': 'Head to head or on the same team',
  'Turnuva ya da kral sahası, isimlerinizle': 'Tournament or king of the court, with your names',
  'Top makinesi, karakterleri dene': 'Ball machine, try the characters',
  'İki yapay zekayı izle, tahmin et': 'Watch two AIs, make a guess',

  // --- mod adımı
  'Maç': 'Match', 'Yapay zekaya karşı': 'Versus AI', 'Hayatta kalma': 'Survival', 'Zamana karşı': 'Time attack',
  'Süre bitince önde olan kazanır': 'Whoever leads when time runs out wins',
  'Karşılıklı': 'Head to head', 'Aynı cihazda birbirinize karşı': 'Against each other on one device',
  'İkiniz bir takım': 'Team up', 'Siz ikiniz, yapay zeka ikilisine karşı': 'You two against an AI pair',
  'Süreli karşılıklı maç': 'Timed head-to-head match',
  'Yapay zekaya ya da arkadaşına karşı': 'Versus the AI or a friend', '3–8 kişi, kazanan sahada kalır': '3–8 players, winner stays on',
  'Karşılıklı, aynı cihazda': 'Head to head, on one device', '2 Oyuncu · Aynı takım': '2 Players · Same team',
  'Kaç kişi oynayacak?': 'How many players?', 'İsimleri ayarlardan sonra yazacaksınız; istediğiniz yere yapay zeka koyabilirsiniz.': 'You\'ll type the names after the settings; you can put AI in any spot.',
  'Maç · 1 Oyuncu': 'Match · 1 Player', 'Maç · 2 Oyuncu': 'Match · 2 Players', 'Maç · Aynı takım': 'Match · Same team',
  'Zamana karşı · 1 Oyuncu': 'Time attack · 1 Player', 'Zamana karşı · 2 Oyuncu': 'Time attack · 2 Players',
  'Atış türü ve bekleme süresi maç içinde, duraklatma menüsünden ayarlanır.': 'Shot type and cooldown are set in game, from the pause menu.',
  '15+2 sayı, iki taraf 5 karakter yasaklar': '15+2 points, both sides ban 5 characters',
  'HyperMatch · 1 Oyuncu': 'HyperMatch · 1 Player', 'HyperMatch · 2 Oyuncu': 'HyperMatch · 2 Players',
  'Karakterli · 15 sayı + 2 fark · İki taraf da 5 karakter yasaklar': 'Characters · 15 points, win by 2 · Both sides ban 5 characters',
  'HyperMatch: karakterini seç': 'HyperMatch: choose your character', 'Yasaklar': 'Bans', 'Kapalı': 'Off',
  'Turnuva': 'Tournament', '2–8 kişi, eleme usulü': '2–8 players, knockout',
  'Kral sahası': 'King of the court', 'Kazanan sahada kalır, taçları ilk toplayan kral': 'Winner stays on, first to collect the crowns is king',
  'İki karakter seç, tahmin et, yapay zekalar oynasın': 'Pick two characters, guess, let the AIs play',
  'Kural': 'Rules', 'Karakterli': 'Characters', 'Klasik': 'Classic', 'Parti': 'Party', 'Kaos': 'Chaos',
  'Her karakterin pasif, aktif yeteneği ve Hyper\'ı var': 'Every character has a passive, an active and a Hyper',
  'Yetenek yok, saf Blobby voleybolu': 'No abilities, pure blob volleyball',
  'Her sayıda rastgele bir kural': 'A random rule every point',
  'Her sayıda karakterler rastgele değişir': 'Characters change randomly every point',
  'Takım': 'Team', '1\'e 1': '1 v 1', '2\'ye 2': '2 v 2', 'Her takıma yapay zeka bir arkadaş': 'An AI teammate for each side',
  'Rakip': 'Opponent', 'Zorluk': 'Difficulty', 'Süre': 'Time', 'Hedef': 'Target', '2 fark': 'Win by 2',
  'Kazanmak için 2 sayı fark gerekir': 'You must win by 2 points', 'Taç': 'Crowns',
  'Saha seç': 'Choose arena', 'Oyuncuları gir': 'Enter players', 'Karakter seç': 'Choose characters',
  'Plaj': 'Beach', 'Gün Batımı': 'Sunset', 'Kar Tepesi': 'Snowy Peak', 'Spor Salonu': 'Gym',

  // --- istatistikler
  'maç': 'matches', 'en uzun ralli': 'longest rally', 'smaç': 'spikes', 'en uzun galibiyet serisi': 'longest win streak',
  'sayı': 'points', 'oyun süresi': 'play time', 'Oran': 'Rate',

  // --- ayarlar
  'Efektleri azalt': 'Reduce effects', 'Daha az parçacık, sarsıntı ve flaş': 'Fewer particles, less shake and flash',
  'Sayı tekrarı': 'Point replay', 'Her sayıdan sonra son 2 saniye': 'The last 2 seconds after every point',
  'Karakter yasaklama': 'Character bans', 'Seçimden önce herkes bir karakter yasaklar': 'Everyone bans one character before picking',
  'Grafik': 'Graphics', 'Kasarsa Düşük': 'Choose Low if it stutters', 'Otomatik': 'Auto', 'Yüksek': 'High', 'Düşük': 'Low', 'En düşük': 'Lowest',
  'Efekt sesi': 'Effects volume', 'Seyirci sesi': 'Crowd volume',
  'Kontroller': 'Controls', 'Tuş atama, oyun kolu, dokunmatik butonlar': 'Key bindings, gamepad, touch buttons',
  'Dil': 'Language', 'Dil değişince oyun yeniden yüklenir': 'The game reloads when the language changes',
  'FPS göstergesi': 'FPS counter', 'Köşede küçük kare hızı yazısı': 'Small frame rate text in the corner',

  // --- kontroller
  'Zıpla': 'Jump', 'Yetenek': 'Ability', 'Bağlı': 'Connected', 'Bağlı değil': 'Not connected', 'Oyun kolu:': 'Gamepad:',
  'Tuşa tıkla, yeni tuşa bas (Esc vazgeçer). Kol: çubuk hareket, A zıpla, X/B yetenek, Start duraklat.':
    'Click a key, then press the new key (Esc cancels). Gamepad: stick moves, A jumps, X/B ability, Start pauses.',
  'Dokunmatik butonlar': 'Touch buttons', 'Telefon ve tablet': 'Phone and tablet', 'Küçük': 'Small', 'Büyük': 'Large',
  'Buton saydamlığı': 'Button opacity', 'Varsayılan tuşlar': 'Default keys', 'Tuşa bas…': 'Press a key…',
  'Boşluk': 'Space', 'Sağ Shift': 'Right Shift', 'Sol Shift': 'Left Shift',

  // --- eski mod penceresi ve tahmin
  'Modlar': 'Modes', 'İzleme': 'Watch', '2 oyuncu': '2 players',
  '5 canın var; rakip her 3 sayında güçlenir ve karakter değiştirir. Rekor:': 'You have 5 lives; every 3 points the opponent gets stronger and switches character. Best:',
  'Süre bitince önde olan kazanır; eşitlikte altın sayı.': 'Whoever leads when time runs out wins; a tie goes to a golden point.',
  'İki karakter seç, tahmin et, yapay zekalar oynasın.': 'Pick two characters, guess, let the AIs play.',
  'Kim kazanır?': 'Who will win?', 'Tahminini yap, maç sonunda tuttu mu görürsün.': 'Make your guess; you\'ll see if you were right at the end.',
  'Tahmin yok': 'No guess',

  // --- karakter seçimi
  'Karakterini seç': 'Choose your character', 'Antrenman: karakterini seç': 'Training: choose your character',
  'İzle: iki karakter seç': 'Watch: choose two characters', 'Hayatta kalma: karakterini seç': 'Survival: choose your character',
  'İkiniz bir takım: karakterlerinizi seçin': 'Team up: choose your characters',
  'Yasakla: rakibin alamayacağı bir karakter seç': 'Ban: choose a character your opponent can\'t take',
  'Seç': 'Pick', 'Bekliyor': 'Waiting', 'Yasakla': 'Ban', 'Yasaklı': 'Banned', 'Yasak': 'Banned', 'Rakipte': 'Taken',
  'Sen seçince seçecek': 'Picks after you', 'Rastgele karakter': 'Random character',
  'gez': 'browse', 'seç': 'pick', 'geri': 'back', 'zar': 'dice',
  'Pasif': 'Passive', 'Aktif': 'Active', 'PASİF': 'PASSIVE',

  // --- turnuva / kral sahası
  '3–8 oyuncu. Kazanan sahada kalır ve taç kazanır, kaybeden sıranın sonuna geçer.':
    '3–8 players. The winner stays on and earns a crown; the loser goes to the back of the queue.',
  '2–8 oyuncu. İsimleri yazın; eksik kalan yerlere yapay zeka ekleyebilirsiniz. Eşleşmeler rastgele.':
    '2–8 players. Type the names; you can fill empty spots with AI. Pairings are random.',
  'Turnuvayı başlat': 'Start tournament', 'Oyuncu ekle': 'Add player', 'İnsan ya da yapay zeka': 'Human or AI', 'Çıkar': 'Remove',
  'Mod ekranından değiştirilebilir.': 'Can be changed on the mode screen.',
  'Maça başla': 'Start match', 'Hızlı sonuç': 'Quick result', 'Yeni turnuva': 'New tournament', 'Bay': 'Bye',
  'Kralı gör': 'See the king', 'Şampiyonu gör': 'See the champion', 'Sıraya dön': 'Back to queue', 'Ağaca dön': 'Back to bracket',
  'Sıra': 'Queue', 'Şampiyon': 'Champion', 'Kral': 'King', 'Final': 'Final', 'Yarı final': 'Semi-final', 'Çeyrek final': 'Quarter-final',

  // --- duraklatma / maç sonu
  'Duraklatıldı': 'Paused', 'Atış': 'Shots', 'Karışık': 'Mixed', 'Sert': 'Hard', 'File önü': 'Net drops', 'Derin': 'Deep',
  'Normal bekleme': 'Normal cooldown', 'Beklemesiz': 'No cooldown',
  'hareket': 'move', 'zıpla': 'jump', 'yetenek': 'ability', 'duraklat': 'pause', 'ses': 'sound',
  'Smaç': 'Spike', 'Vuruş': 'Hit', 'Yetenek kullanımı': 'Abilities used', 'En uzun ralli': 'Longest rally',
  'Karakter değiştir': 'Change character', 'Tekrar oyna': 'Play again', 'Hayatta kalma bitti': 'Survival over',
  'Yapay zeka maçı': 'AI match', 'Tahminin tuttu!': 'Your guess was right!', 'Tahminin tutmadı.': 'Your guess was wrong.',
  'Yeni rekor!': 'New record!',

  // --- maç içi
  'HYPER HAZIR': 'HYPER READY',
  'SAYI!': 'POINT!', 'Kalan süre': 'Time left', 'Altın sayı': 'Golden point', 'Son sayı': 'Last point',
  'Seviye atladın': 'Level up', 'Karakterler değişti': 'Characters changed', 'Canın bitti': 'Out of lives',
  'Eşitlik! Altın sayı: sonraki sayıyı alan kazanır': 'Tie! Golden point: next point wins',
  'Süre doldu: altın sayı!': 'Time\'s up: golden point!', 'Süre doldu: bu ralli son sayı': 'Time\'s up: this rally is the last point',
  'İsabet · Kaçan': 'Hits · Misses', 'Atlamak için Boşluk tuşuna bas veya dokun': 'Press Space or tap to skip',
  'Oyun başlatılamadı:': 'The game could not start:',
});

const P = registerPattern;
P(/^(\d+)\. (Oyuncu|Mod|Saha|Karakter|Ayarlar)$/, '$1. $2');
P(/^Oyuncu (\d+)$/, 'Player $1');
P(/^Yasakla \((\d+)\/(\d+)\): rakibin alamayacağı bir karakter seç$/, 'Ban ($1/$2): choose a character your opponent can\'t take');
P(/^YZ (\d+)$/, 'AI $1');
P(/^Oyuncu 1 \+ 2 \((.+)\)$/, 'Players 1 + 2 ($1)');
P(/^Yapay zeka \((.+)\)$/, 'AI ($1)');
P(/^\+ (.+)$/, '+ $1');
P(/^(\d+) maç oynandı · Hayatta kalma rekoru (\d+)$/, '$1 matches played · Survival best $2');
P(/^(\d+) maç oynandı$/, '$1 matches played');
P(/^Hoş geldin · Hayatta kalma rekoru (\d+)$/, 'Welcome · Survival best $1');
P(/^5 can, rakip giderek güçlenir · rekor (\d+)$/, '5 lives, the opponent keeps getting stronger · best $1');
P(/^Devam eden turnuva: (.+)$/, 'Tournament in progress: $1');
P(/^(\d+)\. tur$/, 'Round $1');
P(/^(\d+) sa (\d+) dk$/, '$1 h $2 min');
P(/^(\d+) dk$/, '$1 min');
P(/^(\d+) sayı$/, '$1 points');
P(/^(\d+) vuruş$/, '$1 hits');
P(/^(\d+) taç$/, '$1 crowns');
P(/^(\d+)\/(\d+) galibiyet$/, '$1/$2 wins');
P(/^([\s\S]*) \((\d+) sn\)$/, '$1 ($2 s)');
P(/^Rastgele karakter \((.+)\)$/, 'Random character ($1)');
P(/^(\d+)\. oyuncunun adı$/, 'Player $1 name');
P(/^Her maç (\d+) sayı(.*)$/, 'Every match to $1$2');
P(/^, 2 fark$/, ', win by 2');
P(/^(\d+) oyuncu, maçlar (\d+) sayı \(2 fark\)$/, '$1 players, matches to $2 (win by 2)');
P(/^(\d+) oyuncu, maçlar (\d+) sayı$/, '$1 players, matches to $2');
P(/^(\d+) taç alan kral olur · maçlar (\d+) sayı \(2 fark\)$/, 'First to $1 crowns is king · matches to $2 (win by 2)');
P(/^(\d+) taç alan kral olur · maçlar (\d+) sayı$/, 'First to $1 crowns is king · matches to $2');
P(/^(.+) kral oldu$/, '$1 is the king');
P(/^(.+) sahada kalıyor$/, '$1 stays on court');
P(/^(.+) turnuvayı kazandı$/, '$1 wins the tournament');
P(/^(.+) turu geçti$/, '$1 advances');
P(/^(.+) - (.+), en uzun ralli (\d+) vuruş$/, '$1 - $2, longest rally $3 hits');
P(/^(.+) maçı kazandı!$/, '$1 wins the match!');
P(/^(.+) kazandı$/, '$1 wins');
P(/^Hedef (.+)$/, 'Target $1');
P(/^Seri (\d+)(\s+·\s+)Rekor (\d+)$/, 'Streak $1$2Best $3');
P(/^Can (\d+) · Seviye (\d+)$/, 'Lives $1 · Level $2');
P(/^Seviye (\d+)$/, 'Level $1');
P(/^Rakip: (Kolay|Orta|Zor|Usta)(.*)$/, 'Opponent: $1$2');
P(/^(\d+) sayı · Seviye (\d+) · (.+)$/, '$1 points · Level $2 · $3');
P(/^Rekor: (\d+)$/, 'Best: $1');
P(/^Yapay zekayı \((.+)\) yendin\.$/, 'You beat the AI ($1).');
P(/^Yapay zeka \((.+)\) bu sefer kazandı\.$/, 'The AI ($1) won this time.');
P(/^Oyun kolu bağlandı: Oyuncu (\d+)$/, 'Gamepad connected: Player $1');
P(/^Oyun kolu ayrıldı: Oyuncu (\d+)$/, 'Gamepad disconnected: Player $1');
P(/^(.+) \+1, rakip 3 dokunuş hakkını aştı$/, '$1 +1, the opponent used more than 3 touches');
P(/^Can kaybettin, (\d+) can kaldı$/, 'Life lost, $1 left');
P(/^(\d+) sayı, seviye atladın!$/, '$1 points, level up!');
P(/^(.+): sola esiyor$/, '$1: blowing left');
P(/^(.+): sağa esiyor$/, '$1: blowing right');
P(/^SERİ ×(\d+)$/, 'STREAK ×$1');
P(/^(.+) \+1$/, '$1 +1');
P(/^Tekrar (.+)x$/, 'Replay $1x');

// ----------------------------------------------------------------- veri
const ABILITY_EN = {
  zipir: ['Bouncy', `${pct(A.zipir.jumpHeightMul)}% higher jumps`],
  hizliAyaklar: ['Quick Feet', `${pct(A.hizliAyaklar.speedMul)}% faster movement`],
  yumusakDokunus: ['Soft Touch', `Slows a hard ball by ${Math.round(A.yumusakDokunus.damping * 100)}% on the first touch`],
  devBlob: ['Giant Blob', `${pct(A.devBlob.radiusMul)}% bigger, ${pct(A.devBlob.speedMul)}% slower`],
  sertVurus: ['Hard Hitter', `Hits are ${pct(A.sertVurus.hitMul)}% stronger`],
  suzulme: ['Glide', 'Hold jump to fall slowly'],
  ciftZiplama: ['Double Jump', 'Jump once more while falling'],
  zirve: ['Summit', `Both speed and jump +${pct(A.zirve.speedMul)}%`],
  isinlanma: ['Teleport', 'Instant short teleport in the direction you face'],
  roketZiplama: ['Rocket Jump', 'Instantly jump very high from the ground'],
  agirTop: ['Heavy Ball', `The ball gets heavy for ${A.agirTop.duration} s and drops fast`],
  kalkan: ['Shield', 'Bounces back a ball landing on your side once'],
  falso: ['Curveball', 'The next hit curves in the air'],
  gucVurusu: ['Power Shot', `Next hit is ${pct(A.gucVurusu.speedMul)}% stronger`],
  havaAtilmasi: ['Air Dash', 'Horizontal dash in the air'],
  miknatis: ['Magnet', `Pulls the ball toward you for ${A.miknatis.duration} s`],
  yavasZaman: ['Slow Time', `The ball slows down for ${A.yavasZaman.duration} s`],
  sersemlet: ['Daze', `The opponent moves slowly for ${A.sersemlet.duration} s`],
  sisme: ['Inflate', `Grows ${pct(A.sisme.radiusMul)}% bigger for ${A.sisme.duration} s`],
  tuyTop: ['Feather Ball', `The ball gets light for ${A.tuyTop.duration} s and falls slowly`],
  turbo: ['Turbo', `Runs ${pct(A.turbo.speedMul)}% faster for ${A.turbo.duration} s`],
  sasirt: ['Confuse', `The opponent's left and right flip for ${A.sasirt.duration} s`],
  kucult: ['Shrink', `The opponent shrinks for ${A.kucult.duration} s`],
  onsezi: ['Foresight', 'Teleports under where the ball will land'],
  kesikTop: ['Chop Shot', 'Kills the ball\'s horizontal speed so it drops straight'],
  deprem: ['Quake', 'A grounded opponent is shaken and thrown up'],
  karaDelik: ['Black Hole', `The ball is pulled to the middle of the opponent's court for ${A.karaDelik.duration} s`],
  ikinciSans: ['Second Chance', 'Gives your team back 1 touch'],
  ayna: ['Mirror', 'Instantly reverses the ball\'s direction'],
  dorukAtagi: ['Peak Strike', `Leaps high, next hit is ${pct(A.dorukAtagi.speedMul)}% stronger`],
  ruzgar: ['Gust', `The ball is blown toward the opponent's court for ${A.ruzgar.duration} s`],
  yakala: ['Catch', `Catches the next ball and throws it after ${A.yakala.hold} s`],
  hayalTop: ['Illusion Ball', 'A fake ball, identical to the real one, flies another way'],
  ejderNefesi: ['Dragon Breath', 'Blows a nearby ball over the net with fire (saves balls you can\'t reach)'],
  uyustur: ['Numb', `Opponent hits are ${Math.round((1 - A.uyustur.hitMul) * 100)}% weaker for ${A.uyustur.duration} s`],
  gokAskisi: ['Sky Hold', `The ball hangs in the air for ${A.gokAskisi.duration} s (buys time for a ball you can't reach)`],
  arindir: ['Purify', `Clears every effect on the ball and your team, slows the ball by ${Math.round((1 - A.arindir.slowMul) * 100)}%`],
  yuksekNota: ['High Note', 'A sound wave pops a nearby ball on your side straight up (saves a falling ball)'],
  kutsama: ['Blessing', `For ${A.kutsama.duration} s: faster, higher jumps, harder hits, immune to negative effects`],
  korTop: ['Ember Ball', `The ball glows for ${A.korTop.duration} s: the opponent's first touch counts as two`],
  hatVurusu: ['Line Drive', 'Next hit flies dead straight for a moment, ignoring gravity'],
  kokSal: ['Take Root', `The opponent can't jump for ${A.kokSal.duration} s`],
  kisaDevre: ['Short Circuit', `The opponent's active goes on full cooldown, their Hyper bar drops ${Math.round(A.kisaDevre.meterCut * 100)}%`],
  firtinaDarbesi: ['Storm Blast', 'Blows the opponent back away from the net'],
};

const STYLE_EN = {
  'Hücumcu': 'Attacker', 'Kontrolcü': 'Controller', 'Akrobat': 'Acrobat', 'Hilekâr': 'Trickster', 'Savunmacı': 'Defender',
  'Pasör': 'Setter', 'Bombacı': 'Bomber', 'Ninja': 'Ninja', 'Uçan': 'Flyer', 'Duvar': 'Wall', 'Bozucu': 'Disruptor',
  'Taktisyen': 'Tactician', 'Tank': 'Tank', 'Çevik': 'Agile', 'Sürat': 'Speedster', 'Aldatıcı': 'Deceiver', 'Büyücü': 'Sorcerer',
  'Okuyucu': 'Reader', 'Keskin': 'Sharp', 'Dev': 'Giant', 'Yıldız': 'Star', 'Kurtarıcı': 'Rescuer', 'Kaleci': 'Keeper', 'Efsane': 'Legend',
  'Avcı': 'Hunter', 'İllüzyonist': 'Illusionist', 'Yıkıcı': 'Destroyer', 'Zehirli': 'Venomous', 'Ezici': 'Crusher', 'Taşıyıcı': 'Bearer', 'Şifacı': 'Healer', 'Solist': 'Soloist', 'Kızgın': 'Scorcher', 'Nişancı': 'Marksman', 'Köklü': 'Rooted', 'Sabotajcı': 'Saboteur',
};

const RULE_EN = {
  dusukYercekimi: ['Low Gravity', 'Everything floats'],
  devTop: ['Giant Ball', 'The ball is huge'],
  miniTop: ['Mini Ball', 'Tiny, fast ball'],
  devler: ['Giants', 'Blobs are huge'],
  superZiplama: ['Super Jump', 'Everyone jumps really high'],
  hizliTop: ['Fast Ball', 'Hits are very hard'],
  agirTop: ['Heavy Ball', 'The ball drops like a stone'],
  yetenekYagmuru: ['Ability Rain', 'Abilities recharge 4 times faster'],
  firtina: ['Storm', 'Wind blows the ball around'],
  kayganZemin: ['Slippery Floor', 'Like ice skating'],
};

const ARENA_EN = { plaj: 'Beach', gunbatimi: 'Sunset', kar: 'Snowy Peak', salon: 'Gym' };

/** İngilizce seçiliyse oyun verisindeki adları/açıklamaları çevir (bir kez, açılışta). */
export function localizeData() {
  for (const a of ABILITIES) {
    const e = ABILITY_EN[a.id];
    if (e) { a.name = e[0]; a.desc = e[1]; }
  }
  for (const h of Object.values(HYPERS)) if (h.en) { h.name = h.en.name; h.desc = h.en.desc; }
  for (const c of CHARACTERS) c.style = STYLE_EN[c.style] || c.style;
  for (const r of PARTY_RULES) { const e = RULE_EN[r.id]; if (e) { r.name = e[0]; r.desc = e[1]; } }
  for (const ar of CONFIG.arenas) ar.name = ARENA_EN[ar.id] || ar.name;
}
