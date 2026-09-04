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

import { NAMA_MASJID, PENGUMUMAN, WAKTU_HARIAN } from "./config.js";
import { getJadwal, dateKey } from "./api.js";
import { loadIqomah } from "./settings.js";
import { loadOverride, terapkanOverride } from "./testing.js";
import { loadTampilan } from "./tampilan.js";
import { ICONS } from "./icons.js";

const IQOMAH_KEY = "iqomahAktif";

// State modul
let jadwal = null;         // {imsak,subuh,terbit,dzuhur,ashar,maghrib,isya}
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
  const tampilan = loadTampilan();
  $("topbar").hidden = !tampilan.header;
  $("marquee-bar").hidden = !tampilan.maklumat;
}

function renderMarquee() {
  const item = (teks) => `<span class="marquee-item"><span class="marquee-bullet">&#10022;</span>${teks}</span>`;
  const isi = PENGUMUMAN.map(item).join("");
  $("marquee-track").innerHTML = isi + isi; // digandakan biar animasi loop mulus
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
  for (const { key, label, icon } of WAKTU_HARIAN) {
    const aktif = next && next.key === key;
    const div = document.createElement("div");
    div.className = "kartu-waktu" + (aktif ? " aktif" : "");
    div.innerHTML = `
      ${aktif ? '<span class="kartu-pita">Waktu Berikutnya</span>' : ""}
      <span class="kartu-ikon">${ICONS[icon] || ""}</span>
      <span class="nama">${label}</span>
      <span class="jam">${jadwal[key] || "--:--"}</span>
      <span class="unit">WIB</span>
    `;
    grid.appendChild(div);
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

function renderTesting() {
  $("testing-indikator").hidden = !loadOverride().aktif;
}

const IKON_MAXIMIZE = `<path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" />`;
const IKON_MINIMIZE = `<path d="M15 19v-2a2 2 0 0 1 2 -2h2" /><path d="M15 5v2a2 2 0 0 0 2 2h2" /><path d="M5 15h2a2 2 0 0 1 2 2v2" /><path d="M5 9h2a2 2 0 0 0 2 -2v-2" />`;

function setupFullscreen() {
  const btn = $("tombol-fullscreen");
  const svg = btn.querySelector("svg");
  function sync() {
    const full = !!document.fullscreenElement;
    svg.innerHTML = full ? IKON_MINIMIZE : IKON_MAXIMIZE;
    btn.setAttribute("aria-label", full ? "Keluar layar penuh" : "Layar penuh");
  }
  btn.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });
  document.addEventListener("fullscreenchange", sync);
  sync();
}

async function muatJadwal(now) {
  try {
    const r = await getJadwal(now);
    jadwal = terapkanOverride(r.jadwal);
    offline = r.fromCache;
    fetchedAt = r.fetchedAt;
    jadwalDateKey = dateKey(now);
  } catch (e) {
    jadwal = null;
    offline = true;
  }
  renderOffline();
  renderTesting();
}

function mulaiIqomah(iq) {
  const endTime = new Date(Date.now() + iq.sisaDetik * 1000).toISOString();
  localStorage.setItem(IQOMAH_KEY, JSON.stringify({ key: iq.key, label: iq.label, endTime }));
  location.href = "iqomah.html";
}

function tick() {
  const now = new Date();
  $("jam").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  renderTanggal(now);

  if (!jadwal) return; // belum ada data

  const iqSettings = loadIqomah();
  const iq = iqomahState(now, jadwal, iqSettings);
  if (iq) {
    mulaiIqomah(iq);
    return;
  }

  const next = nextSholat(now, jadwal);
  renderGrid(next);
  $("next-nama").textContent = next.label;
  $("countdown-waktu").textContent = fmtDurasi(Math.max(0, Math.ceil((next.time - now) / 1000)));
}

async function init() {
  renderStatis();
  renderMarquee();
  setupFullscreen();
  localStorage.removeItem(IQOMAH_KEY); // kembali dari iqomah.html, bersihkan state lama
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

// Guard: jangan auto-jalan saat file ini di-import untuk unit test (app.test.html),
// yang tidak punya elemen DOM layar utama seperti #jam.
if (typeof document !== "undefined" && document.getElementById("jam")) {
  init();
}
