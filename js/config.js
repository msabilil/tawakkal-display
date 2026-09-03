export const ID_KOTA = "1219";
export const NAMA_MASJID = "Masjid At-Tawakkal 2";
export const LOKASI_LABEL = "Astana Anyar, Kota Bandung";

// Semua waktu yang ditampilkan di grid layar utama, urut kronologis.
// `sholat: true` menandai waktu yang punya iqomah dan dihitung sebagai "sholat berikutnya".
// Imsak & Terbit hanya informasi, bukan waktu sholat.
export const WAKTU_HARIAN = [
  { key: "imsak", label: "Imsak", icon: "moon-stars", sholat: false },
  { key: "subuh", label: "Subuh", icon: "sunrise", sholat: true },
  { key: "terbit", label: "Terbit", icon: "sun-low", sholat: false },
  { key: "dzuhur", label: "Dzuhur", icon: "sun-high", sholat: true },
  { key: "ashar", label: "Ashar", icon: "sun", sholat: true },
  { key: "maghrib", label: "Maghrib", icon: "sunset", sholat: true },
  { key: "isya", label: "Isya", icon: "moon", sholat: true },
];

export const SHOLAT = WAKTU_HARIAN.filter((w) => w.sholat).map(({ key, label }) => ({ key, label }));

export const DEFAULT_IQOMAH = {
  subuh: { menit: 10, aktif: true },
  dzuhur: { menit: 10, aktif: true },
  ashar: { menit: 10, aktif: true },
  maghrib: { menit: 5, aktif: true },
  isya: { menit: 10, aktif: true },
};
