import { SHOLAT } from "./config.js";
import { parseHM } from "./waktu.js";
export { parseHM };

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

// Adzan wajib tampil buat semua sholat (durasi dari setting Adzan global,
// tidak bisa dimatikan). Toggle "aktif" per sholat cuma nentuin apa fase
// Iqomah (hitung mundur) lanjut jalan SETELAH adzan selesai, atau layar
// langsung balik ke jadwal sholat begitu adzan beres (lihat mulaiIqomah &
// iqomah.js tick - adzanEndTime === iqomahEndTime kalau iqomah nonaktif).
export function iqomahState(now, jadwal, iqomahSettings, adzanMenit) {
  for (const { key, label } of SHOLAT) {
    if (now.getDay() === 5 && key === "dzuhur") continue; // Jumat: dzuhur dilewati
    const set = iqomahSettings[key] || {};
    const iqomahMenit = set.aktif && set.menit > 0 ? set.menit : 0;
    const totalMenit = adzanMenit + iqomahMenit;
    if (totalMenit <= 0) continue; // adzan 0 menit & iqomah nonaktif -> tidak ada apa-apa
    const start = parseHM(jadwal[key], now);
    const end = new Date(start.getTime() + totalMenit * 60000);
    if (now >= start && now < end) {
      const totalDetik = iqomahMenit * 60; // durasi fase iqomah saja, dipakai mulaiIqomah()
      const sisaDetik = Math.ceil((end - now) / 1000);
      return { key, label, sisaDetik, totalDetik };
    }
  }
  return null;
}

import { NAMA_MASJID, TAGLINE_MASJID, WAKTU_HARIAN } from "./config.js";
import { getJadwal, dateKey } from "./api.js";
import { loadIqomah, loadAdzan, loadPengumuman } from "./settings.js";
import { loadTampilan } from "./tampilan.js";
import { ICONS } from "./icons.js";
import { initMurotal, tickMurotal, stopMurotal } from "./murotal.js";
import { tickHalamanSholat, mulaiSesiSholat } from "./rotasi.js";
import { jumatState } from "./jumat-mode.js";
import { tampilkan } from "./navigasi.js";

const IQOMAH_KEY = "iqomahAktif";
const JUMAT_KEY = "jumatAktif";
// ?demo=1 dipakai slide "Jadwal Sholat" di Demo Layar (js/demo-slide.js) biar
// murotal ikut kedengaran tanpa nunggu jendela waktu asli - lihat murotal.js.
const modeDemo = new URLSearchParams(location.search).get("demo") === "1";

// State modul
let jadwal = null;         // {imsak,subuh,terbit,dzuhur,ashar,maghrib,isya} dari API/cache
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
  $("topbar-sub").textContent = TAGLINE_MASJID;
  const tampilan = loadTampilan();
  $("topbar").hidden = !tampilan.header;
  $("marquee-bar").hidden = !tampilan.maklumat;
}

function renderMarquee() {
  const item = (teks) => `<span class="marquee-item"><span class="marquee-bullet">&#10022;</span>${teks}</span>`;
  const isi = loadPengumuman().map(item).join("");
  $("marquee-track").innerHTML = isi + isi; // digandakan biar animasi loop mulus
}

function renderTanggal(now) {
  $("tanggal-masehi").textContent = now.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  try {
    $("tanggal-hijriah").textContent = new Intl.DateTimeFormat("id-ID-u-ca-islamic", {
      day: "numeric", month: "long", year: "numeric",
    }).format(now);
  } catch {
    $("tanggal-hijriah").textContent = "";
  }
}

function renderGrid(next) {
  const elemenAkar = $("grid-sholat");
  elemenAkar.innerHTML = "";
  for (const { key, label, icon } of WAKTU_HARIAN) {
    const aktif = next && next.key === key;
    const div = document.createElement("div");
    div.className = "kartu-waktu" + (aktif ? " aktif" : "");
    div.dataset.key = key;
    div.innerHTML = `
      ${aktif ? '<span class="kartu-pita">Waktu Berikutnya</span>' : ""}
      <span class="kartu-ikon">${ICONS[icon] || ""}</span>
      <span class="nama">${label}</span>
      <span class="jam">${jadwal[key] || "--:--"}</span>
      <span class="unit">WIB</span>
    `;
    elemenAkar.appendChild(div);
  }
}

function renderOffline() {
  const el = $("offline-indikator");
  if (offline && fetchedAt) {
    const t = new Date(fetchedAt);
    el.textContent = `Data offline, update terakhir ${pad(t.getDate())}/${pad(t.getMonth()+1)} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

// Jam analog (dipakai tema Masjid Biru, lihat css/versi-biru.css - disembunyikan
// buat tema lain). Angka dibuat sekali; jarum diputar tiap detik di tick().
function buatJamAnalogAngka() {
  const wrap = $("jam-analog-angka");
  for (let n = 1; n <= 12; n++) {
    const span = document.createElement("span");
    span.className = "jam-analog-angka";
    span.style.setProperty("--n", n);
    span.textContent = n;
    wrap.appendChild(span);
  }
}

function tickJamAnalog(now) {
  const jam = now.getHours() % 12;
  const menit = now.getMinutes();
  const detik = now.getSeconds();
  const derajatJam = jam * 30 + menit * 0.5;
  const derajatMenit = menit * 6 + detik * 0.1;
  const derajatDetik = detik * 6;
  $("jarum-jam").style.transform = `rotate(${derajatJam}deg)`;
  $("jarum-menit").style.transform = `rotate(${derajatMenit}deg)`;
  $("jarum-detik").style.transform = `rotate(${derajatDetik}deg)`;
}

async function muatJadwal(now) {
  try {
    const r = await getJadwal(now);
    jadwal = r.jadwal;
    offline = r.fromCache;
    fetchedAt = r.fetchedAt;
    jadwalDateKey = dateKey(now);
  } catch (e) {
    jadwal = null;
    offline = true;
  }
  renderOffline();
}

// Exported murni buat testable - lihat app.test.html. Nentuin apa hitung
// mundur iqomah yang sudah tersimpan (mis. sebelum refresh halaman) masih
// valid dilanjut, atau harus dihitung ulang dari awal (sholat baru/expired).
export function harusResumeIqomah(existing, iqKey, nowMs) {
  return !!existing && existing.key === iqKey && nowMs < new Date(existing.iqomahEndTime).getTime();
}

function bacaIqomahState() {
  try {
    return JSON.parse(localStorage.getItem(IQOMAH_KEY));
  } catch {
    return null;
  }
}

function mulaiIqomah(iq) {
  stopMurotal();
  const now = Date.now();
  if (harusResumeIqomah(bacaIqomahState(), iq.key, now)) {
    // Sudah ada hitung mundur berjalan buat sholat yang sama (mis. balik
    // dari refresh) - lanjutkan pakai endTime lama, jangan reset ke awal.
    tampilkan("iqomah");
    return;
  }
  // Fase Adzan dan fase Iqomah dua durasi terpisah, berurutan (bukan dipotong
  // dari total yang sama): adzan penuh sesuai menit di setting Adzan, BARU
  // iqomah dihitung penuh sesuai menit jeda di setting Iqomah sholat ini.
  const adzanDetik = loadAdzan().menit * 60;
  const adzanEndTime = new Date(now + adzanDetik * 1000).toISOString();
  const iqomahEndTime = new Date(now + (adzanDetik + iq.totalDetik) * 1000).toISOString();
  localStorage.setItem(IQOMAH_KEY, JSON.stringify({ key: iq.key, label: iq.label, adzanEndTime, iqomahEndTime }));
  tampilkan("iqomah");
}

function mulaiJumat(jum) {
  stopMurotal();
  localStorage.setItem(JUMAT_KEY, JSON.stringify({ endTime: jum.endTime }));
  tampilkan("jumat");
}

function tick() {
  const now = new Date();
  $("jam").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  renderTanggal(now);
  tickJamAnalog(now);

  if (!jadwal) return; // belum ada data

  const jum = jumatState(now, jadwal);
  if (jum) {
    mulaiJumat(jum);
    return;
  }

  const iqSettings = loadIqomah();
  const iq = iqomahState(now, jadwal, iqSettings, loadAdzan().menit);
  if (iq) {
    mulaiIqomah(iq);
    return;
  }

  const next = nextSholat(now, jadwal);
  renderGrid(next);
  $("next-nama").textContent = next.label;
  $("countdown-waktu").textContent = fmtDurasi(Math.max(0, Math.ceil((next.time - now) / 1000)));

  // Ditaruh terakhir dengan sengaja: kalau salah satu ini throw (mis. data
  // hasil edit manual di localStorage rusak), grid/countdown di atas sudah
  // sempat ter-update untuk tick ini - display utama tidak ikut macet.
  tickMurotal(now, jadwal, modeDemo);
  tickHalamanSholat(now);
}

let intervalId = null;

// Dipanggil sekali dari kiosk.js sebelum view manapun jalan - bagian yang
// pasang event listener atau bangun DOM sekali jadi (bukan per-kunjungan),
// beda dari start() yang dipanggil ULANG tiap balik ke view sholat.
export function initSekali() {
  buatJamAnalogAngka();
  initMurotal({
    audioEl: $("audio-murotal"),
    indikatorEl: $("murotal-indikator"),
    labelEl: $("murotal-label"),
    overlayEl: $("unlock-audio"),
  });
}

// Dipanggil router (navigasi.js) tiap masuk view "sholat". Return stop()
// buat dipanggil router pas pindah ke view lain.
export function start() {
  renderStatis();
  renderMarquee();
  mulaiSesiSholat();
  const now = new Date();
  // Sudah punya jadwal hari ini di memori (balik dari view lain, bukan boot
  // pertama) - jangan fetch API lagi tiap kali masuk view ini.
  if (jadwal && jadwalDateKey === dateKey(now)) tick();
  else muatJadwal(now).then(tick);
  intervalId = setInterval(() => {
    const now = new Date();
    // Ganti hari: fetch jadwal baru (dipicu setelah lewat tengah malam)
    if (jadwalDateKey && dateKey(now) !== jadwalDateKey) {
      muatJadwal(now);
    }
    tick();
  }, 1000);
  return stop;
}

function stop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
