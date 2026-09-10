// Data & state mode Tarawih (layar hening otomatis setelah iqomah Isya,
// khusus bulan Ramadhan). Default-nya deteksi otomatis pakai kalender
// Hijriah bawaan browser (Intl, kalender "islamic" - sama seperti yang
// dipakai app.js buat tanggal Hijriah di layar utama, sengaja disamakan
// biar tidak beda 1 hari antara dua tempat), tapi bisa selisih dari
// penetapan resmi Kemenag (beda metode hisab/rukyat) - makanya admin bisa
// override LANGSUNG pakai tanggal Masehi mulai/selesai Ramadhan yang resmi
// diumumkan (lihat isRamadhanEfektif), bukan angka koreksi abstrak.
import { DEFAULT_TARAWIH } from "./config.js";
import { parseHM } from "./waktu.js";
import { cloudSet } from "./cloud.js";
import { parseTanggal } from "./jadwal-pengajian.js";

const KEY_SETTINGS = "tarawihSettings";

// try/catch sengaja - sama seperti renderTanggal() di app.js, jaga-jaga
// browser/webview kiosk yang kalender Hijriahnya tidak lengkap. Kalau gagal,
// anggap bukan Ramadhan (bukan throw) supaya tick() utama tidak ikut macet.
function bulanHijriah(date) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic", { month: "numeric" }).formatToParts(date);
    return Number(parts.find((p) => p.type === "month").value);
  } catch {
    return null;
  }
}

// Ramadhan = bulan ke-9 kalender Hijriah.
export function isRamadhan(date) {
  return bulanHijriah(date) === 9;
}

export function tanggalHijriahLabel(date) {
  try {
    return new Intl.DateTimeFormat("id-ID-u-ca-islamic", { day: "numeric", month: "long", year: "numeric" }).format(date);
  } catch {
    return "-";
  }
}

export function loadTarawihSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_SETTINGS));
    return { ...DEFAULT_TARAWIH, ...(s || {}) };
  } catch {
    return { ...DEFAULT_TARAWIH };
  }
}

export function saveTarawihSettings(settings) {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  cloudSet(KEY_SETTINGS, settings);
}

// Akhir hari (23:59:59.999) lokal dari "YYYY-MM-DD" - dipakai batas akhir
// tanggalSelesai supaya inklusif sepanjang hari itu, bukan cuma jam 00:00.
function akhirHari(str) {
  const d = parseTanggal(str);
  d.setHours(23, 59, 59, 999);
  return d;
}

// nonaktif: matikan total deteksi Ramadhan musim ini, apapun tanggalnya
// (mis. tidak ingin tarawih otomatis tahun ini) - menang atas apa pun di
// bawah. tanggalMulai/tanggalSelesai ("YYYY-MM-DD", Masehi): kalau admin
// mengisi KEDUANYA, itu dipakai LANGSUNG sebagai rentang Ramadhan (override
// penuh, sesuai tanggal resmi yang diumumkan) - kalender Hijriah otomatis
// diabaikan. Kalau salah satu/kedua kosong, fallback ke deteksi otomatis.
export function isRamadhanEfektif(now, settings) {
  if (settings.nonaktif) return false;
  if (settings.tanggalMulai && settings.tanggalSelesai) {
    return now >= parseTanggal(settings.tanggalMulai) && now <= akhirHari(settings.tanggalSelesai);
  }
  return isRamadhan(now);
}

const SEHARI_MS = 24 * 60 * 60 * 1000;

// Aktif kalau: bulan Ramadhan (atau dipaksa aktif), dan sekarang di window
// [selesai iqomah Isya + jeda, + durasi tarawih].
export function tarawihState(now, jadwal, iqomahSettings, adzanMenit) {
  const settings = loadTarawihSettings();
  // Malam tarawih ke-1 jatuh MALAM SEBELUM hari puasa ke-1 (hari Hijriah
  // ganti pas maghrib, bukan tengah malam) - jadi begitu lewat maghrib/isya,
  // "hari ini" secara Hijriah sudah jadi "besok" (Masehi). +1 hari di sini
  // pas cek Ramadhan supaya malam terakhir Sya'ban ikut terhitung tarawih,
  // dan malam terakhir Ramadhan (menjelang Lebaran, tidak ada puasa
  // sesudahnya) otomatis TIDAK ikut - berlaku sama buat mode otomatis
  // (kalender Hijriah) maupun tanggal manual.
  const tanggalTarawih = new Date(now.getTime() + SEHARI_MS);
  if (!isRamadhanEfektif(tanggalTarawih, settings)) return null;

  const isyaSet = iqomahSettings.isya || {};
  const iqomahMenit = isyaSet.aktif && isyaSet.menit > 0 ? isyaSet.menit : 0;
  const isyaStart = parseHM(jadwal.isya, now);
  const isyaIqomahEnd = new Date(isyaStart.getTime() + (adzanMenit + iqomahMenit) * 60000);

  const mulai = new Date(isyaIqomahEnd.getTime() + settings.jedaMenit * 60000);
  const selesai = new Date(mulai.getTime() + settings.durasiMenit * 60000);
  if (now >= mulai && now < selesai) return { endTime: selesai.toISOString() };
  return null;
}
