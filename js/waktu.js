// Helper waktu murni yang dipakai bersama oleh app.js, murotal.js, dan
// jadwal-pengajian.js. Dipisah agar tidak ada circular import.
const ZONA_WAKTU = "Asia/Jakarta";
const FORMATTER_WIB = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_WAKTU,
  calendar: "gregory",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const FORMATTER_TANGGAL_WIB = new Intl.DateTimeFormat("id-ID", {
  timeZone: ZONA_WAKTU,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const FORMATTER_HIJRIAH_WIB = new Intl.DateTimeFormat("en-u-ca-islamic", {
  timeZone: ZONA_WAKTU,
  day: "numeric",
  month: "numeric",
  year: "numeric",
});
const BULAN_HIJRIAH = [
  "Muharam", "Safar", "Rabiulawal", "Rabiulakhir",
  "Jumadilawal", "Jumadilakhir", "Rajab", "Syakban",
  "Ramadan", "Syawal", "Zulkaidah", "Zulhijah",
];
const KEYS_KOREKSI = ["subuh", "dzuhur", "ashar", "maghrib", "isya"];

function bagianWIB(date) {
  const parts = FORMATTER_WIB.formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]));
}

export function dateKeyWIB(date) {
  const p = bagianWIB(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function dayWIB(date) {
  const p = bagianWIB(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

export function formatJamWIB(date) {
  const p = bagianWIB(date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:${String(p.second).padStart(2, "0")}`;
}

export function formatTanggalWIB(date) {
  return FORMATTER_TANGGAL_WIB.format(date);
}

// Beberapa browser TV memiliki data lokalisasi Hijriah Indonesia yang tidak
// lengkap: angka kalendernya benar, tetapi nama bulan/era dapat tercampur
// dengan kalender Masehi. Ambil hanya angka dari Intl, lalu bentuk label
// Indonesia sendiri agar tampilan konsisten lintas-perangkat.
export function formatTanggalHijriahWIB(date) {
  try {
    const bagian = Object.fromEntries(FORMATTER_HIJRIAH_WIB.formatToParts(date)
      .filter(({ type }) => ["day", "month", "year"].includes(type))
      .map(({ type, value }) => [type, Number(value)]));
    if (!Number.isInteger(bagian.day) || !Number.isInteger(bagian.month)
      || !Number.isInteger(bagian.year) || !BULAN_HIJRIAH[bagian.month - 1]) return "";
    return `${bagian.day} ${BULAN_HIJRIAH[bagian.month - 1]} ${bagian.year} H`;
  } catch {
    return "";
  }
}

function waktuWIBKeEpoch(parts, jam, menit) {
  const wallTime = Date.UTC(parts.year, parts.month - 1, parts.day, jam, menit, 0, 0);
  const zonaParts = bagianWIB(new Date(wallTime));
  const zonaWallTime = Date.UTC(zonaParts.year, zonaParts.month - 1, zonaParts.day, zonaParts.hour, zonaParts.minute, zonaParts.second, 0);
  return new Date(wallTime - (zonaWallTime - wallTime));
}

export function parseHM(hhmm, baseDate) {
  const [h, m] = hhmm.split(":").map(Number);
  const parts = bagianWIB(baseDate);
  return waktuWIBKeEpoch(parts, h, m);
}

export function normalizeKoreksiMenit(value) {
  return Number.isInteger(value) && value >= -30 && value <= 30 ? value : 0;
}

function tambahMenit(hhmm, menit) {
  const [jam, menitAwal] = String(hhmm).split(":").map(Number);
  if (!Number.isInteger(jam) || !Number.isInteger(menitAwal)) return hhmm;
  const total = (jam * 60 + menitAwal + menit + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function applyKoreksiWaktu(jadwal, koreksi = {}) {
  const hasil = { ...jadwal };
  for (const key of KEYS_KOREKSI) {
    hasil[key] = tambahMenit(jadwal[key], normalizeKoreksiMenit(koreksi[key]));
  }
  return hasil;
}

// Ringkasan publik untuk admin/klien: jadwal mentah yang berlaku hari ini
// dibandingkan dengan waktu setelah koreksi, tanpa mengubah objek sumber.
export function ringkasKoreksiWaktu(jadwal, koreksi = {}) {
  const berlaku = applyKoreksiWaktu(jadwal, koreksi);
  return Object.fromEntries(KEYS_KOREKSI.map((key) => [key, {
    asli: jadwal[key],
    berlaku: berlaku[key],
  }]));
}
