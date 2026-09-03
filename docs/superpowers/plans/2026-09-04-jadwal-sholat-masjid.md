# Layar Jadwal Sholat Masjid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi web statis untuk layar 16 inch di masjid yang menampilkan jadwal sholat Kota Bandung, jam real-time, countdown, mode iqomah, dengan halaman admin untuk mengatur durasi iqomah.

**Architecture:** HTML/CSS/JS vanilla tanpa build tool. `index.html` (layar utama) dan `admin.html` (setting). Jadwal di-fetch dari API MyQuran, di-cache di `localStorage`. Setting iqomah disimpan di `localStorage`. Dijalankan lewat Chrome kiosk mode.

**Tech Stack:** HTML5, CSS3 (grid/flex), JavaScript ES6 (module `<script type="module">`), Fetch API, `localStorage`, `Intl.DateTimeFormat` (Hijriah). Tanpa npm/framework/build.

**Spec:** `docs/superpowers/specs/2026-09-04-jadwal-sholat-masjid-design.md`

## Global Constraints

- Tanpa dependency eksternal, tanpa `package.json`, tanpa build step. File dibuka langsung di Chrome.
- API jadwal: `https://api.myquran.com/v2/sholat/jadwal/1219/{YYYY}/{MM}/{DD}` (id_kota Kota Bandung = `1219`). Field jadwal: `subuh`, `dzuhur`, `ashar`, `maghrib`, `isya` (format "HH:MM").
- Urutan & label 5 sholat: Subuh, Dzuhur, Ashar, Maghrib, Isya.
- Bahasa UI: Indonesia. Kontras tinggi, font besar (kebaca dari jauh untuk lansia), layout landscape tanpa scroll.
- localStorage keys: `jadwalCache`, `iqomahSettings`.
- Semua komentar kode, commit message, dan teks dokumen ditulis dalam prosa normal (bukan gaya caveman).

---

## File Structure

```
jadwal-sholat-masjid/
  index.html        # layar utama
  admin.html        # halaman setting iqomah
  css/style.css     # styling kedua halaman
  js/config.js      # konstanta: id_kota, nama masjid, definisi sholat, default iqomah
  js/api.js         # fetch jadwal + cache localStorage
  js/settings.js    # baca/tulis iqomahSettings di localStorage
  js/app.js         # logika layar utama: jam, render, countdown, mode iqomah
  js/admin.js       # logika form admin
```

Pemisahan tanggung jawab: `config.js` data statis; `api.js` I/O jaringan+cache; `settings.js` I/O setting; `app.js` orkestrasi tampilan utama; `admin.js` form. `app.js` meng-import `config`, `api`, `settings`.

---

## Testing Approach

Proyek statis kecil tanpa test framework (sesuai spec). Tetapi logika murni (parsing waktu, hitung sholat berikutnya, hitung state iqomah) dipisah ke fungsi pure di `js/app.js` dan diuji lewat file `js/app.test.html` — halaman HTML yang meng-import fungsi tersebut, menjalankan assertion di `<script type="module">`, dan menampilkan PASS/FAIL di layar + `console`. Ini menjaga aturan "logika non-trivial punya satu check yang bisa dijalankan" tanpa menambah dependency (tanpa Node/Jest).

Cara menjalankan test: buka `js/app.test.html` di Chrome, lihat hasil di halaman/console. Karena `fetch` API butuh HTTP (bukan `file://`) untuk sebagian browser, jalankan lewat server statis sederhana: `python -m http.server 8000` lalu buka `http://localhost:8000/...`. Fungsi pure yang diuji tidak butuh jaringan, jadi bisa juga dibuka via `file://`.

---

### Task 1: Config statis

**Files:**
- Create: `js/config.js`

**Interfaces:**
- Produces:
  - `export const ID_KOTA = "1219";`
  - `export const NAMA_MASJID = "Masjid ..."` (placeholder teks, mudah diedit)
  - `export const LOKASI_LABEL = "Astana Anyar, Kota Bandung";`
  - `export const SHOLAT = [{ key:"subuh", label:"Subuh" }, { key:"dzuhur", label:"Dzuhur" }, { key:"ashar", label:"Ashar" }, { key:"maghrib", label:"Maghrib" }, { key:"isya", label:"Isya" }];` (array urut, tiap item `{key,label}`)
  - `export const DEFAULT_IQOMAH = { subuh:{menit:10,aktif:true}, dzuhur:{menit:10,aktif:true}, ashar:{menit:10,aktif:true}, maghrib:{menit:5,aktif:true}, isya:{menit:10,aktif:true} };`

- [ ] **Step 1: Tulis `js/config.js`**

```javascript
export const ID_KOTA = "1219";
export const NAMA_MASJID = "Masjid Jami Al-Ikhlas"; // ganti sesuai nama masjid
export const LOKASI_LABEL = "Astana Anyar, Kota Bandung";

export const SHOLAT = [
  { key: "subuh", label: "Subuh" },
  { key: "dzuhur", label: "Dzuhur" },
  { key: "ashar", label: "Ashar" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isya", label: "Isya" },
];

export const DEFAULT_IQOMAH = {
  subuh: { menit: 10, aktif: true },
  dzuhur: { menit: 10, aktif: true },
  ashar: { menit: 10, aktif: true },
  maghrib: { menit: 5, aktif: true },
  isya: { menit: 10, aktif: true },
};
```

- [ ] **Step 2: Commit**

```bash
git add js/config.js
git commit -m "feat: add static config for masjid display"
```

---

### Task 2: Settings iqomah (localStorage)

**Files:**
- Create: `js/settings.js`

**Interfaces:**
- Consumes: `DEFAULT_IQOMAH` dari `config.js`
- Produces:
  - `export function loadIqomah()` → object bentuk `DEFAULT_IQOMAH` (merge cache dengan default; kunci hilang diisi default)
  - `export function saveIqomah(settings)` → void, tulis ke `localStorage["iqomahSettings"]`

- [ ] **Step 1: Tulis `js/settings.js`**

```javascript
import { DEFAULT_IQOMAH, SHOLAT } from "./config.js";

const KEY = "iqomahSettings";

export function loadIqomah() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    stored = {};
  }
  const result = {};
  for (const { key } of SHOLAT) {
    const def = DEFAULT_IQOMAH[key];
    const cur = stored[key] || {};
    result[key] = {
      menit: Number.isFinite(cur.menit) ? cur.menit : def.menit,
      aktif: typeof cur.aktif === "boolean" ? cur.aktif : def.aktif,
    };
  }
  return result;
}

export function saveIqomah(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
```

- [ ] **Step 2: Commit**

```bash
git add js/settings.js
git commit -m "feat: add iqomah settings load/save via localStorage"
```

---

### Task 3: API fetch + cache jadwal

**Files:**
- Create: `js/api.js`

**Interfaces:**
- Consumes: `ID_KOTA` dari `config.js`
- Produces:
  - `export async function getJadwal(date)` → returns `{ jadwal, tanggalStr, fromCache, fetchedAt }` di mana `jadwal` = `{subuh,dzuhur,ashar,maghrib,isya}` (string "HH:MM"), `tanggalStr` = teks tanggal dari API (mis. "Jumat, 04/09/2026"), `fromCache` boolean, `fetchedAt` ISO string. Logika: coba fetch API untuk `date`; sukses → simpan cache `localStorage["jadwalCache"]` `{dateKey, jadwal, tanggalStr, fetchedAt}` dan return `fromCache:false`. Gagal → baca cache; return `fromCache:true`. Tidak ada cache → throw `Error`.
  - `export function dateKey(date)` → "YYYY-MM-DD" waktu lokal (helper, dipakai app.js untuk deteksi ganti hari)

- [ ] **Step 1: Tulis `js/api.js`**

```javascript
import { ID_KOTA } from "./config.js";

const CACHE_KEY = "jadwalCache";

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

export async function getJadwal(date) {
  const dk = dateKey(date);
  const [y, m, d] = dk.split("-");
  const url = `https://api.myquran.com/v2/sholat/jadwal/${ID_KOTA}/${y}/${m}/${d}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.status || !body.data || !body.data.jadwal) {
      throw new Error("Bentuk data API tidak sesuai");
    }
    const j = body.data.jadwal;
    const jadwal = {
      subuh: j.subuh, dzuhur: j.dzuhur, ashar: j.ashar,
      maghrib: j.maghrib, isya: j.isya,
    };
    const fetchedAt = new Date().toISOString();
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      dateKey: dk, jadwal, tanggalStr: j.tanggal, fetchedAt,
    }));
    return { jadwal, tanggalStr: j.tanggal, fromCache: false, fetchedAt };
  } catch (err) {
    const cache = readCache();
    if (cache && cache.jadwal) {
      return {
        jadwal: cache.jadwal, tanggalStr: cache.tanggalStr,
        fromCache: true, fetchedAt: cache.fetchedAt,
      };
    }
    throw new Error("Gagal fetch dan tidak ada cache: " + err.message);
  }
}
```

- [ ] **Step 2: Verifikasi manual fetch**

Jalankan server statis di root proyek: `python -m http.server 8000`. Buat sementara `test-api.html` isi `<script type="module">import {getJadwal} from "./js/api.js"; getJadwal(new Date()).then(r=>document.body.textContent=JSON.stringify(r));</script>`, buka `http://localhost:8000/test-api.html`, pastikan tampil jadwal `fromCache:false`. Lalu hapus `test-api.html`.

Expected: object jadwal 5 waktu tampil, `fromCache:false`.

- [ ] **Step 3: Commit**

```bash
git add js/api.js
git commit -m "feat: add jadwal sholat fetch with localStorage cache fallback"
```

---

### Task 4: Logika waktu pure + test

Fungsi pure untuk menghitung sholat berikutnya dan state iqomah. Diuji lewat `js/app.test.html`.

**Files:**
- Create: `js/app.js` (hanya bagian fungsi pure di task ini; sisanya ditambah Task 6)
- Test: `js/app.test.html`

**Interfaces:**
- Consumes: `SHOLAT` dari `config.js`
- Produces (semua `export`, dipakai Task 6):
  - `export function parseHM(hhmm, baseDate)` → `Date` pada `baseDate` (tahun/bulan/hari sama) dengan jam:menit dari string "HH:MM", detik 0.
  - `export function nextSholat(now, jadwal)` → `{ key, label, time }` untuk sholat berikutnya hari ini; jika semua sholat hari ini sudah lewat → return Subuh besok (`time` = besok). `jadwal` = map key→"HH:MM".
  - `export function iqomahState(now, jadwal, iqomahSettings)` → `null` jika tidak sedang iqomah, atau `{ key, label, sisaDetik, totalDetik }` jika `now` berada dalam jendela [waktu sholat, waktu sholat + menit iqomah) untuk sholat yang `aktif` dan `menit>0`. Aturan Jumat: jika `now` hari Jumat (getDay()===5) dan key==="dzuhur", return `null` (dilewati).

- [ ] **Step 1: Tulis test `js/app.test.html`**

```html
<!doctype html>
<meta charset="utf-8">
<title>Test app.js</title>
<pre id="out"></pre>
<script type="module">
import { parseHM, nextSholat, iqomahState } from "./app.js";

const out = [];
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; out.push(`PASS ${name}`); }
  else { fail++; out.push(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
}

const jadwal = { subuh:"04:34", dzuhur:"11:52", ashar:"15:09", maghrib:"17:56", isya:"19:01" };
const iq = { subuh:{menit:10,aktif:true}, dzuhur:{menit:10,aktif:true}, ashar:{menit:10,aktif:true}, maghrib:{menit:5,aktif:true}, isya:{menit:10,aktif:true} };

// parseHM: gunakan Kamis 2026-09-03 (bukan Jumat) untuk uji dzuhur
const kamis = new Date(2026, 8, 3, 0, 0, 0);
eq("parseHM jam", parseHM("11:52", kamis).getHours(), 11);
eq("parseHM menit", parseHM("11:52", kamis).getMinutes(), 52);

// nextSholat: jam 10:00 Kamis -> berikutnya Dzuhur
const t1 = new Date(2026, 8, 3, 10, 0, 0);
eq("next pagi", nextSholat(t1, jadwal).key, "dzuhur");
// jam 20:00 -> semua lewat -> Subuh besok
const t2 = new Date(2026, 8, 3, 20, 0, 0);
eq("next malam key", nextSholat(t2, jadwal).key, "subuh");
eq("next malam besok", nextSholat(t2, jadwal).time.getDate(), 4);

// iqomahState: Kamis 11:55 (3 menit setelah dzuhur, window 10 mnt) -> aktif
const t3 = new Date(2026, 8, 3, 11, 55, 0);
const s3 = iqomahState(t3, jadwal, iq);
eq("iqomah aktif key", s3 && s3.key, "dzuhur");
eq("iqomah sisa detik", s3 && s3.sisaDetik, 7*60); // 10mnt-3mnt=7mnt
// Kamis 12:05 (13 menit setelah dzuhur) -> lewat window -> null
eq("iqomah lewat", iqomahState(new Date(2026,8,3,12,5,0), jadwal, iq), null);
// Kamis 10:00 -> bukan waktu sholat -> null
eq("iqomah bukan waktu", iqomahState(t1, jadwal, iq), null);
// Jumat 11:55 dzuhur -> dilewati -> null
eq("iqomah jumat dzuhur null", iqomahState(new Date(2026,8,4,11,55,0), jadwal, iq), null);
// sholat nonaktif -> null
const iqOff = JSON.parse(JSON.stringify(iq)); iqOff.dzuhur.aktif=false;
eq("iqomah nonaktif null", iqomahState(t3, jadwal, iqOff), null);
// menit 0 -> null
const iqZero = JSON.parse(JSON.stringify(iq)); iqZero.dzuhur.menit=0;
eq("iqomah menit0 null", iqomahState(t3, jadwal, iqZero), null);

out.unshift(`${pass} PASS, ${fail} FAIL\n`);
document.getElementById("out").textContent = out.join("\n");
console.log(out.join("\n"));
</script>
```

- [ ] **Step 2: Tulis fungsi pure di `js/app.js`**

```javascript
import { SHOLAT } from "./config.js";

export function parseHM(hhmm, baseDate) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

export function nextSholat(now, jadwal) {
  for (const { key, label } of SHOLAT) {
    const t = parseHM(jadwal[key], now);
    if (t > now) return { key, label, time: t };
  }
  // semua lewat -> Subuh besok
  const besok = new Date(now);
  besok.setDate(besok.getDate() + 1);
  const subuh = SHOLAT[0];
  return { key: subuh.key, label: subuh.label, time: parseHM(jadwal[subuh.key], besok) };
}

export function iqomahState(now, jadwal, iqomahSettings) {
  for (const { key, label } of SHOLAT) {
    if (now.getDay() === 5 && key === "dzuhur") continue; // Jumat: dzuhur dilewati
    const set = iqomahSettings[key];
    if (!set || !set.aktif || set.menit <= 0) continue;
    const start = parseHM(jadwal[key], now);
    const end = new Date(start.getTime() + set.menit * 60000);
    if (now >= start && now < end) {
      const totalDetik = set.menit * 60;
      const sisaDetik = Math.ceil((end - now) / 1000);
      return { key, label, sisaDetik, totalDetik };
    }
  }
  return null;
}
```

- [ ] **Step 3: Jalankan test**

Buka `js/app.test.html` di Chrome (via `file://` cukup, fungsi pure tidak butuh jaringan). 

Expected: baris teratas "9 PASS, 0 FAIL".

- [ ] **Step 4: Commit**

```bash
git add js/app.js js/app.test.html
git commit -m "feat: add pure time/iqomah logic with browser test"
```

---

### Task 5: HTML + CSS layar utama & admin

**Files:**
- Create: `index.html`, `admin.html`, `css/style.css`

**Interfaces:**
- Produces DOM id yang dipakai `app.js` (Task 6) dan `admin.js` (Task 7):
  - index.html: `#nama-masjid`, `#lokasi`, `#jam`, `#tanggal-masehi`, `#tanggal-hijriah`, `#grid-sholat`, `#countdown-label`, `#countdown-waktu`, `#offline-indikator`, `#tombol-admin`, dan container `#mode-normal` + `#mode-iqomah` (dengan `#iqomah-nama`, `#iqomah-waktu`).
  - admin.html: `<form id="form-iqomah">`, container `#baris-sholat`, `#tombol-simpan`, `#status-simpan`.

- [ ] **Step 1: Tulis `index.html`**

```html
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jadwal Sholat</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body class="layar">
  <a id="tombol-admin" href="admin.html" title="Pengaturan">⚙</a>

  <div id="mode-normal">
    <header class="header">
      <h1 id="nama-masjid"></h1>
      <p id="lokasi"></p>
    </header>

    <section class="jam-blok">
      <div id="jam">--:--:--</div>
      <div class="tanggal">
        <span id="tanggal-masehi"></span>
        <span id="tanggal-hijriah"></span>
      </div>
    </section>

    <section id="grid-sholat" class="grid-sholat"></section>

    <section class="countdown">
      <span id="countdown-label">Menuju —</span>
      <span id="countdown-waktu">--:--:--</span>
    </section>
  </div>

  <div id="mode-iqomah" hidden>
    <p class="iqomah-judul">Waktu <span id="iqomah-nama"></span> telah masuk</p>
    <p class="iqomah-sub">Menunggu Iqomah</p>
    <div id="iqomah-waktu">--:--</div>
  </div>

  <div id="offline-indikator" hidden></div>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Tulis `admin.html`**

```html
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pengaturan Iqomah</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body class="admin">
  <div class="admin-kotak">
    <h1>Pengaturan Iqomah</h1>
    <p class="admin-ket">Atur jeda menit dari azan ke iqomah untuk tiap sholat.</p>
    <form id="form-iqomah">
      <div id="baris-sholat"></div>
      <div class="admin-aksi">
        <button type="submit" id="tombol-simpan">Simpan</button>
        <a href="index.html" class="tombol-sekunder">Kembali ke Layar</a>
      </div>
      <p id="status-simpan" class="status" hidden>Tersimpan.</p>
    </form>
  </div>
  <script type="module" src="js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 3: Tulis `css/style.css`**

Desain: tema gelap (navy/hitam), teks putih/emas, kontras tinggi, font besar responsif pakai `clamp()` + `vw` agar kebaca di 16 inch tanpa scroll. Landscape.

```css
:root {
  --bg: #0b1a2b;
  --bg2: #0f2540;
  --emas: #f2c14e;
  --putih: #f5f7fa;
  --redup: #9db4cc;
  --highlight: #1c8a5a;
  font-family: system-ui, "Segoe UI", Tahoma, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body.layar {
  background: radial-gradient(circle at 50% 0%, var(--bg2), var(--bg));
  color: var(--putih);
  overflow: hidden;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

#mode-normal {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 2vh 3vw;
  gap: 1.5vh;
}
.header { text-align: center; }
#nama-masjid { font-size: clamp(24px, 4.5vw, 64px); color: var(--emas); font-weight: 800; }
#lokasi { font-size: clamp(14px, 1.8vw, 26px); color: var(--redup); margin-top: 0.3vh; }

.jam-blok { text-align: center; }
#jam { font-size: clamp(48px, 12vw, 180px); font-weight: 800; line-height: 1; letter-spacing: 2px; }
.tanggal { display: flex; justify-content: center; gap: 2vw; font-size: clamp(14px, 2vw, 30px); color: var(--redup); margin-top: 0.5vh; }
#tanggal-hijriah { color: var(--emas); }

.grid-sholat { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1vw; flex: 1; align-items: stretch; }
.kartu-sholat {
  background: rgba(255,255,255,0.05);
  border: 2px solid transparent;
  border-radius: 12px;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  gap: 1vh;
}
.kartu-sholat .nama { font-size: clamp(18px, 2.5vw, 40px); color: var(--redup); }
.kartu-sholat .waktu { font-size: clamp(28px, 5vw, 80px); font-weight: 800; }
.kartu-sholat.aktif {
  background: rgba(28,138,90,0.25);
  border-color: var(--highlight);
}
.kartu-sholat.aktif .nama { color: var(--putih); }
.kartu-sholat.aktif .waktu { color: var(--emas); }

.countdown { text-align: center; font-size: clamp(18px, 3vw, 46px); }
#countdown-label { color: var(--redup); margin-right: 1vw; }
#countdown-waktu { color: var(--emas); font-weight: 800; }

#mode-iqomah {
  height: 100vh;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  gap: 3vh; text-align: center;
  background: radial-gradient(circle at 50% 50%, #123, #010912);
}
.iqomah-judul { font-size: clamp(28px, 5vw, 80px); color: var(--emas); font-weight: 800; }
#iqomah-nama { text-transform: capitalize; }
.iqomah-sub { font-size: clamp(20px, 3vw, 44px); color: var(--redup); }
#iqomah-waktu { font-size: clamp(80px, 22vw, 320px); font-weight: 800; line-height: 1; }

#tombol-admin {
  position: fixed; right: 12px; bottom: 10px; z-index: 10;
  color: rgba(255,255,255,0.15); text-decoration: none; font-size: 22px;
}
#tombol-admin:hover { color: var(--putih); }

#offline-indikator {
  position: fixed; left: 12px; bottom: 10px;
  background: rgba(200,80,40,0.85); color: #fff;
  font-size: 14px; padding: 4px 10px; border-radius: 6px;
}

/* Admin */
body.admin {
  background: var(--bg); color: var(--putih);
  min-height: 100vh; display: flex; justify-content: center; align-items: flex-start;
  padding: 4vh 4vw;
}
.admin-kotak { width: 100%; max-width: 640px; background: var(--bg2); padding: 28px; border-radius: 14px; }
.admin-kotak h1 { color: var(--emas); font-size: 28px; margin-bottom: 6px; }
.admin-ket { color: var(--redup); margin-bottom: 20px; }
.baris {
  display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 14px;
  padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.baris .label-sholat { font-size: 20px; }
.baris input[type=number] { width: 90px; font-size: 20px; padding: 8px; border-radius: 8px; border: 1px solid var(--redup); background: #0a1626; color: var(--putih); }
.baris label.aktif-cek { display: flex; align-items: center; gap: 6px; color: var(--redup); }
.baris input[type=checkbox] { width: 22px; height: 22px; }
.admin-aksi { display: flex; gap: 12px; margin-top: 22px; }
#tombol-simpan { font-size: 18px; padding: 12px 24px; border: none; border-radius: 8px; background: var(--highlight); color: #fff; cursor: pointer; }
.tombol-sekunder { font-size: 18px; padding: 12px 24px; border-radius: 8px; background: transparent; border: 1px solid var(--redup); color: var(--putih); text-decoration: none; }
.status { margin-top: 14px; color: var(--emas); }
```

- [ ] **Step 4: Verifikasi tampil**

Buka `index.html` dan `admin.html` di Chrome. Expected: struktur tampil (belum ada data dinamis), tema gelap, admin form kosong (baris diisi oleh JS di task berikutnya). Tidak ada scroll horizontal/vertikal di index.

- [ ] **Step 5: Commit**

```bash
git add index.html admin.html css/style.css
git commit -m "feat: add display and admin HTML with high-contrast landscape CSS"
```

---

### Task 6: Orkestrasi layar utama (`app.js`)

Menambah kode render + loop tiap detik ke `js/app.js` (di bawah fungsi pure Task 4).

**Files:**
- Modify: `js/app.js` (tambah di bawah export fungsi pure)

**Interfaces:**
- Consumes: `NAMA_MASJID, LOKASI_LABEL, SHOLAT` (config), `getJadwal, dateKey` (api), `loadIqomah` (settings), `parseHM, nextSholat, iqomahState` (fungsi pure di file sama).

- [ ] **Step 1: Tambah kode orkestrasi di akhir `js/app.js`**

```javascript
import { NAMA_MASJID, LOKASI_LABEL } from "./config.js";
import { getJadwal, dateKey } from "./api.js";
import { loadIqomah } from "./settings.js";

// State modul
let jadwal = null;         // {subuh,...}
let jadwalDateKey = null;  // "YYYY-MM-DD" jadwal yang sedang dipakai
let offline = false;
let fetchedAt = null;

const $ = (id) => document.getElementById(id);

function pad(n) { return String(n).padStart(2, "0"); }

function fmtDurasi(totalDetik) {
  const jam = Math.floor(totalDetik / 3600);
  const menit = Math.floor((totalDetik % 3600) / 60);
  const detik = totalDetik % 60;
  return jam > 0 ? `${pad(jam)}:${pad(menit)}:${pad(detik)}` : `${pad(menit)}:${pad(detik)}`;
}

function renderStatis() {
  $("nama-masjid").textContent = NAMA_MASJID;
  $("lokasi").textContent = LOKASI_LABEL;
}

function renderTanggal(now) {
  $("tanggal-masehi").textContent = now.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  try {
    $("tanggal-hijriah").textContent = new Intl.DateTimeFormat("id-ID-u-ca-islamic", {
      day: "numeric", month: "long", year: "numeric",
    }).format(now) + " H";
  } catch {
    $("tanggal-hijriah").textContent = "";
  }
}

function renderGrid(next) {
  const grid = $("grid-sholat");
  grid.innerHTML = "";
  for (const { key, label } of SHOLAT) {
    const div = document.createElement("div");
    div.className = "kartu-sholat" + (next && next.key === key ? " aktif" : "");
    div.innerHTML = `<span class="nama">${label}</span><span class="waktu">${jadwal[key]}</span>`;
    grid.appendChild(div);
  }
}

function renderOffline() {
  const el = $("offline-indikator");
  if (offline && fetchedAt) {
    const t = new Date(fetchedAt);
    el.textContent = `⚠ data offline — update terakhir ${pad(t.getDate())}/${pad(t.getMonth()+1)} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

async function muatJadwal(now) {
  try {
    const r = await getJadwal(now);
    jadwal = r.jadwal;
    offline = r.fromCache;
    fetchedAt = r.fetchedAt;
    jadwalDateKey = dateKey(now);
  } catch (e) {
    // tidak ada jadwal & tidak ada cache
    jadwal = null;
    offline = true;
  }
  renderOffline();
}

function tick() {
  const now = new Date();
  $("jam").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  renderTanggal(now);

  if (!jadwal) return; // belum ada data

  const iqSettings = loadIqomah();
  const iq = iqomahState(now, jadwal, iqSettings);

  if (iq) {
    $("mode-normal").hidden = true;
    $("mode-iqomah").hidden = false;
    $("iqomah-nama").textContent = iq.label;
    $("iqomah-waktu").textContent = fmtDurasi(iq.sisaDetik);
  } else {
    $("mode-iqomah").hidden = true;
    $("mode-normal").hidden = false;
    const next = nextSholat(now, jadwal);
    renderGrid(next);
    $("countdown-label").textContent = `Menuju ${next.label}`;
    $("countdown-waktu").textContent = fmtDurasi(Math.max(0, Math.ceil((next.time - now) / 1000)));
  }
}

async function init() {
  renderStatis();
  await muatJadwal(new Date());
  tick();
  setInterval(() => {
    const now = new Date();
    // Ganti hari: fetch jadwal baru (dipicu setelah lewat tengah malam)
    if (jadwalDateKey && dateKey(now) !== jadwalDateKey) {
      muatJadwal(now);
    }
    tick();
  }, 1000);
}

init();
```

- [ ] **Step 2: Verifikasi manual**

Jalankan `python -m http.server 8000` di root, buka `http://localhost:8000/index.html`. Expected: nama masjid, jam berjalan, tanggal Masehi+Hijriah, grid 5 sholat dengan jadwal Bandung, sholat berikutnya ter-highlight, countdown jalan mundur. Buka DevTools → Network → offline → reload: data tetap tampil dari cache + indikator offline muncul.

- [ ] **Step 3: Verifikasi mode iqomah (opsional, via console)**

Di console, sementara override untuk cek transisi: ubah salah satu jadwal ke waktu ~1 menit dari sekarang lewat DevTools tidak mudah; alternatif: percayai test Task 4 untuk logika, dan cek visual mode iqomah dengan set `document.getElementById('mode-normal').hidden=true; document.getElementById('mode-iqomah').hidden=false;` untuk memastikan layout iqomah benar. Kembalikan setelahnya.

Expected: layout mode iqomah (teks besar + countdown) tampil rapi.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: wire up main display loop, countdown, and iqomah mode"
```

---

### Task 7: Form admin (`admin.js`)

**Files:**
- Create: `js/admin.js`

**Interfaces:**
- Consumes: `SHOLAT` (config), `loadIqomah, saveIqomah` (settings)

- [ ] **Step 1: Tulis `js/admin.js`**

```javascript
import { SHOLAT } from "./config.js";
import { loadIqomah, saveIqomah } from "./settings.js";

const $ = (id) => document.getElementById(id);

function render() {
  const settings = loadIqomah();
  const wrap = $("baris-sholat");
  wrap.innerHTML = "";
  for (const { key, label } of SHOLAT) {
    const s = settings[key];
    const row = document.createElement("div");
    row.className = "baris";
    row.innerHTML = `
      <span class="label-sholat">${label}</span>
      <input type="number" min="0" max="60" id="menit-${key}" value="${s.menit}"> 
      <label class="aktif-cek"><input type="checkbox" id="aktif-${key}" ${s.aktif ? "checked" : ""}> aktif</label>
    `;
    wrap.appendChild(row);
  }
}

function simpan(e) {
  e.preventDefault();
  const settings = {};
  for (const { key } of SHOLAT) {
    const menit = parseInt($(`menit-${key}`).value, 10);
    settings[key] = {
      menit: Number.isFinite(menit) && menit >= 0 ? menit : 0,
      aktif: $(`aktif-${key}`).checked,
    };
  }
  saveIqomah(settings);
  const status = $("status-simpan");
  status.hidden = false;
  setTimeout(() => { status.hidden = true; }, 2000);
}

render();
$("form-iqomah").addEventListener("submit", simpan);
```

- [ ] **Step 2: Verifikasi manual**

Buka `admin.html` via server statis. Expected: 5 baris sholat dengan nilai default (Subuh/Dzuhur/Ashar/Isya 10, Maghrib 5, semua aktif). Ubah durasi Dzuhur ke 7, uncheck Ashar, klik Simpan → "Tersimpan." muncul. Reload → nilai tetap (dari localStorage). Buka `index.html` → countdown/mode iqomah pakai setting baru.

- [ ] **Step 3: Commit**

```bash
git add js/admin.js
git commit -m "feat: add admin form to configure iqomah duration per sholat"
```

---

### Task 8: README + cara jalankan kiosk

**Files:**
- Create: `README.md`

**Interfaces:** —

- [ ] **Step 1: Tulis `README.md`**

Isi: deskripsi singkat, cara ganti nama masjid (edit `js/config.js`), cara jalankan (dua opsi: buka `index.html` langsung, atau via `python -m http.server`), cara setup Chrome kiosk di Windows (shortcut `chrome.exe --kiosk --app=file:///D:/Proyek/me/jadwal-sholat-masjid/index.html` atau via localhost), cara buka admin (klik ⚙ pojok kanan bawah), catatan jadwal pakai Kota Bandung, catatan Jumat (Dzuhur dilewati mode iqomah).

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with kiosk setup instructions"
```

---

## Self-Review

**Spec coverage:**
- Hybrid fetch + cache → Task 3 ✓
- Layar utama (jam, tanggal Masehi+Hijriah, grid, countdown) → Task 5+6 ✓
- Mode iqomah → Task 4 (logika) + Task 6 (render) ✓
- Halaman admin setting iqomah → Task 5+7 ✓
- Offline indicator → Task 3+6 ✓
- Windows Chrome kiosk, landscape → Task 5 (CSS) + Task 8 (README) ✓
- Tanpa PIN admin → tombol ⚙ langsung, tanpa gate ✓
- Catatan Jumat → Task 4 ✓

**Placeholder scan:** Tidak ada TBD/TODO; semua step berisi kode nyata.

**Type consistency:** `getJadwal` return `{jadwal,tanggalStr,fromCache,fetchedAt}` konsisten Task 3↔6. `loadIqomah/saveIqomah` bentuk `{key:{menit,aktif}}` konsisten Task 2↔6↔7. `nextSholat`→`{key,label,time}`, `iqomahState`→`{key,label,sisaDetik,totalDetik}` konsisten Task 4↔6. DOM id konsisten Task 5↔6↔7.
