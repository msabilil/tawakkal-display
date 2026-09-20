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
