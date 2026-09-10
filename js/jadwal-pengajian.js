import { parseHM } from "./waktu.js";
import { cloudSet } from "./cloud.js";

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
  cloudSet(KEY, arr);
}

// "YYYY-MM-DD" -> Date lokal awal hari (hindari parsing UTC dari new Date("YYYY-MM-DD")).
export function parseTanggal(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// Date -> "YYYY-MM-DD" lokal (kebalikan parseTanggal).
export function toISODateLokal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Hari (0=Minggu..6=Sabtu) hasil deteksi dari tanggal - dipakai buat teks
// konfirmasi "Hari pengulangan" di form, biar tanggal & hari gak pernah beda.
export function hariDariTanggal(tanggalStr) {
  return parseTanggal(tanggalStr).getDay();
}

// ---------- Kegiatan tanggal khusus (sekali tampil) ----------
function kejadianTanggal(entry) {
  return parseHM(entry.jam || "00:00", parseTanggal(entry.tanggal));
}

// ---------- Kegiatan mingguan (seri berulang dari tanggalMulai, step 7 hari) ----------
// Seri: { nama, jam, tanggalMulai, akhir: {jenis:"tanpa-batas"} | {jenis:"tanggal",sampai} |
//   {jenis:"jumlah",n}, rotasiPengisi: [nama,...],
//   override: {"YYYY-MM-DD": {pengisi?, jam?, dikecualikan?}} } - jam per-tanggal opsional,
//   kosongkan override.jam buat pakai jam default seri.

function batasJumlahOccurrence(series) {
  const akhir = series.akhir || { jenis: "tanpa-batas" };
  if (akhir.jenis === "jumlah") return Math.max(0, akhir.n || 0);
  if (akhir.jenis === "tanggal") {
    if (!akhir.sampai) return 0;
    const mulai = parseTanggal(series.tanggalMulai);
    const sampai = parseTanggal(akhir.sampai);
    if (sampai < mulai) return 0;
    return Math.floor((sampai - mulai) / (7 * 86400000)) + 1;
  }
  return Infinity;
}

function tanggalOccurrence(series, idx) {
  const d = parseTanggal(series.tanggalMulai);
  d.setDate(d.getDate() + idx * 7);
  return d;
}

// Pengisi efektif tanggal ke-idx: override manual menang, lalu rotasi
// round-robin (kalau diaktifkan), default kosong ("belum ditentukan").
export function pengisiOccurrence(series, idx, tanggalStr) {
  const ov = series.override && series.override[tanggalStr];
  if (ov && ov.pengisi !== undefined) return ov.pengisi;
  if (series.rotasiPengisi && series.rotasiPengisi.length) {
    return series.rotasiPengisi[idx % series.rotasiPengisi.length];
  }
  return "";
}

export function dikecualikanOccurrence(series, tanggalStr) {
  return !!(series.override && series.override[tanggalStr] && series.override[tanggalStr].dikecualikan);
}

// Jam efektif tanggal ke-idx: override manual menang, else jam default seri.
export function jamOccurrence(series, tanggalStr) {
  const ov = series.override && series.override[tanggalStr];
  if (ov && ov.jam !== undefined) return ov.jam;
  return series.jam || "";
}

// Daftar kejadian buat tabel pratinjau admin - dibatasi `max` (default 12)
// karena seri "tanpa batas" scr matematis tak berhingga.
export function daftarOccurrenceSeri(series, max = 12) {
  if (!series.tanggalMulai) return [];
  const n = Math.min(max, batasJumlahOccurrence(series));
  const hasil = [];
  for (let idx = 0; idx < n; idx++) {
    const tanggal = tanggalOccurrence(series, idx);
    const tanggalStr = toISODateLokal(tanggal);
    hasil.push({
      idx,
      tanggal,
      tanggalStr,
      jam: jamOccurrence(series, tanggalStr),
      pengisi: pengisiOccurrence(series, idx, tanggalStr),
      dikecualikan: dikecualikanOccurrence(series, tanggalStr),
    });
  }
  return hasil;
}

// Semua kejadian mendatang (belum lewat, tidak dikecualikan) dari seri ini.
// Seri "tanpa batas" cuma masuk akal tampilkan yg terdekat (berulang
// selamanya, gak ada titik "sisa semua"). Seri terbatas (akhir tanggal/
// jumlah) tampilkan SEMUA sisa pertemuannya - itu direncanakan sbg N
// pertemuan konkret ("setelah 4 kali pertemuan" = 4 kejadian beneran),
// bukan 1 slot berulang yg pengisinya gantian & cuma nongol 1 di layar.
// Batas 520 minggu (~10 tahun) jaga-jaga dari seri tanpa-batas + data aneh.
export function occurrenceMendatangSeri(series, now) {
  if (!series.tanggalMulai) return [];
  const akhir = series.akhir || { jenis: "tanpa-batas" };
  const batas = Math.min(batasJumlahOccurrence(series), 520);
  const hasil = [];
  for (let idx = 0; idx < batas; idx++) {
    const tanggal = tanggalOccurrence(series, idx);
    const tanggalStr = toISODateLokal(tanggal);
    if (dikecualikanOccurrence(series, tanggalStr)) continue;
    const jam = jamOccurrence(series, tanggalStr);
    const waktu = parseHM(jam || "00:00", tanggal);
    if (waktu < now) continue;
    hasil.push({ tanggal: waktu, jam, pengisi: pengisiOccurrence(series, idx, tanggalStr), idx });
    if (akhir.jenis === "tanpa-batas") break;
  }
  return hasil;
}

// Kejadian mendatang pertama - dipakai di mana pun cuma butuh "yg berikutnya
// aja" (mis. form admin). null kalau serinya sudah habis.
export function kejadianBerikutnyaSeri(series, now) {
  const hasil = occurrenceMendatangSeri(series, now);
  return hasil.length ? hasil[0] : null;
}

export function entriAktif(now, entries) {
  const hariIni = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return entries
    .flatMap((e) => {
      if (e.tipe === "mingguan") {
        return occurrenceMendatangSeri(e, now).map((occ) => ({ ...e, _waktu: occ.tanggal, _pengisi: occ.pengisi, _jam: occ.jam }));
      }
      if (parseTanggal(e.tanggal) < hariIni) return []; // tanggal lampau disembunyikan
      return [{ ...e, _waktu: kejadianTanggal(e), _pengisi: e.pengisi, _jam: e.jam }];
    })
    .sort((a, b) => a._waktu - b._waktu);
}
