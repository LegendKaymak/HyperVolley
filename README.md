# HyperVolley

*By LegendKaymak*

**HyperVolley** — Blobby Volley benzeri, 2 oyunculu plaj voleybolu. 24 karakter, her birinin pasif ve aktif yeteneği ile kendine özgü **Hyper**'ı, yapay zeka (Kolay/Orta/Zor/Usta) ve her sayıda **Rocket League tarzı gol patlaması**. Vite + PixiJS v8 (WebGPU → WebGL2 otomatik geçiş), tüm görseller kodla çizilir, tüm sesler Web Audio ile sentezlenir — dış dosya yok.

## Çalıştırma

```bash
npm install
npm run dev        # geliştirme sunucusu (telefonda denemek için ağdaki IP adresini de gösterir)
npm run build      # dist/ klasörüne statik çıktı
npm run preview    # build çıktısını yerelde dene
```

### Yayınlama
- **Netlify:** Depoyu bağlayın (build: `npm run build`, publish: `dist` — `netlify.toml` hazır) ya da `dist/` klasörünü Netlify Drop'a sürükleyin.
- **GitHub Pages:** `npm run build` sonrası `dist/` içeriğini `gh-pages` dalına (veya Pages kaynağı olarak seçtiğiniz klasöre) koyun. `vite.config.js` içinde `base: './'` olduğu için alt klasörde (`kullanici.github.io/repo/`) de çalışır.

## Kontroller

| | Hareket | Zıpla | Aktif yetenek |
|---|---|---|---|
| **Oyuncu 1** (sol) | A / D | W | S (veya Q) |
| **Oyuncu 2** (sağ) | ← / → | ↑ | ↓ (veya Sağ Shift / Enter) |

| **Oyun kolu** | Sol çubuk / yön tuşları | A | X, B ya da RB |

- Tek oyunculuda Oyuncu 1 ok tuşlarını ve iki oyun kolunu da kullanabilir.
- **Oyun kolu (Xbox, PlayStation ve standart kollar):** ilk bağlanan kol Oyuncu 1'e, ikincisi Oyuncu 2'ye atanır; bağlanınca ekranda bildirim çıkar (tarayıcı kolu ancak bir tuşuna basıldıktan sonra görür). Maçta **Start / Options** duraklatır; menülerde yön tuşları gezinir, **A** seçer, **B** geri gider. Karakter seçiminde 1. kol W/A/S/D, 2. kol ok tuşları gibi çalışır. Destekleyen kollarda vuruşta kısa titreşim olur; HUD'da yetenek tuşu olarak **X** görünür.
- **Tuş atama:** Ayarlar → Kontroller'den iki oyuncunun Sol / Sağ / Zıpla / Yetenek tuşları değiştirilebilir (tuşa tıkla, yeni tuşa bas; başka eylemde kullanılan tuş seçilirse ikisi yer değiştirir). "Varsayılan tuşlar" eski haline döndürür. Atamalar tarayıcıda saklanır.
- **Dokunmatik buton ayarları:** aynı ekrandan boyut (Küçük / Orta / Büyük) ve saydamlık (%30–100).
- **Esc:** duraklat · **M:** ses aç/kapat · **Boşluk / dokunma:** tekrarı atla
- **Mobil:** dokunmatik butonlar ekranın iki yanındaki dar sütunlarda durur, sahayı kapatmaz. 1 oyunculuda solda ◀ ▶, sağda üst üste yetenek ve zıpla (sağ sütun tek buton genişliğinde, oyun bu yüzden daha büyük). 2 oyunculuda her iki yanda 2x2 küme (üstte yetenek + zıpla, altta ◀ ▶). Butonlar sağ alttaki Netlify rozetinin üstünde kalır (`style.css` → `.tcluster`, ölçüler `touch.js` → `TouchControls.BTN`).
- **Karakter seçimi:** Oyuncu 1 → A/D seç, W onayla, S geri · Oyuncu 2 → ←/→ seç, ↑/Enter onayla, ↓ geri · ya da karta tıkla/dokun, sonra Hazır.

## Hareket hissi
Blob'lar yürürken Blobby Volley'deki gibi ritmik esner, hareket yönüne hafifçe eğilir ve her adımda ayak altından zemin renginde küçük bir toz kalkar (`render/stage.js` → `BlobView.sync`).

## Kurallar
- Her takım topu en fazla **3 dokunuşta** karşıya geçirmeli; 4. dokunuş hata → sayı rakibe.
- Top bir sahanın kumuna değerse **karşı takım** sayı alır. Servisi sayıyı alan takım atar.
- Servis topu, Blobby Volley'deki gibi küçük bir zıplamayla vurulacak yükseklikte havada asılı doğar (`ball.serveY`); ilk dokunuşla oyuna girer (5 sn dokunulmazsa kendisi düşer).
- **15 sayıya** ilk ulaşan kazanır.

## Karakterler
Karakterli modda maç öncesi her oyuncu dövüş oyunu tarzı bir ekranda karakter seçer: ortada 36 karakterlik portre ızgarası (9x4) (Oyuncu 1 sarı "1", Oyuncu 2 turkuaz "2" çerçeve), iki yanda seçilen karakter büyük, adı, tarzı ve yetenekleriyle. İkisi de hazır olunca kısa bir "VS" ekranı gelir. Karakter seçimi: Her karakterin kendi rengi, sabit bir pasif ve bir aktif yeteneği vardır; seçilen karakterin rengi o tarafın rengi olur (skor tabelası, efektler, konfeti). 2 oyunculuda aynı karakter iki tarafta olamaz; tek oyunculuda yapay zeka kalanlardan birini seçer.

| Karakter | Tarz | Pasif | Aktif |
|---|---|---|---|
| Volkan (turuncu) | Hücumcu | Hızlı Ayaklar | Güç Vuruşu |
| Tufan (mavi) | Kontrolcü | Hızlı Ayaklar | Yavaş Zaman |
| Atmaca (yeşil) | Akrobat | Zıpır | Hava Atılması |
| Ametist (mor) | Hilekâr | Hızlı Ayaklar | Falso |
| Hisar (kırmızı) | Savunmacı | Dev Blob | Kalkan |
| Kehribar (sarı) | Pasör | Zıpır | Mıknatıs |
| Granit (gri) | Bombacı | Sert Vuruş | Ağır Top |
| Kuzgun (çivit) | Ninja | Hızlı Ayaklar | Işınlanma |
| Meteor (pembe) | Uçan | Süzülme | Roket Zıplama |
| Ayaz (turkuaz) | Duvar | Hızlı Ayaklar | Kalkan |
| Kâbus (siyah) | Bozucu | Dev Blob | Sersemlet |
| Poyraz (limon yeşili) | Taktisyen | Zıpır | Rüzgâr |
| Tunç (bronz) | Tank | Sert Vuruş | Şişme |
| Bulut (krem) | Çevik | Hızlı Ayaklar | Tüy Top |
| Yıldırım (açık mavi) | Sürat | Zıpır | Turbo |
| Sis (petrol yeşili) | Aldatıcı | Süzülme | Şaşırt |
| Cadı (fuşya) | Büyücü | Süzülme | Küçült |
| Kâhin (lacivert) | Okuyucu | Zıpır | Önsezi |
| Ustura (bordo) | Keskin | Sert Vuruş | Kesik Top |
| Titan (haki) | Dev | Dev Blob | Deprem |
| Nova (somon) | Yıldız | Hızlı Ayaklar | Kara Delik |
| Yeşim (nane yeşili) | Kurtarıcı | Yumuşak Dokunuş | İkinci Şans |
| Zırh (çelik mavisi) | Kaleci | Dev Blob | Ayna |
| **Zenith** (altın) | Efsane | **Zirve** (kendine özel) | **Doruk Atağı** (kendine özel) |
| Pars (kum sarısı) | Avcı | Çift Zıplama | Yakala |
| Atlas (koyu turkuaz) | Taşıyıcı | Hızlı Ayaklar | Gök Askısı |
| Cura (krem sarısı) | Şifacı | Sert Vuruş | Kutsama |
| Kor (kor kırmızısı) | Kızgın | Sert Vuruş | Kor Top |
| Mızrak (çelik grisi) | Nişancı | Zıpır | Hat Vuruşu |
| Diken (orman yeşili) | Köklü | Dev Blob | Kök Sal |
| Kıvılcım (elektrik sarısı) | Sabotajcı | Hızlı Ayaklar | Kısa Devre |
| Diva (gül kırmızısı) | Solist | Hızlı Ayaklar | Yüksek Nota |
| Phantom (lavanta mavisi) | İllüzyonist | Süzülme | Hayal Top |
| Ejder (koyu zümrüt) | Yıkıcı | Sert Vuruş | Ejder Nefesi |
| Akrep (mürdüm) | Zehirli | Zıpır | Uyuştur |
| Bora (kraliyet mavisi) | Ezici | Dev Blob | Fırtına Darbesi |

Zenith bilerek diğerlerinden biraz güçlü tasarlandı: kendine özel pasifi hem hızı hem zıplamayı %8 artırır, aktifi yüksek sıçrama ile güçlü vuruşu birleştirir. Denge, karakterlerin birbirine karşı yapay zeka (Zor) maçlarıyla ayarlandı; en güçlü ve en zayıf karakter arasındaki sayı payı farkı daraltıldı.

Karakterler `src/game/characters.js` içinde tanımlı (iç kimlikler, kayıtlı verilerle uyum için eski adlarıyla kalır); renk, ad ve yetenek eşleşmelerini oradan değiştirebilirsiniz.

### Yetenekler
| Tür | Yetenek | Etki | Bekleme |
|---|---|---|---|
| Pasif | Zıpır | %12 daha yüksek zıplama | – |
| Pasif | Hızlı Ayaklar | %10 daha hızlı hareket | – |
| Pasif | Yumuşak Dokunuş | Sert gelen topu (smaç, güçlü vuruş) takımın ilk dokunuşunda %20 yavaşlatır | – |
| Pasif | Dev Blob | %10 büyük, %5 yavaş | – |
| Pasif | Sert Vuruş | Vuruşlar %6 daha güçlü | – |
| Pasif | Süzülme | Düşerken zıplama tuşunu basılı tutunca yavaş iner | – |
| Pasif | Çift Zıplama | Zirveden sonra (düşerken) zıplama tuşuna tekrar basınca bir kez daha, daha alçak zıplar | – |
| Pasif | Zirve (Zenith) | Hem hız hem zıplama %12 fazla | – |
| Aktif | Işınlanma | Baktığın yöne anında kısa ışınlanma (yerde de çalışır) | 8 sn |
| Aktif | Roket Zıplama | Yerdeyken anında çok yükseğe zıplar | 8 sn |
| Aktif | Ağır Top | Top 1.5 sn ağırlaşır, hızlı düşer | 14 sn |
| Aktif | Kalkan | 5 sn içinde kendi sahana düşen topu bir kez yukarı sektirir (sayı olmaz) | 13 sn |
| Aktif | Falso | Sonraki vuruşta top havada aşağı doğru kıvrılır | 8 sn |
| Aktif | Güç Vuruşu | Sonraki vuruş %45 güçlü (3 sn içinde, alevli iz) | 23 sn |
| Aktif | Hava Atılması | Havada yatay atılma | 9 sn |
| Aktif | Mıknatıs | Topu 1 sn sana çeker (topa dokununca biter) | 9 sn |
| Aktif | Yavaş Zaman | Top 1.2 sn %35 yavaşlar | 15 sn |
| Aktif | Sersemlet | Rakip 1.5 sn %40 yavaş hareket eder, daha alçak zıplar | 15 sn |
| Aktif | Şişme | 4 sn boyunca %30 büyür (daha geniş vuruş ve blok alanı) | 16 sn |
| Aktif | Tüy Top | Top 1.6 sn hafifler, yavaş düşer (yetişmek kolaylaşır) | 14 sn |
| Aktif | Turbo | 3 sn boyunca %45 hızlı koşar | 14 sn |
| Aktif | Şaşırt | Rakibin sağı solu 0.9 sn ters döner | 24 sn |
| Aktif | Küçült | Rakip 4 sn boyunca %22 küçülür | 13 sn |
| Aktif | Önsezi | Topun düşeceği yerin altına ışınlanır | 10 sn |
| Aktif | Kesik Top | Topun yatay hızı anında kesilir, top dik düşer (file üstünden kısa top) | 13 sn |
| Aktif | Deprem | Yerdeki rakip sarsılıp havaya savrulur | 17 sn |
| Aktif | Kara Delik | Top 1.1 sn rakip sahanın ortasına çekilir (rakip dokununca biter) | 15 sn |
| Aktif | İkinci Şans | Takımın dokunuş hakkından 1 geri alır (en az 2 dokunuş yapılmışken) | 18 sn |
| Aktif | Ayna | Topun yatay yönünü anında tersine çevirir | 23 sn |
| Aktif | Doruk Atağı (Zenith) | Yerden yükseğe sıçrar; 1.8 sn içindeki sonraki vuruş %35 güçlü | 11 sn |
| Aktif | Rüzgâr | Top 1 sn rakip sahaya doğru savrulur (rakip topa dokununca biter) | 19 sn |
| Aktif | Yakala (Pars) | 2.4 sn içinde değdiğin top tepende yakalanır, 0.4 sn sonra rakip sahaya fırlatılır | 18 sn |
| Aktif | Hayal Top (Phantom) | Topun yanından gerçeğinden ayırt edilemeyen sahte bir top başka yöne uçar (2.2 sn); rakip gerçek topa dokununca kaybolur. Yapay zeka bazen sahtesine kanar (kolayda sık, ustada nadiren) | 22 sn |
| Aktif | Ejder Nefesi (Ejder) | Kendi sahandaki ve yakınındaki (165 px) topu ateşle rakip sahaya aşırtır; uzanamadığın topu kurtarır. Menzil dışındaysa hak harcanmaz | 23 sn |
| Aktif | Uyuştur (Akrep) | Rakibin vuruşları 2.5 sn %11 zayıflar | 24 sn |
| Aktif | Fırtına Darbesi (Bora) | Rakip fileden geriye savrulur (kısa süre kontrolü kaybeder) | 19 sn |
| Aktif | Kutsama (Cura) | 5 sn %22 hızlı koşar, daha yükseğe zıplar, %10 sert vurur; bu sürede üzerindeki olumsuz etkiler anında silinir. Kullanınca takımındaki olumsuz etkiler de temizlenir | 13 sn |
| Aktif | Kor Top (Kor) | Top 4 sn kızar: rakibin topa ilk dokunuşu 2 dokunuş sayılır (tek başına faul yaptırmaz) | 16 sn |
| Aktif | Hat Vuruşu (Mızrak) | Sonraki vuruş kısa süre yerçekimsiz, dümdüz gider | 13 sn |
| Aktif | Kök Sal (Diken) | Rakip 2.5 sn zıplayamaz | 15 sn |
| Aktif | Kısa Devre (Kıvılcım) | Rakibin aktif yeteneği baştan beklemeye girer, Hyper barı %35 azalır | 18 sn |
| Aktif | Yüksek Nota (Diva) | Ses dalgası kendi sahandaki yakın (210 px) topu dikine havaya kaldırır; düşen topu kurtarır. Menzil dışındaysa hak harcanmaz | 14 sn |
| Aktif | Gök Askısı (Atlas) | Top 1 sn havada asılı kalır, sonra kaldığı yerden aynı hızla devam eder; yetişemediğin topa zaman kazandırır | 14 sn |

### Maç içi HUD
Üst bant tek parça bir yayın grafiği gibi: ortada skor tabelası, iki yanında aynı yükseklikte ve aynı tasarımda oyuncu kartları (koyu zemin, altta karakter renginde şerit).
- **Ortada skor tabelası:** iki tarafın sayısı, ortada hedef (ör. "Hedef 15+2") ve **maç süresi** (dk:sn; sadece oyun oynanırken işler, duraklatma ve sayı efektlerinde durur); altında duraklat düğmesi.
- **Oyuncu kartı** (her taraf kendi köşesinde, o tarafa ait her şey tek yerde):
  - **Yetenek karesi:** bekleme süresinde saat gibi dolar ve kalan saniyeyi yazar; hazır olunca karakter renginde yanar ve tuşunu (S / ↓) gösterir, mobilde şimşek işareti. Yetenek etkisi sürerken beyaz çerçeve yanıp söner.
  - **Ad:** karakter adı (turnuvada oyuncu adı, yanında küçük karakter adı; uzun adlar "…" ile kısalır).
  - **Aktif yetenek adı:** karakter renginde, adın altında.
  - **Dokunuş hakkı:** 3 nokta; topa her dokunuşta biri dolar, üçü de dolunca kırmızı olur.
  - **Pasif yetenek:** kartın altına asılı küçük "PASİF" etiketi.
- Top kendi sahandayken dokunuş noktaları oyuncunun başının üstünde de görünür.
- Top ya da oyuncu kartın arkasına girerse kart saydamlaşır.
- Ses ve tam ekran düğmeleri maç sırasında duraklatma ekranında.
- Klasik modda kartta sadece ad ve dokunuş noktaları vardır.

**Bekleme süresi yeteneğin etkisi bittikten sonra başlar:** süreli bir yetenek (ör. Klon 8 sn, Kalkan 5 sn) etkin olduğu sürece bekleme süresi azalmaz; etki bitince ya da harcanınca (ör. Güç Vuruşu ile vurunca) azalmaya başlar. Cooldown'lar sayı efekti ve geri sayım sırasında işlemeye devam eder; **sayı tekrarı oynarken durur** (tekrar süresi bekleme süresinden yemez).

## Turnuva
Ana menü → 3–8 Oyuncu → **Turnuva**. 2–8 oyuncu, tek elemeli (kaybeden elenir).
- Her oyuncunun adını yazın; her satırdaki düğmeyle **İnsan / YZ Kolay / YZ Orta / YZ Zor** seçin. Eşleşmeler rastgele; sayı 2, 4 ya da 8 değilse bazı oyuncular ilk turu rakipsiz ("Bay") geçer. Son girilen isimler hatırlanır.
- Ağaç ekranında sıradaki maç sarı çerçeveyle gösterilir. İki insan karşılaşırsa 2 oyunculu maç (A/D/W/S ve oklar); insan ile yapay zeka karşılaşırsa insan sol tarafta oynar. İki yapay zeka karşılaşırsa **İzle** (maçı izle) ya da **Hızlı sonuç** (zorluğa göre anında sonuç).
- Maçlarda ekranda oyuncu adları görünür ("Ayşe +1", "Ayşe turu geçti"). Final sonrası şampiyon ekranı ve havai fişekler.
- Maç uzunluğu, 2 fark ve Klasik/Karakterli ayarı ana menüdeki seçeneklerden gelir. Turnuva yarıda bırakılırsa ana menüdeki Turnuva'dan devam edilir.
- Mantık `src/game/tournament.js` içinde.

## Hyper
Karakterli, parti ve kaos modlarında her karakterin kendine özgü bir güçlendirmesi, **Hyper**'ı vardır; her Hyper o karakterin aktif yeteneğinin büyütülmüş hâlidir. Her tarafın Hyper barı kendi oyuncu kartının altındaki ince şerittir (ortadaki skor tabelasında değil).
- Bar o tarafın her vuruşunda biraz dolar, uzun rallilerde daha hızlı.
- Bar dolunca kendiliğinden başlamaz: kartta **"HYPER HAZIR"** yazar, şerit altın renkte nabız gibi yanıp söner ve yetenek karesinin çevresinde altın halka belirir.
- Oyuncu **bir sonraki aktif yeteneğini kullandığında** yetenek normal çalışır, üstüne Hyper gelir: kartın çerçevesi altın yanar, yetenek satırında "HYPER · ad" yazar, blob'un üstünde "HYPER" yazısı yükselir.
- **Süreli Hyper'lar** (ör. Kale Duvarı) o anda başlar; şerit altın renkte azalarak kalan süreyi gösterir. **Vuruş Hyper'ları** (tabloda "sonraki vuruş") bir sonraki vuruşu bekler, o vuruşta topa uygulanır; beklerken şerit dolu altın kalır ve sayı bitse de kaybolmaz.
- Hyper'lar eskisinden uzun sürer. Sayı bitince süren Hyper sona erer; bar sayılar arasında korunur, maç başında sıfırlanır. Klasik modda ve antrenmanda yoktur.
- Ayarlar: `config.js` → `hyper`, tanımlar `src/game/hyper.js`.

| Karakter | Hyper | Etkisi | Süre |
|---|---|---|---|
| Volkan | Lav Yağmuru | Sonraki vuruş %45 hızlı, top uzun süre alevle dalar | sonraki vuruş |
| Tufan | Zaman Durdur | Rakip 1.5 sn tamamen donar | anlık |
| Atmaca | Pike | 9 sn çok yüksek zıplar, hızlı koşar | 9 sn |
| Ametist | Büyülü Kıvrım | Sonraki vuruşta top uzun süre sert kıvrılır | sonraki vuruş |
| Hisar | Kale Duvarı | 8 sn top senin sahana düşemez | 8 sn |
| Kehribar | Süper Mıknatıs | 8 sn kendi sahandaki topu sana çeker | 8 sn |
| Granit | Göktaşı | Sonraki vuruşta top taş gibi ağırlaşıp dalar | sonraki vuruş |
| Kuzgun | Gölge Adımı | 10 sn içinde gelen topun altına kendiliğinden ışınlanır | 10 sn |
| Meteor | Yıldız Sıçrayışı | 9 sn her zıplayış roket gibi | 9 sn |
| Ayaz | Buz Devri | Rakip 4.5 sn yavaşlar, alçak zıplar | anlık |
| Kâbus | Kâbus | Rakibin yönleri 2.2 sn ters döner | anlık |
| Poyraz | Kasırga | Sonraki vuruştan sonra top 3 sn rakip sahaya savrulur | sonraki vuruş |
| Tunç | Dev Tunç | 9 sn kocaman olur, vuruşları sertleşir | 9 sn |
| Bulut | Bulut Yastığı | 9 sn kendi sahanda top yavaş düşer | 9 sn |
| Yıldırım | Işık Hızı | 8 sn şimşek gibi koşar | 8 sn |
| Sis | Sis Perdesi | Sonraki vuruşta top rakip sahada 2.5 sn görünmez olur | sonraki vuruş |
| Cadı | Lanet | Rakip 7 sn küçülür ve yavaşlar | anlık |
| Kâhin | Kehanet | 11 sn sana gelen topun yolunu görür, hızlanır | 11 sn |
| Ustura | Keskin Kesim | Sonraki vuruşta top fileyi geçer geçmez dik düşer | sonraki vuruş |
| Titan | Yer Sarsıntısı | Rakip havaya savrulur ve sersemler | anlık |
| Nova | Süpernova | Sonraki vuruşta top hızlanır ve arka köşeye çekilir | sonraki vuruş |
| Yeşim | Yenilenme | Aktif yetenek hemen dolar, dokunuş hakkı sıfırlanır | anlık |
| Zırh | Ayna Zırh | 10 sn içinde sana gelen ilk top geri seker | 10 sn |
| Zenith | Zirve Formu | 9 sn daha hızlı, daha yüksek, daha sert | 9 sn |
| Pars | Av Pençesi | 9 sn her topu yakalar, %25 daha sert fırlatır | 9 sn |
| Phantom | Aynalar Salonu | Topun yanında 3 sahte top birden uçar | anlık |
| Ejder | Alev Fırtınası | Üflenen top alevle dalar, rakip 2 sn sersemler | anlık |
| Akrep | Zehir | Rakibin vuruşları 9 sn zayıflar, 2.5 sn yavaşlar | anlık |
| Atlas | Gök Kilidi | Top 1.6 sn asılı kalır, rakip 1 sn donar | anlık |
| Cura | Kutsal Alan | Klon 10 sn kalır; 8 sn takımın olumsuz etkilerden etkilenmez, hızlanır | 8 sn |
| Diva | Final Sahnesi | 9 sn daha yükseğe zıplar, daha sert vurur | 9 sn |
| Kor | Kızgın Top | 6 sn rakibin HER dokunuşu 2 dokunuş sayılır | 6 sn |
| Mızrak | Yıldırım Mızrağı | Sonraki vuruş daha uzun süre dümdüz ve %20 hızlı gider | sonraki vuruş |
| Diken | Derin Kök | Rakip 5 sn zıplayamaz ve 2 sn yavaşlar | anlık |
| Kıvılcım | Karartma | Rakibin Hyper barı sıfırlanır, 2 sn sersemler | anlık |
| Bora | Kara Bora | Rakip çok daha uzağa savrulur ve 2.5 sn sersemler | anlık |

## Menü akışı
Ana menü adım adım ilerler (sağ üstte "1. Mod — 2. Oyuncu — 3. Ayarlar — 4. Karakter" göstergesi; istatistik ve ayarlar sağ üstteki simgelerde):
1. **Oyun modu:** Maç · HyperMatch · Hayatta kalma · Zamana karşı · Turnuva · Kral sahası · Antrenman · İzle
2. **Kaç kişilik:**
   - Maç: 1 Oyuncu (yapay zekaya karşı), 2 Oyuncu (karşılıklı), 2 Oyuncu · Aynı takım (ikiniz yapay zeka ikilisine karşı)
   - HyperMatch ve Zamana karşı: 1 Oyuncu ya da 2 Oyuncu
   - Turnuva (2–8) ve Kral sahası (3–8): kaç kişi oynayacağı seçilir; isim ekranı o kadar satırla açılır
   - Hayatta kalma, Antrenman ve İzle'de bu adım atlanır
3. **Ayarlar:** solda moda göre Kural (Karakterli / Klasik / Parti / Kaos), Takım (1'e 1 / 2'ye 2), Rakip zorluğu, Süre, Hedef sayı + 2 fark, **Yasaklar** (Kapalı / 1 / 3 / 5; Maç ve Zamana karşı), Taç sayısı; sağda **Saha** (Plaj, Gün Batımı, Kar Tepesi, Spor Salonu; arkadaki gösteri maçında anında önizlenir)
4. **Karakter seçimi** (Klasik ve Kaos'ta atlanır; turnuva ve kral sahasında önce isimler girilir), ardından VS ekranı ve maç.

Seçimler hatırlanır; bir sonraki açılışta aynı seçenekler hazır gelir. Esc ya da "Geri" bir adım geri götürür. Devam eden bir turnuva varsa menüde Turnuva'nın altında yazar ve tıklayınca doğrudan eşleşme ağacına dönülür.

## Modlar
- **HyperMatch:** karakterli büyük maç: **15 sayı, 2 fark** ve iki taraf da **5'er karakter yasaklar** (toplam 10 karakter oyundan çıkar). 1 Oyuncu (yapay zekaya karşı) ya da 2 Oyuncu; ayarlarda sadece Takım, Rakip ve Saha seçilir. Kendi hedef ve kural ayarların değişmez.
- **Hayatta kalma:** 5 canın var; yapay zeka her sayı aldığında bir can gider. Rakip Kolay başlar ve senin her 3 sayında bir seviye atlar (Orta, Zor, Usta) ve yeni bir karaktere geçer. Tabelada can ve seviye yazar; en çok sayı rekor olarak saklanır.
- **Zamana karşı:** 1, 2 ya da 3 dakika; yapay zekaya ya da 2. oyuncuya karşı. Tabeladaki saat geri sayar (son 10 sn kırmızı). Süre dolunca oynanan ralli son sayıdır; eşitlikte **altın sayı** (sonraki sayıyı alan kazanır).
- **İkiniz bir takım:** iki oyuncu aynı takımda (Oyuncu 1 önde, Oyuncu 2 arkada), yapay zeka ikilisine karşı. Rakip zorluğu seçilebilir.
- **Kaos:** karakterli maç, ama her sayıdan önce bütün blob'ların karakteri rastgele değişir (birbirinden farklı); değişim kısaca duyurulur. Karakter seçimi yoktur.
- **Kral sahası:** 3–8 kişi. Sahada "kral" ile sıradaki rakip oynar; kazanan sahada kalır ve bir **taç** alır, kaybeden sıranın sonuna geçer. Belirlenen taç sayısına (2, 3 ya da 5) ilk ulaşan kral olur. Ekranda sahadaki iki kişi, taçlar ve sıra görünür; iki yapay zeka karşılaşırsa İzle ya da Hızlı sonuç. Mantık `src/game/kingcourt.js`.
- **İzle:** iki karakter seç, kimin kazanacağını tahmin et, iki yapay zeka (seçilen zorlukta) oynasın. Maç sonunda tahminin tuttu mu yazar.

## Karakter seçimi: zar ve yasaklama
- **Zar at:** her oyuncunun "Seç" düğmesinin yanındaki karışık ok simgesi (Oyuncu 1 için **R**, Oyuncu 2 için **Sağ Shift**) imleci kısa bir süre rastgele gezdirip rastgele bir karakterde durdurur.
- **Yasaklama:** Maç ve Zamana karşı modlarında Ayarlar adımındaki **Yasaklar** seçeneğiyle açılır: Kapalı, 1, 3 ya da 5. Seçimden önce oyuncular turlar hâlinde yasaklar (her turda iki taraf birer karakter; başlıkta "Yasakla (2/5)" gibi tur yazar); yapay zeka rastgele yasaklar. Yasaklı karakterler çizgili ve soluk görünür, seçilemez; imleç üstlerinden atlar. HyperMatch'te her taraf 5 karakter yasaklar.

## Tekrarda vuruş hızı
Sayı tekrarında sağ üstte sayıyı getiren vuruşun türü (Vuruş, Smaç ya da "Hyper: ad") ve hızı km/sa olarak yazar (ölçek: 32 piksel = 1 metre; `main.js` → `PX_PER_M`).

## Antrenman
Ana menü → **Antrenman** (saha seçimi, sonra karakter): karakterini seç, karşı tarafta blob yerine **top makinesi** sana top atar. Skor tabelasında **isabet** (top karşı sahaya düştü) ve **kaçan** sayılır; sağ üstte seri ve rekor yazar. 3 dokunuş kuralı geçerlidir. Duraklatma ekranından:
- **Atış:** Karışık, Yüksek, Sert, File önü, Derin
- **Yetenek:** Normal bekleme / Beklemesiz (yetenekleri sınırsız denemek için)

## Parti modu
Mod adımında Kural: **Parti**. Karakterli maçtır, ama her sayıdan önce rastgele bir kural gelir (büyükçe duyurulur, sonra skor tabelasının altında küçük yazar): Düşük Yerçekimi, Dev Top, Mini Top, Devler, Süper Zıplama, Hızlı Top, Ağır Top, Yetenek Yağmuru (yetenekler 4 kat hızlı dolar), Fırtına (rüzgâr topu bir yöne savurur), Kaygan Zemin (blob'lar kayar). Kurallar `src/game/mods.js` içinde.

## 2'ye 2
Mod adımında Takım: **2'ye 2**. Her takıma yapay zeka bir takım arkadaşı katılır (seçilen karakterlerden farklı rastgele bir karakterle; Klasik'te yeteneksiz). Ana oyuncular fileye yakın, arkadaşlar arkada başlar. Topu kimin alacağına topa yakınlığa göre karar verirler; arkadaşın insansa yapay zeka ona öncelik tanır. Dokunuş hakkı takım başına 3'tür. Kartta adın yanında arkadaşın adı ("+ Kehribar") yazar. 1 ve 2 oyunculu maçta çalışır; turnuva ve antrenman 1'e 1'dir.

## Yapay zeka zorlukları
Kolay, Orta, Zor ve **Usta**. Kolay, Orta ve Zor belirgin şekilde güçlendirildi: yeni Kolay eski Orta'ya, yeni Orta eski Zor'a yakın; yeni Zor eski Usta'nın ayarlarıyla oynar (rakibin yetişme süresini hesaplar). **Usta'nın vuruş planlayıcısı:** top kendi sahasına gelirken topun ve kendi blob'unun kopyalarını gerçek fizikle ileri sarar; farklı duruş noktalarını hem yerden hem de farklı anlarda **zıplayarak** dener (yaklaşık 28 aday), her birinde topun karşıda nereye ve ne kadar sürede ineceğini hesaplar ve rakibin en zor yetişeceği vuruşu uygular. Bu yüzden sık sık zıplayıp topu yukarıdan aşağı sert vurur. Aynı planlayıcıyla **servisi** de seçer; hücum mümkün değilse topu yüksek ve sahanın ortasına kaldıran bir **kurtarış pası** atar. Top rakipteyken, rakibin o noktadan atabileceği vuruşların düşeceği aralığı hesaplayıp ortasında bekler (**önsezi**). Sahte toplara neredeyse hiç kanmaz. Test maçlarında Zor'u 56-2 yendi. Çok uzun rallilerde (kendi 12+ vuruşu) duruşu giderek sapar; iki Usta'nın maçı sonsuza kadar sürmesin diye. Planlama Usta başına kare başına ortalama ~0.6 ms sürer (`ai.js` → `simPlan`, `anticipate`). Usta neredeyse hiç hata yapmaz; her vuruşta olası yörüngeleri simüle edip rakibin topa yetişme süresini hesaplayarak en zor topu seçer (2'ye 2'de en yakın rakibe göre). Test maçlarında Zor'u 104-78 sayıyla yendi. Turnuvada "YZ Usta" olarak da seçilebilir.

## Klasik mod
Mod adımında **Kural: Klasik** seçilirse karakter seçimi atlanır, maçta hiçbir yetenek yoktur (yetenek göstergeleri ve dokunmatik yetenek butonu da gizlenir). Saf Blobby Volley gibi oynanır; sayı efektleri ve diğer ayarlar aynen çalışır.

## Maç formatı
Mod adımında **Hedef**: 5, 10 veya 15 sayı. **2 fark** açıksa kazanmak için rakipten en az 2 sayı önde olmak gerekir (skor tabelasında "15+2" yazar).

## İstatistikler
- **Maç sonu:** iki taraf için smaç, vuruş ve yetenek kullanımı; en uzun ralli ve maç süresi.
- **Kalıcı (Ana menü, İstatistikler):** toplam maç, en uzun ralli, toplam smaç, yapay zekaya karşı en uzun galibiyet serisi, toplam sayı, oyun süresi ve her zorluk için galibiyet/mağlubiyet. Tarayıcıda saklanır; "Sıfırla" ile silinir.
- Smaç sayılan vuruş: blob havadayken topu aşağı doğru ve hızlı gönderen vuruş (`main.js` → `matchStats.onHit`).

## Telefona yükleme (PWA)
Netlify/GitHub Pages gibi https adreslerinde oyun uygulama gibi yüklenebilir: Chrome'da menü → "Ana ekrana ekle" (iPhone'da Safari → Paylaş → "Ana Ekrana Ekle"). Yüklenince tam ekran ve yatay açılır, bir kez açıldıktan sonra internetsiz de çalışır.
- Dosyalar: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/`.
- Yeni sürüm yayınlayınca `public/sw.js` içindeki `VERSION` değerini değiştirin; böylece telefonlardaki eski önbellek temizlenir.

## Arenalar
Ana menüden seçilir: **Plaj**, **Gün Batımı**, **Kar Tepesi** (yağan kar), **Spor Salonu** (parke zemin, tavan ışıkları). Arenalar sadece görünümü değiştirir; fizik her arenada aynıdır, böylece yetenek dengesi bozulmaz. Yeni arena eklemek veya renkleri değiştirmek için `CONFIG.arenas`.

## Arayüz
Plaj voleybolu yayın grafiklerinden esinlenen tasarım: derin deniz mavisi yüzeyler, tebeşir beyazı yazı, kum tonları ve voleybol topu sarısı vurgu. Başlıklar, menü ve rakamlar dar spor yazı tipi **Barlow Condensed**, küçük metinler **Barlow** (Google Fonts; bağlantı yoksa sistem yazı tipi).
- Ana menü: büyük harfli menü listesi, seçili öğenin solunda sarı "saha çizgisi"; arkada gösteri maçı oynar.
- Skor tabelası yayın tarzında: iki takım bloğu, ortada hedef sayı.
- Renkler `src/style.css` başındaki değişkenlerde (`--abyss`, `--tide`, `--chalk`, `--sand`, `--ball`).

## Sesler
Hepsi Web Audio ile kod içinde üretilir (dosya yok), `src/audio/sfx.js`:
- **Vuruşlar:** bip yerine tok bir darbe ve kısa doku sesi; her vuruşta ton biraz değişir, hızlı top daha dolgun duyulur.
- **İniş:** zemine göre — kum, parke (ara sıra ayakkabı gıcırtısı), kar.
- **Ortam:** sürekli arka plan uğultusu (dalga, rüzgâr, salon) kulağı yorduğu için kaldırıldı; arenalar sadece zemin sesiyle (kum, kar, parke) ayrışır.
- **Seyirci (hafif):** top fileye çarpınca ara sıra kısa bir "ooo", sayıda alkış. Sürekli seyirci uğultusu yok.
- **Menü:** yumuşak tıklamalar. Ayarlar'da "Efekt sesi" ve "Seyirci sesi" için iki ayrı ses kaydırıcısı.

## Ekran ve tam ekran
- Menülerde oyun ekranı sığabildiği kadar büyük gösterilir.
- Maçta dokunmatik butonlar görünürken iki yerleşimden oyunu daha büyük gösteren seçilir: iPad gibi 4:3 ekranlarda butonlar **oyunun altında** (oyun tam genişlikte), geniş telefon ekranlarında **iki yanda** (`main.js` → `computeLayout`). Telefonlarda ekran zaten yüksekliğe göre sınırlı olduğundan oyun sadece butonlara gereken kadar kaydırılır/daraltılır; çentikli ekranlarda güvenli alan da hesaba katılır.
- Menülerde sağ üstteki düğmeyle, maçta duraklatma ekranından **tam ekran** (iPad Safari dahil; iPhone Safari tam ekranı desteklemez, orada ana ekrana ekleyerek açın).
- Tıklanabilir öğeler sağ alt köşeden uzak tutulur (barındırma rozetleri, ör. "Powered by Netlify", oraya biner).

## Performans (tablet, telefon, eski bilgisayar)
- **Her karede yeniden çizim yok:** blob gözleri, mıknatıs ve yavaş zaman halkaları, HUD'daki Hyper barı/çerçevesi, yetenek karesi ve baş üstü dokunuş noktaları bir kez çizilir; her karede sadece konum, ölçek ve saydamlıkları güncellenir. Yetenek karesi yalnızca görünümü değişince (64 kademeli dolum) yeniden çizilir. Top izi önceden oluşturulmuş bir sprite havuzudur. Çizilecek bir şey yokken (kalkan, Kehanet yolu, gol halkaları) hiçbir geometri kurulmaz.
- **Grafik kalitesi** (Ayarlar): Otomatik / Yüksek / Orta / Düşük / En düşük.
- **Eski/zayıf bilgisayarlar (ör. 4 GB RAM'li Pardus PC):** Otomatik modda oyun açılışta ekran kartını kontrol eder. Yazılımsal çizim (sürücü yok, ör. "llvmpipe") görürse **En düşük** (0.75x çözünürlük, az parçacık), eski Intel tümleşik grafik, ≤4 GB bellek ya da ≤4 çekirdek görürse **Orta** ile başlar. Linux'ta her zaman WebGL kullanılır (WebGPU sürücü desteği çoğu zaman eksik). Pardus'ta Firefox'ta donanım hızlandırma kapalıysa `about:preferences` → Performans → "Önerilen performans ayarlarını kullan" ve "Donanım hızlandırmayı kullan" açık olmalı; Chromium/Chrome genelde daha akıcıdır.
- Diğer cihazlarda Otomatik'te masaüstü Yüksek, tablet ve telefon Orta başlar; oyun 2 saniyelik iki ölçümde üst üste 45 FPS'in altında kalırsa kendiliğinden bir seviye düşer.
- Seviyeler `CONFIG.effects.quality` içinde: çizim çözünürlüğü (Yüksek 2.5x, Orta 1.5x, Düşük 1x, En düşük 0.75x), bloom/RGB filtreleri (sadece Yüksek'te) ve parçacık sayısı.
- Tablet ve telefonda Pixi'nin WebGL yolu kullanılır (iPad/iPhone Safari'de WebGPU'dan daha kararlı), kenar yumuşatma (MSAA) kapalıdır.
- Dalga ve köpük çizgileri bir kez çizilip kaydırılır; HUD yazıları sadece değiştiklerinde yenilenir.

## Ayarlar (ana menüde sağ üstteki dişli; istatistikler grafik simgesinde)
- **Efektleri azalt:** sade flaş, kısa shake, az parçacık; RGB ayrışma, bloom ve zoom kapalı.
- **Tekrar:** sayıdan önceki son 2 sn'yi 0.5x hızda "TEKRAR" olarak oynatır.
- **Grafik kalitesi**, efekt ve seyirci sesi, **Kontroller** (tuş atama, oyun kolu, dokunmatik butonlar).
- **FPS göstergesi:** açıkken oyun alanının sol alt köşesinde küçük, sadece yazı olarak kare hızı (ör. "60 FPS") görünür; yer kaplamaz.
- **Dil:** Türkçe / English. Seçince oyun yeniden yüklenir ve ayarlar penceresine döner. İngilizce'de menüler, maç yazıları, yetenek/Hyper/saha/kural adları ve açıklamaları çevrilir; karakter adları özel isim olduğu için aynı kalır. Çeviriler `src/lang/en.js`, altyapı `src/i18n.js` (menü HTML'i Türkçe yazılır, İngilizce'de ekrana gelen metinler sözlükten otomatik çevrilir).
- Mobilde parçacık sayısı otomatik yarıya iner. Ayarlar tarayıcıda (localStorage) saklanır.

## Balansı ve efektleri değiştirmek — `src/config.js`
Tüm sayılar tek dosyada. Değiştirin, kaydedin; `npm run dev` anında yeniler.

| Ne değiştirmek istiyorsunuz? | `CONFIG` içindeki yer |
|---|---|
| Blob hızı, zıplama, yerçekimi, boyut ve şekli | `blob.moveSpeed`, `blob.jumpVelocity`, `blob.gravity`, `blob.radius`, `blob.bodyY/bodyR/headY/headR` |
| Top boyutu, yerçekimi, hız sınırı, vuruş gücü, sekme | `ball.radius`, `ball.gravity`, `ball.maxSpeed`, `ball.hitSpeed`, `ball.blobVelocityInfluence`, `ball.*Restitution` |
| File yüksekliği / kalınlığı | `world.netTopY`, `world.netHalfWidth`, `world.netCapRadius` |
| Kazanma sayısı, dokunuş hakkı | `rules.pointsToWin`, `rules.maxTouches` |
| Yetenek yüzdeleri ve cooldown'lar | `abilities.zipir`, `abilities.kalkan`, `abilities.falso.spin` vb. (kart açıklamaları otomatik güncellenir) |
| Yapay zeka zorlukları | `ai.kolay / orta / zor` (tepki, hata, hız, zıplama, smaç, yetenek kullanımı) |
| Hit-stop, slow-motion | `goalFx.hitStopMs`, `goalFx.slowScale`, `goalFx.slowMs`, `goalFx.recoverMs` |
| Patlama büyüklüğü | `goalFx.sparks`, `dust`, `debris`, `shockwaves`, `confettiRain`, `confettiCannon` |
| Kamera | `goalFx.shakeTrauma`, `shakeMaxOffset`, `shakeDecay`, `zoom`, `chromaticPx`, `bloomScale` |
| Işık | `goalFx.flashAlpha`, `tintAlpha`, `tintMs` |
| Yazı/geri sayım zamanlaması | `goalFx.textDelayMs`, `textHoldMs`, `scorePopDelayMs`, `countdownDelayMs`, `countdownStepMs` |
| Seri ve maç sayısı çarpanları | `goalFx.streakThreshold`, `streakMul`, `matchPointMul`, `matchPointSlowMul` |
| Tekrar | `replay.enabled` (varsayılan), `replay.seconds`, `replay.speed` |
| Performans | `effects.particleCapacity`, `mobileParticleMul`, `reducedParticleMul`, `maxResolution` |
| Takım renkleri/adları | `teams` |
| Arenalar (renkler, dekor, kar) | `arenas` |

## Mimari

```
src/
  main.js            Pixi kurulumu, letterbox, durum makinesi, SABİT ADIMLI döngü (accumulator)
  config.js          tüm sabitler ve balans değerleri
  game/              (Pixi'den bağımsız, Node'da test edilebilir)
    physics.js       blob hareketi, top–duvar/tavan/file/blob çarpışmaları, yapay zeka için tahmin
    entities.js      Blob ve Ball veri sınıfları
    rules.js         3 dokunuş, sayı, servis, seri, 15'te bitiş
    abilities.js     veri odaklı yetenek tanımları (apply/remove/activate/update/onHit)
    hyper.js         24 karakterin Hyper tanımları (start/update/end/onCross)
    kingcourt.js     kral sahası sırası ve taçlar
    tournament.js    eleme turnuvası
    mods.js          parti modu kuralları
    ai.js            iniş noktası tahmini + vuruş açısı seçimi, zorluk seviyeleri
    world.js         bir fizik adımında her şeyi ilerleten çekirdek
    replay.js        son 2 sn'nin ring buffer kaydı
    timeScale.js     hit-stop / slow-motion
  render/
    stage.js         katmanlar, arka plan, blob/top görünümleri, kamera, filtreler
    hud.js           skor (flip/pop), dokunuş noktaları, cooldown, TEKRAR etiketi
    goalExplosion.js GoalExplosion.play({ x, y, teamColor, streak, isMatchPoint })
    particles.js     object pool'lu parçacıklar
    textures.js      kodla çizilen parçacık dokuları
    tween.js         Tweener, Timeline, easeOutCubic / easeOutBack / easeInOutQuad
  audio/sfx.js       Web Audio sentezi
  input/keyboard.js, input/touch.js
  ui/menus.js        adım adım menü, karakter seçimi, duraklatma, maç sonu
  i18n.js            dil altyapısı (t, translateDom, watchDom)
  lang/en.js         İngilizce sözlük ve oyun verisi çevirileri
```

**Sabit zaman adımı:** Her karede geçen gerçek süre `timeScale` ile çarpılıp bir "kova"ya (accumulator) eklenir; kovada 1/60 sn biriktikçe fizik bir adım ilerler (karede en fazla 5 adım, sekme arka plandan dönünce fazlası atılır). Slow-motion fizik adımını küçültmez, sadece kovanın dolma hızını düşürür. Kovada kalan kesir, çizimde önceki/şimdiki durum arasında enterpolasyon için kullanılır. Ayrıntılı açıklamalar `main.js` ve `physics.js` içindeki yorumlarda.

**Hata ayıklama:** Tarayıcı konsolunda `__blob.gw.match.score`, `__blob.state` vb.
