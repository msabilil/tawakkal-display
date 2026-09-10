import { SHOLAT, DEFAULT_MUROTAL } from "./config.js";
import { parseHM } from "./waktu.js";
import { cloudSet } from "./cloud.js";

const KEY = "murotalSettings";

export function loadMurotal() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    return {
      ...DEFAULT_MUROTAL,
      ...s,
      perSholat: { ...DEFAULT_MUROTAL.perSholat, ...(s.perSholat || {}) },
      posisi: { ...DEFAULT_MUROTAL.posisi, ...(s.posisi || {}) },
      playlist: Array.isArray(s.playlist) ? s.playlist : DEFAULT_MUROTAL.playlist,
    };
  } catch {
    return { ...DEFAULT_MUROTAL };
  }
}

export function saveMurotal(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
  cloudSet(KEY, s);
}

// Sholat yang jendela murotalnya sedang aktif, atau null.
// Jendela key = [jamSholat - mulaiMenit, jamSholat - berhentiMenit).
// paksa: dipakai mode Demo Layar (?demo=1) biar murotal ikut kedengaran tanpa
// nunggu jendela waktu asli - tetap hormati toggle aktif & perSholat.
export function murotalWindow(now, jadwal, settings, paksa) {
  if (!settings.aktif) return null;
  if (paksa) {
    const s = SHOLAT.find((x) => settings.perSholat[x.key]);
    return s ? { key: s.key } : null;
  }
  for (const { key } of SHOLAT) {
    if (!settings.perSholat[key]) continue;
    const t = parseHM(jadwal[key], now);
    const start = new Date(t.getTime() - settings.mulaiMenit * 60000);
    const end = new Date(t.getTime() - settings.berhentiMenit * 60000);
    if (now >= start && now < end) return { key };
  }
  return null;
}

import { getMedia, cloudUrlUntukMedia } from "./media-db.js";

let audioEl = null, indikatorEl = null, labelEl = null, overlayEl = null;
let sedangMain = false;
let objectUrl = null;         // URL blob offline yang perlu di-revoke
let gagalBeruntun = 0;        // guard anti-loop kalau semua track gagal
let simpanTerakhir = 0;       // throttle simpan posisi
let winAktifKey = null;       // key jendela sholat yang sedang diamati tickMurotal (snapshot per tick)
let jendelaGagal = null;      // key jendela yang baru saja gagal total, biar tidak retry tiap detik

export function initMurotal(refs) {
  audioEl = refs.audioEl;
  indikatorEl = refs.indikatorEl;
  labelEl = refs.labelEl;
  overlayEl = refs.overlayEl;

  audioEl.addEventListener("ended", () => {
    if (!sedangMain) return;
    gagalBeruntun = 0;
    majuTrack(+1, 0);
  });
  audioEl.addEventListener("error", () => {
    if (!sedangMain) return;
    gagalBeruntun++;
    const s = loadMurotal();
    if (gagalBeruntun >= s.playlist.length) { hentikan(false, true); return; } // semua gagal
    majuTrack(+1, 0);
  });
  audioEl.addEventListener("timeupdate", () => {
    if (!sedangMain) return;
    const kini = Date.now();
    if (kini - simpanTerakhir > 5000) { simpanTerakhir = kini; simpanPosisi(); }
  });

  if (overlayEl) {
    overlayEl.addEventListener("click", () => {
      audioEl.play().catch(() => {});
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
    // Lokal dulu (kerja offline, tanpa network) - baru fallback ke URL cloud
    // kalau blob-nya tidak ada di IndexedDB device ini (mis. diupload dari
    // laptop admin yang beda device, kiosk ini belum pernah punya salinannya).
    const blob = await getMedia(item.mediaKey);
    if (blob) {
      objectUrl = URL.createObjectURL(blob);
      audioEl.src = objectUrl;
    } else {
      const urlCloud = cloudUrlUntukMedia(item.mediaKey);
      if (!urlCloud) return false;
      audioEl.src = urlCloud;
    }
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
  if (!ok) {
    gagalBeruntun++;
    if (gagalBeruntun < s.playlist.length) majuTrack(+1, 0); else hentikan(false, true);
    return;
  }
  audioEl.currentTime = detik || 0;
  try {
    await audioEl.play();
    if (overlayEl) overlayEl.hidden = true;
    tampilIndikator(item.label);
  } catch (err) {
    // Cuma tampilkan overlay unlock kalau memang autoplay diblok browser.
    // NotSupportedError (track gagal dimuat) / AbortError (src diganti duluan
    // oleh percobaan track berikutnya) bukan soal autoplay - biarkan handler
    // "error" pada elemen audio yang menangani retry-nya.
    if (overlayEl && err && err.name === "NotAllowedError") overlayEl.hidden = false;
  }
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

// gagalTotal: true kalau stop ini dipicu karena satu putaran penuh playlist
// gagal (bukan window sholat selesai) - dipakai buat menandai jendela ini
// supaya tidak di-retry tiap detik selama jendela masih terbuka.
function hentikan(simpan, gagalTotal) {
  if (simpan && audioEl && !audioEl.paused) simpanPosisi();
  if (audioEl) { audioEl.pause(); }
  if (indikatorEl) indikatorEl.hidden = true;
  if (overlayEl) overlayEl.hidden = true;
  sedangMain = false;
  gagalBeruntun = 0;
  if (gagalTotal) jendelaGagal = winAktifKey;
}

export function tickMurotal(now, jadwal, paksa) {
  if (!audioEl) return;
  const s = loadMurotal();
  const win = murotalWindow(now, jadwal, s, paksa);
  winAktifKey = win ? win.key : null;
  if (!win || win.key !== jendelaGagal) jendelaGagal = null; // keluar jendela gagal -> reset ingatan
  if (win && !sedangMain && win.key !== jendelaGagal) {
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
