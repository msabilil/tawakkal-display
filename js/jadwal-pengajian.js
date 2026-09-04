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
