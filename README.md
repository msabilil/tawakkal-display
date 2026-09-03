# Layar Jadwal Sholat Masjid

Aplikasi web statis untuk layar monitor di masjid At-Tawakkal 2. Menampilkan jam, jadwal harian (Imsak, Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya) waktu Kota Bandung (mewakili Astana Anyar), dan countdown ke sholat berikutnya. Saat masuk waktu sholat, layar pindah ke halaman iqomah terpisah. Ada halaman admin untuk mengatur durasi iqomah dan override jadwal untuk testing.

## Halaman

- `index.html` - layar utama, jalan terus selama tidak ada sholat yang masuk waktunya.
- `iqomah.html` - halaman terpisah yang otomatis dibuka oleh `index.html` begitu waktu sholat masuk, menghitung mundur iqomah, lalu balik sendiri ke `index.html`.
- `admin.html` - pengaturan durasi iqomah dan override jadwal untuk testing.

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

## Pengaturan

- **Nama masjid:** edit `NAMA_MASJID` di `js/config.js`.
- **Durasi iqomah:** klik ikon setting di kanan atas layar utama, atau buka `admin.html`.
- **Testing (uji coba halaman iqomah):** di `admin.html` bagian "Pengujian", isi jam salah satu waktu sholat (misal Dzuhur, 1-2 menit dari sekarang) lalu centang "Aktifkan override" dan Simpan. Balik ke layar utama, tunggu, halaman iqomah otomatis muncul. Field yang dikosongkan tetap pakai jadwal asli. Klik "Reset ke Jadwal Asli" untuk mematikan override.

## Catatan

- Jadwal memakai waktu **Kota Bandung** (id 1219, API MyQuran). Selisih antar kecamatan <1 menit, diabaikan.
- **Hari Jumat:** mode iqomah untuk Dzuhur otomatis dilewati (khutbah ditangani manual).
- Jika internet mati, layar tetap jalan memakai jadwal cache terakhir dan menampilkan indikator offline.
- Ikon waktu sholat dari [Tabler Icons](https://tabler.io/icons) (lisensi MIT), disimpan di `js/icons.js`.

## Menjalankan test logika

Fungsi murni (hitung sholat berikutnya, state iqomah) diuji lewat `js/app.test.html` - buka file itu di Chrome, hasil PASS/FAIL tampil di layar dan console.
