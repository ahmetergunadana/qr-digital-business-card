# QR Dijital Kartvizit Sistemi

Bu proje, kullanıcıların kendi dijital kartvizitlerini oluşturabileceği, QR kodlarını paylaşabileceği ve bu kartvizitlerin tarama istatistiklerinin takip edilebildiği, tamamen yerel ortamda çalışan (Node.js + Text tabanlı veritabanı) bir web uygulamasıdır.

## Özellikler

- **Kart Oluşturma:** Kullanıcıların bilgilerini girip anında QR kod ve vCard üretebildiği modern bir arayüz.
- **Dijital Kartvizit Görüntüleme:** Taratılan QR kod üzerinden açılan, mobil uyumlu ve şık kartvizit sayfası. Rehbere kaydetme ve paylaşma seçenekleri sunar.
- **Yönetim Paneli:** Şifre korumalı (varsayılan: `admin123`) panel üzerinden toplam kartlar, tarama istatistikleri, aktif/pasif durum yönetimi ve canlı tarama logları görüntülenebilir.
- **Yerel Veritabanı:** Harici bir veritabanına ihtiyaç duymaz. Veriler `/data` klasörü içindeki `kartlar.txt` ve `analitik.txt` dosyalarında tutulur.

## Gereksinimler

- Node.js (v14 veya üzeri)
- npm (Node Package Manager)

## Kurulum ve Çalıştırma

1. Proje dosyalarının bulunduğu klasörde bir terminal açın.
2. Bağımlılıkları yüklemek için aşağıdaki komutu çalıştırın:
   ```bash
   npm install
   ```
3. Sunucuyu başlatmak için aşağıdaki komutu çalıştırın:
   ```bash
   npm start
   ```
   (Alternatif olarak geliştirme ortamı için `npm run dev` kullanabilirsiniz.)
4. Tarayıcınızda şu adresi açın:
   `http://localhost:3000`

## Kullanım Kılavuzu

- **Kart Oluşturma:** Ana sayfada formdaki zorunlu alanları (Ad, Soyad) ve isteğe bağlı diğer iletişim bilgilerinizi doldurun. Tema renginizi seçin ve "Kartviziti ve QR Kodu Oluştur" butonuna basın. Açılan ekranda QR kodunuzu indirebilir veya doğrudan bağlantıyı kopyalayabilirsiniz.
- **Admin Paneli:** `http://localhost:3000/admin.html` adresine gidin. Şifre olarak `admin123` girerek (varsayılan) panele erişebilirsiniz. Buradan kartvizitleri silebilir, devre dışı bırakabilir ve detaylı analitikleri inceleyebilirsiniz.

## Güvenlik Notları

Admin şifresini değiştirmek isterseniz `server.js` dosyası içindeki `ADMIN_PASS` değişkenini düzenleyebilir veya uygulamayı başlatırken bir çevre değişkeni (`ADMIN_PASS=yenisifre npm start`) olarak tanımlayabilirsiniz.
