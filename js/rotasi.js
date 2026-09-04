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
  slotEl.dataset.aktif = state.aktif;
  slotEl.innerHTML = htmlBaru;
}

