# Layar Jadwal Sholat Masjid — Design Spec

Tanggal: 2026-09-04

## Tujuan

Aplikasi web statis untuk ditampilkan di layar monitor 16 inch (landscape) yang terhubung ke komputer Windows di masjid. Menampilkan jadwal sholat harian berdasarkan waktu Kota Bandung (mewakili wilayah Astana Anyar), jam real-time, dan countdown menuju sholat berikutnya. Admin bisa mengatur durasi iqomah per sholat lewat halaman terpisah.

Target pengguna layar utama: jemaah umum (bapak-bapak/ibu-ibu), termasuk lansia — UI harus kontras tinggi, font besar, informasi minim-distraksi, mudah dibaca dari jarak jauh.

## Batasan & Asumsi

- Device: Windows + Chrome, dijalankan fullscreen/kiosk mode (`chrome --kiosk index.html` atau F11).
- Tanpa server backend, tanpa build tool, tanpa framework — HTML/CSS/JS vanilla.
- Data jadwal sholat: granularity kota/kabupaten (Kota Bandung), bukan kecamatan — kecamatan Astana Anyar direpresentasikan oleh jadwal Kota Bandung karena API publik tidak menyediakan presisi kecamatan, dan selisih waktu sholat antar kecamatan dalam satu kota <1 menit (diabaikan).
- Halaman admin tidak dikunci PIN (device dianggap dipegang oleh pengurus masjid, akses lewat tombol tersembunyi/url langsung).
- Device diasumsikan menyala terus (kiosk 24/7); tidak perlu handle "app baru dibuka setelah mati berhari-hari" secara khusus selain fetch ulang saat load.

## Sumber Data

API: MyQuran v2 — `https://api.myquran.com/v2/sholat/jadwal/{id_kota}/{tahun}/{bulan}/{tanggal}`

- `id_kota` untuk Kota Bandung dicari sekali lewat endpoint `https://api.myquran.com/v2/sholat/kota/cari/bandung`, di-hardcode di config (tidak perlu lookup runtime).
- Fetch dilakukan: (1) saat halaman pertama kali dimuat, (2) otomatis tiap pukul 00:05 (cek via interval, bandingkan tanggal lokal).
- Response disimpan ke `localStorage` sebagai cache: `{ tanggal, jadwal: {subuh, dzuhur, ashar, maghrib, isya}, fetchedAt }`.
- Kalau fetch gagal (offline/API down): pakai cache terakhir kalau tanggalnya masih valid untuk hari ini; kalau cache juga tidak ada/beda tanggal, tampilkan pesan error kecil di pojok layar, jam & countdown tetap jalan pakai jadwal cache terakhir yang ada (fallback ke data kemarin lebih baik daripada kosong).
- Indikator kecil non-intrusive di pojok layar kalau sedang pakai data cache/offline: "⚠ data offline — update terakhir: DD/MM HH:MM".

## Struktur File

```
jadwal-sholat-masjid/
  index.html       # layar utama (display)
  admin.html        # halaman setting iqomah
  css/style.css
  js/config.js      # konstanta: id_kota, nama masjid, urutan sholat
  js/api.js         # fetch + cache jadwal
  js/app.js         # render layar utama, countdown, mode iqomah
  js/admin.js       # form setting iqomah, baca/tulis localStorage
  docs/...
```

## Layar Utama (index.html)

Layout landscape, dominan warna gelap kontras tinggi (putih/emas di atas navy/hitam — umum dipakai layar masjid, gampang dibaca siang/malam), tanpa scroll.

Elemen:
1. **Header**: nama masjid (config) + label kota "Astana Anyar, Kota Bandung"
2. **Jam digital besar**: HH:MM:SS real-time (update tiap detik), tanggal Masehi + Hijriah di bawahnya
3. **Grid 5 waktu sholat**: Subuh, Dzuhur, Ashar, Maghrib, Isya — masing-masing kolom berisi nama + jam. Sholat berikutnya di-highlight (background beda/border menyala).
4. **Countdown**: "Menuju [Nama Sholat]: HH:MM:SS" di bawah grid, update tiap detik.
5. **Indikator cache offline** (kondisional, pojok bawah, kecil).
6. **Tombol admin tersembunyi**: elemen kecil transparan di pojok (misal pojok kanan bawah, ukuran kecil) yang klik-nya membuka `admin.html`.

### Mode Iqomah

Saat waktu sholat tercapai (jam sekarang == jam sholat) dan sholat itu aktif (lihat setting admin):
- Layar beralih ke tampilan khusus: teks besar "Waktu [Nama Sholat] telah masuk" lalu countdown iqomah "IQOMAH: MM:SS" (durasi dari setting admin untuk sholat tsb).
- Setelah countdown iqomah habis, layar kembali otomatis ke tampilan normal (lanjut ke countdown sholat berikutnya).
- Kalau durasi iqomah untuk sholat tsb di-set 0 atau sholat dinonaktifkan di admin, mode iqomah dilewati (langsung balik normal / tidak masuk mode ini).

Catatan Jumat: Dzuhur hari Jumat biasanya diganti Sholat Jumat (durasi khutbah beda, bukan iqomah singkat). Untuk versi ini, field durasi Dzuhur di admin punya sub-catatan "khusus Jumat" opsional — tapi tidak dibuat kompleks: kalau hari Jumat, mode iqomah untuk Dzuhur otomatis dilewati (anggap ditangani manual oleh pengurus, karena durasi khutbah tidak tetap).

## Halaman Admin (admin.html)

Form sederhana, 5 baris (satu per sholat):
- Nama sholat (label, tidak diedit)
- Input angka: durasi iqomah (menit), default masuk akal (mis. Subuh 10, Dzuhur 10, Ashar 10, Maghrib 5, Isya 10)
- Checkbox: aktifkan mode iqomah untuk sholat ini (default: semua aktif)

Tombol "Simpan" — tulis ke `localStorage` key `iqomahSettings`. Tombol "Kembali ke Layar Utama" — link ke `index.html`.

`index.html` membaca `iqomahSettings` dari `localStorage` setiap kali cek status sholat (tiap detik), jadi perubahan dari admin langsung berlaku begitu user balik ke index.html (tidak perlu real-time sync antar tab, karena di kiosk cuma satu tab aktif pada satu waktu).

## Error Handling

- Fetch API gagal → fallback cache (lihat bagian Sumber Data). Tidak ada retry agresif — cukup coba lagi di fetch berikutnya (load ulang halaman / jam 00:05).
- `localStorage` tidak tersedia (mode private/disabled) — kasus sangat jarang untuk kiosk dedicated, tidak ditangani khusus (di luar scope).
- Config `id_kota` salah/API berubah struktur — akan terlihat sebagai fetch gagal biasa, ditangani lewat fallback cache + indikator error.

## Testing

Manual di Chrome (tanpa test framework — proyek statis kecil):
- Cek jam & tanggal berjalan akurat.
- Cek highlight sholat berikutnya benar sepanjang hari (test dengan override waktu via DevTools/console kalau perlu).
- Cek transisi masuk/keluar mode iqomah pas jam sholat tercapai.
- Cek fallback offline: matikan network di DevTools, reload, pastikan cache lama tetap tampil + indikator muncul.
- Cek admin: ubah durasi, checkbox nonaktif, balik ke index.html, pastikan reflect.
- Cek tampilan di ukuran window ~16:9 kecil (simulasikan 16 inch, resize browser) — font tidak terpotong, tidak perlu scroll.
