# Fitur Murotal, QR Donasi, Jadwal Pengajian, Nada Iqomah — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah empat fitur ke layar jadwal sholat masjid — murotal otomatis sebelum adzan (file offline via IndexedDB + API EQuran.id), QR donasi & jadwal pengajian yang tampil bergilir di satu slot rotasi, dan nada dering saat mode iqomah mulai.

**Architecture:** Tetap HTML/CSS/JS vanilla ES modules, tanpa build tool, multi-page (`index.html` display, `iqomah.html` overlay, `admin.html` setting). Logika murni (jendela murotal, siklus rotasi, filter jadwal pengajian) dipisah ke fungsi pure yang diuji lewat file `*.test.html` (pola yang sama dengan `js/app.test.html` yang sudah ada). File audio besar disimpan di IndexedDB; data kecil (setting, QR base64, jadwal) di localStorage. Tiap modul view memegang DOM-nya sendiri; `app.js` cuma memanggil `tickMurotal()` dan `renderSlotRotasi()` di loop 1 detik yang sudah ada.

**Tech Stack:** HTML5, CSS3, JavaScript ES6 modules, IndexedDB, Web Audio API (beep sintetis), `<audio>`, Fetch API (EQuran.id), localStorage. Tanpa npm/framework/build.

**Spec:** `docs/superpowers/specs/2026-09-04-jadwal-sholat-masjid-design.md` (bagian Addendum)

## Global Constraints

- Tanpa dependency eksternal, tanpa `package.json`, tanpa build step. Dibuka langsung di Chrome (kiosk).
- Kiosk perlu flag `--autoplay-policy=no-user-gesture-required` agar audio auto-play. Fallback non-kiosk: overlay "klik untuk aktifkan suara".
- Storage: file audio upload → IndexedDB `masjidMediaDB`, object store `media` (keyPath implisit lewat `put(blob, key)`). Data kecil → localStorage.
- localStorage keys baru: `murotalSettings`, `rotasiSettings`, `qrDonasi`, `jadwalPengajian`. IndexedDB media keys: `murotal:<uuid>`, `nadaIqomah`.
- API murotal: `GET https://equran.id/api/v2/surat` (CORS `*`, terverifikasi). Field per surah: `nomor`, `namaLatin`, `audioFull` (map `"01".."06"` → url mp3).
- 6 qori (key `audioFull`): `01` Abdullah Al-Juhany, `02` Abdul Muhsin Al-Qasim, `03` Abdurrahman as-Sudais, `04` Ibrahim Al-Dossari, `05` Misyari Rasyid Al-Afasi, `06` Yasser Al-Dosari.
- 5 sholat dengan murotal/iqomah: subuh, dzuhur, ashar, maghrib, isya (konstanta `SHOLAT` yang sudah ada di `config.js`).
- Bahasa UI: Indonesia. Semua komentar kode, commit message, dan dokumen ditulis prosa normal (bukan gaya caveman).
- Fitur bersifat additive: kalau storage kosong/gagal, layar utama existing tetap jalan normal.

---

## File Structure

```
jadwal-sholat-masjid/
  js/
    waktu.js              # BARU: parseHM (dipindah dari app.js agar dipakai bersama tanpa circular import)
    config.js             # MODIFIKASI: + QORI, DEFAULT_MUROTAL, DEFAULT_ROTASI
    media-db.js           # BARU: wrapper IndexedDB (putMedia, getMedia, delMedia)
    jadwal-pengajian.js   # BARU: load/save + entriAktif/kejadianBerikutnya (pure)
    rotasi.js             # BARU: load/save rotasi & QR + rotasiMaju (pure) + renderSlotRotasi
    murotal.js            # BARU: load/save + murotalWindow (pure) + kontrol playback
    nada.js               # BARU: mainkanNada (custom blob atau beep sintetis)
    app.js                # MODIFIKASI: import parseHM dari waktu.js; panggil tickMurotal & renderSlotRotasi; stopMurotal sebelum iqomah
    iqomah.js             # MODIFIKASI: mainkan nada sekali saat load
    admin.js              # MODIFIKASI: + 4 blok form
  index.html              # MODIFIKASI: + <audio>, indikator murotal, #slot-rotasi, overlay unlock audio
  iqomah.html             # MODIFIKASI: + <audio id="audio-nada">
  admin.html              # MODIFIKASI: + 4 section
  css/style.css           # MODIFIKASI: + gaya slot rotasi, indikator murotal, overlay unlock, form admin baru
  js/*.test.html          # BARU: media-db.test.html, jadwal-pengajian.test.html, rotasi.test.html, murotal.test.html
```

Pemisahan tanggung jawab: tiap fitur satu modul yang memegang logika + view-nya sendiri; `app.js` hanya orkestrator tipis. `waktu.js` menampung `parseHM` supaya `app.js`, `murotal.js`, dan `jadwal-pengajian.js` memakainya tanpa saling meng-import (hindari circular import karena `app.js` akan meng-import `murotal.js`).

---

## Testing Approach

Sama dengan proyek existing: tanpa test framework. Fungsi pure diuji lewat halaman `*.test.html` yang meng-import fungsi, menjalankan assertion `eq(name, got, want)`, menampilkan `PASS/FAIL` di `<pre>` + console. Jalankan lewat server lokal (`python -m http.server 8000`) lalu buka `http://localhost:8000/js/<nama>.test.html`. Untuk IndexedDB, test memakai assertion async.

Bagian impure (kontrol `<audio>`, IndexedDB streaming, rendering DOM, timer rotasi) diverifikasi manual di Chrome memakai override waktu yang sudah ada di `js/testing.js`.

Helper assertion standar yang dipakai di semua `*.test.html`:

```javascript
const out = [];
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; out.push(`PASS ${name}`); }
  else { fail++; out.push(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
}
function selesai() {
  out.unshift(`${pass} PASS, ${fail} FAIL\n`);
  document.getElementById("out").textContent = out.join("\n");
  console.log(out.join("\n"));
}
```

---

### Task 1: Ekstrak `parseHM` ke `waktu.js` + konstanta config baru

**Files:**
- Create: `js/waktu.js`
- Modify: `js/config.js` (tambah konstanta di akhir)
- Modify: `js/app.js:3-8` (ganti definisi `parseHM` jadi import + re-export)

**Interfaces:**
- Produces:
  - `js/waktu.js`: `export function parseHM(hhmm, baseDate)` → `Date` (jam:menit di tanggal `baseDate`, detik/ms = 0). Identik dengan implementasi lama di `app.js`.
  - `js/config.js`: `export const QORI` (map `"01".."06"` → nama), `export const DEFAULT_MUROTAL`, `export const DEFAULT_ROTASI`.
  - `js/app.js`: tetap `export { parseHM }` (re-export) supaya `js/app.test.html` yang meng-import `parseHM` dari `./app.js` tidak rusak.

- [ ] **Step 1: Tulis `js/waktu.js`**

```javascript
// Helper waktu murni yang dipakai bersama oleh app.js, murotal.js, dan
// jadwal-pengajian.js. Dipisah agar tidak ada circular import.
export function parseHM(hhmm, baseDate) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}
```

- [ ] **Step 2: Ganti definisi `parseHM` di `js/app.js`**

Ganti baris 1-8 lama (yang berisi `import { SHOLAT } from "./config.js";` lalu definisi `export function parseHM(...)`) menjadi:

```javascript
import { SHOLAT } from "./config.js";
import { parseHM } from "./waktu.js";
export { parseHM };
```

Sisa `app.js` (fungsi `nextSholat`, `iqomahState`, dst.) tetap memakai `parseHM` yang kini datang dari import. Jangan ubah bagian lain.

- [ ] **Step 3: Tambah konstanta di akhir `js/config.js`**

```javascript

export const QORI = {
  "01": "Abdullah Al-Juhany",
  "02": "Abdul Muhsin Al-Qasim",
  "03": "Abdurrahman as-Sudais",
  "04": "Ibrahim Al-Dossari",
  "05": "Misyari Rasyid Al-Afasi",
  "06": "Yasser Al-Dosari",
};

export const DEFAULT_MUROTAL = {
  aktif: false,               // baru main setelah pengurus aktifkan & isi playlist
  mulaiMenit: 15,             // mulai murotal X menit sebelum jam sholat
  berhentiMenit: 3,           // berhenti Y menit sebelum jam sholat (0 = sampai pas adzan)
  perSholat: { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true },
  playlist: [],               // item: {id,tipe:"offline",label,mediaKey} atau {id,tipe:"api",label,surah,qori,url}
  posisi: { index: 0, detik: 0 },
};

export const DEFAULT_ROTASI = { jadwalPengajianDetik: 20, qrDonasiDetik: 15 };
```

- [ ] **Step 4: Verifikasi test lama tetap hijau**

Jalankan: `python -m http.server 8000` lalu buka `http://localhost:8000/js/app.test.html`.
Expected: header menampilkan `9 PASS, 0 FAIL` (jumlah sama seperti sebelum perubahan).

- [ ] **Step 5: Commit**

```bash
git add js/waktu.js js/config.js js/app.js
git commit -m "refactor: extract parseHM to waktu.js, add murotal/rotasi config constants"
```

---

### Task 2: Wrapper IndexedDB (`media-db.js`)

**Files:**
- Create: `js/media-db.js`
- Test: `js/media-db.test.html`

**Interfaces:**
- Produces:
  - `export async function putMedia(key, blob)` → `Promise<boolean>` (true jika sukses; false jika IndexedDB tak tersedia/gagal)
  - `export async function getMedia(key)` → `Promise<Blob|null>` (null jika tak ada atau gagal)
  - `export async function delMedia(key)` → `Promise<void>` (diam jika gagal)

- [ ] **Step 1: Tulis test `js/media-db.test.html`**

```html
<!doctype html>
<meta charset="utf-8">
<title>Test media-db.js</title>
<pre id="out"></pre>
<script type="module">
import { putMedia, getMedia, delMedia } from "./media-db.js";

const out = [];
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; out.push(`PASS ${name}`); }
  else { fail++; out.push(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
}

const key = "test:blob1";
const blob = new Blob(["assalamualaikum"], { type: "text/plain" });

const ok = await putMedia(key, blob);
eq("putMedia sukses", ok, true);

const got = await getMedia(key);
eq("getMedia balik Blob", got instanceof Blob, true);
eq("getMedia isi benar", await got.text(), "assalamualaikum");

await delMedia(key);
eq("getMedia setelah del null", await getMedia(key), null);

eq("getMedia key tak ada null", await getMedia("test:tidakada"), null);

out.unshift(`${pass} PASS, ${fail} FAIL\n`);
document.getElementById("out").textContent = out.join("\n");
console.log(out.join("\n"));
</script>
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Buka `http://localhost:8000/js/media-db.test.html`.
Expected: FAIL / error "does not provide an export named 'putMedia'" (file belum ada).

- [ ] **Step 3: Tulis `js/media-db.js`**

```javascript
// Wrapper minimal IndexedDB untuk menyimpan Blob audio (murotal offline & nada iqomah).
// Semua fungsi menelan error dan mengembalikan nilai netral supaya fitur audio
// bisa dilewati diam-diam kalau IndexedDB tidak tersedia (mis. mode private).

const DB_NAME = "masjidMediaDB";
const STORE = "media";

function openDB() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putMedia(key, blob) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function getMedia(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function delMedia(key) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    // diam
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Buka `http://localhost:8000/js/media-db.test.html`.
Expected: `5 PASS, 0 FAIL`.

- [ ] **Step 5: Commit**

```bash
git add js/media-db.js js/media-db.test.html
git commit -m "feat: add IndexedDB media wrapper for audio blobs"
```

---

### Task 3: Jadwal pengajian (`jadwal-pengajian.js`)

**Files:**
- Create: `js/jadwal-pengajian.js`
- Test: `js/jadwal-pengajian.test.html`

**Interfaces:**
- Consumes: `parseHM` dari `waktu.js`
- Produces:
  - `export function loadJadwalPengajian()` → array entri (dari `localStorage["jadwalPengajian"]`, `[]` jika kosong/rusak)
  - `export function saveJadwalPengajian(arr)` → void
  - `export function kejadianBerikutnya(entry, now)` → `Date` kejadian berikutnya dari entri. Mingguan: hari+jam berikutnya ≥ `now` (bila hari ini sudah lewat jamnya, minggu depan). Tanggal: `tanggal`+`jam` (Date pasti, bisa di masa lalu). Pure.
  - `export function entriAktif(now, entries)` → entri yang masih relevan (mingguan selalu; tanggal hanya bila `tanggal` ≥ hari `now`), diurut menaik berdasar `kejadianBerikutnya`. Pure.

Bentuk entri:
- Mingguan: `{ id, tipe: "mingguan", hari: 0..6, jam: "HH:MM", nama, pengisi }` (0 = Minggu)
- Tanggal: `{ id, tipe: "tanggal", tanggal: "YYYY-MM-DD", jam: "HH:MM", nama, pengisi }`

- [ ] **Step 1: Tulis test `js/jadwal-pengajian.test.html`**

```html
<!doctype html>
<meta charset="utf-8">
<title>Test jadwal-pengajian.js</title>
<pre id="out"></pre>
<script type="module">
import { entriAktif, kejadianBerikutnya } from "./jadwal-pengajian.js";

const out = [];
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; out.push(`PASS ${name}`); }
  else { fail++; out.push(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
}

// Acuan: Kamis 2026-09-03 pukul 08:00. getDay(): Kamis = 4.
const now = new Date(2026, 8, 3, 8, 0, 0);

const mingguanJumat = { id: "a", tipe: "mingguan", hari: 5, jam: "05:00", nama: "Kajian Subuh", pengisi: "Ust. A" };
const tanggalLampau = { id: "b", tipe: "tanggal", tanggal: "2026-09-01", jam: "19:30", nama: "Tabligh", pengisi: "Ust. B" };
const tanggalNanti = { id: "c", tipe: "tanggal", tanggal: "2026-09-10", jam: "19:30", nama: "Tabligh Akbar", pengisi: "Ust. C" };
const mingguanKamisSore = { id: "d", tipe: "mingguan", hari: 4, jam: "15:30", nama: "Kajian Ashar", pengisi: "Ust. D" };

// kejadianBerikutnya mingguan Jumat 05:00 dari Kamis 08:00 -> besok (Jumat 2026-09-04 05:00)
const kb = kejadianBerikutnya(mingguanJumat, now);
eq("mingguan berikutnya tanggal", kb.getDate(), 4);
eq("mingguan berikutnya jam", kb.getHours(), 5);

// mingguan Kamis 15:30, sekarang Kamis 08:00 -> hari ini (belum lewat)
const kb2 = kejadianBerikutnya(mingguanKamisSore, now);
eq("mingguan hari ini blm lewat", kb2.getDate(), 3);

// tanggal lampau di-hide, tanggal nanti + mingguan tampil
const aktif = entriAktif(now, [mingguanJumat, tanggalLampau, tanggalNanti, mingguanKamisSore]);
eq("tanggal lampau disembunyikan", aktif.find(e => e.id === "b"), undefined);
eq("jumlah aktif", aktif.length, 3);

// urutan: kejadian terdekat dulu. Kamis 15:30 (id d) < Jumat 05:00 (id a) < 10 Sep (id c)
eq("urutan terdekat dulu", aktif.map(e => e.id), ["d", "a", "c"]);

out.unshift(`${pass} PASS, ${fail} FAIL\n`);
document.getElementById("out").textContent = out.join("\n");
console.log(out.join("\n"));
</script>
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Buka `http://localhost:8000/js/jadwal-pengajian.test.html`.
Expected: error "does not provide an export named 'entriAktif'".

- [ ] **Step 3: Tulis `js/jadwal-pengajian.js`**

```javascript
import { parseHM } from "./waktu.js";

const KEY = "jadwalPengajian";

export function loadJadwalPengajian() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveJadwalPengajian(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

// "YYYY-MM-DD" -> Date lokal awal hari (hindari parsing UTC dari new Date("YYYY-MM-DD")).
function parseTanggal(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function kejadianBerikutnya(entry, now) {
  if (entry.tipe === "tanggal") {
    return parseHM(entry.jam, parseTanggal(entry.tanggal));
  }
  // mingguan: cari hari yang cocok mulai dari hari ini (selisih 0..6)
  for (let tambah = 0; tambah < 7; tambah++) {
    const kandidat = new Date(now);
    kandidat.setDate(kandidat.getDate() + tambah);
    if (kandidat.getDay() !== entry.hari) continue;
    const waktu = parseHM(entry.jam, kandidat);
    if (waktu >= now) return waktu;
    // hari cocok tapi jamnya sudah lewat: lanjut ke minggu depan
  }
  // fallback: minggu depan pada hari yang sama
  const lanjut = new Date(now);
  lanjut.setDate(lanjut.getDate() + 7);
  return parseHM(entry.jam, lanjut);
}

export function entriAktif(now, entries) {
  const hariIni = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return entries
    .filter((e) => {
      if (e.tipe === "mingguan") return true;
      return parseTanggal(e.tanggal) >= hariIni; // tanggal lampau disembunyikan
    })
    .sort((a, b) => kejadianBerikutnya(a, now) - kejadianBerikutnya(b, now));
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Buka `http://localhost:8000/js/jadwal-pengajian.test.html`.
Expected: `7 PASS, 0 FAIL`.

- [ ] **Step 5: Commit**

```bash
git add js/jadwal-pengajian.js js/jadwal-pengajian.test.html
git commit -m "feat: add jadwal pengajian storage and active-entry filtering"
```

---

### Task 4: Rotasi slot (`rotasi.js`)

**Files:**
- Create: `js/rotasi.js`
- Test: `js/rotasi.test.html`

**Interfaces:**
- Consumes: `DEFAULT_ROTASI` dari `config.js`; `loadJadwalPengajian`, `entriAktif` dari `jadwal-pengajian.js`
- Produces:
  - `export function loadRotasi()` / `saveRotasi(s)` → `{jadwalPengajianDetik, qrDonasiDetik}` (merge dengan `DEFAULT_ROTASI`)
  - `export function loadQr()` → `{dataUrl, judul, teks}` atau `null`; `saveQr(obj)`; `clearQr()`
  - `export function rotasiMaju(state, nowMs, kartu, durasiDetik)` → `{ idx, gantiPada, aktif }`. Pure. `kartu` = array id kartu (mis. `["jadwal","qr"]`); `durasiDetik` = map id→detik. Logika: bila `state` null / `kartu` berubah dari `state.kartuKey` → reset ke idx 0, `gantiPada = nowMs + durasiDetik[kartu[0]]*1000`. Bila `nowMs >= state.gantiPada` → idx maju (wrap), `gantiPada` baru. Selain itu pertahankan `state`. `aktif` = `kartu[idx]` (atau `null` bila `kartu` kosong).
  - `export function renderSlotRotasi(slotEl, now)` → view: hitung kartu tersedia (jadwal bila ada entri aktif, qr bila `loadQr()` ada), majukan state internal via `rotasiMaju`, render kartu aktif ke `slotEl` (atau `slotEl.hidden = true` bila 0 kartu). Memegang state modul sendiri.

- [ ] **Step 1: Tulis test `js/rotasi.test.html`** (hanya menguji `rotasiMaju` yang pure)

```html
<!doctype html>
<meta charset="utf-8">
<title>Test rotasi.js</title>
<pre id="out"></pre>
<script type="module">
import { rotasiMaju } from "./rotasi.js";

const out = [];
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; out.push(`PASS ${name}`); }
  else { fail++; out.push(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
}

const durasi = { jadwal: 20, qr: 15 };
const kartu = ["jadwal", "qr"];

// state awal null -> mulai di idx 0, gantiPada = 1000 + 20*1000
let s = rotasiMaju(null, 1000, kartu, durasi);
eq("mulai aktif jadwal", s.aktif, "jadwal");
eq("mulai gantiPada", s.gantiPada, 1000 + 20000);

// belum waktunya ganti (now < gantiPada) -> tetap
s = rotasiMaju(s, 5000, kartu, durasi);
eq("belum ganti tetap jadwal", s.aktif, "jadwal");

// lewat gantiPada -> maju ke qr, gantiPada = 21000 + 15*1000
s = rotasiMaju(s, 21000, kartu, durasi);
eq("maju ke qr", s.aktif, "qr");
eq("qr gantiPada", s.gantiPada, 21000 + 15000);

// maju lagi -> wrap ke jadwal
s = rotasiMaju(s, 40000, kartu, durasi);
eq("wrap balik jadwal", s.aktif, "jadwal");

// kartu berubah (tinggal qr) -> reset ke idx 0 = qr
s = rotasiMaju(s, 41000, ["qr"], durasi);
eq("kartu berubah reset", s.aktif, "qr");

// kartu kosong -> aktif null
s = rotasiMaju(s, 42000, [], durasi);
eq("kartu kosong null", s.aktif, null);

out.unshift(`${pass} PASS, ${fail} FAIL\n`);
document.getElementById("out").textContent = out.join("\n");
console.log(out.join("\n"));
</script>
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Buka `http://localhost:8000/js/rotasi.test.html`.
Expected: error "does not provide an export named 'rotasiMaju'".

- [ ] **Step 3: Tulis `js/rotasi.js`**

```javascript
import { DEFAULT_ROTASI } from "./config.js";
import { loadJadwalPengajian, entriAktif } from "./jadwal-pengajian.js";

const KEY_ROTASI = "rotasiSettings";
const KEY_QR = "qrDonasi";

export function loadRotasi() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_ROTASI));
    return s ? { ...DEFAULT_ROTASI, ...s } : { ...DEFAULT_ROTASI };
  } catch {
    return { ...DEFAULT_ROTASI };
  }
}

export function saveRotasi(s) {
  localStorage.setItem(KEY_ROTASI, JSON.stringify(s));
}

export function loadQr() {
  try {
    const q = JSON.parse(localStorage.getItem(KEY_QR));
    return q && q.dataUrl ? q : null;
  } catch {
    return null;
  }
}

export function saveQr(obj) {
  localStorage.setItem(KEY_QR, JSON.stringify(obj));
}

export function clearQr() {
  localStorage.removeItem(KEY_QR);
}

// Siklus murni. state: {idx, gantiPada, kartuKey} | null.
export function rotasiMaju(state, nowMs, kartu, durasiDetik) {
  const kartuKey = kartu.join(",");
  if (!kartu.length) return { idx: 0, gantiPada: 0, kartuKey, aktif: null };
  if (!state || state.kartuKey !== kartuKey) {
    return { idx: 0, gantiPada: nowMs + durasiDetik[kartu[0]] * 1000, kartuKey, aktif: kartu[0] };
  }
  if (nowMs >= state.gantiPada) {
    const idx = (state.idx + 1) % kartu.length;
    return { idx, gantiPada: nowMs + durasiDetik[kartu[idx]] * 1000, kartuKey, aktif: kartu[idx] };
  }
  return { ...state, aktif: kartu[state.idx] };
}

const HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function renderKartuJadwal(now) {
  const entri = entriAktif(now, loadJadwalPengajian()).slice(0, 3);
  const baris = entri.map((e) => {
    const kapan = e.tipe === "mingguan"
      ? `${HARI_NAMA[e.hari]} ${e.jam}`
      : `${e.tanggal.split("-").reverse().join("/")} ${e.jam}`;
    const pengisi = e.pengisi ? `<span class="rotasi-pengisi">${e.pengisi}</span>` : "";
    return `<li class="rotasi-item"><span class="rotasi-nama">${e.nama}</span><span class="rotasi-kapan">${kapan}</span>${pengisi}</li>`;
  }).join("");
  return `<div class="rotasi-kartu rotasi-jadwal"><p class="rotasi-judul">Jadwal Pengajian</p><ul class="rotasi-list">${baris}</ul></div>`;
}

function renderKartuQr(qr) {
  return `<div class="rotasi-kartu rotasi-qr">
    <p class="rotasi-judul">${qr.judul || "Donasi"}</p>
    <img class="rotasi-qr-img" src="${qr.dataUrl}" alt="QR Donasi">
    <p class="rotasi-qr-teks">${qr.teks || ""}</p>
  </div>`;
}

let state = null;

export function renderSlotRotasi(slotEl, now) {
  const durasiSetting = loadRotasi();
  const durasi = { jadwal: durasiSetting.jadwalPengajianDetik, qr: durasiSetting.qrDonasiDetik };
  const qr = loadQr();
  const kartu = [];
  if (entriAktif(now, loadJadwalPengajian()).length) kartu.push("jadwal");
  if (qr) kartu.push("qr");

  state = rotasiMaju(state, now.getTime(), kartu, durasi);
  if (!state.aktif) {
    slotEl.hidden = true;
    slotEl.innerHTML = "";
    return;
  }
  slotEl.hidden = false;
  const htmlBaru = state.aktif === "jadwal" ? renderKartuJadwal(now) : renderKartuQr(qr);
  // Hanya tulis ulang bila kartu aktif berganti, agar tidak reflow tiap detik.
  if (slotEl.dataset.aktif !== state.aktif) {
    slotEl.dataset.aktif = state.aktif;
    slotEl.innerHTML = htmlBaru;
  } else if (state.aktif === "jadwal") {
    slotEl.innerHTML = htmlBaru; // jadwal bisa berubah isi seiring waktu; murah
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Buka `http://localhost:8000/js/rotasi.test.html`.
Expected: `8 PASS, 0 FAIL`.

- [ ] **Step 5: Commit**

```bash
git add js/rotasi.js js/rotasi.test.html
git commit -m "feat: add rotasi slot logic for jadwal pengajian and QR donasi"
```

---

### Task 5: Logika murni murotal (`murotal.js` bagian pure)

**Files:**
- Create: `js/murotal.js` (bagian setting + `murotalWindow`; kontrol playback ditambah di Task 6)
- Test: `js/murotal.test.html`

**Interfaces:**
- Consumes: `SHOLAT`, `DEFAULT_MUROTAL` dari `config.js`; `parseHM` dari `waktu.js`
- Produces:
  - `export function loadMurotal()` → object bentuk `DEFAULT_MUROTAL` (merge; `perSholat` & `posisi` di-merge dalam)
  - `export function saveMurotal(s)` → void
  - `export function murotalWindow(now, jadwal, settings)` → `{ key }` sholat yang jendela murotalnya aktif, atau `null`. Jendela sholat `key` = `[jamSholat - mulaiMenit, jamSholat - berhentiMenit)`. Hanya sholat dengan `settings.perSholat[key]` true dan `settings.aktif` true. Pure.

- [ ] **Step 1: Tulis test `js/murotal.test.html`**

```html
<!doctype html>
<meta charset="utf-8">
<title>Test murotal.js</title>
<pre id="out"></pre>
<script type="module">
import { murotalWindow } from "./murotal.js";

const out = [];
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; out.push(`PASS ${name}`); }
  else { fail++; out.push(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
}

const jadwal = { subuh:"04:34", dzuhur:"11:52", ashar:"15:09", maghrib:"17:56", isya:"19:01" };
const set = {
  aktif: true, mulaiMenit: 15, berhentiMenit: 3,
  perSholat: { subuh:true, dzuhur:true, ashar:true, maghrib:true, isya:true },
};
const hari = (h, m) => new Date(2026, 8, 3, h, m, 0);

// Dzuhur 11:52. Jendela = [11:37, 11:49). 11:40 -> aktif dzuhur.
eq("dalam jendela dzuhur", murotalWindow(hari(11,40), jadwal, set), { key: "dzuhur" });
// 11:37 tepat awal -> aktif (inklusif)
eq("awal jendela inklusif", murotalWindow(hari(11,37), jadwal, set), { key: "dzuhur" });
// 11:49 tepat akhir -> null (eksklusif, sudah masuk jeda hening)
eq("akhir jendela eksklusif", murotalWindow(hari(11,49), jadwal, set), null);
// 11:52 (jam adzan) -> null
eq("jam adzan null", murotalWindow(hari(11,52), jadwal, set), null);
// 11:30 (sebelum mulai) -> null
eq("sebelum mulai null", murotalWindow(hari(11,30), jadwal, set), null);

// perSholat dzuhur false -> null walau dalam jendela
const setOff = { ...set, perSholat: { ...set.perSholat, dzuhur: false } };
eq("perSholat off null", murotalWindow(hari(11,40), jadwal, setOff), null);

// aktif global false -> null
eq("aktif false null", murotalWindow(hari(11,40), jadwal, { ...set, aktif: false }), null);

// berhentiMenit 0 -> jendela sampai pas adzan. 11:50 -> aktif.
eq("berhenti0 sampai adzan", murotalWindow(hari(11,50), jadwal, { ...set, berhentiMenit: 0 }), { key: "dzuhur" });

out.unshift(`${pass} PASS, ${fail} FAIL\n`);
document.getElementById("out").textContent = out.join("\n");
console.log(out.join("\n"));
</script>
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Buka `http://localhost:8000/js/murotal.test.html`.
Expected: error "does not provide an export named 'murotalWindow'".

- [ ] **Step 3: Tulis `js/murotal.js` (bagian pure + setting)**

```javascript
import { SHOLAT, DEFAULT_MUROTAL } from "./config.js";
import { parseHM } from "./waktu.js";

const KEY = "murotalSettings";

export function loadMurotal() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    return {
      ...DEFAULT_MUROTAL,
      ...s,
      perSholat: { ...DEFAULT_MUROTAL.perSholat, ...(s.perSholat || {}) },
      posisi: { ...DEFAULT_MUROTAL.posisi, ...(s.posisi || {}) },
      playlist: Array.isArray(s.playlist) ? s.playlist : [],
    };
  } catch {
    return { ...DEFAULT_MUROTAL };
  }
}

export function saveMurotal(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

// Sholat yang jendela murotalnya sedang aktif, atau null.
// Jendela key = [jamSholat - mulaiMenit, jamSholat - berhentiMenit).
export function murotalWindow(now, jadwal, settings) {
  if (!settings.aktif) return null;
  for (const { key } of SHOLAT) {
    if (!settings.perSholat[key]) continue;
    const t = parseHM(jadwal[key], now);
    const start = new Date(t.getTime() - settings.mulaiMenit * 60000);
    const end = new Date(t.getTime() - settings.berhentiMenit * 60000);
    if (now >= start && now < end) return { key };
  }
  return null;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Buka `http://localhost:8000/js/murotal.test.html`.
Expected: `8 PASS, 0 FAIL`.

- [ ] **Step 5: Commit**

```bash
git add js/murotal.js js/murotal.test.html
git commit -m "feat: add murotal settings and pre-adzan window logic"
```

---

### Task 6: Kontrol playback murotal (`murotal.js` bagian impure)

**Files:**
- Modify: `js/murotal.js` (tambah controller di bawah bagian pure)

**Interfaces:**
- Consumes: `getMedia` dari `media-db.js`; `murotalWindow`, `loadMurotal`, `saveMurotal` (dari file yang sama)
- Produces:
  - `export function initMurotal(refs)` → simpan referensi `{ audioEl, indikatorEl, labelEl, overlayEl }`, pasang event handler `ended`/`error`/`timeupdate`.
  - `export function tickMurotal(now, jadwal)` → dipanggil tiap detik dari `app.js`. Mulai playback bila masuk jendela & belum main; stop & simpan posisi bila keluar jendela & sedang main; perbarui indikator.
  - `export function stopMurotal()` → stop + simpan posisi (dipanggil `app.js` sebelum navigasi ke `iqomah.html`).

- [ ] **Step 1: Tambah controller di akhir `js/murotal.js`**

```javascript

import { getMedia } from "./media-db.js";

let audioEl = null, indikatorEl = null, labelEl = null, overlayEl = null;
let sedangMain = false;
let objectUrl = null;         // URL blob offline yang perlu di-revoke
let gagalBeruntun = 0;        // guard anti-loop kalau semua track gagal
let simpanTerakhir = 0;       // throttle simpan posisi

export function initMurotal(refs) {
  audioEl = refs.audioEl;
  indikatorEl = refs.indikatorEl;
  labelEl = refs.labelEl;
  overlayEl = refs.overlayEl;

  audioEl.addEventListener("ended", () => {
    gagalBeruntun = 0;
    majuTrack(+1, 0);
  });
  audioEl.addEventListener("error", () => {
    if (!sedangMain) return;
    gagalBeruntun++;
    const s = loadMurotal();
    if (gagalBeruntun >= s.playlist.length) { hentikan(false); return; } // semua gagal
    majuTrack(+1, 0);
  });
  audioEl.addEventListener("timeupdate", () => {
    if (!sedangMain) return;
    const kini = Date.now();
    if (kini - simpanTerakhir > 5000) { simpanTerakhir = kini; simpanPosisi(); }
  });

  if (overlayEl) {
    overlayEl.addEventListener("click", () => {
      audioEl.play().then(() => audioEl.pause()).catch(() => {});
      overlayEl.hidden = true;
    });
  }
}

function simpanPosisi() {
  const s = loadMurotal();
  s.posisi = { index: s.posisi.index, detik: audioEl.currentTime || 0 };
  saveMurotal(s);
}

async function muatTrack(item) {
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  if (item.tipe === "offline") {
    const blob = await getMedia(item.mediaKey);
    if (!blob) return false;
    objectUrl = URL.createObjectURL(blob);
    audioEl.src = objectUrl;
  } else {
    audioEl.src = item.url;
  }
  return true;
}

async function mainkanIndex(index, detik) {
  const s = loadMurotal();
  if (!s.playlist.length) return;
  const idx = ((index % s.playlist.length) + s.playlist.length) % s.playlist.length;
  const item = s.playlist[idx];
  s.posisi = { index: idx, detik: detik || 0 };
  saveMurotal(s);
  const ok = await muatTrack(item);
  if (!ok) { gagalBeruntun++; if (gagalBeruntun < s.playlist.length) majuTrack(+1, 0); return; }
  audioEl.currentTime = detik || 0;
  try {
    await audioEl.play();
    if (overlayEl) overlayEl.hidden = true;
  } catch {
    // Autoplay diblok (bukan kiosk): tampilkan overlay unlock.
    if (overlayEl) overlayEl.hidden = false;
  }
  tampilIndikator(item.label);
}

function majuTrack(arah, detik) {
  const s = loadMurotal();
  if (!s.playlist.length) return;
  mainkanIndex(s.posisi.index + arah, detik);
}

function tampilIndikator(label) {
  if (!indikatorEl) return;
  if (labelEl) labelEl.textContent = label || "";
  indikatorEl.hidden = false;
}

function hentikan(simpan) {
  if (simpan && audioEl && !audioEl.paused) simpanPosisi();
  if (audioEl) { audioEl.pause(); }
  if (indikatorEl) indikatorEl.hidden = true;
  sedangMain = false;
  gagalBeruntun = 0;
}

export function tickMurotal(now, jadwal) {
  if (!audioEl) return;
  const s = loadMurotal();
  const win = murotalWindow(now, jadwal, s);
  if (win && !sedangMain) {
    sedangMain = true;
    gagalBeruntun = 0;
    mainkanIndex(s.posisi.index, s.posisi.detik);
  } else if (!win && sedangMain) {
    hentikan(true);
  }
}

export function stopMurotal() {
  hentikan(true);
}
```

- [ ] **Step 2: Verifikasi manual playback (butuh Task 8 untuk elemen DOM)**

Catatan: verifikasi penuh dilakukan setelah Task 8 memasang `<audio>` dan indikator di `index.html`. Untuk sekarang cukup pastikan file ter-parse tanpa error sintaks:

Buka `http://localhost:8000/js/murotal.test.html` lagi.
Expected: `8 PASS, 0 FAIL` (test pure tetap jalan; penambahan controller tidak merusak import).

- [ ] **Step 3: Commit**

```bash
git add js/murotal.js
git commit -m "feat: add murotal playback controller with position save and autoplay fallback"
```

---

### Task 7: Nada dering iqomah (`nada.js` + wiring `iqomah`)

**Files:**
- Create: `js/nada.js`
- Modify: `iqomah.html` (tambah `<audio id="audio-nada">`)
- Modify: `js/iqomah.js` (mainkan nada sekali saat load)

**Interfaces:**
- Consumes: `getMedia` dari `media-db.js`
- Produces:
  - `js/nada.js`: `export async function mainkanNada(audioEl)` → putar blob `nadaIqomah` dari IndexedDB bila ada; kalau tidak, `beep()`. `export function beep()` → 3 beep pendek via Web Audio API.

- [ ] **Step 1: Tulis `js/nada.js`**

```javascript
import { getMedia } from "./media-db.js";

// Tiga beep pendek sebagai nada default (tanpa file aset).
export function beep() {
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  const mulai = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    const t = mulai + i * 0.35;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

export async function mainkanNada(audioEl) {
  const blob = await getMedia("nadaIqomah");
  if (blob && audioEl) {
    const url = URL.createObjectURL(blob);
    audioEl.src = url;
    audioEl.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    try {
      await audioEl.play();
      return;
    } catch {
      // gagal (autoplay diblok) -> fallback beep
    }
  }
  beep();
}
```

- [ ] **Step 2: Tambah elemen audio di `iqomah.html`**

Sisipkan sebelum `<script type="module" src="js/iqomah.js"></script>`:

```html
  <audio id="audio-nada" preload="auto"></audio>
```

- [ ] **Step 3: Panggil nada di `js/iqomah.js`**

Tambah di awal file (setelah `const KEY = "iqomahAktif";`, sebelum `tick()` dipanggil di bawah) import dan pemanggilan. Ubah bagian bawah file dari:

```javascript
tick();
setInterval(tick, 1000);
```

menjadi:

```javascript
import { mainkanNada } from "./nada.js";

mainkanNada(document.getElementById("audio-nada"));
tick();
setInterval(tick, 1000);
```

Catatan: pindahkan baris `import { mainkanNada } from "./nada.js";` ke atas file (baris import harus di scope modul teratas; letakkan tepat di bawah `const KEY = "iqomahAktif";` atau di baris pertama). Contoh susunan atas file:

```javascript
import { mainkanNada } from "./nada.js";

const KEY = "iqomahAktif";
```

dan di bawah file cukup:

```javascript
mainkanNada(document.getElementById("audio-nada"));
tick();
setInterval(tick, 1000);
```

- [ ] **Step 4: Verifikasi manual**

Buka `http://localhost:8000/iqomah.html` langsung. Karena tanpa state `iqomahAktif` halaman akan redirect ke index; untuk mengetes nada, pakai override di admin (Task 8/9) atau sementara set `localStorage.setItem("iqomahAktif", JSON.stringify({label:"Dzuhur", endTime:new Date(Date.now()+60000).toISOString()}))` di console lalu buka `iqomah.html`.
Expected: terdengar 3 beep pendek saat halaman load; countdown iqomah tampil.

- [ ] **Step 5: Commit**

```bash
git add js/nada.js iqomah.html js/iqomah.js
git commit -m "feat: play ringtone (custom or default beep) when iqomah mode starts"
```

---

### Task 8: Integrasi layar utama (`index.html`, `css/style.css`, `app.js`)

**Files:**
- Modify: `index.html` (elemen slot rotasi, audio murotal, indikator, overlay unlock)
- Modify: `css/style.css` (gaya elemen baru)
- Modify: `js/app.js` (import & panggil `initMurotal`, `tickMurotal`, `renderSlotRotasi`, `stopMurotal`)

**Interfaces:**
- Consumes: `initMurotal`, `tickMurotal`, `stopMurotal` dari `murotal.js`; `renderSlotRotasi` dari `rotasi.js`

- [ ] **Step 1: Tambah elemen di `index.html`**

Di dalam `<footer class="footer">`, tepat sebelum `<div class="status-bar">` (baris ~199), sisipkan slot rotasi:

```html
    <section id="slot-rotasi" class="slot-rotasi glass-panel" hidden></section>
```

Tambahkan indikator murotal ke dalam `<div class="status-bar">` (di samping indikator lain):

```html
      <div id="murotal-indikator" class="pill-status pill-status-hijau" hidden>
        <span aria-hidden="true">&#128266;</span> Murotal: <span id="murotal-label"></span>
      </div>
```

Sebelum `<script type="module" src="js/app.js"></script>` (baris ~205), tambahkan audio + overlay unlock:

```html
  <audio id="audio-murotal" preload="none"></audio>
  <div id="unlock-audio" class="unlock-audio" hidden>Ketuk layar untuk mengaktifkan suara</div>
```

- [ ] **Step 2: Tambah gaya di `css/style.css`**

Tambahkan di akhir file:

```css
/* Slot rotasi (jadwal pengajian / QR donasi) */
.slot-rotasi {
  margin-top: 1vh;
  padding: 1.2vh 1.4vw;
  min-height: 16vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rotasi-kartu { width: 100%; text-align: center; }
.rotasi-judul { font-size: clamp(16px, 2vw, 28px); font-weight: 700; margin: 0 0 0.6vh; opacity: 0.85; }
.rotasi-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4vh; }
.rotasi-item { display: flex; gap: 1vw; justify-content: center; align-items: baseline; font-size: clamp(16px, 2.1vw, 30px); }
.rotasi-nama { font-weight: 700; }
.rotasi-kapan { opacity: 0.8; }
.rotasi-pengisi { opacity: 0.65; font-style: italic; }
.rotasi-qr { display: flex; flex-direction: column; align-items: center; gap: 0.6vh; }
.rotasi-qr-img { width: clamp(90px, 12vh, 150px); height: auto; background: #fff; padding: 6px; border-radius: 8px; }
.rotasi-qr-teks { font-size: clamp(14px, 1.6vw, 22px); opacity: 0.8; margin: 0; }

/* Overlay unlock audio (hanya muncul kalau autoplay diblok) */
.unlock-audio {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.6); color: #fff;
  font-size: clamp(20px, 4vw, 48px); text-align: center; cursor: pointer;
}
```

Catatan: proyek punya dua tema (`data-versi` lama/baru). Gaya di atas netral (memakai `.glass-panel` & `.pill-status` yang sudah ada) sehingga tampil wajar di kedua versi. Sesuaikan warna bila perlu setelah verifikasi visual.

- [ ] **Step 3: Wire di `js/app.js`**

Tambahkan import di kelompok import atas `app.js` (setelah baris `import { getVersi, setVersi } from "./versi.js";`):

```javascript
import { initMurotal, tickMurotal, stopMurotal } from "./murotal.js";
import { renderSlotRotasi } from "./rotasi.js";
```

Di fungsi `mulaiIqomah(iq)` (baris ~183), tambahkan `stopMurotal();` sebagai baris pertama sebelum menulis `localStorage` / `location.href`:

```javascript
function mulaiIqomah(iq) {
  stopMurotal();
  const endTime = new Date(Date.now() + iq.sisaDetik * 1000).toISOString();
  localStorage.setItem(IQOMAH_KEY, JSON.stringify({ key: iq.key, label: iq.label, endTime }));
  location.href = "iqomah.html";
}
```

Di fungsi `tick()`, tepat sebelum `const next = nextSholat(now, jadwal);` (setelah blok `if (iq) { mulaiIqomah(iq); return; }`), tambahkan panggilan murotal & rotasi:

```javascript
  tickMurotal(now, jadwal);
  renderSlotRotasi($("slot-rotasi"), now);
```

Di fungsi `init()`, setelah `setupTombolVersi();` (baris ~217), inisialisasi murotal:

```javascript
  initMurotal({
    audioEl: $("audio-murotal"),
    indikatorEl: $("murotal-indikator"),
    labelEl: $("murotal-label"),
    overlayEl: $("unlock-audio"),
  });
```

- [ ] **Step 4: Verifikasi manual murotal + rotasi**

Jalankan server lokal, buka `http://localhost:8000/index.html` di Chrome. Untuk mengetes murotal tanpa menunggu waktu asli:
1. Buka `admin.html` (setelah Task 9) → tambah 1 track API ke playlist, aktifkan murotal.
2. Buka `admin.html` → bagian Pengujian → set override jam salah satu sholat ke ~10 menit dari sekarang, aktifkan override.
3. Balik ke `index.html`. Saat masuk jendela `[sholat-15mnt, sholat-3mnt)`, indikator "Murotal" muncul & audio main.
4. Set override ke ~2 menit dari sekarang → murotal berhenti (masuk jeda hening); saat jam sholat tercapai → pindah ke `iqomah.html` (murotal sudah stop, posisi tersimpan di `murotalSettings.posisi`).

Untuk rotasi: tambah entri jadwal pengajian & upload QR (Task 9), lalu cek slot bergilir sesuai durasi.
Expected: indikator murotal muncul/hilang sesuai jendela; slot rotasi bergilir; tak ada error console.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/app.js
git commit -m "feat: wire murotal playback and rotasi slot into main display"
```

---

### Task 9: Form admin (`admin.html` + `admin.js`)

**Files:**
- Modify: `admin.html` (4 section baru)
- Modify: `js/admin.js` (render + simpan 4 fitur)

**Interfaces:**
- Consumes: `loadMurotal`, `saveMurotal` dari `murotal.js`; `loadRotasi`, `saveRotasi`, `loadQr`, `saveQr`, `clearQr` dari `rotasi.js`; `loadJadwalPengajian`, `saveJadwalPengajian` dari `jadwal-pengajian.js`; `putMedia`, `delMedia` dari `media-db.js`; `mainkanNada` dari `nada.js`; `QORI` dari `config.js`; `SHOLAT` dari `config.js`

- [ ] **Step 1: Tambah 4 section di `admin.html`**

Sisipkan di dalam `<div class="admin-wrap">`, setelah section "Pengujian" (sebelum penutup `</div>` wrap):

```html
    <div class="admin-kotak">
      <h1>Murotal Sebelum Adzan</h1>
      <p class="admin-ket">Putar murotal otomatis menjelang waktu sholat. Butuh flag kiosk autoplay (lihat README) atau ketuk layar sekali untuk mengaktifkan suara.</p>
      <form id="form-murotal">
        <label class="aktif-cek testing-toggle">
          <input type="checkbox" id="murotal-aktif"> Aktifkan murotal
        </label>
        <div class="baris">
          <span class="label-sholat">Mulai (menit sebelum adzan)</span>
          <input type="number" min="1" max="60" id="murotal-mulai">
        </div>
        <div class="baris">
          <span class="label-sholat">Berhenti (menit sebelum adzan)</span>
          <input type="number" min="0" max="59" id="murotal-berhenti">
        </div>
        <div id="murotal-per-sholat"></div>
        <div class="admin-aksi">
          <button type="submit" id="tombol-simpan-murotal">Simpan Murotal</button>
        </div>
        <p id="status-murotal" class="status" hidden>Tersimpan.</p>
      </form>

      <h2 class="admin-subjudul">Playlist</h2>
      <ul id="murotal-playlist" class="admin-list"></ul>

      <h2 class="admin-subjudul">Tambah dari file (offline)</h2>
      <div class="baris">
        <input type="file" id="murotal-file" accept="audio/*">
        <button type="button" id="tombol-tambah-file">Tambah</button>
      </div>

      <h2 class="admin-subjudul">Tambah dari API (EQuran.id)</h2>
      <div class="baris">
        <select id="murotal-surah"><option>Memuat surah&hellip;</option></select>
        <select id="murotal-qori"></select>
        <button type="button" id="tombol-tambah-api">Tambah</button>
      </div>
    </div>

    <div class="admin-kotak">
      <h1>Nada Iqomah</h1>
      <p class="admin-ket">Bunyi sekali saat mode iqomah dimulai. Kosong = beep default.</p>
      <div class="baris">
        <input type="file" id="nada-file" accept="audio/*">
        <button type="button" id="tombol-simpan-nada">Simpan Nada</button>
      </div>
      <div class="admin-aksi">
        <button type="button" id="tombol-tes-nada" class="tombol-sekunder">Tes Nada</button>
        <button type="button" id="tombol-hapus-nada" class="tombol-sekunder">Hapus (pakai beep default)</button>
      </div>
      <p id="status-nada" class="status" hidden>Tersimpan.</p>
      <audio id="nada-preview"></audio>
    </div>

    <div class="admin-kotak">
      <h1>QR Donasi</h1>
      <p class="admin-ket">Unggah gambar QR (QRIS). Tampil bergilir di layar utama.</p>
      <form id="form-qr">
        <div class="baris">
          <span class="label-sholat">Judul</span>
          <input type="text" id="qr-judul" placeholder="Donasi Masjid">
        </div>
        <div class="baris">
          <span class="label-sholat">Teks ajakan</span>
          <input type="text" id="qr-teks" placeholder="Scan untuk berdonasi via QRIS">
        </div>
        <div class="baris">
          <input type="file" id="qr-file" accept="image/*">
        </div>
        <img id="qr-preview" class="qr-preview" alt="Pratinjau QR" hidden>
        <div class="admin-aksi">
          <button type="submit" id="tombol-simpan-qr">Simpan QR</button>
          <button type="button" id="tombol-hapus-qr" class="tombol-sekunder">Hapus QR</button>
        </div>
        <p id="status-qr" class="status" hidden>Tersimpan.</p>
      </form>
    </div>

    <div class="admin-kotak">
      <h1>Jadwal Pengajian</h1>
      <p class="admin-ket">Kegiatan mingguan (berulang) atau tanggal khusus. Tanggal yang sudah lewat otomatis disembunyikan di layar.</p>
      <form id="form-pengajian">
        <div class="baris">
          <select id="pengajian-tipe">
            <option value="mingguan">Mingguan</option>
            <option value="tanggal">Tanggal khusus</option>
          </select>
        </div>
        <div class="baris" id="baris-hari">
          <span class="label-sholat">Hari</span>
          <select id="pengajian-hari">
            <option value="0">Minggu</option><option value="1">Senin</option>
            <option value="2">Selasa</option><option value="3">Rabu</option>
            <option value="4">Kamis</option><option value="5">Jumat</option>
            <option value="6">Sabtu</option>
          </select>
        </div>
        <div class="baris" id="baris-tanggal" hidden>
          <span class="label-sholat">Tanggal</span>
          <input type="date" id="pengajian-tanggal">
        </div>
        <div class="baris">
          <span class="label-sholat">Jam</span>
          <input type="time" id="pengajian-jam">
        </div>
        <div class="baris">
          <span class="label-sholat">Nama kegiatan</span>
          <input type="text" id="pengajian-nama" placeholder="Kajian Subuh">
        </div>
        <div class="baris">
          <span class="label-sholat">Pengisi (opsional)</span>
          <input type="text" id="pengajian-pengisi" placeholder="Ust. Fulan">
        </div>
        <div class="admin-aksi">
          <button type="submit" id="tombol-tambah-pengajian">Tambah</button>
        </div>
        <p id="status-pengajian" class="status" hidden>Tersimpan.</p>
      </form>
      <ul id="pengajian-list" class="admin-list"></ul>
    </div>
```

- [ ] **Step 2: Tambah gaya list admin di `css/style.css`**

```css
.admin-subjudul { font-size: 16px; margin: 16px 0 8px; opacity: 0.8; }
.admin-list { list-style: none; margin: 8px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.admin-list li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; background: rgba(0,0,0,0.05); border-radius: 6px; }
.qr-preview { max-width: 160px; margin: 8px 0; background: #fff; padding: 6px; border-radius: 8px; }
```

- [ ] **Step 3: Tambah logika di `js/admin.js`**

Tambahkan import di atas `admin.js` (setelah import yang sudah ada):

```javascript
import { QORI } from "./config.js";
import { loadMurotal, saveMurotal } from "./murotal.js";
import { loadRotasi, saveRotasi, loadQr, saveQr, clearQr } from "./rotasi.js";
import { loadJadwalPengajian, saveJadwalPengajian } from "./jadwal-pengajian.js";
import { putMedia, delMedia } from "./media-db.js";
import { mainkanNada } from "./nada.js";
```

Tambahkan blok fungsi berikut sebelum baris pemanggilan `renderIqomah();` di akhir file:

```javascript
// ---------- Murotal ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function renderMurotal() {
  const s = loadMurotal();
  $("murotal-aktif").checked = s.aktif;
  $("murotal-mulai").value = s.mulaiMenit;
  $("murotal-berhenti").value = s.berhentiMenit;
  const wrap = $("murotal-per-sholat");
  wrap.innerHTML = "";
  for (const { key, label } of SHOLAT) {
    const row = document.createElement("label");
    row.className = "aktif-cek testing-toggle";
    row.innerHTML = `<input type="checkbox" id="murotal-sholat-${key}" ${s.perSholat[key] ? "checked" : ""}> ${label}`;
    wrap.appendChild(row);
  }
  renderPlaylist();
}

function renderPlaylist() {
  const s = loadMurotal();
  const ul = $("murotal-playlist");
  ul.innerHTML = "";
  if (!s.playlist.length) { ul.innerHTML = "<li>(kosong)</li>"; return; }
  s.playlist.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${item.label}</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tombol-sekunder";
    btn.textContent = "Hapus";
    btn.addEventListener("click", async () => {
      const cur = loadMurotal();
      cur.playlist = cur.playlist.filter((p) => p.id !== item.id);
      if (item.tipe === "offline") await delMedia(item.mediaKey);
      if (cur.posisi.index >= cur.playlist.length) cur.posisi = { index: 0, detik: 0 };
      saveMurotal(cur);
      renderPlaylist();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function simpanMurotal(e) {
  e.preventDefault();
  const s = loadMurotal();
  s.aktif = $("murotal-aktif").checked;
  const mulai = parseInt($("murotal-mulai").value, 10);
  const berhenti = parseInt($("murotal-berhenti").value, 10);
  if (!(mulai > berhenti) || berhenti < 0) {
    alert("Menit mulai harus lebih besar dari menit berhenti, dan berhenti minimal 0.");
    return;
  }
  s.mulaiMenit = mulai;
  s.berhentiMenit = berhenti;
  for (const { key } of SHOLAT) s.perSholat[key] = $(`murotal-sholat-${key}`).checked;
  saveMurotal(s);
  tampilkanStatus("status-murotal");
}

async function tambahFileMurotal() {
  const file = $("murotal-file").files[0];
  if (!file) return;
  const mediaKey = "murotal:" + uid();
  const ok = await putMedia(mediaKey, file);
  if (!ok) { alert("Gagal menyimpan file (IndexedDB tidak tersedia)."); return; }
  const s = loadMurotal();
  s.playlist.push({ id: uid(), tipe: "offline", label: file.name, mediaKey });
  saveMurotal(s);
  $("murotal-file").value = "";
  renderPlaylist();
}

let daftarSurah = [];
async function muatDaftarSurah() {
  // Qori
  const qoriSel = $("murotal-qori");
  qoriSel.innerHTML = "";
  for (const [kode, nama] of Object.entries(QORI)) {
    const opt = document.createElement("option");
    opt.value = kode; opt.textContent = nama;
    qoriSel.appendChild(opt);
  }
  // Surah
  try {
    const res = await fetch("https://equran.id/api/v2/surat");
    const body = await res.json();
    daftarSurah = body.data || [];
    const sel = $("murotal-surah");
    sel.innerHTML = "";
    daftarSurah.forEach((su) => {
      const opt = document.createElement("option");
      opt.value = su.nomor;
      opt.textContent = `${su.nomor}. ${su.namaLatin}`;
      sel.appendChild(opt);
    });
  } catch {
    $("murotal-surah").innerHTML = "<option>Gagal memuat (perlu koneksi)</option>";
  }
}

function tambahApiMurotal() {
  const nomor = parseInt($("murotal-surah").value, 10);
  const qori = $("murotal-qori").value;
  const surah = daftarSurah.find((s) => s.nomor === nomor);
  if (!surah || !surah.audioFull || !surah.audioFull[qori]) { alert("Surah/qori tidak tersedia."); return; }
  const s = loadMurotal();
  s.playlist.push({
    id: uid(), tipe: "api", surah: nomor, qori,
    label: `${surah.namaLatin} - ${QORI[qori]}`,
    url: surah.audioFull[qori],
  });
  saveMurotal(s);
  renderPlaylist();
}

// ---------- Nada Iqomah ----------
async function simpanNada() {
  const file = $("nada-file").files[0];
  if (!file) { alert("Pilih file dulu."); return; }
  const ok = await putMedia("nadaIqomah", file);
  if (!ok) { alert("Gagal menyimpan (IndexedDB tidak tersedia)."); return; }
  $("nada-file").value = "";
  tampilkanStatus("status-nada");
}
async function hapusNada() {
  await delMedia("nadaIqomah");
  tampilkanStatus("status-nada");
}
function tesNada() {
  mainkanNada($("nada-preview"));
}

// ---------- QR Donasi ----------
function renderQr() {
  const q = loadQr();
  const r = loadRotasi();
  if (q) {
    $("qr-judul").value = q.judul || "";
    $("qr-teks").value = q.teks || "";
    $("qr-preview").src = q.dataUrl;
    $("qr-preview").hidden = false;
  }
  // durasi rotasi dipakai bersama; sisipkan input durasi sederhana di section QR
  $("qr-judul").dataset.durasiQr = r.qrDonasiDetik;
  $("qr-judul").dataset.durasiJadwal = r.jadwalPengajianDetik;
}

function simpanQr(e) {
  e.preventDefault();
  const file = $("qr-file").files[0];
  const judul = $("qr-judul").value.trim();
  const teks = $("qr-teks").value.trim();
  const simpanObj = (dataUrl) => {
    saveQr({ dataUrl, judul, teks });
    $("qr-preview").src = dataUrl;
    $("qr-preview").hidden = false;
    tampilkanStatus("status-qr");
  };
  if (file) {
    const reader = new FileReader();
    reader.onload = () => simpanObj(reader.result);
    reader.readAsDataURL(file);
  } else {
    const q = loadQr();
    if (!q) { alert("Pilih gambar QR dulu."); return; }
    simpanObj(q.dataUrl); // update judul/teks saja
  }
}
function hapusQr() {
  clearQr();
  $("qr-preview").hidden = true;
  $("qr-judul").value = "";
  $("qr-teks").value = "";
  tampilkanStatus("status-qr");
}

// ---------- Jadwal Pengajian ----------
const HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function toggleTipePengajian() {
  const tipe = $("pengajian-tipe").value;
  $("baris-hari").hidden = tipe !== "mingguan";
  $("baris-tanggal").hidden = tipe !== "tanggal";
}

function renderPengajian() {
  const arr = loadJadwalPengajian();
  const ul = $("pengajian-list");
  ul.innerHTML = "";
  if (!arr.length) { ul.innerHTML = "<li>(belum ada jadwal)</li>"; return; }
  arr.forEach((e) => {
    const kapan = e.tipe === "mingguan" ? `${HARI_NAMA[e.hari]} ${e.jam}` : `${e.tanggal} ${e.jam}`;
    const li = document.createElement("li");
    li.innerHTML = `<span>${e.nama} — ${kapan}${e.pengisi ? " — " + e.pengisi : ""}</span>`;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "tombol-sekunder"; btn.textContent = "Hapus";
    btn.addEventListener("click", () => {
      saveJadwalPengajian(loadJadwalPengajian().filter((x) => x.id !== e.id));
      renderPengajian();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function tambahPengajian(e) {
  e.preventDefault();
  const tipe = $("pengajian-tipe").value;
  const jam = $("pengajian-jam").value;
  const nama = $("pengajian-nama").value.trim();
  const pengisi = $("pengajian-pengisi").value.trim();
  if (!jam || !nama) { alert("Jam dan nama kegiatan wajib diisi."); return; }
  const entry = { id: uid(), tipe, jam, nama, pengisi };
  if (tipe === "mingguan") {
    entry.hari = parseInt($("pengajian-hari").value, 10);
  } else {
    const tanggal = $("pengajian-tanggal").value;
    if (!tanggal) { alert("Tanggal wajib diisi."); return; }
    entry.tanggal = tanggal;
  }
  saveJadwalPengajian([...loadJadwalPengajian(), entry]);
  $("pengajian-nama").value = "";
  $("pengajian-pengisi").value = "";
  tampilkanStatus("status-pengajian");
  renderPengajian();
}
```

Tambahkan pemanggilan render + listener di akhir file (setelah listener yang sudah ada):

```javascript
renderMurotal();
renderQr();
renderPengajian();
muatDaftarSurah();
toggleTipePengajian();

$("form-murotal").addEventListener("submit", simpanMurotal);
$("tombol-tambah-file").addEventListener("click", tambahFileMurotal);
$("tombol-tambah-api").addEventListener("click", tambahApiMurotal);
$("tombol-simpan-nada").addEventListener("click", simpanNada);
$("tombol-hapus-nada").addEventListener("click", hapusNada);
$("tombol-tes-nada").addEventListener("click", tesNada);
$("form-qr").addEventListener("submit", simpanQr);
$("tombol-hapus-qr").addEventListener("click", hapusQr);
$("pengajian-tipe").addEventListener("change", toggleTipePengajian);
$("form-pengajian").addEventListener("submit", tambahPengajian);
```

Catatan: durasi rotasi (jadwalPengajianDetik/qrDonasiDetik) belum punya input UI di section ini agar form tetap ringkas — nilai default dari `DEFAULT_ROTASI` sudah masuk akal. Kalau pengurus minta atur durasi, tambahkan dua `<input type="number">` di section QR yang menulis lewat `saveRotasi`. (YAGNI: tunda sampai diminta.)

- [ ] **Step 4: Verifikasi manual admin**

Buka `http://localhost:8000/admin.html`. Untuk tiap section:
- Murotal: centang aktif, isi mulai 15 / berhenti 3, centang sholat, Simpan → cek `localStorage.murotalSettings`. Tambah file audio → muncul di playlist & tersimpan di IndexedDB. Pilih surah+qori, Tambah → muncul di playlist. Hapus item → hilang.
- Nada: upload file, Simpan; Tes Nada → terdengar; Hapus → Tes Nada berbunyi beep default.
- QR: isi judul/teks, pilih gambar, Simpan → preview muncul, `localStorage.qrDonasi` terisi. Hapus → preview hilang.
- Jadwal Pengajian: tambah entri mingguan & tanggal → muncul di list; ganti tipe → field hari/tanggal toggle; Hapus → hilang.

Expected: semua tersimpan & ter-render tanpa error console.

- [ ] **Step 5: Commit**

```bash
git add admin.html css/style.css js/admin.js
git commit -m "feat: add admin forms for murotal, nada iqomah, QR donasi, jadwal pengajian"
```

---

### Task 10: Update README (flag autoplay kiosk)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Tambah catatan autoplay & fitur baru di `README.md`**

Tambahkan bagian berikut (sesuaikan dengan struktur README yang ada — sisipkan di bawah bagian "Kiosk mode"):

```markdown
## Suara (murotal & nada iqomah)

Agar murotal sebelum adzan dan nada iqomah bisa berbunyi otomatis tanpa
interaksi, jalankan Chrome kiosk dengan flag autoplay:

    chrome --kiosk --autoplay-policy=no-user-gesture-required "file:///path/index.html"

Tanpa flag ini, browser memblokir autoplay dan layar menampilkan overlay
"Ketuk layar untuk mengaktifkan suara" — cukup diketuk sekali.

File murotal offline dan nada iqomah kustom diunggah lewat halaman admin dan
disimpan di IndexedDB browser perangkat kiosk (tetap ada walau tanpa internet).
Murotal juga bisa memakai audio dari API EQuran.id (butuh koneksi saat diputar).

## Pengaturan tambahan (admin)

- Murotal: aktif/nonaktif, menit mulai & berhenti sebelum adzan, per-sholat, playlist (file + API).
- Nada iqomah: unggah nada kustom atau pakai beep default.
- QR donasi: unggah gambar QR, tampil bergilir di layar.
- Jadwal pengajian: kegiatan mingguan atau tanggal khusus, tampil bergilir di layar.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document autoplay flag and new admin settings"
```

---

## Self-Review

**1. Spec coverage:**
- Murotal offline (IndexedDB) → Task 2 (media-db) + Task 6 (playback) + Task 9 (upload). ✓
- Murotal API EQuran.id → Task 9 (fetch surat, tambah playlist) + Task 6 (stream url). ✓
- Mulai X / berhenti Y menit sebelum adzan → Task 5 (`murotalWindow`). ✓
- Playlist urut lanjut posisi → Task 6 (`mainkanIndex`, `simpanPosisi`, `posisi`). ✓
- Stop sebelum iqomah → Task 8 (`stopMurotal()` di `mulaiIqomah`). ✓
- Indikator murotal + tanpa kontrol volume → Task 8 (indikator) . ✓
- Unlock audio fallback → Task 6 (overlay) + Task 8 (elemen). ✓
- Rotasi satu slot (jadwal ↔ QR), durasi per-kartu → Task 4 (`rotasiMaju`, `renderSlotRotasi`). ✓
- QR donasi upload + tampil → Task 4 (loadQr/saveQr, render) + Task 9 (upload). ✓
- Jadwal pengajian mingguan + tanggal, auto-hide lampau → Task 3 (`entriAktif`). ✓
- Nada iqomah default beep + custom → Task 7 (`nada.js`, wiring iqomah) + Task 9 (upload/tes/hapus). ✓
- Config QORI/DEFAULT_MUROTAL/DEFAULT_ROTASI → Task 1. ✓
- Error handling additive (storage gagal → dilewati) → media-db getter null, loaders fallback default. ✓

**2. Placeholder scan:** Tidak ada "TBD/TODO". Catatan "YAGNI tunda durasi rotasi UI" adalah keputusan scope eksplisit dengan default masuk akal, bukan placeholder pekerjaan.

**3. Type consistency:**
- `murotalWindow(now, jadwal, settings)` konsisten Task 5 & 6.
- `rotasiMaju(state, nowMs, kartu, durasiDetik)` konsisten Task 4 test & impl; state punya `kartuKey`.
- Item playlist `{id,tipe,label,mediaKey}` / `{id,tipe,label,surah,qori,url}` konsisten Task 1 (config komentar), Task 6, Task 9.
- `posisi: {index, detik}` konsisten config, murotal controller, admin hapus.
- `getMedia/putMedia/delMedia` konsisten Task 2, 6, 7, 9.
- `entriAktif(now, entries)` / `kejadianBerikutnya(entry, now)` konsisten Task 3 & 4.
- Elemen DOM (`audio-murotal`, `murotal-indikator`, `murotal-label`, `unlock-audio`, `slot-rotasi`, `audio-nada`) konsisten antara HTML (Task 7, 8) dan JS (Task 6, 7, 8).

Tidak ada gap. Plan siap dieksekusi.
