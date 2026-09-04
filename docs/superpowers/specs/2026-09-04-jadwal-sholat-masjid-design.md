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

---

# Addendum — Fitur Murotal, QR Donasi, Jadwal Pengajian, Nada Iqomah

Tanggal: 2026-09-04 (revisi)

## Tujuan Tambahan

Empat fitur baru di atas fondasi yang ada, tanpa mengubah arsitektur multi-page (`index.html` display + `iqomah.html` overlay terpisah + `admin.html` setting):

1. **Murotal sebelum adzan** — audio otomatis main beberapa menit sebelum tiap sholat, sumber file offline (upload) dan/atau API online, playlist berurutan lanjut posisi.
2. **QR donasi** — gambar QR diupload pengurus, tampil bergilir (rotasi) di layar utama.
3. **Jadwal pengajian** — daftar kajian (mingguan berulang + tanggal spesifik), tampil bergilir di slot rotasi yang sama dengan QR.
4. **Nada dering iqomah** — bunyi sekali saat mode iqomah mulai; default beep sintetis, bisa diganti file upload.

## Batasan & Asumsi Tambahan

- **Autoplay audio**: kiosk Chrome harus dijalankan dengan flag `--autoplay-policy=no-user-gesture-required` supaya murotal & nada bisa main tanpa interaksi. Kalau autoplay tetap diblok (browser biasa), tampil indikator "klik layar untuk aktifkan suara" — sekali klik meng-unlock AudioContext & `<audio>`. Dicatat di README.
- **Storage file audio**: file murotal/nada upload disimpan di **IndexedDB** (bukan localStorage — audio bisa puluhan MB, lewat kuota localStorage ~5MB). DB: `masjidMediaDB`, object store `media` (key = id string seperti `"murotal:<uuid>"` / `"nadaIqomah"`, value = Blob).
- **QR donasi & jadwal pengajian**: data kecil (gambar QR di-resize/kompres wajar, teks jadwal) — tetap di **localStorage** (base64 untuk QR).
- IndexedDB tidak tersedia (private mode) → fitur audio upload dilewati diam-diam; nada iqomah fallback ke beep sintetis; murotal API tetap jalan (URL, tak butuh IndexedDB).
- Track API online butuh koneksi; kalau offline saat sesi murotal, track API di-skip, lanjut ke track offline berikutnya di playlist.

## Sumber Data — API Murotal (EQuran.id)

- Daftar surah + audio: `GET https://equran.id/api/v2/surat` (CORS `access-control-allow-origin: *`, terverifikasi jalan dari browser).
- Response: `data[]`, tiap item `{ nomor, namaLatin, jumlahAyat, audioFull: { "01".."06": <mp3 url> } }`.
- Enam qori (key `audioFull`): `01` Abdullah Al-Juhany, `02` Abdul Muhsin Al-Qasim, `03` Abdurrahman as-Sudais, `04` Ibrahim Al-Dossari, `05` Misyari Rasyid Al-Afasi, `06` Yasser Al-Dosari. Nama qori di-hardcode (konstanta di config) — tidak perlu endpoint terpisah.
- Admin fetch daftar surah sekali saat buka form (cache di memori); track API yang ditambah ke playlist disimpan sebagai referensi `{ tipe: "api", surah: <nomor>, qori: "<01..06>", label: "<namaLatin> - <qori>", url: "<mp3 url>" }` di localStorage. URL mp3 di-stream langsung dari CDN saat main (tak diunduh ke IndexedDB).

## Struktur File (perubahan)

```
jadwal-sholat-masjid/
  js/
    config.js       # + KONSTANTA: QORI (map 01..06 -> nama), DEFAULT_MUROTAL, DEFAULT_ROTASI
    media-db.js     # BARU: wrapper IndexedDB (putMedia, getMedia, delMedia, listMedia)
    murotal.js      # BARU: state playlist, jadwal main, kontrol <audio>, simpan/lanjut posisi
    rotasi.js       # BARU: logika slot rotasi (jadwal pengajian <-> QR donasi)
    jadwal-pengajian.js # BARU: load/save/normalisasi entri (mingguan + tanggal)
    settings.js     # + load/save: murotalSettings, rotasiSettings, qrDonasi, jadwalPengajian
    app.js          # + panggil murotal.tick() & rotasi.tick() di loop utama
    admin.js        # + 4 blok form baru
    iqomah.js       # + main nada dering sekali saat load
  admin.html         # + section: Murotal, Nada Iqomah, QR Donasi, Jadwal Pengajian
  index.html         # + elemen: indikator murotal, slot rotasi, unlock-audio prompt
```

## Fitur 1 — Murotal

### Setting (admin, localStorage key `murotalSettings`)

```
{
  aktif: true,
  mulaiMenit: 15,      // mulai main X menit sebelum jam sholat
  berhentiMenit: 3,    // berhenti Y menit sebelum jam sholat (jeda hening); 0 = main sampai pas adzan
  perSholat: { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true }, // aktif per sholat
  playlist: [ /* item, lihat bawah */ ],
  posisi: { index: 0, detik: 0 }   // lanjut track & offset terakhir
}
```

Item playlist:
- Offline: `{ id, tipe: "offline", label: "<nama file>", mediaKey: "murotal:<uuid>" }` (blob di IndexedDB).
- API: `{ id, tipe: "api", label, surah, qori, url }`.

Validasi: `mulaiMenit` > `berhentiMenit` ≥ 0. Kalau tidak, tolak simpan dengan pesan.

### Jadwal main (index.html, dipanggil tiap detik dari `tick()`)

Untuk tiap sholat aktif (`perSholat[key] && murotalSettings.aktif`):
- Jendela main = `[jamSholat - mulaiMenit, jamSholat - berhentiMenit)`.
- Kalau `now` masuk jendela salah satu sholat DAN belum main → mulai playlist dari `posisi`.
- Kalau `now` keluar semua jendela DAN sedang main → stop, simpan `posisi` (index track + `audio.currentTime`).
- Cuma satu jendela aktif pada satu waktu (sholat berurutan, jarak > mulaiMenit).

### Playback (`murotal.js`)

- Satu elemen `<audio>` di index.html.
- Offline: `URL.createObjectURL(blob)` dari IndexedDB. API: set `src = url`.
- `ended` → next track (index+1, wrap ke 0), reset detik 0, lanjut main.
- Track API gagal load (`error` event / offline) → skip ke track berikutnya (guard anti-loop: kalau semua track gagal dalam satu putaran, stop diam-diam).
- Simpan `posisi.detik` berkala (`timeupdate`, throttle ~5 detik) + saat stop + `beforeunload` (supaya navigate ke iqomah.html tak kehilangan posisi).
- **Stop sebelum iqomah**: `mulaiIqomah()` di app.js panggil `murotal.stop()` (simpan posisi) sebelum `location.href`. Audio mati otomatis saat page unload; simpan posisi yang penting.
- Indikator layar utama: elemen kecil "🔊 Murotal: `<label>`" (`hidden` saat tidak main). Tanpa kontrol volume — atur di OS.

### Unlock audio (fallback non-kiosk)

- Saat pertama coba `audio.play()` di-reject (autoplay policy) → set flag, tampilkan overlay "Klik layar untuk mengaktifkan suara". Klik mana pun → `audio.play()` (unlock) lalu langsung `pause()` kalau belum waktunya, sembunyikan overlay. Di kiosk dengan flag, overlay tak pernah muncul.

## Fitur 2 & 3 — Slot Rotasi (QR Donasi + Jadwal Pengajian)

Satu area di layar utama (`#slot-rotasi`), bergilir antar "kartu". Jam, tanggal, grid sholat, countdown tetap fix (tak ikut rotasi). Saat mode iqomah, halaman pindah ke iqomah.html → rotasi berhenti sendiri.

### Setting (admin, localStorage key `rotasiSettings`)

```
{ jadwalPengajianDetik: 20, qrDonasiDetik: 15 }
```

### Logika (`rotasi.js`)

- Kartu tersedia = daftar dinamis: `jadwal-pengajian` (kalau ada ≥1 entri aktif) + `qr-donasi` (kalau `qrDonasi` sudah diupload).
- 0 kartu tersedia → slot `hidden`.
- 1 kartu → tampil terus, tak berganti.
- ≥2 kartu → cycle urut, tiap kartu tampil sesuai durasinya (`*Detik`), transisi sederhana (fade opsional).
- Dijalankan pakai timer sendiri berbasis `Date.now()` (bukan `setTimeout` bersarang yang rawan drift) — di-tick dari loop utama: simpan `slotAktif` + `gantiPada` (timestamp), saat `now >= gantiPada` maju ke kartu berikutnya.

### Kartu QR Donasi

- `localStorage.qrDonasi` = `{ dataUrl: "data:image/...", judul: "Donasi Masjid", teks: "Scan untuk berdonasi via QRIS" }`.
- Render: gambar QR besar di tengah slot + judul + teks. Upload via admin (input file → FileReader → dataURL; kompres bila > ~500KB opsional, YAGNI kalau QR kecil).

### Kartu Jadwal Pengajian

- Tampilkan hingga 3 entri terdekat/relevan (mingguan yang cocok + tanggal mendatang), format: nama kegiatan, hari/tanggal + jam, pengisi (kalau ada).

## Fitur 3 (data) — Jadwal Pengajian

### Data (admin, localStorage key `jadwalPengajian`)

Array entri, dua tipe:
- Mingguan: `{ id, tipe: "mingguan", hari: 0..6, jam: "HH:MM", nama, pengisi }` (0=Minggu).
- Tanggal: `{ id, tipe: "tanggal", tanggal: "YYYY-MM-DD", jam: "HH:MM", nama, pengisi }`.

### Logika (`jadwal-pengajian.js`)

- `loadAktif(now)`: kembalikan entri yang masih relevan:
  - Mingguan: selalu relevan (berulang).
  - Tanggal: hanya kalau `tanggal >= hari ini` (auto-hide yang sudah lewat; entri lama tak dihapus dari storage, cuma disembunyikan — pengurus bisa hapus manual).
- Urut untuk tampil: gabungan diurut berdasar kejadian berikutnya (tanggal mendatang terdekat & hari mingguan terdekat dari `now`).

### Admin

- Form tambah: pilih tipe (mingguan/tanggal) → tampilkan field sesuai (dropdown hari ATAU `<input type="date">`), `<input type="time">`, nama, pengisi (opsional).
- List entri tersimpan dengan tombol hapus tiap baris. Edit = hapus + tambah ulang (YAGNI, tak perlu inline edit).

## Fitur 4 — Nada Dering Iqomah

- Main **sekali** saat `iqomah.html` load (di `iqomah.js`, awal, sebelum/berbarengan tick pertama).
- Sumber: kalau ada file custom di IndexedDB key `nadaIqomah` → main blob itu via `<audio>`. Kalau tidak → **beep sintetis** Web Audio API (oscillator, mis. 2–3 beep pendek ~800Hz). Nol asset file bawaan.
- Admin: upload file nada (opsional) + tombol "Tes nada" + tombol "Hapus (kembali ke default beep)".
- Kena autoplay policy juga → di kiosk aman (flag); di browser biasa nada mungkin diblok kalau belum ada interaksi (dapat diterima, iqomah tetap jalan visual).

## Perubahan Config

```
export const QORI = { "01": "Abdullah Al-Juhany", "02": "Abdul Muhsin Al-Qasim",
  "03": "Abdurrahman as-Sudais", "04": "Ibrahim Al-Dossari",
  "05": "Misyari Rasyid Al-Afasi", "06": "Yasser Al-Dosari" };
export const DEFAULT_MUROTAL = { aktif:false, mulaiMenit:15, berhentiMenit:3,
  perSholat:{subuh:true,dzuhur:true,ashar:true,maghrib:true,isya:true},
  playlist:[], posisi:{index:0,detik:0} };
export const DEFAULT_ROTASI = { jadwalPengajianDetik:20, qrDonasiDetik:15 };
```

Default `murotal.aktif = false` — fitur audio tidak main sampai pengurus sengaja mengaktifkan & menambah minimal satu track (hindari layar diam-diam bunyi sebelum dikonfigurasi).

## Error Handling (tambahan)

- IndexedDB gagal buka → `media-db.js` return null di semua getter; murotal skip track offline, nada fallback beep. Tak ada crash.
- Track/nada blob hilang (mediaKey tak ada di DB, mis. dihapus) → skip track / fallback beep.
- QR dataURL rusak → `<img>` `onerror` sembunyikan kartu QR dari rotasi.
- Semua fitur baru "additive": kalau storage kosong/gagal, layar utama existing tetap jalan normal (jam, jadwal, iqomah).

## Testing (tambahan, manual + reuse `js/testing.js` override waktu)

- **Murotal jendela**: set override waktu ke `jamSubuh - 10 menit` → murotal mulai; ke `jamSubuh - 2 menit` (berhentiMenit=3) → murotal stop; masuk iqomah → posisi tersimpan, tak error.
- **Lanjut posisi**: main sebentar, reload/stop, cek `murotalSettings.posisi` terupdate, sesi berikut lanjut track & detik yang sama.
- **Playlist campur**: 1 track offline + 1 API, cek `ended` pindah track, wrap ke awal.
- **Track API gagal**: matikan network → track API di-skip, offline tetap main.
- **Rotasi**: dengan QR + jadwal keduanya ada → cek gilir sesuai durasi; hapus salah satu → sisanya tampil terus; kosongkan keduanya → slot `hidden`; masuk iqomah → rotasi berhenti (page pindah).
- **Jadwal pengajian**: tambah entri mingguan (hari ini) & tanggal lampau & tanggal mendatang → cek yang lampau auto-hide, urutan tampil benar; hapus entri.
- **Nada iqomah**: default beep bunyi saat masuk iqomah; upload custom → bunyi custom; hapus → balik beep; tombol "Tes nada" di admin.
- **Unlock audio**: jalankan tanpa flag kiosk → overlay "klik untuk aktifkan suara" muncul, klik → hilang & audio jalan.
- **Fallback storage**: simulasi IndexedDB gagal (private window) → murotal offline & nada custom dilewati, layar utama tetap normal.
