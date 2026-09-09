# Layar Jadwal Sholat Masjid

Aplikasi web statis untuk layar monitor di masjid At-Tawakkal 2. Menampilkan jam, jadwal harian (Imsak, Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya) waktu Kota Bandung (mewakili Astana Anyar), dan countdown ke sholat berikutnya. Saat masuk waktu sholat, layar pindah ke tampilan iqomah. Ada halaman admin untuk mengatur durasi iqomah dan semua setting layar lainnya.

## Halaman

`index.html` satu-satunya layar display - berisi 5 "view" (section yang di-toggle lewat JS, bukan halaman terpisah, biar fullscreen browser tidak ke-reset tiap gantian - lihat `js/navigasi.js`):

- **sholat** - view default, jalan terus selama tidak ada sholat yang masuk waktunya.
- **iqomah** - otomatis tampil begitu waktu sholat masuk: fase Adzan (tanpa hitung mundur) dulu, lalu fase Iqomah (hitung mundur), baru balik sendiri ke view sholat.
- **jumat** - otomatis tampil di jam Dzuhur hari Jumat (kalau ada slide diatur), gambar/video bergilir, lalu balik sendiri ke view sholat.
- **qr**, **kegiatan** - layar sekunder yang gantian otomatis di antara jadwal sholat.

`admin.html` - pengaturan semua view di atas (durasi, latar belakang, override testing, dll). `demo.html` - preview semua view berurutan lewat iframe, dipakai buat nunjukin ke pengurus tanpa buka admin.

## Menjalankan

**Opsi cepat:** buka `index.html` di Chrome (dobel klik). Butuh internet untuk ambil jadwal pertama kali; setelahnya jalan dari cache.

**Opsi server (disarankan untuk kiosk):**
1. Install Python.
2. Di folder proyek: `python -m http.server 8000`
3. Buka `http://localhost:8000/index.html`

## Kiosk mode (Windows)

Buat shortcut Chrome dengan target:
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=http://localhost:8000/index.html
```
Atau tanpa server: ganti dengan `file:///` path ke `index.html`.

## Suara (murotal & nada iqomah)

Agar murotal sebelum adzan dan nada iqomah bisa berbunyi otomatis tanpa
interaksi, jalankan Chrome kiosk dengan flag autoplay:

    chrome --kiosk --autoplay-policy=no-user-gesture-required "file:///path/index.html"

Tanpa flag ini, browser memblokir autoplay dan layar menampilkan overlay
"Ketuk layar untuk mengaktifkan suara" — cukup diketuk sekali.

File murotal offline dan nada iqomah kustom diunggah lewat halaman admin dan
disimpan di IndexedDB browser perangkat kiosk (tetap ada walau tanpa internet).
Murotal juga bisa memakai audio dari API EQuran.id (butuh koneksi saat diputar).

## Latar belakang per layar & slide Jum'at

Layar Adzan, Iqomah, QR Donasi, dan Jum'at bisa dikasih foto latar (atau
gambar/video bergilir khusus Jum'at) lewat admin. Ini nulis file ASLI ke
folder `img/` (bukan IndexedDB) pakai File System Access API - jadi:

- Cuma jalan di **Chrome/Edge**, dan admin.html **wajib** dibuka lewat
  `http://localhost:8000` (server lokal), bukan dobel-klik file `file://`.
- Sekali per browser: klik "Pilih Folder img/" di sidebar admin, arahkan
  **langsung ke folder `img/` project ini** (bukan folder root), lalu izinkan akses.
- View iqomah, qr, dan jumat di `index.html` cukup baca file lewat path
  relatif `img/...` - tidak butuh izin folder sama sekali, jadi jalan normal
  walau dibuka dari `file://`.

## Pengaturan tambahan (admin)

- Murotal: aktif/nonaktif, menit mulai & berhenti sebelum adzan, per-sholat, playlist (file + API).
- Nada iqomah: unggah nada kustom atau pakai beep default.
- Adzan: durasi tampil (menit) sebelum pindah ke fase Iqomah, + latar belakang.
- QR donasi: unggah gambar QR, tampil bergilir di layar, + latar belakang.
- Jadwal pengajian: kegiatan mingguan atau tanggal khusus, tampil bergilir di layar.
- Jum'at: durasi total mode + daftar slide gambar/video yang tampil di jam Dzuhur hari Jumat.

## Pengaturan

- **Nama masjid:** edit `NAMA_MASJID` di `js/config.js`.
- **Durasi iqomah:** klik ikon setting di kanan atas layar utama, atau buka `admin.html`.
- **Testing (uji coba halaman iqomah):** di `admin.html` bagian "Pengujian", isi jam salah satu waktu sholat (misal Dzuhur, 1-2 menit dari sekarang) lalu centang "Aktifkan override" dan Simpan. Balik ke layar utama, tunggu, halaman iqomah otomatis muncul. Field yang dikosongkan tetap pakai jadwal asli. Klik "Reset ke Jadwal Asli" untuk mematikan override.

## Catatan

- Jadwal memakai waktu **Kota Bandung** (id 1219, API MyQuran). Selisih antar kecamatan <1 menit, diabaikan.
- **Hari Jumat:** mode iqomah normal untuk Dzuhur dilewati, gantinya view jumat yang tampil (lihat "Latar belakang per layar & slide Jum'at") - tapi cuma kalau ada minimal 1 slide diatur di admin, kalau kosong ya dilewati diam-diam seperti sebelumnya.
- Jika internet mati, layar tetap jalan memakai jadwal cache terakhir dan menampilkan indikator offline.
- Ikon waktu sholat dari [Tabler Icons](https://tabler.io/icons) (lisensi MIT), disimpan di `js/icons.js`.

## Menjalankan test logika

Fungsi murni (hitung sholat berikutnya, state iqomah) diuji lewat `js/app.test.html` - buka file itu di Chrome, hasil PASS/FAIL tampil di layar dan console. Test serupa juga ada untuk fitur lain: `js/media-db.test.html`, `js/jadwal-pengajian.test.html`, `js/rotasi.test.html`, `js/murotal.test.html`, `js/jumat-mode.test.html`, `js/demo-slide.test.html` - dibuka dengan cara yang sama (lewat server lokal, sama seperti `app.test.html`).
