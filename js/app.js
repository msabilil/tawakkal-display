import { ADZAN_LEBIH_AWAL_DETIK, SHOLAT } from "./config.js";
import { dayWIB, formatJamWIB, formatTanggalWIB, formatTanggalHijriahWIB, parseHM, applyKoreksiWaktu } from "./waktu.js";
export { parseHM };

export function nextSholat(now, jadwal) {
  for (const { key, label } of SHOLAT) {
    const t = parseHM(jadwal[key], now);
    if (t > now) return { key, label, time: t };
  }
  // semua lewat -> Subuh besok
  const besok = new Date(now.getTime() + 24 * 60 * 60 * 1000);
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
    if (dayWIB(now) === 5 && key === "dzuhur") continue; // Jumat: dzuhur dilewati
    const set = iqomahSettings[key] || {};
    const iqomahMenit = set.aktif && set.menit > 0 ? set.menit : 0;
    const totalMenit = adzanMenit + iqomahMenit;
    if (totalMenit <= 0) continue; // adzan 0 menit & iqomah nonaktif -> tidak ada apa-apa
    const start = parseHM(jadwal[key], now);
    const adzanMulai = new Date(start.getTime() - ADZAN_LEBIH_AWAL_DETIK * 1000);
    const end = new Date(start.getTime() + totalMenit * 60000);
    if (now >= adzanMulai && now < end) {
      const totalDetik = iqomahMenit * 60; // durasi fase iqomah saja, dipakai mulaiIqomah()
      const sisaDetik = Math.ceil((end - now) / 1000);
      return { key, label, sisaDetik, totalDetik, start };
    }
  }
  return null;
}

// Layar hening (hitam polos) tampil SETELAH iqomah kelar - fungsi murni sama
// seperti iqomahState di atas, jadi otomatis tahan refresh (dihitung ulang
// dari jadwal+setting, bukan dari state runtime). "menit" hening dihitung
// dari SELESAI iqomah, bukan dari azan.
export function heningState(now, jadwal, iqomahSettings, heningSettings, adzanMenit) {
  for (const { key, label } of SHOLAT) {
    if (dayWIB(now) === 5 && key === "dzuhur") continue; // Jumat: dzuhur dilewati
    const hSet = heningSettings[key] || {};
    if (!hSet.aktif || !(hSet.menit > 0)) continue;
    const iqSet = iqomahSettings[key] || {};
    const iqomahMenit = iqSet.aktif && iqSet.menit > 0 ? iqSet.menit : 0;
    const start = parseHM(jadwal[key], now);
    const iqomahEnd = new Date(start.getTime() + (adzanMenit + iqomahMenit) * 60000);
    const heningEnd = new Date(iqomahEnd.getTime() + hSet.menit * 60000);
    if (now >= iqomahEnd && now < heningEnd) return { key, label, endTime: heningEnd.toISOString() };
  }
  return null;
}

import { NAMA_MASJID, TAGLINE_MASJID, WAKTU_HARIAN } from "./config.js";
import { getJadwal, dateKey } from "./api.js";
import { loadIqomah, loadAdzan, loadHening, loadKoreksiWaktu, loadPengumuman } from "./settings.js";
import { tarawihState } from "./ramadhan.js";
import { mulaiHening } from "./hening.js";
import { loadTampilan } from "./tampilan.js";
import { ICONS } from "./icons.js";
import { initMurotal, tickMurotal, stopMurotal } from "./murotal.js";
import { tickHalamanSholat, mulaiSesiSholat } from "./rotasi.js";
import { loadJumatSettings, loadJumatSlides } from "./jumat-mode.js";
import { tampilkan, viewAktif } from "./navigasi.js";
import { bolehPutarNadaPadaTransisi, tentukanAlur } from "./alur-ibadah.js";
import { loadJadwalPengajian } from "./jadwal-pengajian.js";
import { kegiatanTerdekat } from "./hero-kegiatan.js";

const IQOMAH_KEY = "iqomahAktif";
const JUMAT_KEY = "jumatAktif";
// ?demo=1 dipakai slide "Jadwal Sholat" di Demo Layar (js/demo-slide.js) biar
// murotal ikut kedengaran tanpa nunggu jendela waktu asli - lihat murotal.js.
const modeDemo = new URLSearchParams(location.search).get("demo") === "1";

// State modul
let jadwal = null;         // jadwal yang sudah dikoreksi untuk seluruh logika layar
let jadwalMentah = null;   // jadwal asli dari API/cache, tidak pernah ditimpa koreksi
let koreksiTerakhir = null;
let jadwalDateKey = null;  // "YYYY-MM-DD" jadwal yang sedang dipakai
let offline = false;
let fetchedAt = null;
let sedangMuatJadwal = false;
let alurAwalSudahDinilai = false;

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
  $("tanggal-masehi").textContent = formatTanggalWIB(now);
  $("tanggal-hijriah").textContent = formatTanggalHijriahWIB(now);
}

function renderHeroKegiatan(now) {
  const kegiatan = kegiatanTerdekat(now, loadJadwalPengajian());
  const tampilkanKegiatan = kegiatan && Math.floor(now.getTime() / 10000) % 2 === 1;
  const hero = $("hero-kegiatan");
  const panel = $("hero-kegiatan").parentElement;

  panel.classList.toggle("hero-kanan-menampilkan-kegiatan", !!tampilkanKegiatan);
  hero.setAttribute("aria-hidden", String(!tampilkanKegiatan));
  if (!kegiatan) return;

  $("hero-kegiatan-nama").textContent = kegiatan.nama;
  $("hero-kegiatan-tanggal").textContent = kegiatan.tanggal;
  $("hero-kegiatan-jam").textContent = kegiatan.jam;
  $("hero-kegiatan-pengisi").textContent = kegiatan.pengisi ? `Pengisi: ${kegiatan.pengisi}` : "";
  $("hero-kegiatan-pengisi").hidden = !kegiatan.pengisi;
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
    const waktu = formatTanggalWIB(t);
    el.textContent = `Data offline, update terakhir ${waktu} ${formatJamWIB(t).slice(0, 5)}`;
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
  const [jamMentah, menit, detik] = formatJamWIB(now).split(":").map(Number);
  const jam = jamMentah % 12;
  const derajatJam = jam * 30 + menit * 0.5;
  const derajatMenit = menit * 6 + detik * 0.1;
  const derajatDetik = detik * 6;
  $("jarum-jam").style.transform = `rotate(${derajatJam}deg)`;
  $("jarum-menit").style.transform = `rotate(${derajatMenit}deg)`;
  $("jarum-detik").style.transform = `rotate(${derajatDetik}deg)`;
}

async function muatJadwal(now) {
  if (sedangMuatJadwal) return;
  sedangMuatJadwal = true;
  try {
    const r = await getJadwal(now);
    jadwalMentah = r.jadwal;
    koreksiTerakhir = null;
    sinkronkanKoreksi();
    offline = r.fromCache;
    fetchedAt = r.fetchedAt;
    jadwalDateKey = dateKey(now);
  } catch (e) {
    jadwalMentah = null;
    jadwal = null;
    offline = true;
  }
  sedangMuatJadwal = false;
  renderOffline();
}

function sinkronkanKoreksi() {
  if (!jadwalMentah) return;
  const koreksi = loadKoreksiWaktu();
  const serial = JSON.stringify(koreksi);
  if (serial === koreksiTerakhir) return;
  jadwal = applyKoreksiWaktu(jadwalMentah, koreksi);
  koreksiTerakhir = serial;
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

function mulaiIqomah(state, { putarNada = true } = {}) {
  stopMurotal();
  const now = Date.now();
  if (harusResumeIqomah(bacaIqomahState(), state.key, now)) {
    // Sudah ada hitung mundur berjalan buat sholat yang sama (mis. balik
    // dari refresh) - lanjutkan pakai endTime lama, jangan reset ke awal.
    tampilkan("iqomah");
    return;
  }
  // Fase Adzan dan fase Iqomah dua durasi terpisah, berurutan (bukan dipotong
  // dari total yang sama): adzan penuh sesuai menit di setting Adzan, BARU
  // iqomah dihitung penuh sesuai menit jeda di setting Iqomah sholat ini.
  // Dihitung dari iq.start (jam azan ASLI dari jadwal), BUKAN dari `now` -
  // kalau dihitung dari `now`, mulaiIqomah() yang kepanggil telat (mis.
  // harusResumeIqomah gagal resume karena state lama sudah lewat) bakal
  // reset balik ke fase adzan penuh walau azan aslinya sudah lama lewat
  // (bug: ganti setting durasi adzan pas lagi iqomah bikin layar balik ke
  // "Waktu X Telah Masuk" dengan durasi adzan yang baru).
  localStorage.setItem(IQOMAH_KEY, JSON.stringify({
    ...state,
    nadaDimainkan: !putarNada,
  }));
  tampilkan("iqomah");
}

function mulaiJumat(state) {
  stopMurotal();
  localStorage.setItem(JUMAT_KEY, JSON.stringify(state));
  tampilkan("jumat");
}

function tick() {
  const now = new Date();
  $("jam").textContent = formatJamWIB(now);
  renderTanggal(now);
  renderHeroKegiatan(now);
  tickJamAnalog(now);

  if (!jadwal) return; // belum ada data
  sinkronkanKoreksi();
  const iqSettings = loadIqomah();
  const adzanMenit = loadAdzan().menit;
  const tw = tarawihState(now, jadwal, iqSettings, adzanMenit);
  const keputusan = tentukanAlur({
    now,
    jadwal,
    iqomah: iqSettings,
    hening: loadHening(),
    adzanMenit,
    jumat: { ...loadJumatSettings(), adaSlide: loadJumatSlides().length > 0 },
    tarawih: tw ? { view: "hening", state: { startTime: tw.startTime, endTime: tw.endTime, putarNada: true } } : null,
  });
  const putarNada = bolehPutarNadaPadaTransisi(alurAwalSudahDinilai);
  if (keputusan) {
    const view = viewAktif();
    if (keputusan.view === "iqomah" && view !== "iqomah") mulaiIqomah(keputusan.state, { putarNada });
    else if (keputusan.view === "jumat" && view !== "jumat") mulaiJumat(keputusan.state);
    else if (keputusan.view === "hening" && view !== "hening") {
      stopMurotal();
      mulaiHening(keputusan.state.endTime, {
        startTime: keputusan.state.startTime,
        putarNada: putarNada && keputusan.state.putarNada !== false,
      });
    }
    alurAwalSudahDinilai = true;
    return;
  }

  alurAwalSudahDinilai = true;

  // View fase tidak menentukan perpindahan sendiri. Saat keputusan alur
  // berakhir, pemilik tunggal ini membersihkan state dan kembali normal.
  if (["iqomah", "jumat", "hening"].includes(viewAktif())) {
    localStorage.removeItem(IQOMAH_KEY);
    localStorage.removeItem(JUMAT_KEY);
    localStorage.removeItem("heningAktif");
    tampilkan("sholat");
    return;
  }

  // Murotal perlu dipantau walau layar sekunder sedang tampil. Kalau tidak,
  // audio baru mulai saat rotasi selesai dan terasa terlambat.
  tickMurotal(now, jadwal, modeDemo);
  if (viewAktif() !== "sholat") return;

  const next = nextSholat(now, jadwal);
  renderGrid(next);
  $("next-nama").textContent = next.label;
  $("countdown-waktu").textContent = fmtDurasi(Math.max(0, Math.ceil((next.time - now) / 1000)));

  tickHalamanSholat(now);
}

let intervalId = null;

function mulaiPemantauWaktu() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    const now = new Date();
    // Jadwal tetap dimuat ulang ketika hari berganti, sekalipun layar saat itu
    // sedang menampilkan QR, kegiatan, atau poster.
    if (jadwalDateKey && dateKey(now) !== jadwalDateKey) muatJadwal(now);
    tick();
  }, 1000);
}

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
  mulaiPemantauWaktu();
  // Pemantau waktu sengaja tidak dihentikan saat router berpindah layar;
  // ia memastikan Adzan/iqomah memotong layar rotasi tepat pada waktunya.
  return () => {};
}
