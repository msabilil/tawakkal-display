# Layar Jadwal Sholat Masjid

Aplikasi web statis untuk layar monitor di masjid. Menampilkan jam, jadwal sholat Kota Bandung (mewakili Astana Anyar), countdown, dan mode iqomah. Ada halaman admin untuk mengatur durasi iqomah.

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
- **Durasi iqomah:** klik tombol ⚙ di pojok kanan bawah layar, atau buka `admin.html`.

## Catatan

- Jadwal memakai waktu **Kota Bandung** (id 1219, API MyQuran). Selisih antar kecamatan <1 menit, diabaikan.
- **Hari Jumat:** mode iqomah untuk Dzuhur otomatis dilewati (khutbah ditangani manual).
- Jika internet mati, layar tetap jalan memakai jadwal cache terakhir dan menampilkan indikator offline.

## Menjalankan test logika

Fungsi murni (hitung sholat berikutnya, state iqomah) diuji lewat `js/app.test.html` — buka file itu di Chrome, hasil PASS/FAIL tampil di layar dan console.
