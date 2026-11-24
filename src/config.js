// =============================================================================
//  config.js — TÜM sabitler ve balans değerleri burada.
//  Oyunun hissini değiştirmek için başka dosyaya dokunmanız gerekmez.
//  Birimler: piksel (sanal 800x450 ekranda), saniye, piksel/saniye.
// =============================================================================

export const CONFIG = {
  // Sanal çözünürlük: her şey bu koordinatlarda hesaplanır, ekrana letterbox ile ölçeklenir.
  width: 800,
  height: 450,

  // ---------------------------------------------------------------------------
  // Döngü / fizik zaman adımı
  // ---------------------------------------------------------------------------
  physics: {
    step: 1 / 60,          // Sabit fizik adımı (60 Hz). Asla değişmez; slow-motion bunu DEĞİL, birikeni ölçekler.
    maxStepsPerFrame: 5,   // Bir karede en fazla kaç fizik adımı (sekme arka plandan dönünce "ölüm sarmalı"nı önler).
    ballSubsteps: 2,       // Top her adımda kaç alt adımda ilerletilsin (hızlı topun direkten geçmesini önler).
  },

  // ---------------------------------------------------------------------------
  // Saha
  // ---------------------------------------------------------------------------
  world: {
    groundY: 400,       // Blob'ların bastığı ve topun "yere değdiği" çizgi.
    sandTopY: 372,      // Kumun görsel başlangıcı (sadece çizim).
    ceilingY: 0,        // Tavan (top buradan seker).
    netX: 400,          // File direğinin x'i.
    netHalfWidth: 5,    // Direğin yarı kalınlığı.
    netTopY: 262,       // Direğin üst ucundaki yuvarlak başlığın merkezi.
    netCapRadius: 9,    // Yuvarlak üst ucun yarıçapı.
  },

  // ---------------------------------------------------------------------------
  // Blob (oyuncu)
  // ---------------------------------------------------------------------------
  blob: {
    radius: 32,                 // Yarım genişlik. Gövde, Blobby Volley'deki gibi iki daireden oluşur:
    bodyY: 0.8, bodyR: 0.92,    //   gövde dairesi: merkez tabandan 0.8r yukarıda, yarıçap 0.92r
    headY: 1.72, headR: 0.66,   //   baş dairesi:   merkez tabandan 1.72r yukarıda, yarıçap 0.66r (toplam boy ≈ 2.4r)
    moveSpeed: 300,             // Yatay hız.
    jumpVelocity: 760,          // Zıplama başlangıç hızı.
    gravity: 1800,              // Blob yerçekimi.
    jumpReleaseGravityMul: 1.7, // Zıplama tuşu bırakılınca yükselirken ekstra yerçekimi (değişken zıplama yüksekliği).
    startX: [200, 600],         // Takımların başlangıç x konumları.
  },

  // ---------------------------------------------------------------------------
  // Top
  // ---------------------------------------------------------------------------
  ball: {
    radius: 20,
    gravity: 820,
    airDrag: 0.1,               // Saniye başına hız kaybı oranı (hafif hava sürtünmesi).
    maxSpeed: 880,              // Hız sınırı.
    hitSpeed: 600,              // Blob'a çarpınca normal doğrultusunda verilen sabit hız (klasik Blobby hissi).
    blobVelocityInfluence: 0.3, // Blob'un kendi hızının topa aktarılan payı.
    minOutwardSpeed: 280,       // Çarpışmadan sonra normal yönünde en az bu hız (topun blob'a yapışmasını önler).
    wallRestitution: 0.9,
    ceilingRestitution: 0.75,
    netRestitution: 0.8,
    serveX: [200, 600],         // Servis topunun doğduğu x (takıma göre).
    serveY: 228,                // Servis topunun havada beklediği yükseklik (Blobby Volley oranı: küçük bir zıplamayla vurulur).
    hoverTimeout: 5,            // Servis topu bu kadar saniye dokunulmazsa kendiliğinden düşer.
  },

  // ---------------------------------------------------------------------------
  // Kurallar
  // ---------------------------------------------------------------------------
  rules: {
    pointsToWin: 15,
    maxTouches: 3,        // Bir takımın topu karşıya geçirmek için hakkı. 4. dokunuş = hata.
    touchLockTime: 0.18,  // Aynı blob'un art arda çarpışmalarının tek dokunuş sayıldığı süre.
  },

  // HYPER: her karakterin kendine özel güçlendirmesi (game/hyper.js). Blob'un kendi barı
  // kendi vuruşlarıyla dolar; dolduğu vuruşta Hyper kendiliğinden başlar. Bar sayılar arasında korunur.
  hyper: {
    perHit: 0.06,          // blob'un her vuruşunda dolan miktar (1 = dolu)
    rallyBonus: 0.03,      // ralli 6. vuruşu geçince vuruş başına ek
    diveTime: 0.9,         // "dalış" etkili Hyper'larda topun ağır düştüğü süre (sn)
    diveGravity: 1.3,      // dalış sırasında top yerçekimi çarpanı
    speedCap: 1.65,        // dalış sırasında hız sınırı çarpanı
  },


  // ---------------------------------------------------------------------------
  // Yetenekler (balans). Açıklamalar abilities.js'te bu değerlerden üretilir.
  // ---------------------------------------------------------------------------
  abilities: {
    // Pasifler
    zipir: { jumpHeightMul: 1.12 },               // Zıplama YÜKSEKLİĞİ çarpanı (hız √çarpan ile ölçeklenir).
    hizliAyaklar: { speedMul: 1.1 },
    yumusakDokunus: { damping: 0.2, minIncoming: 560 }, // Sert gelen topu (hızı > minIncoming) takımın ilk dokunuşunda bu oranda yavaşlatır.
    devBlob: { radiusMul: 1.1, speedMul: 0.95 },
    sertVurus: { hitMul: 1.06 },                     // Vuruşlar %6 daha güçlü.
    suzulme: { fallGravityMul: 0.45 },               // Düşerken zıplama tuşu basılıysa yerçekimi %55 azalır.
    ciftZiplama: { secondJumpMul: 0.6, minFall: 0 },  // Havada 2. zıplama: hız ilkinin %60'ı (yükseklik ≈ %36). Sadece düşerken kullanılır.
    // Aktifler
    isinlanma: { cooldown: 8, distance: 130 },                  // Baktığın yöne anında kısa ışınlanma (yerde de olur).
    roketZiplama: { cooldown: 8, jumpMul: 1.32 },               // Yerdeyken anında güçlü zıplama.
    agirTop: { cooldown: 14, duration: 1.5, gravityMul: 1.45 },   // Top bir süre ağırlaşır, hızlı düşer.
    kalkan: { cooldown: 13, duration: 5, bounceSpeed: 640 },   // Süre içinde kendi sahana düşen topu bir kez yukarı sektirir.
    falso: { cooldown: 8, window: 3, spin: 0.6, spinTime: 1.2 }, // Sonraki vuruş topa falso verir: top havada aşağı kıvrılır.
    gucVurusu: { cooldown: 23, window: 3, speedMul: 1.45, fireTime: 1.2, boostTime: 0.8 },
    havaAtilmasi: { cooldown: 9, dashSpeed: 720, dashTime: 0.17 },
    miknatis: { cooldown: 9, duration: 1, radius: 230, strength: 900 },
    yavasZaman: { cooldown: 15, duration: 1.2, ballTimeScale: 0.65 },
    sersemlet: { cooldown: 15, duration: 1.5, speedMul: 0.6, jumpMul: 0.8 },   // Rakip kısa süre ağırlaşır.
    ruzgar: { cooldown: 19, duration: 1.0, accel: 320 },                       // Top rakip sahaya doğru itilir (px/s²).
    sisme: { cooldown: 16, duration: 4, radiusMul: 1.3 },                      // Blob kısa süre büyür (daha geniş vuruş/blok alanı).
    tuyTop: { cooldown: 14, duration: 1.6, gravityMul: 0.45 },                 // Top hafifler, yavaş düşer (yetişmek kolaylaşır).
    turbo: { cooldown: 14, duration: 3, speedMul: 1.45 },                      // Kısa süre çok hızlı koşma.
    sasirt: { cooldown: 24, duration: 0.9 },                                   // Rakibin sol/sağ yönleri ters döner.
    kucult: { cooldown: 13, duration: 5, radiusMul: 0.78 },                    // Rakip küçülür (vuruş alanı daralır).
    onsezi: { cooldown: 10 },                                                  // Topun düşeceği yerin altına ışınlanma.
    kesikTop: { cooldown: 13, vxMul: 0.25 },                                    // Topun yatay hızı anında kesilir, top dik düşer.
    deprem: { cooldown: 17, liftMul: 0.55 },
    karaDelik: { cooldown: 15, duration: 1.1, strength: 560 },                 // Top rakip sahanın ortasına doğru çekilir (px/s²).
    ikinciSans: { cooldown: 18 },                                              // Takımın dokunuş sayısından 1 geri alınır.
    ayna: { cooldown: 23 },                                                    // Topun yatay yönü anında tersine döner.
    // Zenith'e özel (biraz daha güçlü ama abartısız)
    zirve: { speedMul: 1.12, jumpHeightMul: 1.12 },                            // Pasif: hem hız hem zıplama %12 fazla.
    dorukAtagi: { cooldown: 11, jumpMul: 1.18, window: 1.8, speedMul: 1.35 },  // Aktif: yüksek zıplama + sonraki vuruş %35 güçlü.
    yakala: { cooldown: 18, window: 2.4, hold: 0.4, throwVx: 450, throwVy: 615 }, // Sonraki top yakalanır, 0.4 sn sonra rakibe fırlatılır.
    hayalTop: { cooldown: 22, life: 2.2 },                                     // Gerçeğinden ayırt edilemeyen sahte top (farklı yöne gider).
    ejderNefesi: { cooldown: 23, range: 165, vx: 400, vy: 620, fireTime: 0.8 },// Yakındaki topu ateşle rakip sahaya üfler.
    uyustur: { cooldown: 24, duration: 2.5, hitMul: 0.89 },                      // Rakibin vuruşları kısa süre zayıflar.
    kutsama: { cooldown: 13, duration: 5, speedMul: 1.22, jumpMul: 1.15, hitMul: 1.1 },   // Cura: kısa süre hızlı, yüksek, sert; olumsuz etkilerden etkilenmez.
    korTop: { cooldown: 16, duration: 4 },                                     // Kor: rakibin topa ilk dokunuşu 2 dokunuş sayılır.
    hatVurusu: { cooldown: 13, window: 2.5, line: 0.42, speedMul: 1.08 },      // Mızrak: sonraki vuruş kısa süre dümdüz gider.
    kokSal: { cooldown: 15, duration: 2.5 },                                   // Diken: rakip zıplayamaz.
    kisaDevre: { cooldown: 18, meterCut: 0.35 },                               // Kıvılcım: rakibin yeteneği beklemeye girer, Hyper barı azalır.
    arindir: { cooldown: 15, slowMul: 0.75 },                                   // Topun ve kendi takımının üzerindeki etkileri siler, topu yavaşlatır.
    yuksekNota: { cooldown: 14, range: 210, lift: 620 },                       // Yakındaki topu ses dalgasıyla dikine havaya kaldırır.
    gokAskisi: { cooldown: 14, duration: 1.0 },                                // Top kısa süre havada asılı kalır.
    firtinaDarbesi: { cooldown: 19, knockVx: 720, knockTime: 0.35, hop: 380 }, // Rakip fileden geriye savrulur.
  },

  // ---------------------------------------------------------------------------
  // Yapay zeka zorlukları
  // ---------------------------------------------------------------------------
  ai: {
    // (Kolay, Orta ve Zor güçlendirildi: yeni Zor = eski Usta. Usta zaten tavandaydı; daha hızlı tepki
    //  ya da sıfır hata simülasyonda fayda etmedi, hatta zarar verdi.)
    kolay: { reaction: 0.19, error: 22, moveMul: 0.88, jumpSkill: 0.74, spike: 0.25, abilityChance: 0.3 },
    orta:  { reaction: 0.07, error: 7, moveMul: 1.0, jumpSkill: 0.95, spike: 0.65, abilityChance: 0.65 },
    zor:   { reaction: 0.025, error: 1.5, moveMul: 1.0, jumpSkill: 1.0, spike: 0.95, abilityChance: 1.0, smart: true },
    // Usta: neredeyse hatasız; vuruşlarını rakibin yetişme süresini hesaplayarak seçer (smart)
    usta:  { reaction: 0.022, error: 1, moveMul: 1.0, jumpSkill: 1.0, spike: 0.95, abilityChance: 1.0, smart: true, elite: 2 },
  },

  // ---------------------------------------------------------------------------
  // SAYI EFEKTİ (Rocket League tarzı gol patlaması) — tüm süreler ms
  // ---------------------------------------------------------------------------
  goalFx: {
    hitStopMs: 80,          // Tam donma süresi.
    slowScale: 0.25,        // Slow-motion hız çarpanı.
    slowMs: 700,            // Slow-motion süresi.
    recoverMs: 350,         // 0.25x → 1x yumuşak dönüş süresi.
    matchPointMul: 1.5,     // Maç sayısında efekt büyüklüğü çarpanı.
    matchPointSlowMul: 1.6, // Maç sayısında slow-motion süre çarpanı.
    streakThreshold: 3,     // Kaç üst üste sayıdan sonra "SERİ!".
    streakMul: 1.35,        // Seri sırasında efekt büyüklüğü çarpanı.

    sparks: 160,            // Kıvılcım sayısı (150+).
    dust: 26,               // Toz/kum bulutu parçacıkları.
    debris: 22,             // Dönen enkaz parçaları.
    confettiRain: 70,       // Yukarıdan yağan konfeti.
    confettiCannon: 40,     // Her bir yan konfeti topundan çıkan konfeti.
    shockwaves: [           // Kademeli şok dalgaları: gecikme(ms), yarıçap, kalınlık, süre(ms)
      { delay: 0, radius: 190, width: 14, dur: 520 },
      { delay: 90, radius: 270, width: 9, dur: 640 },
      { delay: 180, radius: 350, width: 5, dur: 760 },
    ],

    shakeTrauma: 0.85,      // Screen shake "travma" başlangıcı (0-1).
    shakeMaxOffset: 22,     // En güçlü sarsıntıda piksel kayması.
    shakeDecay: 1.5,        // Travmanın saniyede azalma hızı.
    zoom: 1.12,             // Patlama noktasına zoom.
    zoomInMs: 250, zoomHoldMs: 400, zoomOutMs: 650,
    chromaticPx: 7,         // RGB ayrışmasının piksel cinsinden başlangıcı.
    chromaticMs: 420,
    flashAlpha: 0.85,       // Beyaz ekran flaşı.
    flashMs: 260,
    tintAlpha: 0.35,        // Arka planın takım rengine tonlanması.
    tintMs: 1000,
    bloomScale: 1.0,        // Bloom (pixi-filters AdvancedBloomFilter) en yüksek değeri.
    bloomMs: 900,

    textDelayMs: 300,       // "SAYI!" yazısının gelişi.
    textHoldMs: 1200,       // Yazının ekranda durma süresi (sonra büyüyüp solar).
    scorePopDelayMs: 500,   // Skor tabelası pop + flip.
    countdownDelayMs: 1500, // 3-2-1 geri sayımının başlangıcı (tekrar kapalıysa).
    countdownStepMs: 420,   // Her rakamın süresi.
    matchEndDelayMs: 2600,  // Maçı bitiren sayıdan sonra kazanan ekranı.
  },

  // ---------------------------------------------------------------------------
  // Tekrar (replay)
  // ---------------------------------------------------------------------------
  replay: {
    enabled: true,    // Varsayılan; menüdeki "Tekrar" ayarı bunu ezer.
    seconds: 2,       // Kaydedilen son saniye.
    speed: 0.5,       // Oynatma hızı.
    startDelayMs: 1500,
  },

  // ---------------------------------------------------------------------------
  // Genel efektler / performans
  // ---------------------------------------------------------------------------
  effects: {
    particleCapacity: 1400,     // Object pool boyutu.
    reducedParticleMul: 0.35,   // "Efektleri azalt" açıkken.
    reducedShakeMul: 0.45,
    hitSparks: 10,              // Her vuruşta küçük patlama.
    trailMinSpeed: 470,         // Bu hızın üstünde topun arkasında iz.
    trailLength: 12,
    // Grafik kalitesi seviyeleri. "Otomatik"te masaüstü yüksek, dokunmatik cihazlar orta başlar;
    // kare hızı düşük kalırsa oyun kendiliğinden bir alt seviyeye iner.
    //   maxRes: çizim çözünürlüğü üst sınırı (ekran pikseli / oyun pikseli)
    //   filters: bloom ve RGB ayrışma filtreleri   particles: parçacık çarpanı
    quality: {
      yuksek: { maxRes: 2.5, filters: true,  particles: 1 },
      orta:   { maxRes: 1.5, filters: false, particles: 0.55 },
      dusuk:  { maxRes: 1,   filters: false, particles: 0.3 },
      enDusuk:{ maxRes: 0.75, filters: false, particles: 0.18 },   // ekran kartı zayıf ya da yazılımsal çizim (ör. eski PC'ler)
    },
    autoDowngradeMs: 22,        // 2 sn boyunca ortalama kare süresi bunun üstündeyse kalite düşer (≈45 FPS altı)
  },

  // ---------------------------------------------------------------------------
  // Arenalar (sadece görünüm; fizik her arenada aynıdır → balans bozulmaz)
  //  sky: gökyüzü gradyanı [üst, ufuk]   water: deniz/göl [üst, alt] ya da null
  //  ground: zemin gradyanı              backdrop: 'islands' | 'mountains' | 'hall'
  //  thumb: menüdeki önizleme kartının CSS gradyanı
  // ---------------------------------------------------------------------------
  arenas: [
    {
      id: 'plaj', name: 'Plaj', backdrop: 'islands',
      sky: [0x2f86dd, 0xd3f1ff], water: [0x45c3e0, 0x1a8bbd], foam: true,
      sun: { x: 650, y: 85, r: 30, color: 0xfff8dc, glow: 0xfff0a8 },
      far: [0x7db6c4, 0x8cc2cf], palms: 0x4f7a64,
      ground: [0xf8dfa6, 0xe2b66b], speck: [0xc99a52, 0xfff3d1], line: 0xffffff,
      clouds: 0xffffff, dust: 0xecd29a,
      thumb: 'linear-gradient(#3b8fe0 0%, #c9ecff 52%, #2aa6cf 53%, #2aa6cf 66%, #f3d79c 67%)',
    },
    {
      id: 'gunbatimi', name: 'Gün Batımı', backdrop: 'islands',
      sky: [0x2b2357, 0xff9b63], water: [0xd9767a, 0x3a2b63], foam: true,
      sun: { x: 540, y: 278, r: 48, color: 0xffd9a8, glow: 0xff7b47 },
      far: [0x4a2f5c, 0x5c3b6a], palms: 0x2e1d3d,
      ground: [0xe9b182, 0xb4724c], speck: [0x8f5537, 0xffd9b3], line: 0xfff0e0,
      clouds: 0xffb59a, dust: 0xe4a87c,
      thumb: 'linear-gradient(#2b2357 0%, #ff9b63 52%, #b35f73 53%, #4a3266 66%, #e1a678 67%)',
    },
    {
      id: 'kar', name: 'Kar Tepesi', backdrop: 'mountains', snow: true,
      sky: [0x6f9ccf, 0xe8f2fc], water: null,
      sun: { x: 140, y: 78, r: 22, color: 0xffffff, glow: 0xdcecff },
      far: [0x9db6d4, 0xc0d3e8], palms: 0x3d5a55,
      ground: [0xf6f9fd, 0xcbdcee], speck: [0xaac2dc, 0xffffff], line: 0x5d8fc9,
      clouds: 0xffffff, dust: 0xffffff,
      thumb: 'linear-gradient(#6f9ccf 0%, #e8f2fc 55%, #f6f9fd 67%, #cbdcee 100%)',
    },
    {
      id: 'salon', name: 'Spor Salonu', backdrop: 'hall',
      sky: [0x1e2530, 0x3a4554], water: null,
      sun: null, far: [0x2a323e, 0x343e4c], palms: 0,
      ground: [0xdba46c, 0xa86f3f], speck: [0x8e5a30, 0xf0c79a], line: 0xffffff,
      clouds: null, dust: 0xd9c3a3,
      thumb: 'linear-gradient(#1e2530 0%, #3a4554 66%, #dba46c 67%, #a86f3f 100%)',
    },
  ],

  // ---------------------------------------------------------------------------
  // Takımlar
  // ---------------------------------------------------------------------------
  teams: [
    { name: 'Turuncu', color: 0xff8a1f, dark: 0xc85a00, light: 0xffc27a, css: '#ff8a1f' },
    { name: 'Mavi',    color: 0x2f8dff, dark: 0x1556c0, light: 0x9cc9ff, css: '#2f8dff' },
  ],
};
